import type { SupabaseClient } from '@supabase/supabase-js';

import { HttpError } from './http.ts';

export type AiKind = 'scan' | 'voice' | 'import' | 'coach';
export type QuotaKey = 'scan' | 'automation' | 'importPdf' | 'coachAsk' | 'coachNarration';

const RATE_LIMIT_PER_MIN = 10; // PRD Bab 9

/** Tutup baris ai_jobs yang dibuka ai_job_start dengan hasil akhirnya. */
async function finish(db: SupabaseClient, jobId: string, status: 'ok' | 'failed' | 'limited', startedAt: number, err?: string) {
  await db.from('ai_jobs').update({ status, latency_ms: Date.now() - startedAt, error: err?.slice(0, 200) ?? null }).eq('id', jobId);
}

/**
 * Jalankan pekerjaan AI dengan aturan PRD:
 *  1. rate limit 10 permintaan AI/menit/pengguna: dihitung dan dicatat ('started') dalam satu transaksi
 *     berkunci per pengguna (ai_job_start), jadi permintaan serentak tidak bisa lolos bersama,
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
  const { data: jobId, error: startError } = await db.rpc('ai_job_start', { p_user: userId, p_kind: kind, p_limit: RATE_LIMIT_PER_MIN });
  if (startError) throw new HttpError('server', 500);
  if (!jobId) throw new HttpError('rate_limited', 429);

  if (quotaKey) {
    const { data: ok, error } = await db.rpc('quota_try_consume', { p_user: userId, p_key: quotaKey });
    if (error) {
      await finish(db, jobId, 'failed', startedAt, 'quota_check_failed');
      throw new HttpError('server', 500);
    }
    if (!ok) {
      await finish(db, jobId, 'limited', startedAt, `quota_${quotaKey}`);
      throw new HttpError('quota', 402, { quotaKey });
    }
  }

  try {
    const result = await work();
    await finish(db, jobId, 'ok', startedAt);
    return result;
  } catch (e) {
    if (quotaKey) await db.rpc('quota_refund', { p_user: userId, p_key: quotaKey });
    const code = e instanceof HttpError ? e.code : e instanceof Error ? e.message : 'unknown';
    await finish(db, jobId, 'failed', startedAt, code);
    if (e instanceof HttpError) throw e;
    throw new HttpError('ai_failed', 502);
  }
}
