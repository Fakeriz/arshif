import { localHm } from '@/features/capture/clock';

import { parseNotification, type Capture, type Parsed } from './parser';
import { todayYmd } from '../dates';

type IngestStatus = 'disabled' | 'quota' | 'review' | 'applied' | 'confirmed' | 'dismissed' | 'undone';
export type Ingest = (
  c: Capture,
  p: Parsed,
  date: string,
  time: string,
) => Promise<{
  status: IngestStatus;
  id?: string;
  repeat?: boolean;
  tx_type?: 'expense' | 'transfer';
  category_key?: string;
  to_account_id?: string | null;
}>;

export type AppliedEntry = {
  id: string;
  bank: string;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  time: string;
  txType?: 'expense' | 'transfer';
  categoryKey?: string;
  toAccountId?: string | null;
};

export type ProcessSummary = {
  applied: AppliedEntry[];
  review: number;
  dropped: number;
  /** Ditahan di perangkat: kuota habis atau gagal terkirim. Dicoba lagi pada pemrosesan berikutnya. */
  held: Capture[];
  quotaHit: boolean;
};

/** Tangkapan lebih tua dari ini tidak dicoba lagi (kuota bulan depan tidak berlaku mundur untuk riwayat panjang). */
export const HOLD_MAX_AGE_MS = 35 * 86_400_000;
export const HOLD_MAX = 200;

/**
 * Proses tangkapan secara berurutan (FR-SLOG-2..5). Yang dibuang parser tidak pernah dikirim. Kuota habis:
 * sisanya ditahan tanpa memanggil server lagi. Gagal jaringan: ditahan untuk dicoba ulang.
 */
export async function processCaptures(captures: Capture[], ingest: Ingest, now = Date.now()): Promise<ProcessSummary> {
  const out: ProcessSummary = { applied: [], review: 0, dropped: 0, held: [], quotaHit: false };
  const ordered = [...captures].filter((c) => now - c.postedAt <= HOLD_MAX_AGE_MS).sort((a, b) => a.postedAt - b.postedAt);
  for (const c of ordered) {
    const parsed = parseNotification(c);
    if (!parsed.ok) {
      out.dropped++;
      continue;
    }
    if (out.quotaHit) {
      out.held.push(c);
      continue;
    }
    const at = new Date(c.postedAt);
    const date = todayYmd(at);
    const time = localHm(at);
    let res: Awaited<ReturnType<Ingest>>;
    try {
      res = await ingest(c, parsed, date, time);
    } catch {
      out.held.push(c);
      continue;
    }
    if (res.status === 'disabled') break;
    if (res.status === 'quota') {
      out.quotaHit = true;
      out.held.push(c);
      continue;
    }
    if (res.repeat) continue;
    if (res.status === 'applied' && res.id) {
      out.applied.push({
        id: res.id,
        bank: parsed.bank,
        merchant: parsed.merchant,
        amount: parsed.amount,
        currency: parsed.currency,
        date,
        time,
        txType: res.tx_type,
        categoryKey: res.category_key,
        toAccountId: res.to_account_id,
      });
    } else if (res.status === 'review') {
      out.review++;
    }
  }
  out.held = out.held.slice(-HOLD_MAX);
  return out;
}
