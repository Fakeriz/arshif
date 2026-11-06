/**
 * Tanya Coach (FR-COACH-3, Premium 20 pertanyaan/hari; Free terkunci = kuota 0).
 * FR-COACH-4: AI hanya menerima ringkasan angka dari klien (tanpa merchant, catatan, atau transaksi mentah).
 * Kuota `coachAsk` diambil sebelum AI dipanggil dan dikembalikan bila gagal (runAiJob). Percakapan tidak disimpan.
 */
import { generateJson } from '../_shared/ai.ts';
import { adminClient, requireUser } from '../_shared/auth.ts';
import { AskRequest } from '../_shared/contracts.ts';
import { runAiJob } from '../_shared/guard.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { normalizeAsk } from '../_shared/normalize.ts';
import { ASK_SCHEMA, askPrompt } from '../_shared/prompts.ts';

serve(async (req) => {
  const user = await requireUser(req);
  const input = AskRequest.safeParse(await readJson(req));
  if (!input.success) throw new HttpError('bad_request', 400);
  const { lang, question, history, context } = input.data;
  const db = adminClient();

  const result = await runAiJob(db, user.id, 'coach', 'coachAsk', async () => {
    const raw = await generateJson(askPrompt(lang, { question, history, context }), ASK_SCHEMA);
    const answer = normalizeAsk(raw);
    if (!answer) throw new HttpError('ai_failed', 502);
    return answer;
  });
  return json(result);
});
