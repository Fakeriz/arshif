/**
 * Sinkron kurs (FR-FX-2, sumber disetujui pemilik: Frankfurter/ECB, harian, tanpa kunci API).
 * Dipanggil pg_cron (call_edge) dengan header x-cron-secret, atau admin dari panel /admin (token pengguna admin).
 * Bila API gagal, kurs lama tetap dipakai. Setiap percobaan dicatat di fx_sync_runs (status di panel admin).
 */
import { adminClient, requireUser } from '../_shared/auth.ts';
import { CRON_SECRET } from '../_shared/env.ts';
import { HttpError, json, serve } from '../_shared/http.ts';

const API = 'https://api.frankfurter.dev/v1';
const MIN_HISTORY_DAYS = 30;

/** Bandingkan tanpa bocor waktu (secret tidak bisa ditebak per karakter). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Row = { rate_date: string; code: string; per_usd: string; source: string };

function rowsFor(date: string, rates: Record<string, number>): Row[] {
  // String(number) dari JSON API: presisi sesuai yang diterbitkan ECB (maks ~6 digit signifikan).
  const rows = Object.entries(rates).map(([code, rate]) => ({ rate_date: date, code, per_usd: String(rate), source: 'frankfurter' }));
  rows.push({ rate_date: date, code: 'USD', per_usd: '1', source: 'frankfurter' });
  return rows;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`frankfurter_${res.status}`);
  return (await res.json()) as T;
}

serve(async (req) => {
  const db = adminClient();
  let trigger: 'cron' | 'admin' = 'cron';
  if (!safeEqual(req.headers.get('x-cron-secret') ?? '', CRON_SECRET())) {
    const user = await requireUser(req);
    const { data: isAdmin } = await db.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!isAdmin) throw new HttpError('forbidden', 403);
    trigger = 'admin';
  }
  const log = (run: { ok: boolean; rate_date?: string; codes?: number; error?: string }) =>
    db.from('fx_sync_runs').insert({ trigger, ...run }).then(({ error }) => error && console.error('fx log gagal', error.message));

  let latest: { date: string; rates: Record<string, number> };
  try {
    latest = await fetchJson(`${API}/latest?base=USD`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('fx latest gagal', message);
    await log({ ok: false, error: message.slice(0, 200) });
    return json({ error: 'provider_error', message: 'fx_source_unavailable' }, 502);
  }
  const { error } = await db.from('fx_rates').upsert(rowsFor(latest.date, latest.rates));
  if (error) {
    await log({ ok: false, rate_date: latest.date, error: `fx_rates_${error.code}` });
    throw new HttpError('server', 500);
  }

  // Riwayat untuk konversi transaksi lampau (FR-OCR-5): isi 365 hari bila masih sedikit.
  let backfilled = 0;
  const { data: dates } = await db.from('fx_rates').select('rate_date').eq('code', 'IDR').limit(MIN_HISTORY_DAYS + 1);
  if ((dates?.length ?? 0) < MIN_HISTORY_DAYS) {
    const end = latest.date;
    const start = new Date(Date.parse(`${end}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
    try {
      const series = await fetchJson<{ rates: Record<string, Record<string, number>> }>(`${API}/${start}..${end}?base=USD`);
      const rows = Object.entries(series.rates).flatMap(([date, rates]) => rowsFor(date, rates));
      for (let i = 0; i < rows.length; i += 1000) {
        const { error: e } = await db.from('fx_rates').upsert(rows.slice(i, i + 1000));
        if (e) throw new Error(e.message);
      }
      backfilled = Object.keys(series.rates).length;
    } catch (e) {
      console.error('fx backfill gagal', e instanceof Error ? e.message : e);
    }
  }
  const codes = Object.keys(latest.rates).length + 1;
  await log({ ok: true, rate_date: latest.date, codes });
  return json({ date: latest.date, codes, backfilledDays: backfilled });
});
