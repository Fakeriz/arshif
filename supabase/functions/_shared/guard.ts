import type { SupabaseClient } from '@supabase/supabase-js';

import { HttpError } from './http.ts';

export type AiKind = 'scan' | 'voice' | 'import' | 'coach';
export type QuotaKey = 'scan' | 'automation' | 'importPdf' | 'coachAsk';

const RATE_LIMIT_PER_MIN = 10; // PRD Bab 9

async function log(db: SupabaseClient, userId: string, kind: AiKind, status: 'ok' | 'failed' | 'limited', startedAt: number, err?: string) {
  await db.from('ai_jobs').insert({ user_id: userId, kind, status, latency_ms: Date.now() - startedAt, error: err?.slice(0, 200) ?? null });
}

/**
 * Jalankan pekerjaan AI dengan aturan PRD:
 *  1. rate limit 10 permintaan AI/menit/pengguna,
 *  2. kuota diambil atomik SEBELUM AI dipanggil (tidak bisa dibalap paralel),
 *  3. kuota dikembalikan bila pekerjaan gagal (pekerjaan gagal tidak memotong kuota),
 *  4. setiap percobaan dicatat di ai_jobs (latensi, status) untuk panel admin.
 */
export async function runAiJob<T>(
  db: SupabaseClient,
  userId: string,
  kind: AiKind,
  quotaKey: QuotaKey | null,
  work: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const since = new Date(startedAt - 60_000).toISOString();
  const { count, error: countError } = await db.from('ai_jobs').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since);
  if (countError) throw new HttpError('server', 500);
  if ((count ?? 0) >= RATE_LIMIT_PER_MIN) {
    await log(db, userId, kind, 'limited', startedAt, 'rate_limited');
    throw new HttpError('rate_limited', 429);
  }

  if (quotaKey) {
    const { data: ok, error } = await db.rpc('quota_try_consume', { p_user: userId, p_key: quotaKey });
    if (error) throw new HttpError('server', 500);
    if (!ok) {
      await log(db, userId, kind, 'limited', startedAt, `quota_${quotaKey}`);
      throw new HttpError('quota', 402, { quotaKey });
    }
  }

  try {
    const result = await work();
    await log(db, userId, kind, 'ok', startedAt);
    return result;
  } catch (e) {
    if (quotaKey) await db.rpc('quota_refund', { p_user: userId, p_key: quotaKey });
    const code = e instanceof HttpError ? e.code : e instanceof Error ? e.message : 'unknown';
    await log(db, userId, kind, 'failed', startedAt, code);
    if (e instanceof HttpError) throw e;
    throw new HttpError('ai_failed', 502);
  }
}
