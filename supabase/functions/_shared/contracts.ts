/**
 * Kontrak request/response Edge Functions Arshif. Dipakai server (Deno) dan klien (Expo) supaya
 * keduanya memvalidasi bentuk yang sama (PRD Bab 9: validasi Zod di klien dan server).
 * Tanpa API Deno/Node di sini: hanya zod dan TypeScript murni.
 *
 * Nominal SELALU integer unit terkecil mata uangnya (Rp 45.000 = 45000, RM 12.50 = 1250).
 */
import { z } from 'zod';

export const LANGS = ['id', 'ms', 'tr', 'en'] as const;
export const Lang = z.enum(LANGS);

export const CATEGORY_KEYS = [
  'groceries', 'food', 'transport', 'fuel', 'housing', 'utilities', 'phone', 'health', 'education', 'hangout',
  'shopping', 'entertainment', 'travel', 'gift', 'bills', 'savings', 'debt', 'salary', 'investment_income', 'bank', 'other',
] as const;
export const CategoryKey = z.enum(CATEGORY_KEYS);

const Currency = z.string().regex(/^[A-Z]{3}$/);
const Ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Minor = z.number().int().nonnegative();
const Uuid = z.string().uuid();
/** Path storage milik pengguna: "<user_id>/<nama berkas>". Kepemilikan dicek ulang di server. */
const StoragePath = z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/);

/** Kode error yang dipahami klien. HTTP status dipilih server, klien membaca `error`. */
export const ErrorCode = z.enum([
  'unauthorized', 'bad_request', 'rate_limited', 'quota', 'unreadable', 'encrypted_pdf', 'too_large', 'ai_failed', 'not_found', 'server',
  'forbidden', 'not_configured', 'provider_error',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;
export const ErrorBody = z.object({ error: ErrorCode, quotaKey: z.string().optional(), message: z.string().optional() });

// ------------------------------------------------------------------ scan-receipt (FR-OCR-2/3)
export const ScanRequest = z.object({ path: StoragePath, lang: Lang });
/** total = harga sebelum diskon; discount = jumlah diskon promosi yang menempel ke item ini. */
export const ScanItem = z.object({
  name: z.string().min(1).max(120),
  qty: z.number().positive(),
  unitPrice: Minor,
  total: Minor,
  discount: Minor.default(0),
  /** Tarif pajak item dalam persen (KDV %10 -> 10), null bila tidak tercetak. */
  taxRate: z.number().min(0).max(100).nullable().default(null),
});
/** Baris promosi/diskon. amount positif (ditampilkan sebagai pengurang). */
export const ScanDiscount = z.object({
  label: z.string().max(120).nullable(),
  itemName: z.string().max(120).nullable(),
  taxRate: z.number().min(0).max(100).nullable(),
  amount: Minor.positive(),
});
/** Rincian pajak per tarif: tax = pajak, gross = total termasuk pajak (KDV'Li TOPLAM). */
export const ScanTaxLine = z.object({ rate: z.number().min(0).max(100), tax: Minor, gross: Minor.nullable() });
export const ScanResult = z.object({
  merchant: z.string().max(120),
  date: Ymd.nullable(),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  currency: Currency,
  subtotal: Minor.nullable(),
  tax: Minor.nullable(),
  service: Minor.nullable(),
  discount: Minor.nullable(),
  total: Minor.positive(),
  items: z.array(ScanItem).max(80),
  discounts: z.array(ScanDiscount).max(80).default([]),
  taxLines: z.array(ScanTaxLine).max(10).default([]),
  /** true = harga item sudah termasuk pajak (KDV Turki, PPN di struk ritel): pajak tidak ditambahkan ke total. */
  taxIncluded: z.boolean().default(true),
  storeAddress: z.string().max(240).nullable().default(null),
  storeTaxId: z.string().max(80).nullable().default(null),
  receiptNo: z.string().max(60).nullable().default(null),
  paymentMethod: z.string().max(60).nullable().default(null),
  categoryKey: CategoryKey,
  /** Keyakinan 0–1 per field; < 0,7 ditandai kuning di layar review. */
  confidence: z.object({ merchant: z.number().min(0).max(1), date: z.number().min(0).max(1), total: z.number().min(0).max(1), items: z.number().min(0).max(1) }),
});
export type ScanResult = z.infer<typeof ScanResult>;

// ------------------------------------------------------------------ voice-log (FR-VOICE-1..4)
export const VoiceAccount = z.object({ id: Uuid, name: z.string(), bank: z.string(), currency: Currency });
export const VoiceRequest = z.object({
  audio: z.string().min(16).max(2_800_000), // base64, rekaman maks 60 detik
  mimeType: z.enum(['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg']),
  lang: Lang,
  today: Ymd,
  timezone: z.string().max(64),
  defaultCurrency: Currency,
  accounts: z.array(VoiceAccount).max(50),
});
export const VoiceItem = z.object({
  type: z.enum(['income', 'expense']),
  merchant: z.string().max(120),
  amount: Minor.positive(),
  currency: Currency,
  accountId: Uuid.nullable(),
  accountHint: z.string().max(60).nullable(),
  categoryKey: CategoryKey,
  date: Ymd,
  note: z.string().max(200).nullable(),
});
export const VoiceResult = z.object({ transcript: z.string().max(2000), items: z.array(VoiceItem).max(20) });
export type VoiceResult = z.infer<typeof VoiceResult>;

// ------------------------------------------------------------------ import-statement (FR-PDF-1..4)
export const ImportRequest = z.object({ path: StoragePath, accountId: Uuid, lang: Lang });
export const StatementRow = z.object({
  date: Ymd,
  description: z.string().min(1).max(200),
  type: z.enum(['income', 'expense']),
  amount: Minor.positive(),
  currency: Currency,
  categoryKey: CategoryKey,
});
export const ImportResult = z.object({ rows: z.array(StatementRow).max(1000), pages: z.number().int().nonnegative() });
export type ImportResult = z.infer<typeof ImportResult>;

// ------------------------------------------------------------------ coach (FR-COACH-2/4): hanya ringkasan angka
export const CoachRequest = z.object({
  lang: Lang,
  weekStart: Ymd,
  score: z.number().int().min(0).max(100),
  pillars: z.array(z.object({ key: z.enum(['savings', 'budget', 'debt', 'emergency', 'bills']), points: z.number(), max: z.number() })).length(5),
  /** Persen dan rasio saja, tidak ada merchant/nominal mentah. */
  facts: z.object({
    spentChangePct: z.number().int().nullable(),
    topCategoryKey: CategoryKey.nullable(),
    noSpendDays: z.number().int().min(0).max(7),
    budgetUsedPct: z.number().int().min(0).max(1000),
    periodElapsedPct: z.number().int().min(0).max(100),
  }),
});
export const CoachResult = z.object({ narration: z.string().min(1).max(800), actions: z.array(z.string().min(1).max(160)).length(3), cached: z.boolean() });
export type CoachResult = z.infer<typeof CoachResult>;

// ------------------------------------------------------------------ Tanya Coach (FR-COACH-3/4, Premium 20/hari)
/** Nominal dalam unit BESAR mata uang utama (Rp 45.000 = 45000, RM 12,50 = 12.5), dibulatkan. Tanpa merchant/catatan. */
const Major = z.number().finite().min(-1e13).max(1e13);
const Pct = z.number().int().min(-1000).max(1000);
export const AskContext = z.object({
  currency: Currency,
  monthlyIncome: Major,
  netWorth: Major,
  period: z.object({ elapsedPct: z.number().int().min(0).max(100), daysLeft: z.number().int().min(0).max(31) }),
  budget: z.object({
    total: Major,
    flexSpent: Major,
    flexLimit: Major,
    safePerDay: Major,
    pace: z.enum(['sesuai', 'agak_cepat', 'terlalu_cepat']),
    buckets: z.array(z.object({ key: z.enum(['needs', 'wants', 'savings']), spent: Major, limit: Major })).length(3),
  }),
  /** Belanja periode ini per kategori (terbesar dulu) + batasnya bila ada. */
  categories: z.array(z.object({ key: CategoryKey, spent: Major, limit: Major.nullable() })).max(21),
  week: z.object({ spent: Major, changePct: Pct.nullable(), noSpendDays: z.number().int().min(0).max(7) }),
  score: z.number().int().min(0).max(100).nullable(),
  pillars: z.array(z.object({ key: z.enum(['savings', 'budget', 'debt', 'emergency', 'bills']), points: z.number(), max: z.number() })).max(5),
});
export type AskContext = z.infer<typeof AskContext>;
export const AskTurn = z.object({ role: z.enum(['user', 'coach']), text: z.string().min(1).max(1500) });
export const AskRequest = z.object({
  lang: Lang,
  question: z.string().trim().min(2).max(300),
  /** Giliran sebelumnya di sesi ini (paling banyak 6), supaya pertanyaan lanjutan dimengerti. */
  history: z.array(AskTurn).max(6),
  context: AskContext,
});
/**
 * Jawaban terstruktur: `answer` = jawaban langsung (1-2 kalimat), `points` = 0-4 poin pendukung berangka,
 * `tip` = satu langkah berikutnya. Server lama hanya mengirim `answer`; poin dan tip opsional.
 */
export const AskResult = z.object({
  answer: z.string().min(1).max(600),
  points: z.array(z.string().min(1).max(220)).max(4).default([]),
  tip: z.string().min(1).max(240).nullable().default(null),
});
export type AskResult = z.infer<typeof AskResult>;

// ------------------------------------------------------------------ delete-account (FR-SET-3)
export const DeleteAccountRequest = z.object({ confirm: z.literal('DELETE') });

// ------------------------------------------------------------------ billing (FR-PAY-1..5)
export const PERIODS = ['monthly', 'yearly'] as const;
export const Period = z.enum(PERIODS);
/** Mata uang web checkout. IDR/MYR lewat Xendit; USD lewat Paddle (Paddle melokalkan ke TRY dan lainnya). */
export const CHECKOUT_CURRENCIES = ['IDR', 'MYR', 'USD'] as const;
export const CheckoutCurrency = z.enum(CHECKOUT_CURRENCIES);
export const PAY_METHODS = ['va', 'qris', 'ewallet', 'fpx', 'card'] as const;
export const PayMethod = z.enum(PAY_METHODS);
export const ORDER_STATUSES = ['pending', 'paid', 'expired', 'failed', 'refunded'] as const;
export const OrderStatus = z.enum(ORDER_STATUSES);

export const CheckoutRequest = z.object({ period: Period, currency: CheckoutCurrency, method: PayMethod });
export const CheckoutResponse = z.object({
  orderId: Uuid,
  provider: z.enum(['xendit', 'paddle']),
  /** Xendit: halaman invoice. Paddle: null, checkout dibuka lewat Paddle.js dengan transactionId. */
  checkoutUrl: z.string().url().nullable(),
  transactionId: z.string().nullable(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponse>;

/** Cocokkan paket dengan RevenueCat (setelah beli/pulihkan di aplikasi, atau saat membuka halaman status). */
export const SyncResponse = z.object({ plan: z.enum(['free', 'premium']), premiumUntil: z.string().nullable() });
export type SyncResponse = z.infer<typeof SyncResponse>;

/** Aksi admin pada satu pengguna (FR-ADM-2). Grant = pesanan provider 'manual'; cabut = semua grant manual aktif. */
export const AdminUserRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('grant'), userId: Uuid, days: z.number().int().min(1).max(3660) }),
  z.object({ action: z.literal('revoke'), userId: Uuid }),
  z.object({ action: z.literal('suspend'), userId: Uuid }),
  z.object({ action: z.literal('unsuspend'), userId: Uuid }),
]);
export const AdminUserResponse = z.object({
  plan: z.enum(['free', 'premium']),
  premiumUntil: z.string().nullable(),
  suspendedAt: z.string().nullable(),
  /** false = kunci RevenueCat belum diisi; grant hanya tercatat di Arshif. */
  revenueCat: z.boolean(),
  /** true = pesanan grant tersimpan tapi aktivasi gagal sesaat; cron mencoba ulang tiap jam. Jangan grant lagi. */
  grantQueued: z.boolean().optional(),
});

/** Sinkron kurs manual dari panel admin (fx-sync dengan token admin, bukan secret cron). */
export const FxSyncResponse = z.object({ date: z.string(), codes: z.number(), backfilledDays: z.number() });

/** Nama function = path di /functions/v1/<nama>. */
export const FUNCTIONS = {
  scan: 'scan-receipt',
  voice: 'voice-log',
  import: 'import-statement',
  coach: 'coach',
  coachAsk: 'coach-ask',
  fxSync: 'fx-sync',
  deleteAccount: 'delete-account',
  checkout: 'checkout-create',
  entitlementSync: 'entitlement-sync',
  adminUser: 'admin-user',
} as const;
