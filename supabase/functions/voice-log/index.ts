/** Voice Log (FR-VOICE-1..4): audio inline ke Gemini, transkrip + transaksi. Kuota 'automation'. */
import { generateJson } from '../_shared/ai.ts';
import { adminClient, requireUser } from '../_shared/auth.ts';
import { VoiceRequest } from '../_shared/contracts.ts';
import { runAiJob } from '../_shared/guard.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { normalizeVoice } from '../_shared/normalize.ts';
import { VOICE_SCHEMA, voicePrompt } from '../_shared/prompts.ts';

const MAX_VOICE_JSON_BYTES = 10 * 1024 * 1024;

serve(async (req) => {
  const user = await requireUser(req);
  const input = VoiceRequest.safeParse(await readJson(req, MAX_VOICE_JSON_BYTES));
  if (!input.success) throw new HttpError('bad_request', 400);
  const body = input.data;
  const db = adminClient();

  // Muat akun resmi milik pengguna dari DB (tidak mempercayai metadata name/bank/currency dari klien).
  const { data: owned, error: accErr } = await db
    .from('accounts')
    .select('id, name, bank, currency')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(50);
  if (accErr) throw new HttpError('server', 500);
  const accounts = (owned ?? []) as { id: string; name: string; bank: string; currency: string }[];

  const result = await runAiJob(db, user.id, 'voice', 'automation', async () => {
    const mimeType = body.mimeType === 'audio/m4a' ? 'audio/mp4' : body.mimeType;
    const raw = await generateJson(
      voicePrompt({ today: body.today, timezone: body.timezone, defaultCurrency: body.defaultCurrency, accounts, categories: body.categories }),
      VOICE_SCHEMA,
      { mimeType, base64: body.audio },
    );
    const voice = normalizeVoice(raw, { accountIds: accounts.map((a) => a.id), defaultCurrency: body.defaultCurrency, today: body.today, categories: body.categories.map((c) => c.key) });
    // Tidak ada transaksi terbaca (hening/tak jelas) = gagal; runAiJob mengembalikan kuota, sama seperti scan dan import.
    if (voice.items.length === 0) throw new HttpError('unreadable', 422);
    return voice;
  });
  return json(result);
});
