import { SMARTLOG_APPS, smartLogApp } from '@/lib/smartlog/apps';
import { parseAmount, parseNotification, type Parsed } from '@/lib/smartlog/parser';
import { getBank } from '@/constants/banks';

// Contoh dibuat dari pola umum notifikasi tiap aplikasi; bukan data pengguna sungguhan.
type Sample = { pkg: string; title: string; text: string; type: 'expense' | 'income'; amount: number; currency?: string; merchant?: string; bank: string };

const SAMPLES: Sample[] = [
  { pkg: 'com.bca.mybca.omni.android', title: 'Transaksi Berhasil', text: 'Pembayaran QRIS Rp 45.000,00 di KOPI SENJA berhasil pada 05/11 14:20.', type: 'expense', amount: 45000, merchant: 'KOPI SENJA', bank: 'bca' },
  { pkg: 'com.bca', title: 'm-BCA', text: 'Transfer ke ANDI PRATAMA sebesar Rp1.250.000 berhasil. Saldo Rp8.400.000', type: 'expense', amount: 1250000, merchant: 'ANDI PRATAMA', bank: 'bca' },
  { pkg: 'id.bmri.livin', title: "Livin' by Mandiri", text: 'Pembayaran Rp 150.000 ke PLN PRABAYAR berhasil. Sisa saldo Rp 2.345.678', type: 'expense', amount: 150000, merchant: 'PLN PRABAYAR', bank: 'mandiri' },
  { pkg: 'id.co.bri.brimo', title: 'BRImo', text: 'Dana masuk Rp 3.000.000 dari PT MAJU JAYA ke rekening 0123xxxx. Saldo akhir Rp 5.100.000', type: 'income', amount: 3000000, merchant: 'PT MAJU JAYA', bank: 'bri' },
  { pkg: 'id.bni.wondr', title: 'wondr by BNI', text: 'Kamu berhasil bayar Rp75.500 di ALFAMART CILANDAK', type: 'expense', amount: 75500, merchant: 'ALFAMART CILANDAK', bank: 'bni' },
  { pkg: 'src.com.bni', title: 'BNI Mobile Banking', text: 'Transaksi debit IDR 60.000 di WARUNG MAKAN BU SRI', type: 'expense', amount: 60000, merchant: 'WARUNG MAKAN BU SRI', bank: 'bni' },
  { pkg: 'com.btpn.dc', title: 'Jenius', text: 'Kamu membayar IDR 210,000.00 di TOKO BUKU GRAMEDIA dengan Kartu Debit.', type: 'expense', amount: 210000, merchant: 'TOKO BUKU GRAMEDIA', bank: 'jenius' },
  { pkg: 'id.co.cimbniaga.mobile.android', title: 'OCTO', text: 'Transaksi kartu debit Rp 99.000 di SPOTIFY telah berhasil.', type: 'expense', amount: 99000, merchant: 'SPOTIFY', bank: 'cimbniaga' },
  { pkg: 'net.myinfosys.PermataMobileX', title: 'Permata ME', text: 'Pembelian pulsa Rp 50.000 berhasil.', type: 'expense', amount: 50000, bank: 'permata' },
  { pkg: 'com.bsm.activity2', title: 'BSI Mobile', text: 'Transfer masuk Rp 500.000 dari SITI AMINAH', type: 'income', amount: 500000, merchant: 'SITI AMINAH', bank: 'bsi' },
  { pkg: 'co.id.bankbsi.superapp', title: 'BYOND', text: 'Pembayaran QRIS Rp 32.000 di BAKSO PAK DE berhasil', type: 'expense', amount: 32000, merchant: 'BAKSO PAK DE', bank: 'bsi' },
  { pkg: 'com.jago.digitalBanking', title: 'Uang keluar dari Kantong Utama', text: 'Rp 120.000 dibayar ke GRAB*FOOD', type: 'expense', amount: 120000, merchant: 'GRAB*FOOD', bank: 'jago' },
  { pkg: 'com.bcadigital.blu', title: 'blu', text: 'bluPay: pembayaran Rp 18.500 ke INDOMARET PONDOK INDAH berhasil', type: 'expense', amount: 18500, merchant: 'INDOMARET PONDOK INDAH', bank: 'blu' },
  { pkg: 'id.co.bankbkemobile.digitalbank', title: 'SeaBank', text: 'Uang masuk Rp 250.000 dari BUDI SANTOSO', type: 'income', amount: 250000, merchant: 'BUDI SANTOSO', bank: 'seabank' },
  { pkg: 'com.gojek.gopay', title: 'Pembayaran berhasil', text: 'Kamu bayar Rp27.000 ke Mie Gacoan pakai GoPay.', type: 'expense', amount: 27000, merchant: 'Mie Gacoan', bank: 'gopay' },
  { pkg: 'com.gojek.app', title: 'GoRide', text: 'Pembayaran Rp 15.000 untuk GoRide berhasil pakai GoPay', type: 'expense', amount: 15000, bank: 'gopay' },
  { pkg: 'ovo.id', title: 'OVO', text: 'Pembayaran Rp 40.000 di KEDAI KOPI KITA berhasil. Saldo OVO Cash Rp 60.000', type: 'expense', amount: 40000, merchant: 'KEDAI KOPI KITA', bank: 'ovo' },
  { pkg: 'id.dana', title: 'DANA', text: 'Kamu berhasil kirim uang Rp100.000 ke RINA', type: 'expense', amount: 100000, merchant: 'RINA', bank: 'dana' },
  { pkg: 'com.shopeepay.id', title: 'ShopeePay', text: 'Pembayaran Rp 89.900 berhasil di Toko Sepatu Lari', type: 'expense', amount: 89900, merchant: 'Toko Sepatu Lari', bank: 'shopeepay' },
  { pkg: 'com.shopee.id', title: 'Shopee', text: 'Pembayaran pesanan Rp 155.000 dengan ShopeePay berhasil.', type: 'expense', amount: 155000, bank: 'shopeepay' },
];

const ok = (r: ReturnType<typeof parseNotification>): Parsed => {
  if (!r.ok) throw new Error(`dibuang: ${r.reason}`);
  return r;
};

describe('aplikasi yang didukung', () => {
  it('16 bank/dompet PRD tercakup, tiap package unik dan dinormalisasi ke kartu yang ada', () => {
    const banks = new Set(SMARTLOG_APPS.map((a) => a.bank));
    expect([...banks].sort()).toEqual(['bca', 'blu', 'bni', 'bri', 'bsi', 'cimbniaga', 'dana', 'gopay', 'jago', 'jenius', 'mandiri', 'ovo', 'permata', 'seabank', 'shopeepay']);
    expect(new Set(SMARTLOG_APPS.map((a) => a.pkg)).size).toBe(SMARTLOG_APPS.length);
    for (const a of SMARTLOG_APPS) expect(getBank(a.bank).key).toBe(a.bank);
  });

  it('normalisasi nama: myBCA -> BCA, Livin -> Mandiri, BRImo -> BRI, Gojek -> GoPay', () => {
    expect(getBank(smartLogApp('com.bca.mybca.omni.android')!.bank).name).toBe('BCA');
    expect(getBank(smartLogApp('id.bmri.livin')!.bank).name).toBe('Mandiri');
    expect(getBank(smartLogApp('id.co.bri.brimo')!.bank).name).toBe('BRI');
    expect(getBank(smartLogApp('com.gojek.app')!.bank).name).toBe('GoPay');
  });

  it('semua sampel mencakup tiap package yang didukung', () => {
    expect(new Set(SAMPLES.map((s) => s.pkg))).toEqual(new Set(SMARTLOG_APPS.map((a) => a.pkg)));
  });
});

describe('contoh notifikasi per aplikasi', () => {
  it.each(SAMPLES.map((s) => [smartLogApp(s.pkg)!.app, s] as const))('%s', (_name, s) => {
    const r = ok(parseNotification(s));
    expect(r.bank).toBe(s.bank);
    expect(r.type).toBe(s.type);
    expect(r.amount).toBe(s.amount);
    expect(r.currency).toBe(s.currency ?? 'IDR');
    if (s.merchant) expect(r.merchant).toBe(s.merchant);
    expect(r.doubts).toEqual([]);
    expect(r.excerpt).not.toMatch(/saldo/i);
  });
});

describe('yang dibuang di perangkat (tidak dikirim ke server)', () => {
  const pkg = 'com.bca.mybca.omni.android';
  it.each([
    ['Kode OTP', 'Kode OTP kamu 482913. Jangan berikan kode ini kepada siapa pun.', 'otp'],
    ['myBCA', 'Login ke myBCA dari perangkat baru pada 05/11 08:00', 'otp'],
    ['Transaksi', 'Masukkan PIN untuk transaksi Rp 50.000', 'otp'],
    ['Transaksi Gagal', 'Pembayaran Rp 45.000 di KOPI SENJA gagal.', 'failed'],
    ['Transfer', 'Transfer Rp 200.000 ke ANDI sedang diproses', 'failed'],
    ['Pending', 'Pembayaran Rp 99.000 pending', 'failed'],
    ['Promo 11.11', 'Diskon 50% s.d. Rp 100.000 untuk pembayaran QRIS. Buruan!', 'promo'],
    ['Cashback', 'Dapatkan cashback hingga Rp 25.000 untuk transaksi pertamamu', 'promo'],
    ['Info', 'Saldo kamu saat ini Rp 1.200.000', 'no_keyword'],
    ['Transaksi Berhasil', 'Transaksi kamu berhasil.', 'no_amount'],
  ])('%s: %s -> %s', (title, text, reason) => {
    expect(parseNotification({ pkg, title, text })).toEqual({ ok: false, reason });
  });

  it('aplikasi di luar daftar dibuang', () => {
    expect(parseNotification({ pkg: 'com.whatsapp', title: 'Rina', text: 'Transfer Rp 50.000 ya' })).toEqual({ ok: false, reason: 'unsupported_app' });
  });
});

describe('aturan parser', () => {
  const pkg = 'id.dana';
  it('mengambil nominal PERTAMA; baris saldo/limit tidak dihitung', () => {
    const r = ok(parseNotification({ pkg, title: 'DANA', text: 'Sisa limit Rp 2.000.000.\nPembayaran Rp 30.000 ke WARTEG berhasil' }));
    expect(r.amount).toBe(30000);
    expect(r.doubts).toEqual([]);
  });

  it('"Saldo ... berkurang Rp" adalah transaksi, bukan baris saldo', () => {
    const r = ok(parseNotification({ pkg, title: 'DANA', text: 'Saldo DANA kamu berkurang Rp 12.000 untuk pembayaran parkir' }));
    expect([r.type, r.amount]).toEqual(['expense', 12000]);
  });

  it('dua nominal berbeda (mis. biaya admin) = ragu, masuk To Review', () => {
    const r = ok(parseNotification({ pkg, title: 'DANA', text: 'Transfer Rp 100.000 ke BCA berhasil, biaya admin Rp 2.500' }));
    expect(r.amount).toBe(100000);
    expect(r.doubts).toContain('multiple_amounts');
  });

  it('jenis tidak jelas = ragu', () => {
    const r = ok(parseNotification({ pkg, title: 'DANA', text: 'Transaksi Rp 10.000 berhasil' }));
    expect(r.doubts).toContain('type_unclear');
  });

  it('top up = ragu (sebenarnya pindah dana antar akun)', () => {
    const r = ok(parseNotification({ pkg: 'com.bca.mybca.omni.android', title: 'myBCA', text: 'Top up GoPay Rp 100.000 berhasil' }));
    expect(r.doubts).toContain('topup');
  });

  it('mata uang asing diambil apa adanya; keputusan auto-apply di server', () => {
    const r = ok(parseNotification({ pkg: 'com.btpn.dc', title: 'Jenius', text: 'Kamu membayar USD 12.50 di NETFLIX.COM' }));
    expect([r.amount, r.currency, r.merchant]).toEqual([1250, 'USD', 'NETFLIX.COM']);
  });

  it('notifikasi yang sama punya sidik yang sama; beda nominal beda sidik', () => {
    const a = ok(parseNotification({ pkg, title: 'DANA', text: 'Pembayaran Rp 30.000 ke WARTEG berhasil' }));
    const b = ok(parseNotification({ pkg, title: 'DANA', text: 'Pembayaran  Rp 30.000 ke WARTEG berhasil' }));
    const c = ok(parseNotification({ pkg, title: 'DANA', text: 'Pembayaran Rp 31.000 ke WARTEG berhasil' }));
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).not.toBe(c.fingerprint);
  });
});

describe('parseAmount', () => {
  it.each([
    ['45.000', 'IDR', 45000],
    ['45.000,00', 'IDR', 45000],
    ['1.250.000', 'IDR', 1250000],
    ['210,000.00', 'IDR', 210000],
    ['75500', 'IDR', 75500],
    ['12.50', 'USD', 1250],
    ['12,5', 'USD', 1250],
    ['1,234.56', 'USD', 123456],
    ['45.000,60', 'IDR', 45001],
  ])('%s %s -> %d', (raw, cur, n) => expect(parseAmount(raw, cur)).toBe(n));

  it.each(['1.25.000', '0', '12.345.67'])('menolak %s', (raw) => expect(parseAmount(raw, 'IDR')).toBeNull());
});
