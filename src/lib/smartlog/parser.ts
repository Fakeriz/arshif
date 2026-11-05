import { currencyMeta } from '@/lib/money';

import { smartLogApp } from './apps';

/** Notifikasi mentah dari NotificationListenerService. */
export type Capture = {
  /** Unik per notifikasi (kunci Android + waktu posting), dipakai server untuk idempotensi. */
  key: string;
  pkg: string;
  title: string;
  text: string;
  /** Epoch ms saat notifikasi diterima. */
  postedAt: number;
};

/** Notifikasi dibuang di perangkat dan tidak pernah dikirim ke server. */
export type DropReason = 'unsupported_app' | 'otp' | 'failed' | 'promo' | 'no_keyword' | 'no_amount';

/** Keraguan parser: notifikasi tetap diproses, tapi masuk To Review (FR-SLOG-3). */
export type Doubt = 'type_unclear' | 'topup' | 'multiple_amounts';

export type Parsed = {
  ok: true;
  bank: string;
  type: 'expense' | 'income';
  /** Unit terkecil mata uang. */
  amount: number;
  currency: string;
  merchant: string;
  doubts: Doubt[];
  /** Teks notifikasi tanpa baris saldo/limit, untuk ditampilkan di To Review. */
  excerpt: string;
  /** Sidik konten (package + teks dinormalisasi) untuk deteksi duplikat di server. */
  fingerprint: string;
};

export type ParseResult = Parsed | { ok: false; reason: DropReason };

const OTP = /\b(otp|kode (verifikasi|otentikasi|rahasia|akses|aktivasi)|verification code|one[- ]time|pin\b|m-?pin|password|kata sandi|log ?in|masuk ke akun|perangkat baru|aktivasi|jangan (berikan|bagikan))/i;
const FAILED = /\b(gagal|ditolak|dibatalkan|batal|tidak berhasil|belum berhasil|failed|declined|unsuccessful|pending|tertunda|sedang diproses|dalam proses|menunggu (pembayaran|konfirmasi|persetujuan)|kedaluwarsa|expired)\b/i;
const PROMO = /\b(promo|diskon|voucher|kupon|hadiah|undian|flash ?sale|penawaran|dapatkan|nikmati|buruan|jangan lewatkan|klaim|cashback (s\.?d\.?|hingga|sampai|up to)|giveaway)\b/i;
const TX_KEYWORD = /\b(transaksi|pembayaran|bayar|dibayar|membayar|pembelian|beli|belanja|transfer|kirim|dikirim|mengirim|terima|diterima|menerima|masuk|keluar|debit|didebit|kredit|top ?up|isi saldo|tarik tunai|penarikan|setor|setoran|qris|berkurang|bertambah|terpotong|payment|paid|received|sent|purchase|withdrawal)\b/i;
const BALANCE = /\b(sisa saldo|saldo|balance|sisa limit|limit|available|tersedia|poin|points?)\b/i;
const BALANCE_IS_TX = /\b(berkurang|bertambah|terpotong|didebit|dikredit)\b/i;
const INCOME = /\b(masuk|diterima|terima|menerima|received|kredit|dikredit|bertambah|incoming|refund|pengembalian dana|dana kembali)\b/i;
const EXPENSE = /\b(keluar|pembayaran|bayar|dibayar|membayar|pembelian|beli|belanja|transfer ke|kirim|dikirim|mengirim|debit|didebit|tarik tunai|penarikan|berkurang|terpotong|payment|paid|purchase|sent|qris)\b/i;
const TOPUP = /\b(top ?up|isi saldo)\b/i;

const CUR_TOKEN: Record<string, string> = {
  rp: 'IDR', idr: 'IDR', rupiah: 'IDR', usd: 'USD', 'us$': 'USD', $: 'USD', sgd: 'SGD', s$: 'SGD',
  myr: 'MYR', rm: 'MYR', eur: 'EUR', '€': 'EUR', try: 'TRY', tl: 'TRY', '₺': 'TRY',
};
const NUM = String.raw`\d[\d.,]*\d|\d`;
const AMOUNT_BEFORE = new RegExp(String.raw`(Rp|IDR|US\$|USD|S\$|SGD|MYR|RM|EUR|€|TRY|₺|\$)\s?(${NUM})`, 'gi');
const AMOUNT_AFTER = new RegExp(String.raw`(${NUM})\s?(IDR|rupiah|USD|SGD|MYR|EUR|TRY|TL)\b`, 'gi');

type Money = { index: number; amount: number; currency: string };

/**
 * "50.000", "1.250.000,00", "50,000.00", "12.50" -> unit terkecil. Pemisah terakhir dianggap desimal bila
 * kedua jenis muncul; satu pemisah dengan tepat 3 digit di belakangnya = ribuan. null = format tidak masuk akal.
 */
export function parseAmount(raw: string, currency: string): number | null {
  const exp = currencyMeta(currency).exponent;
  let int = raw;
  let frac = '';
  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    const cut = raw.lastIndexOf(dec);
    int = raw.slice(0, cut);
    frac = raw.slice(cut + 1);
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = raw.split(sep);
    if (parts.length === 2 && parts[1]!.length !== 3) {
      int = parts[0]!;
      frac = parts[1]!;
    }
  }
  const groups = int.split(/[.,]/);
  if (groups.length > 1 && groups.slice(1).some((g) => g.length !== 3)) return null;
  const digits = groups.join('');
  if (!/^\d+$/.test(digits) || (frac && !/^\d{1,2}$/.test(frac))) return null;
  const padded = (frac + '00').slice(0, exp);
  const next = Number((frac + '00')[exp] ?? '0');
  const minor = Number(digits) * 10 ** exp + (padded ? Number(padded) : 0) + (next >= 5 ? 1 : 0);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

function findAmounts(text: string): Money[] {
  const out: Money[] = [];
  for (const m of text.matchAll(AMOUNT_BEFORE)) {
    const currency = CUR_TOKEN[m[1]!.toLowerCase()]!;
    const amount = parseAmount(m[2]!, currency);
    if (amount) out.push({ index: m.index!, amount, currency });
  }
  for (const m of text.matchAll(AMOUNT_AFTER)) {
    const currency = CUR_TOKEN[m[2]!.toLowerCase()]!;
    const amount = parseAmount(m[1]!, currency);
    if (amount && !out.some((o) => Math.abs(o.index - m.index!) < m[0].length)) out.push({ index: m.index!, amount, currency });
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Pecah per kalimat/baris lalu buang bagian saldo/limit. "Saldo GoPay berkurang Rp..." adalah transaksi, bukan saldo. */
function stripBalance(text: string): string {
  const lines = text
    .replace(/\bRp\.\s*/gi, 'Rp ')
    .replace(/([.!?])\s+(?=[A-Z])/g, '$1\n')
    .split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    const m = BALANCE.exec(line);
    if (!m) kept.push(line);
    else if (BALANCE_IS_TX.test(line)) kept.push(line);
    else if (m.index > 0) kept.push(line.slice(0, m.index).replace(/[\s,;:(-]+$/, ''));
  }
  return kept.map((l) => l.trim()).filter(Boolean).join('\n');
}

const MERCHANT = /\b(?:di|ke|kepada|dari|at|to|from|merchant)\s*:?\s+([A-Za-z0-9][\w&'./*-]*(?:\s+[A-Za-z0-9&][\w&'./*-]*){0,5})/gi;
const MERCHANT_STOP = /^(sebesar|senilai|berhasil|sukses|pada|tgl|tanggal|dengan|via|menggunakan|pakai|memakai|telah|sudah|rp|idr|untuk|jam|pukul|ke|dari|di|anda|kamu|rekening|akun|nomor|no|on|for|with)$/i;
const MERCHANT_GENERIC = /^(rekening|akun|nomor|no|anda|kamu|saldo|aplikasi|merchant)$/i;

/** Nama setelah "di/ke/dari ...". Bagian setelah nominal dicoba dulu: judul sering menyebut kantong/akun sendiri. */
function findMerchant(text: string, afterIndex: number): string {
  for (const part of [text.slice(afterIndex), text]) {
    for (const m of part.matchAll(MERCHANT)) {
      const words: string[] = [];
      for (const w of m[1]!.split(/\s+/)) {
        const bare = w.replace(/[.,;:!]+$/, '');
        if (MERCHANT_STOP.test(bare) || /^\d[\d.,]*$/.test(bare)) break;
        words.push(bare);
        if (bare !== w) break;
      }
      const name = words.join(' ');
      if (name.length >= 2 && !MERCHANT_GENERIC.test(name)) return name.slice(0, 60);
    }
  }
  return '';
}

/** Hash cyrb53: cukup untuk sidik duplikat (bukan keamanan), sama di semua platform. */
function hash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/** Parser notifikasi bank (FR-SLOG-2). Murni: tanggal dan kartu ditetapkan pemanggil dari waktu posting dan tautan package. */
export function parseNotification(c: Pick<Capture, 'pkg' | 'title' | 'text'>): ParseResult {
  const app = smartLogApp(c.pkg);
  if (!app) return { ok: false, reason: 'unsupported_app' };
  const full = `${c.title}\n${c.text}`.trim();
  if (OTP.test(full)) return { ok: false, reason: 'otp' };
  if (FAILED.test(full)) return { ok: false, reason: 'failed' };
  if (PROMO.test(full)) return { ok: false, reason: 'promo' };
  if (!TX_KEYWORD.test(full)) return { ok: false, reason: 'no_keyword' };

  const body = stripBalance(full);
  const amounts = findAmounts(body);
  const first = amounts[0];
  if (!first) return { ok: false, reason: 'no_amount' };

  const doubts: Doubt[] = [];
  const isIncome = INCOME.test(body);
  const isExpense = EXPENSE.test(body);
  if (isIncome === isExpense) doubts.push('type_unclear');
  if (TOPUP.test(body)) doubts.push('topup');
  if (amounts.some((a) => a.amount !== first.amount || a.currency !== first.currency)) doubts.push('multiple_amounts');

  return {
    ok: true,
    bank: app.bank,
    type: isIncome && !isExpense ? 'income' : 'expense',
    amount: first.amount,
    currency: first.currency,
    merchant: findMerchant(body, first.index),
    doubts,
    excerpt: body.replace(/\s+/g, ' ').slice(0, 280),
    fingerprint: hash(`${c.pkg}|${full.toLowerCase().replace(/\s+/g, ' ')}`),
  };
}
