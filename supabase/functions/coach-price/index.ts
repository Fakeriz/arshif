/**
 * Tanya harga wajar (Live Market v2 Fase 5): perkiraan kisaran harga wajar satu aset. Kuota sama dengan Tanya Coach
 * (`coachAsk`, Premium 20/hari; Free 0 = terkunci), diambil sebelum AI dan dikembalikan bila gagal (runAiJob).
 * FR-COACH-4: AI hanya menerima kode, pasar, harga live, harga beli, perubahan %. Tidak ada yang disimpan.
 */
import { generateJson } from '../_shared/ai.ts';
import { adminClient, requireUser } from '../_shared/auth.ts';
import { PriceAskRequest } from '../_shared/contracts.ts';
import { runAiJob } from '../_shared/guard.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { normalizePrice } from '../_shared/normalize.ts';
import { PRICE_SCHEMA, pricePrompt } from '../_shared/prompts.ts';

serve(async (req) => {
  const user = await requireUser(req);
  const input = PriceAskRequest.safeParse(await readJson(req));
  if (!input.success) throw new HttpError('bad_request', 400);
  const { lang, asset } = input.data;

  const result = await runAiJob(adminClient(), user.id, 'coach', 'coachAsk', async () => {
    const answer = normalizePrice(await generateJson(pricePrompt(lang, asset), PRICE_SCHEMA), asset.livePrice, asset.currency);
    if (!answer) throw new HttpError('ai_failed', 502);
    return answer;
  });
  return json(result);
});
