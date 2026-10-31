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

## [2026-10-31 11:02] subagent-deleg_reconcile — fitur auto-reconcile struk
Status: done
Baca: lib/split-bill.js (tambah reconcileItems(items,total) pure: diff=sum-total, diff>0→baris diskon price NEGATIF, diff<0→missing), components/arshif/ScanReceiptSheet.js (banner mismatch + tombol reconcile/edit, state reconciled, section Diskon struk dari result.discounts)
Temuan: sign konvensi WAJIB diff=sum-total (bukan total-sum); baris diskon harus price NEGATIF kalau tidak sum makin besar dan tak pernah match. Kasus Watsons: 954.55-636.20=318.35→price:-318.35. openSheet name untuk detail transaksi = 'txDetail' (bukan 'transactionDetail'), payload objek transaksi.
Commit: af955cb

## [2026-10-31 10:45] ENI — debug voice parse 'beli hdmi 20.000'
Status: wip
Baca: app/api/_handlers/ai.js handleParse (baris 87-340: currency regex baris 104-120, prompt rules baris 125-260, sanitasi baris 262-330), components/arshif/VoiceLogSheet.js (parseText baris 59, onResult baris 210, render baris 331)
Temuan: 3 bug teridentifikasi:
1. RM salah deteksi: input 'beli hdmi 20.000' TANPA keyword currency → harusnya fallback homeCurrency (IDR). Tapi regex /\b(rm)\b/i bisa match substring lain; atau Gemini output currency MYR langsung dan sanitasi TIDAK memaksa fallback ke home saat tidak yakin. Perlu: kalau Gemini kasih currency yang tidak ada di teks (tidak match GLOBAL_CURRENCIES regex + tidak match account currency) → force homeCurrency.
2. Merchant salah: 'HDMI' jadi merchant (produk bukan toko). Regex baris 277 cuma buang prefix beli/jajan/bayar — tidak buang nama produk. Prompt rule 1 sudah bilang 'jangan jadikan ucapan belanja sebagai toko' tapi tidak cukup. Perlu: whitelist kata sambung + validasi merchant bukan item name; ATAU kalau merchant == item name → null.
3. 'beli' nempel di list transaksi (baris 2: 'Beli HDMI'): note dari input asli ikut jadi merchant di suatu jalur. Cek note field di payload baris 305: note: tx?.note || items names — note yang berisi 'beli hdmi' di-render sebagai merchant di baris 331 kalau merchant null. Seharusnya di-parse: hapus kata 'beli/jajan' dari note sebelum display, atau jangan pakai note sebagai merchant display.

## [2026-10-31 12:10] subagent-deleg_parse_fix — fix 3 bug parse voice/text (currency, merchant, judul)
Status: done
Baca: app/api/_handlers/ai.js (handleParse: GLOBAL_CURRENCIES + sanitasi + prompt), lib/ai-parse-sanitize.js (baru), components/arshif/{VoiceLogSheet,TransactionRow,SwipeTransactionRow,TransactionDetailSheet}.js, lib/i18n.js (4 blok), tests/ai-parse.test.mjs (baru)
Temuan: sanitasi currency/merchant/note diekstrak ke lib/ai-parse-sanitize.js (fungsi pure, dipakai server + client). BUG 1: currency Gemini tanpa bukti di teks asli dibuang, jatuh ke homeCurrency/account currency; prompt ditambah rule "JANGAN menebak currency". BUG 2: merchant divalidasi terhadap item names, blacklist produk elektronik/generic (toko/warung), dan nominal di dalam nama; prompt rule merchant dipertegas. BUG 3: note server di-strip awalan beli/jajan/bayar, judul client pakai sanitizeMerchant + stripActionPrefix (items names dulu, baru note). Key i18n baru tx_default_title di en/id/ms/tr. npm test 115 pass (103 lama + 12 baru), next build sukses.
Commit: (lihat git log)
