# WORKLOG — Log kerja semua agent (append-only, jangan hapus entri lama)

## [2026-10-31 07:30] ENI — setup shared context
Status: done
Baca: seluruh repo (state terakhir di memory Hermes)
Temuan: subagent context terisolasi, tidak ada shared memory. Solusi: AGENTS.md (konvensi+gotcha) + file ini (worklog). Pola efektif: parent agent analisis root cause sekali, subagent eksekusi — hemat token.
Commit: (segera)

## [2026-10-31 07:15] subagent-deleg_cc440cf3 — fix i18n ms/tr + tombol bahasa onboarding
Status: done
Baca: lib/i18n.js (blok ms baris 953, tr baris 1342; key onboard_say_it/onboard_total_balance cuma ada di en/id → fallback bug), components/arshif/Onboarding.js (tombol bahasa cuma emoji flag, Windows nggak render)
Temuan: translate() fallback ke en kalau key hilang — bug "aman" kalau dev cuma cek en/id. Emoji bendera nggak render di Windows desktop.
Commit: fafe155

## [2026-10-31 05:07] agent-eksternal (tim Forge) — fitur diskon struk split-bill
Status: done
Baca: lib/split-bill.js (baru: lineTotal/computeSplitTotals/validateReceiptTotals), app/api/_handlers/ai.js (OCR prompt + validasi), components/arshif/ScanReceiptSheet.js + TransactionDetailSheet.js (UI diskon)
Temuan: diskon struk-level disimpan sebagai baris item berharga negatif (is_discount:true). Test floating-point: round 3 desimal (318.35/2=159.175).
Commit: 476a83d, 750ea6d, ae80bef

## [2026-10-31 02:27] subagent-deleg_403d27ae — fix enum account_type
Status: done
Baca: lib/categories.js (ACCOUNT_TYPES pakai id invalid), components/arshif/NewAccountSheet.js (default 'bank'), lib/store/*.js (createAccount)
Temuan: enum DB cuma savings/cash/ewallet/credit_card. Ditambah helper normalizeAccountType().
Commit: 559c39a

## [2026-10-31 00:50-05:08] 3 subagent paralel — auto-zoom, i18n notif, currency sheet
Status: done
Baca: components/arshif/*.js (27 input/textarea audit), NotificationSettingsSheet.js (31 key push), CurrencySheet.js (search input)
Temuan: iOS auto-zoom kalau font <16px — fix via text-base + CSS floor @media 767px. Jangan pakai user-scalable=no (regresi a11y).
Commit: ecb936a, 2ea2902, edc697d

## [2026-10-31 00:46] ENI — rotasi VAPID key + regresi fix
Status: done
Baca: lib/push.js, lib/push-server.js
Temuan: commit i18n (c7bb3cf) pernah ganti hardcoded key jadi env-only → push error semua user. Fix: env || hardcoded fallback (15123d6).
Commit: 7ef131b, 15123d6

## [2026-10-31 00:29] ENI — migrasi Supabase produksi
Status: done
Baca: supabase/*.sql (semua), DB produksi via Management API
Temuan: migrasi 005 pakai "on error null" — bukan sintaks PL/pgSQL, current_setting(name,true) sudah return null. service_role butuh GRANT + policy khusus. Akun haf***@gmail.com = premium.
Commit: e85767c

## [2026-10-31 10:20] ENI — diskusi kategori OCR Watsons
Status: wip
Baca: app/api/_handlers/ai.js (OCR_PROMPT baris 404-431: category enum ada tapi TANPA definisi; text parser barus 180-196 punya rules keyword tapi OCR prompt tidak)
Temuan: Gemini pilih 'personal' untuk struk toiletries (sampo/pasta gigi) — semantik benar (personal care) tapi tidak terdefinisi di prompt → bisa tidak konsisten antar scan. Fix: tambah definisi tiap kategori di OCR_PROMPT.

## [2026-10-31 10:38] subagent — definisi kategori OCR_PROMPT + sinkron parser keyword
Status: done
Baca: app/api/_handlers/ai.js (OCR_PROMPT baris 404-432 + text parser baris 180-196), tests/split-bill.test.mjs, lib/split-bill.js (verifikasi stash teman satu tim)
Temuan: CATEGORY DEFINITIONS (13 baris, 1 per kategori) ditambahkan di OCR_PROMPT setelah rules: toiletries/kosmetik/produk apotek di Watsons/Rossmann/dm/Guardian → 'shopping' (bukan 'personal'); 'personal' hanya layanan (spa/salon/barbershop/laundry/cuci mobil). 'health' diklarifikasi layanan medis, produk di apotek tetap 'shopping'. Text parser ditambah baris keyword "Kosmetik/Toiletries" (sampo/pasta gigi/sabun/kosmetik/skincare/watsons/rossmann/guardian) dan baris 'health' diklarifikasi. Tanpa test baru; npm test + next build lolos.
Commit: (lihat git log)
