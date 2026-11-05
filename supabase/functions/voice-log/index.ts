/** Voice Log (FR-VOICE-1..4): audio inline ke Gemini, transkrip + transaksi. Kuota 'automation'. */
import { generateJson } from '../_shared/ai.ts';
import { adminClient, requireUser } from '../_shared/auth.ts';
import { VoiceRequest } from '../_shared/contracts.ts';
import { runAiJob } from '../_shared/guard.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { normalizeVoice } from '../_shared/normalize.ts';
import { VOICE_SCHEMA, voicePrompt } from '../_shared/prompts.ts';

serve(async (req) => {
  const user = await requireUser(req);
  const input = VoiceRequest.safeParse(await readJson(req));
  if (!input.success) throw new HttpError('bad_request', 400);
  const body = input.data;
  const db = adminClient();

  // Daftar akun dari klien hanya dipercaya bila memang milik pengguna.
  const { data: owned } = await db.from('accounts').select('id').eq('user_id', user.id);
  const ownedIds = new Set((owned ?? []).map((a: { id: string }) => a.id));
  const accounts = body.accounts.filter((a) => ownedIds.has(a.id));

  const result = await runAiJob(db, user.id, 'voice', 'automation', async () => {
    const mimeType = body.mimeType === 'audio/m4a' ? 'audio/mp4' : body.mimeType;
    const raw = await generateJson(
      voicePrompt({ today: body.today, timezone: body.timezone, defaultCurrency: body.defaultCurrency, accounts }),
      VOICE_SCHEMA,
      { mimeType, base64: body.audio },
    );
    return normalizeVoice(raw, { accountIds: accounts.map((a) => a.id), defaultCurrency: body.defaultCurrency, today: body.today });
  });
  return json(result);
});
