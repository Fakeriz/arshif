/**
 * Import rekening koran PDF (FR-PDF-1..4). Kuota 'importPdf'.
 * PDF SELALU dihapus dari storage setelah diproses (berhasil atau gagal): lebih ketat dari PRD (30 hari),
 * karena isinya data bank sensitif dan klien hanya butuh hasil parsingnya.
 */
import { generateJson } from '../_shared/ai.ts';
import { adminClient, assertOwnPath, requireUser, toBase64 } from '../_shared/auth.ts';
import { ImportRequest } from '../_shared/contracts.ts';
import { runAiJob } from '../_shared/guard.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { inspectPdf } from '../_shared/media.ts';
import { normalizeStatement } from '../_shared/normalize.ts';
import { STATEMENT_SCHEMA, statementPrompt } from '../_shared/prompts.ts';

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PAGES = 30;

serve(
  async (req) => {
    const user = await requireUser(req);
    const input = ImportRequest.safeParse(await readJson(req));
    if (!input.success) throw new HttpError('bad_request', 400);
    const { path, accountId, categories } = input.data;
    assertOwnPath(path, user.id);
    const db = adminClient();

    try {
      const { data: account } = await db.from('accounts').select('id, currency').eq('id', accountId).eq('user_id', user.id).maybeSingle();
      if (!account) throw new HttpError('not_found', 404, { message: 'account' });

      const result = await runAiJob(db, user.id, 'import', 'importPdf', async () => {
        const { data: file, error } = await db.storage.from('statements').download(path);
        if (error || !file) throw new HttpError('not_found', 404);
        if (file.size > MAX_BYTES) throw new HttpError('too_large', 413);
        const bytes = new Uint8Array(await file.arrayBuffer());
        inspectPdf(bytes, MAX_PAGES);
        const raw = await generateJson(statementPrompt(account.currency, categories), STATEMENT_SCHEMA, { mimeType: 'application/pdf', base64: toBase64(bytes) });
        const parsed = normalizeStatement(raw, account.currency, categories.map((c) => c.key));
        if (parsed.rows.length === 0) throw new HttpError('unreadable', 422);
        return parsed;
      });
      return json(result);
    } finally {
      await db.storage.from('statements').remove([path]);
    }
  },
  { service: 'import-statement' },
);
