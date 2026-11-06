/**
 * Ubah keluaran mentah AI (nominal = string desimal unit besar) menjadi bentuk kontrak (unit terkecil),
 * lalu validasi dengan zod. Murni: tanpa API Deno, diuji jest (src/__tests__/edge-shared.test.ts).
 * Keluaran AI tidak dipercaya: field yang tidak valid dibuang atau diganti nilai aman, bukan diteruskan.
 */
import { CATEGORY_KEYS, ImportResult, ScanResult, VoiceResult, type CoachResult } from './contracts.ts';
import { cleanText, decimalToMinor, nonNegativeMinor, normalizeCurrency, positiveMinor } from './money.ts';

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

const rate = (v: unknown): number | null => {
  const n = Number(str(v).replace('%', '').replace(',', '.').trim());
  return str(v).trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};
const textOrNull = (v: unknown, max: number): string | null => cleanText(str(v)).slice(0, max) || null;
/** Kunci pencocokan nama item vs baris diskon: tanpa diakritik (Ş/S, İ/I), huruf besar, tanpa tanda baca. */
const nameKey = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** null = struk tidak terbaca (total kosong/<= 0): pemanggil mengembalikan kuota + 422. */
export function normalizeScan(raw: unknown, fallbackCurrency = 'IDR'): ScanResult | null {
  const r = (raw ?? {}) as Raw;
  const currency = normalizeCurrency(str(r.currency), fallbackCurrency);
  const total = positiveMinor(str(r.total), currency);
  if (total === null) return null;

  type Item = ScanResult['items'][number];
  type Discount = ScanResult['discounts'][number];
  const items: Item[] = [];
  const discounts: Discount[] = [];
  for (const it of arr(r.items)) {
    const name = cleanText(str(it.name)).slice(0, 120);
    const signed = decimalToMinor(str(it.total), currency);
    if (!name || signed === null) continue;
    // Model kadang memasukkan baris promosi sebagai item bernilai negatif: pindahkan ke diskon.
    if (signed < 0) {
      discounts.push({ label: null, itemName: name, taxRate: rate(it.taxRate), amount: -signed });
      continue;
    }
    const qtyN = Number(str(it.qty) || '1');
    const qty = Number.isFinite(qtyN) && qtyN > 0 ? Math.round(qtyN * 1000) / 1000 : 1;
    const unit = nonNegativeMinor(str(it.unitPrice), currency) ?? Math.round(signed / qty);
    items.push({ name, qty, unitPrice: unit, total: signed, discount: 0, taxRate: rate(it.taxRate) });
  }
  for (const d of arr(r.discounts)) {
    // Diskon boleh tercetak negatif ("-3,45"); yang disimpan selalu besarannya.
    const amount = decimalToMinor(str(d.amount), currency);
    if (amount === null || amount === 0) continue;
    discounts.push({ label: textOrNull(d.label, 120), itemName: textOrNull(d.itemName, 120), taxRate: rate(d.taxRate), amount: Math.abs(amount) });
  }
  // Tempelkan tiap diskon ke item yang namanya sama (nama di struk sering terpotong, jadi cek awalan juga).
  for (const d of discounts) {
    if (!d.itemName) continue;
    const key = nameKey(d.itemName);
    const target =
      items.find((i) => nameKey(i.name) === key) ?? items.find((i) => key.length >= 4 && (nameKey(i.name).startsWith(key) || key.startsWith(nameKey(i.name))));
    if (target) target.discount = Math.min(target.total, target.discount + d.amount);
  }
  const discountSum = discounts.reduce((sum, d) => sum + d.amount, 0);

  const taxLines = arr(r.taxLines)
    .map((l) => {
      const rt = rate(l.rate);
      const tax = nonNegativeMinor(str(l.tax), currency);
      return rt === null || tax === null ? null : { rate: rt, tax, gross: nonNegativeMinor(str(l.gross) || null, currency) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 10);
  const taxTotal = nonNegativeMinor(str(r.taxTotal ?? r.tax) || null, currency) ?? (taxLines.length ? taxLines.reduce((sum, l) => sum + l.tax, 0) : null);
  const discountTotal = nonNegativeMinor(str(r.discountTotal ?? r.discount) || null, currency) ?? (discounts.length ? discountSum : null);

  const conf = (r.confidence ?? {}) as Raw;
  const parsed = ScanResult.safeParse({
    merchant: cleanText(str(r.merchant)).slice(0, 120),
    date: ymd(r.date),
    time: hhmm(r.time),
    currency,
    subtotal: nonNegativeMinor(str(r.subtotal) || null, currency),
    tax: taxTotal,
    service: nonNegativeMinor(str(r.service) || null, currency),
    discount: discountTotal,
    total,
    items: items.slice(0, 80),
    discounts: discounts.slice(0, 80),
    taxLines,
    taxIncluded: r.taxIncluded !== false,
    storeAddress: textOrNull(r.storeAddress, 240),
    storeTaxId: textOrNull(r.storeTaxId, 80),
    receiptNo: textOrNull(r.receiptNo, 60),
    paymentMethod: textOrNull(r.paymentMethod, 60),
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

/** Jawaban Tanya Coach: teks dibersihkan (tanpa em dash), dibatasi panjangnya. */
export function normalizeAsk(raw: unknown): { answer: string } | null {
  const r = (raw ?? {}) as Raw;
  const answer = cleanAnswer(str(r.answer)).slice(0, 1500);
  return answer ? { answer } : null;
}

/** Seperti cleanText, tapi baris baru dipertahankan (daftar singkat). */
function cleanAnswer(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ', ')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l, i, a) => l || (i > 0 && a[i - 1]))
    .join('\n')
    .trim();
}
