/**
 * Narasi Coach (FR-COACH-2/4): AI hanya menerima ringkasan angka (bukan merchant/nominal mentah)
 * dan hasilnya di-cache per (pengguna, minggu, bahasa) agar AI tidak dipanggil tiap buka layar.
 * Kuota harian `coachNarration` (Free 10, Premium 30) + rate limit 10/menit; cache tidak memakai kuota.
 */
import { generateJson } from '../_shared/ai.ts';
import { adminClient, requireUser } from '../_shared/auth.ts';
import { CoachRequest } from '../_shared/contracts.ts';
import { runAiJob } from '../_shared/guard.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { logEvent } from '../_shared/logger.ts';
import { normalizeCoach } from '../_shared/normalize.ts';
import { COACH_SCHEMA, coachPrompt } from '../_shared/prompts.ts';

serve(
  async (req, ctx) => {
    const user = await requireUser(req);
    const input = CoachRequest.safeParse(await readJson(req));
    if (!input.success) throw new HttpError('bad_request', 400);
    const { lang, weekStart, score, pillars, facts } = input.data;
    const db = adminClient();

    const { data: cached, error: cacheReadError } = await db
      .from('coach_narrations')
      .select('narration, actions, score')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .eq('lang', lang)
      .maybeSingle();
    if (cacheReadError) throw new HttpError('server', 500);
    // Cache dipakai hanya bila skornya masih sama; data baru minggu ini = narasi baru.
    if (cached && cached.score === score) return json({ narration: cached.narration, actions: cached.actions, cached: true });

    // Kuota harian narasi: cache di atas bisa dilewati dengan skor berbeda, jadi panggilan AI tetap dibatasi.
    const result = await runAiJob(db, user.id, 'coach', 'coachNarration', async () => {
      const raw = await generateJson(coachPrompt(lang, { score, pillars, facts }), COACH_SCHEMA);
      const coach = normalizeCoach(raw);
      if (!coach) throw new HttpError('ai_failed', 502);
      return coach;
    });

    const { error: upsertError } = await db
      .from('coach_narrations')
      .upsert({ user_id: user.id, week_start: weekStart, lang, score, narration: result.narration, actions: result.actions });
    if (upsertError) logEvent('error', 'coach_cache_upsert_failed', { userId: user.id, requestId: ctx.requestId, code: upsertError.code });
    return json({ ...result, cached: false });
  },
  { service: 'coach' },
);
