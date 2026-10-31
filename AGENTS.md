# AGENTS.md — Panduan untuk semua agent (Archi/Forge/Sentinel/Atlas/subagent Hermes)

WAJIB baca sebelum mulai kerja. Update file ini kalau menemukan gotcha baru.

## Konvensi repo

- Komentar kode: Bahasa Indonesia, 1 kalimat "kenapa" saja (antislop R-01).
- Tanpa em dash di UI string & komentar (R-02).
- i18n: `lib/i18n.js` 4 bahasa (en/id/ms/tr) — key baru WAJIB ada di keempat blok.
  `translate()` fallback ke `en` kalau key hilang (bug tersembunyi: kelihatan "aman" di dev yang pakai en/id).
- Uang: parse via `lib/money-parse`, jangan Number() mentah.
- Test: `npm test` (100+). Build: `NEXT_PUBLIC_SUPABASE_URL=http://localhost:9999 NEXT_PUBLIC_SUPABASE_ANON_KEY=test npx next build`.
- Commit conventional (fix:/feat:/chore:). Sebelum push: `git pull --rebase origin main`.

## Peta file (yang penting)

- `lib/i18n.js` — semua terjemahan, 4 blok bahasa.
- `lib/store/` — store modular (shared/guest-store/supabase-store/tx-meta-migration); `lib/store.js` cuma re-export.
- `lib/split-bill.js` — logic split/OCR diskon struk (lineTotal, computeSplitTotals, validateReceiptTotals).
- `lib/plan-limits.js` + `lib/feature-usage.js` — enforcement kuota premium (client fail-open, SQL fail-closed).
- `lib/push.js` / `lib/push-server.js` — VAPID public key: WAJIB ada fallback hardcoded (env `NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BOPOh8j...2M'`). Commit c7bb3cf pernah hapus hardcoded → semua user gagal enable push.
- `components/arshif/*.js` — UI. Sheet dibuka via `openSheet('nama')` dari useApp.

## Gotcha database (Supabase produksi)

- Enum `account_type`: HANYA `savings, cash, ewallet, credit_card` — jangan pakai 'bank'/'credit'/'other' untuk kolom accounts.type (payment_method 'bank' beda konteks, itu valid).
- Trigger `protect_profile_privileges` menolak update `plan_tier`/`role` dari user biasa. Untuk update via SQL: `ALTER TABLE profiles DISABLE TRIGGER protect_profile_privileges;` → update → enable lagi. Jangan lupa enable.
- Migrasi baru: file SQL di `supabase/migrations/`, idempoten, jalankan via `supabase-apply.py` (Management API, token dari env).

## Kerja paralel antar-agent

BACA dulu `.agents/WORKLOG.md` — log kerja semua agent (apa yang sudah dibaca, temuan, status). JANGAN baca-ulang file yang sudah dianalisis agent lain; percayai catatannya, verifikasi seperlunya.

SETELAH selesai (atau menemukan temuan penting): APPEND ke `.agents/WORKLOG.md` dengan format:

```
## [YYYY-MM-DD HH:MM] <nama agent> — <task singkat>
Status: done | wip | blocked
Baca: <file yang dianalisis + kesimpulan 1 baris per file>
Temuan: <root cause / keputusan / gotcha baru>
Commit: <hash>
```

Jangan menimpa entri lain. Entri lama jangan dihapus (biar jejak tetap ada).
