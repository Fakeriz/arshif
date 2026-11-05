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
]);
export type ErrorCode = z.infer<typeof ErrorCode>;
export const ErrorBody = z.object({ error: ErrorCode, quotaKey: z.string().optional(), message: z.string().optional() });

// ------------------------------------------------------------------ scan-receipt (FR-OCR-2/3)
export const ScanRequest = z.object({ path: StoragePath, lang: Lang });
export const ScanItem = z.object({ name: z.string().min(1).max(120), qty: z.number().positive(), unitPrice: Minor, total: Minor });
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

// ------------------------------------------------------------------ delete-account (FR-SET-3)
export const DeleteAccountRequest = z.object({ confirm: z.literal('DELETE') });

/** Nama function = path di /functions/v1/<nama>. */
export const FUNCTIONS = {
  scan: 'scan-receipt',
  voice: 'voice-log',
  import: 'import-statement',
  coach: 'coach',
  fxSync: 'fx-sync',
  deleteAccount: 'delete-account',
} as const;
