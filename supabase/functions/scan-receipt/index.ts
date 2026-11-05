/** Scan struk (FR-OCR-2/3): unduh foto dari storage, Gemini ekstrak, validasi, kuota 'scan'. */
import { generateJson } from '../_shared/ai.ts';
import { adminClient, assertOwnPath, requireUser, toBase64 } from '../_shared/auth.ts';
import { ScanRequest } from '../_shared/contracts.ts';
import { runAiJob } from '../_shared/guard.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { normalizeScan } from '../_shared/normalize.ts';
import { SCAN_SCHEMA, scanPrompt } from '../_shared/prompts.ts';

const MAX_BYTES = 8 * 1024 * 1024; // FR-OCR-1

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', webp: 'image/webp' };

serve(async (req) => {
  const user = await requireUser(req);
  const input = ScanRequest.safeParse(await readJson(req));
  if (!input.success) throw new HttpError('bad_request', 400);
  const { path } = input.data;
  assertOwnPath(path, user.id);

  const db = adminClient();
  // Mata uang utama sebagai tebakan bila struk tidak menunjukkan mata uang.
  const { data: profile } = await db.from('profiles').select('main_currency').eq('id', user.id).single();

  const result = await runAiJob(db, user.id, 'scan', 'scan', async () => {
    const { data: file, error } = await db.storage.from('receipts').download(path);
    if (error || !file) throw new HttpError('not_found', 404);
    if (file.size > MAX_BYTES) throw new HttpError('too_large', 413);
    const ext = path.split('.').pop()?.toLowerCase() ?? 'jpg';
    const bytes = new Uint8Array(await file.arrayBuffer());
    const raw = await generateJson(scanPrompt(), SCAN_SCHEMA, { mimeType: MIME[ext] ?? 'image/jpeg', base64: toBase64(bytes) });
    const scan = normalizeScan(raw, profile?.main_currency ?? 'IDR');
    // Total kosong / gambar tak terbaca = gagal; runAiJob mengembalikan kuota (FR-OCR-3).
    if (!scan) throw new HttpError('unreadable', 422);
    return scan;
  });
  return json(result);
});
