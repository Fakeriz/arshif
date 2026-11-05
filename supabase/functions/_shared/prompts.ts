/**
 * Prompt + skema keluaran Gemini. Nominal diminta sebagai STRING desimal polos ("45000", "12.50")
 * lalu dikonversi di server (money.ts), karena angka JSON dari model bisa kehilangan presisi.
 */
import { CATEGORY_KEYS } from './contracts.ts';
import type { GeminiSchema } from './ai.ts';

const S = (description?: string, nullable = false): GeminiSchema => ({ type: 'STRING', ...(description ? { description } : {}), ...(nullable ? { nullable: true } : {}) });
const N = (description: string): GeminiSchema => ({ type: 'NUMBER', description });
const CATEGORY: GeminiSchema = { type: 'STRING', enum: [...CATEGORY_KEYS] };
const AMOUNT = 'Plain decimal string in major units, dot as decimal separator, no thousands separators. Example: "45000", "12.50".';

const CATEGORY_GUIDE = `Category keys: groceries (supermarket/minimarket), food (meals, restaurants), hangout (coffee, cafe, eating out with friends), transport (ride hailing, public transport), fuel (petrol, parking, toll), housing (rent), utilities (electricity, water), phone (mobile credit, internet), health, education, shopping (clothes, electronics), entertainment (cinema, streaming), travel, gift, bills, savings, debt (loan or installment), salary, investment_income, bank (bank fees), other.`;

export const SCAN_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    merchant: S('Store name as printed'),
    date: S('YYYY-MM-DD or null', true),
    time: S('HH:MM 24h or null', true),
    currency: S('ISO 4217 code'),
    subtotal: S(AMOUNT, true),
    tax: S(AMOUNT, true),
    service: S(AMOUNT, true),
    discount: S(AMOUNT, true),
    total: S(`${AMOUNT} Null if the total is not readable.`, true),
    items: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { name: S(), qty: S('Quantity as decimal string, default "1"'), unitPrice: S(AMOUNT), total: S(AMOUNT) }, required: ['name', 'qty', 'total'] },
    },
    categoryKey: CATEGORY,
    confidence: {
      type: 'OBJECT',
      properties: { merchant: N('0 to 1'), date: N('0 to 1'), total: N('0 to 1'), items: N('0 to 1') },
      required: ['merchant', 'date', 'total', 'items'],
    },
  },
  required: ['merchant', 'currency', 'total', 'items', 'categoryKey', 'confidence'],
};

export function scanPrompt(): string {
  return `You read a photographed shopping receipt (Indonesia, Malaysia, Turkey or elsewhere) and extract it.
Rules:
- Amounts: ${AMOUNT} Indonesian receipts use "." as thousands separator ("Rp 45.000" means 45000). Turkish uses "," as decimal ("₺350,00" means 350.00). Malaysian "RM 12.50" means 12.50.
- currency: ISO code. Rp/IDR -> IDR, RM -> MYR, ₺/TL -> TRY, $ -> USD, S$ -> SGD, € -> EUR.
- items: every purchased line with name, qty, unit price and line total. Skip payment, change and tax lines.
- total: the final amount paid. If the image is not a receipt or the total is unreadable, set total to null.
- date as YYYY-MM-DD, time as HH:MM, null when absent.
- ${CATEGORY_GUIDE} Pick the single best category for the whole receipt.
- confidence: your certainty per field from 0 to 1. Be honest; blurry or guessed values must be below 0.7.
Do not invent values that are not on the receipt.`;
}

export const VOICE_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    transcript: S('Verbatim transcript in the spoken language'),
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['income', 'expense'] },
          merchant: S('Short description, e.g. "Makan siang", "Isi bensin"'),
          amount: S(AMOUNT),
          currency: S('ISO 4217 code'),
          accountId: S('id from the provided account list, or null', true),
          accountHint: S('account words the user said, or null', true),
          categoryKey: CATEGORY,
          date: S('YYYY-MM-DD'),
          note: S('optional note or null', true),
        },
        required: ['type', 'merchant', 'amount', 'currency', 'categoryKey', 'date'],
      },
    },
  },
  required: ['transcript', 'items'],
};

export function voicePrompt(ctx: { today: string; timezone: string; defaultCurrency: string; accounts: { id: string; name: string; bank: string; currency: string }[] }): string {
  const list = ctx.accounts.map((a) => `- id=${a.id} name="${a.name}" bank=${a.bank} currency=${a.currency}`).join('\n') || '- (none)';
  return `Transcribe the audio, then extract every money transaction the speaker mentions. The speaker may use Indonesian, Malay, Turkish or English, possibly mixed.
Today is ${ctx.today} in time zone ${ctx.timezone}. Convert relative dates to YYYY-MM-DD: "kemarin"/"semalam"/"dün"/"yesterday" = the day before today; "minggu lalu"/"minggu lepas"/"geçen hafta"/"last week" = 7 days before today. Default date is today.
Normalize informal numbers: "goceng" = 5000, "ceban" = 10000, "gopek" = 500, "50k"/"50rb"/"50 ribu" = 50000, "sejuta" = 1000000, "lima puluh ribu" = 50000, "elli lira" = 50 TRY, "seratus ringgit" = 100 MYR. ${AMOUNT}
Currency: use the one spoken; otherwise ${ctx.defaultCurrency}.
Accounts of this user:
${list}
Set accountId only when the speaker clearly refers to one of these accounts (e.g. "pakai GoPay", "cash" = a cash account). Otherwise accountId = null and put the spoken words in accountHint.
${CATEGORY_GUIDE}
If nothing financial is said, return an empty items array.`;
}

export const STATEMENT_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    pages: { type: 'INTEGER' },
    rows: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          date: S('YYYY-MM-DD'),
          description: S('Transaction description as printed, max 200 chars'),
          type: { type: 'STRING', enum: ['income', 'expense'] },
          amount: S(AMOUNT),
          currency: S('ISO 4217 code'),
          categoryKey: CATEGORY,
        },
        required: ['date', 'description', 'type', 'amount', 'currency', 'categoryKey'],
      },
    },
  },
  required: ['pages', 'rows'],
};

export function statementPrompt(accountCurrency: string): string {
  return `This is a bank or e-wallet statement PDF. Extract EVERY transaction row from all pages.
- type: money in (credit, CR, kredit, alacak) = income; money out (debit, DB, debet, borç) = expense.
- amount: positive. ${AMOUNT}
- currency: the statement currency, default ${accountCurrency}.
- Skip opening/closing balance, totals and summary lines.
- date as YYYY-MM-DD; infer the year from the statement period when rows show only day and month.
- ${CATEGORY_GUIDE}
- pages: number of pages in the PDF.`;
}

export const COACH_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: { narration: S('2 to 4 short sentences'), actions: { type: 'ARRAY', items: S('one concrete action') } },
  required: ['narration', 'actions'],
};

const LANG_STYLE: Record<string, string> = {
  id: 'Bahasa Indonesia, friendly, address the user as "kamu" (never "Anda")',
  ms: 'Bahasa Melayu (Malaysia, not Indonesian), friendly, address the user as "anda"',
  tr: 'Turkish, friendly and informal, address the user as "sen"',
  en: 'English, friendly and plain',
};

export function coachPrompt(lang: string, facts: unknown): string {
  return `You are Arshif Coach, a personal finance assistant. Write in ${LANG_STYLE[lang] ?? LANG_STYLE.id}.
Explain this week's Financial Health Score using ONLY the numbers below. The score was computed by a formula; do not change it or invent any number, merchant or amount.
Give exactly 3 concrete, doable actions for next week, each one sentence. No emoji, no em dashes, no headings.
Data (JSON): ${JSON.stringify(facts)}
Pillar keys: savings = savings rate, budget = budget adherence, debt = debt load, emergency = emergency fund months, bills = bills paid on time. points/max = how well each pillar scores.`;
}
