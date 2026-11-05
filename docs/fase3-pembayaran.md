# Fase 3: pembayaran dan Premium

Status: dibangun dan diuji lokal. **Belum di-deploy** (menunggu izin pemilik). Semua penyedia dalam mode uji:
Xendit test mode, Paddle sandbox, RevenueCat dengan produk toko sandbox. Stripe tidak dipakai di mana pun.

## Alur

```
Aplikasi iOS/Android ──RevenueCat SDK──▶ App Store / Google Play
        │                                      │
        │ (setelah beli/pulihkan)              ▼
        └──▶ entitlement-sync ◀── revenuecat-webhook ◀── RevenueCat
                    │
                    ▼
     profiles.plan / premium_until  (cermin; sumber kebenaran = RevenueCat)
                    ▲
                    │ grant entitlement promosi (REST v2) sesuai durasi
Web ──checkout-create──▶ Xendit Invoice (IDR/MYR) ──xendit-webhook──┐
    └─────────────────▶ Paddle transaksi (USD) ───paddle-webhook───┴─▶ orders.status = paid
```

- Premium web = **sekali bayar** untuk 1 bulan / 1 tahun, tanpa perpanjangan otomatis. Masa aktif ditambahkan ke
  Premium yang sedang berjalan. Langganan otomatis hanya lewat toko (RevenueCat).
- Webhook diverifikasi (token Xendit, HMAC Paddle, header Authorization RevenueCat) dan idempoten (tabel
  `webhook_events` + transisi status bersyarat di `orders`).
- Grant gagal tidak hilang: target masa aktif disimpan dulu, cron `entitlement-sync` (tiap jam) mencoba ulang.
- Pesanan yang tidak dibayar sampai batas checkout ditandai `expired` oleh cron (tiap 10 menit).
- Masa aktif tiap pesanan ditetapkan atomik di SQL (`reserve_grant`, lock per pengguna): dua pembayaran bersamaan
  bertumpuk, percobaan ulang tidak memperpanjang dua kali.
- Refund / chargeback penuh: hanya durasi pesanan itu yang dikurangi (`refund_shift`), pesanan yang bertumpuk
  setelahnya bergeser maju. Catatan: pencabutan memakai "revoke granted entitlement" RevenueCat, yang mencabut
  SEMUA grant promosi lalu memberi ulang sisa masa web; grant manual dari dashboard RevenueCat ikut tercabut.
  Grant manual sebaiknya lewat `/admin` (tercatat di `orders`).
- Refund sebagian (Paddle): Premium tidak dicabut otomatis, pesanan ditandai `partial_refund` di panel admin.
- Nominal/mata uang Xendit atau harga/diskon Paddle tidak cocok: Premium tidak diberikan, pesanan ditandai
  `amount_mismatch` / `price_mismatch`. Arshif tidak memakai kode diskon Paddle.

## Kunci yang dibutuhkan

Server, lewat `npx supabase secrets set NAMA=nilai` (jangan ditulis di repo atau chat):

| Secret | Dari mana |
|---|---|
| `RC_SECRET_KEY` | RevenueCat > Project settings > API keys > Secret API key **v2**, izin `customer_information:customers:read_write` |
| `RC_PROJECT_ID` | RevenueCat > Project settings (format `proj...`) |
| `RC_ENTITLEMENT_ID` | ID internal entitlement `premium` (format `entl...`, bukan identifier `premium`) |
| `RC_WEBHOOK_AUTH` | Nilai acak buatanmu; isi sama persis di RevenueCat > Integrations > Webhooks > Authorization header |
| `XENDIT_SECRET_KEY` | Xendit (test mode) > Settings > API keys, izin Money-in: write |
| `XENDIT_CALLBACK_TOKEN` | Xendit > Settings > Webhooks > Webhook verification token |
| `PADDLE_API_KEY` | Paddle **sandbox** > Developer tools > Authentication, izin transactions: write |
| `PADDLE_WEBHOOK_SECRET` | Paddle sandbox > Notifications > destinasi webhook > Secret key |
| `PADDLE_PRICE_MONTHLY`, `PADDLE_PRICE_YEARLY` | ID harga Paddle (`pri_...`), lihat bagian produk |
| `APP_URL` | URL web aplikasi (tempat kembali dari halaman bayar Xendit), mis. `https://app.domainmu` |

Klien (publik, boleh ada di bundle; isi di env build, bukan secret):

| Variabel | Isi |
|---|---|
| `EXPO_PUBLIC_RC_IOS_KEY` | RevenueCat > app iOS > Public SDK key (`appl_...`) |
| `EXPO_PUBLIC_RC_ANDROID_KEY` | RevenueCat > app Android > Public SDK key (`goog_...`) |
| `EXPO_PUBLIC_PADDLE_CLIENT_TOKEN` | Paddle sandbox > Developer tools > Client-side tokens (`test_...`) |
| `EXPO_PUBLIC_PADDLE_ENV` | kosong = sandbox. `production` hanya setelah izin pemilik |
| `EXPO_PUBLIC_WEB_CHECKOUT_IOS_REGIONS` | kosong (bawaan). Daftar kode negara yang boleh melihat link checkout web di iOS |
| `EXPO_PUBLIC_WEB_CHECKOUT_ANDROID_REGIONS` | kosong (bawaan). Sama untuk Android (aturan Google Play serupa) |

## Produk yang perlu dibuat di dashboard

Harga dikunci: bulanan Rp 25.000 / RM 6,90 / $1,50; tahunan Rp 250.000 / RM 69 / $15.

**App Store Connect** (grup langganan "Arshif Premium", auto-renewable):
- `arshif_premium_monthly`, durasi 1 bulan
- `arshif_premium_yearly`, durasi 1 tahun

**Google Play Console** (Subscriptions):
- `arshif_premium_monthly`, base plan `monthly`, auto-renewing, periode 1 bulan (P1M)
- `arshif_premium_yearly`, base plan `yearly`, auto-renewing, periode 1 tahun (P1Y)

**RevenueCat**:
- Entitlement identifier `premium`, berisi keempat produk toko di atas.
- Offering `default` (jadikan current) dengan paket `$rc_monthly` -> produk bulanan dan `$rc_annual` -> produk tahunan.
- Webhook: URL di bawah, Authorization header = nilai `RC_WEBHOOK_AUTH`.
- App user ID diisi aplikasi dengan ID pengguna Supabase (`Purchases.logIn`).

**Xendit** (test mode):
- Kanal IDR: QRIS; VA BCA, BNI, BRI, Mandiri, Permata, BSI, CIMB; e-wallet OVO, DANA, ShopeePay, LinkAja, AstraPay, Jenius Pay.
- Kanal MYR: FPX dan e-wallet yang tersedia.
- Webhook "Invoice paid/expired" dan "Refund" -> URL `xendit-webhook`.

**Paddle** (sandbox):
- Produk "Arshif Premium" dengan dua harga **sekali bayar (non-recurring)**: $1,50 dan $15,00.
- Notification destination -> URL `paddle-webhook`, event: `transaction.completed`, `transaction.paid`,
  `transaction.payment_failed`, `adjustment.created`, `adjustment.updated`.
- Client-side token, dan domain `APP_URL` didaftarkan sebagai domain checkout.

## URL webhook

```
https://gyxtdpmruuhhkprlhlrk.supabase.co/functions/v1/revenuecat-webhook
https://gyxtdpmruuhhkprlhlrk.supabase.co/functions/v1/xendit-webhook
https://gyxtdpmruuhhkprlhlrk.supabase.co/functions/v1/paddle-webhook
```

## Admin

Panel di `/admin` (web saja). Akun admin ditambahkan lewat SQL editor Supabase:

```sql
insert into public.admin_users (user_id) select id from auth.users where email = 'email-admin@contoh.com';
```

## Batas Free vs Premium di server

Semua batas PRD ada di `plan_limits` dengan jenisnya: `month` (scan 20/300, automation 30/tanpa batas,
import PDF 1/10, invoice 5/tanpa batas), `day` (Tanya Coach 0/20), `total` (akun 4, goals 3, tagihan + utang 3,
langganan 5), `feature` (recap bulanan, alat pajak lengkap, ekspor PDF). Kuota direset tanggal 1 (UTC),
pekerjaan AI yang gagal mengembalikan kuota.

Akun ditegakkan oleh trigger `enforce_total_limit('accounts')`. Fitur Goals, Tagihan, Utang, Langganan, Invoice,
Alat Pajak, Tanya Coach, dan recap bulanan **belum dibangun** (di luar cakupan v1 "inti dulu"). Saat tabelnya
dibuat, pasang trigger yang sudah tersedia:

```sql
create trigger goals_limit before insert on public.goals for each row execute function public.enforce_total_limit('goals');
create trigger bills_limit before insert on public.bills for each row execute function public.enforce_total_limit('billsDebts');
create trigger debts_limit before insert on public.debts for each row execute function public.enforce_total_limit('billsDebts');
create trigger subscriptions_limit before insert on public.subscriptions for each row execute function public.enforce_total_limit('subscriptions');
create trigger invoices_quota before insert on public.invoices for each row execute function public.enforce_counter_quota('invoice');
```

Edge Function fitur-fitur itu nanti cukup memanggil `plan_allows(user, 'taxFull' | 'pdfExport' | 'coachMonthly')`
untuk fitur Premium saja, dan Tanya Coach memakai `runAiJob(db, user, 'coach', 'coachAsk', ...)` (kuota harian,
dikembalikan bila gagal).
