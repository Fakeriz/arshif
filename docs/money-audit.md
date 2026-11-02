# Audit money math: temuan dan kebijakan

Audit atas seluruh jalur yang menyentuh nominal: simpan transaksi, saldo akun,
konversi mata uang, agregasi dashboard, impor statement, split bill, dan
notifikasi. Dokumen ini mencatat apa yang ditemukan, aturan yang sekarang
berlaku, dan apa yang belum diperiksa.

## Kebijakan yang berlaku sekarang

**Satu jalur untuk menyimpan transaksi.** `saveTxWithBalance()` di
`lib/tx-save.js`. Alasan: tidak ada trigger DB yang memperbarui `accounts`, jadi
setiap jalur yang memanggil `createTransaction` langsung akan meninggalkan saldo
yang tidak bergerak.

**Satu kebijakan untuk kurs yang tidak dikenal.** `convertOrKeep()` di
`lib/rates.js` mengembalikan nominal asli plus penanda `rateUnknown`. Larangan:

| Pola | Akibat |
| --- | --- |
| `convert()` tanpa penanganan | melempar; render/route mati |
| `safeConvert(...) ?? 0` | baris berkurs asing dibuang dari total; dua layar beda angka |

`safeConvert()` sendiri masih boleh dipakai bila `null`-nya ditangani eksplisit
(mis. badge kurs menampilkan `?`), karena di situ `null` adalah informasi.

**Tanggal adalah hari kalender lokal.** Test memakai getter lokal
(`fmtDateStr`, `localIso`), bukan `toISOString()`, yang menggeser tanggal di
zona waktu non-UTC. Server backup ber-TZ `Asia/Kuala_Lumpur`, dan perbedaan itu
dulu membuat dua test gagal hanya di server.

## Temuan yang sudah diperbaiki

| # | Lokasi | Bug | Dampak |
| --- | --- | --- | --- |
| 1 | `VoiceLogSheet`, `BusinessInvoiceSheet`, `CoachSheet` | simpan tanpa update saldo | saldo tidak bergerak setelah catat via voice/invoice/coach |
| 2 | `lib/notifications.js` | `convert()` melempar saat kurs tak dikenal | lonceng notifikasi mati + route push cron 500 |
| 3 | `AnalyticsSheet`, `TaxReportSheet`, `GoalsTab`, `CoachSheet`, `SetBudgetModal` | `safeConvert(...) ?? 0` | transaksi berkurs asing hilang dari total; beda dengan homepage |
| 4 | `AddTransactionSheet` (fallback) | revert lalu apply dengan snapshot akun basi | edit 100 -> 250 menghasilkan 750, seharusnya 850 |
| 5 | `lib/ledger.js` `evaluateExpression` | kurung dibuang tokenizer | `(2+3)*4` dibaca `2+3*4`; nominal tersimpan 14, bukan 20 |
| 6 | `AddTransactionSheet` | `convert()`/`getRate()` saat render dan saat menyusun payload | sheet blank atau simpan mustahil untuk kurs tak dikenal |
| 7 | `ImportTransactionsPage` | delta saldo dihitung setelah baris dibuat | `convert()` melempar = transaksi ada tapi delta tidak masuk `net` |
| 8 | `NewAccountSheet` | konversi saldo awal setelah `createAccount` | akun terbuat tanpa jejak ledger bila kurs gagal |
| 9 | `lib/store/supabase-store.js` | `findTransactionsInRange` tanpa loop halaman | dedup impor bocor pada akun > 2000 baris |

## Yang diverifikasi benar (tidak diubah)

- `roundMoney()` memakai `Math.abs` sebelum membulatkan lalu mengembalikan tanda,
  jadi pembulatan negatif tidak meleset ke arah nol.
- Split bill: `allocateEqualShares()` memberi sisa pembulatan ke partisipan
  terakhir, sehingga jumlah bagian selalu sama dengan total.
- Pembagian `remaining / daysLeft` dan `spent / limit` sudah dijaga (`limit <= 0`
  berhenti lebih awal, `daysLeft` minimal 1).
- `parseMoney()` menangani notasi ilmiah sebelum membuang simbol, jadi `1e21`
  tidak berubah menjadi `121`.
- Saldo akun kredit/utang memakai `signedAccountBalance()` di net worth, statistik
  beranda, dan coach.

## Penjaga regresi

`tests/money-policy.test.mjs` memeriksa tiga hal: tidak ada pola buang
(`safeConvert(...) ?? 0`), tidak ada `convert()` telanjang di jalur nilai
komponen, dan `deriveNotifications` memakai `convertOrKeep`. Test ini menangkap
regresi saat pola lama muncul kembali.

Test lain yang menutup jalur uang: `tx-save`, `rates-keep`, `edit-revert-order`,
`expression`, `import-summary`, `coach-save`, `db-backup`.

## Belum diaudit

- **Floating point pada agregasi besar.** Penjumlahan memakai float mentah dan
  baru dibulatkan saat format/tulis. Untuk nominal 2 desimal, galat akumulatif
  masih di bawah satu sen dalam rentang realistis, tetapi belum ada test yang
  membuktikannya pada 10.000 baris.
- **Rekonsiliasi saldo vs ledger.** Belum ada perintah yang membandingkan
  `accounts.balance` dengan jumlah transaksi per akun; kalau ada baris lama yang
  ditulis sebelum perbaikan #1/#4, selisihnya belum diketahui.
- **Pajak dan kurs historis.** `tax-report` memakai `home_currency_amount` yang
  tersimpan saat transaksi, bukan kurs saat pelaporan. Belum diputuskan mana
  yang benar untuk laporan pajak.
