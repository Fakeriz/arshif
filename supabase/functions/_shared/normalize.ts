/**
 * Ubah keluaran mentah AI (nominal = string desimal unit besar) menjadi bentuk kontrak (unit terkecil),
 * lalu validasi dengan zod. Murni: tanpa API Deno, diuji jest (src/__tests__/edge-shared.test.ts).
 * Keluaran AI tidak dipercaya: field yang tidak valid dibuang atau diganti nilai aman, bukan diteruskan.
 */
import { CATEGORY_KEYS, ImportResult, ScanResult, VoiceResult, type CoachResult } from './contracts.ts';
import { cleanText, nonNegativeMinor, normalizeCurrency, positiveMinor } from './money.ts';

type Raw = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num01 = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
};
const ymd = (v: unknown): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : null);
const hhmm = (v: unknown): string | null => (/^\d{2}:\d{2}$/.test(str(v)) ? str(v) : null);
const category = (v: unknown, fallback = 'other'): (typeof CATEGORY_KEYS)[number] =>
  (CATEGORY_KEYS as readonly string[]).includes(str(v)) ? (str(v) as (typeof CATEGORY_KEYS)[number]) : (fallback as 'other');
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Raw[]) : []);

/** null = struk tidak terbaca (total kosong/<= 0): pemanggil mengembalikan kuota + 422. */
export function normalizeScan(raw: unknown, fallbackCurrency = 'IDR'): ScanResult | null {
  const r = (raw ?? {}) as Raw;
  const currency = normalizeCurrency(str(r.currency), fallbackCurrency);
  const total = positiveMinor(str(r.total), currency);
  if (total === null) return null;
  const items = arr(r.items)
    .map((it) => {
      const qtyN = Number(str(it.qty) || '1');
      const qty = Number.isFinite(qtyN) && qtyN > 0 ? Math.round(qtyN * 1000) / 1000 : 1;
      const lineTotal = nonNegativeMinor(str(it.total), currency);
      const unit = nonNegativeMinor(str(it.unitPrice), currency) ?? (lineTotal !== null ? Math.round(lineTotal / qty) : null);
      const name = cleanText(str(it.name)).slice(0, 120);
      return name && lineTotal !== null && unit !== null ? { name, qty, unitPrice: unit, total: lineTotal } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 80);
  const conf = (r.confidence ?? {}) as Raw;
  const parsed = ScanResult.safeParse({
    merchant: cleanText(str(r.merchant)).slice(0, 120),
    date: ymd(r.date),
    time: hhmm(r.time),
    currency,
    subtotal: nonNegativeMinor(str(r.subtotal) || null, currency),
    tax: nonNegativeMinor(str(r.tax) || null, currency),
    service: nonNegativeMinor(str(r.service) || null, currency),
    discount: nonNegativeMinor(str(r.discount) || null, currency),
    total,
    items,
    categoryKey: category(r.categoryKey),
    confidence: { merchant: num01(conf.merchant), date: num01(conf.date), total: num01(conf.total), items: num01(conf.items) },
  });
  return parsed.success ? parsed.data : null;
}

/** Akun hanya boleh dari daftar milik pengguna yang dikirim klien; selain itu null + petunjuk. */
export function normalizeVoice(raw: unknown, ctx: { accountIds: string[]; defaultCurrency: string; today: string }): VoiceResult {
  const r = (raw ?? {}) as Raw;
  const items = arr(r.items)
    .map((it) => {
      const currency = normalizeCurrency(str(it.currency), ctx.defaultCurrency);
      const amount = positiveMinor(str(it.amount), currency);
      if (amount === null) return null;
      const accountId = ctx.accountIds.includes(str(it.accountId)) ? str(it.accountId) : null;
      const hint = cleanText(str(it.accountHint)).slice(0, 60);
      return {
        type: str(it.type) === 'income' ? ('income' as const) : ('expense' as const),
        merchant: cleanText(str(it.merchant)).slice(0, 120),
        amount,
        currency,
        accountId,
        accountHint: accountId ? null : hint || null,
        categoryKey: category(it.categoryKey),
        date: ymd(it.date) ?? ctx.today,
        note: cleanText(str(it.note)).slice(0, 200) || null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 20);
  return VoiceResult.parse({ transcript: cleanText(str(r.transcript)).slice(0, 2000), items });
}

export function normalizeStatement(raw: unknown, fallbackCurrency: string): ImportResult {
  const r = (raw ?? {}) as Raw;
  const rows = arr(r.rows)
    .map((row) => {
      const currency = normalizeCurrency(str(row.currency), fallbackCurrency);
      const amount = positiveMinor(str(row.amount).replace(/^-/, ''), currency);
      const date = ymd(row.date);
      const description = cleanText(str(row.description)).slice(0, 200);
      if (amount === null || !date || !description) return null;
      return {
        date,
        description,
        type: str(row.type) === 'income' ? ('income' as const) : ('expense' as const),
        amount,
        currency,
        categoryKey: category(row.categoryKey),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 1000);
  const pages = Number.isInteger(r.pages) && (r.pages as number) >= 0 ? (r.pages as number) : 0;
  return ImportResult.parse({ rows, pages });
}

/** Narasi Coach: tepat 3 aksi, tanpa em dash, panjang dibatasi. null = keluaran tidak layak. */
export function normalizeCoach(raw: unknown): Omit<CoachResult, 'cached'> | null {
  const r = (raw ?? {}) as Raw;
  const narration = cleanText(str(r.narration)).slice(0, 800);
  const actions = (Array.isArray(r.actions) ? r.actions : []).map((a) => cleanText(str(a)).slice(0, 160)).filter(Boolean).slice(0, 3);
  if (!narration || actions.length !== 3) return null;
  return { narration, actions };
}
