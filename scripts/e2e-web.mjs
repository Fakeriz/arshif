// Klik-tembus alur penting di build web (R-35). Pakai: npm run export:web && npm run e2e:web
// Butuh Chromium: npx playwright install chromium. Mencetak PASS/FAIL per langkah + error console, exit 1 bila ada FAIL.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const dist = path.resolve(process.argv[2] ?? 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = http.createServer((req, res) => { let f = path.join(dist, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html'); res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(8095, r));
const b = await chromium.launch();
const results = []; const errors = [];
const step = async (name, fn) => { try { await fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${String(e.message).split('\n')[0]}`); } };
const open = async (url, scheme = 'dark') => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
  const p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push(`${url}: ${m.text().slice(0, 160)}`));
  p.on('pageerror', (e) => errors.push(`${url}: ${String(e).slice(0, 160)}`));
  await p.goto(`http://localhost:8095${url}`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  return p;
};
const btn = (p, name) => p.getByRole('button', { name, exact: true }).first();
const expectText = async (p, t, timeout = 4000) => p.getByText(t, { exact: false }).locator('visible=true').first().waitFor({ timeout });
const url = (p) => new URL(p.url()).pathname;

await step('Home: nav pill pindah tab Transaksi/Anggaran/Coach/Home', async () => {
  const p = await open('/');
  for (const [tab, path_] of [['Transaksi', '/transaksi'], ['Anggaran', '/anggaran'], ['Coach', '/coach'], ['Home', '/']]) {
    await p.getByRole('tab', { name: tab, exact: true }).click(); await p.waitForTimeout(300);
    if (url(p) !== path_) throw new Error(`${tab} -> ${url(p)}`);
  }
});
await step('Home: tombol + membuka sheet Catat dengan 4 pilihan', async () => {
  const p = await open('/'); await btn(p, 'Catat transaksi').click();
  for (const t of ['Scan Struk', 'Voice Log', 'Import Rekening Koran', 'Catat Manual']) await expectText(p, t);
});
await step('Home: sembunyikan saldo menutup nominal, tampilkan lagi memulihkan', async () => {
  const p = await open('/'); await btn(p, 'Sembunyikan saldo').click();
  await p.getByLabel('Saldo disembunyikan').first().waitFor();
  await btn(p, 'Tampilkan saldo').click(); await p.getByLabel(/^Rp 43\./).first().waitFor();
});
await step('Home: lonceng membuka notifikasi, ketuk recap menuju Coach', async () => {
  const p = await open('/'); await p.getByRole('button', { name: 'Notifikasi, 2 belum dibaca' }).click();
  await p.getByRole('button', { name: /Recap mingguanmu sudah siap.*Belum dibaca/ }).click(); await p.waitForTimeout(500);
  if (url(p) !== '/coach') throw new Error(url(p));
});
await step('Home: kartu akun BCA membuka Transaksi terfilter akun', async () => {
  const p = await open('/'); await p.getByRole('button', { name: /^BCA Tabungan, akhiran 2153/ }).click(); await p.waitForTimeout(500);
  if (url(p) !== '/transaksi') throw new Error(url(p));
  await expectText(p, 'BCA Tabungan');
  if (await p.getByText('Kopi Kenangan').locator('visible=true').count()) throw new Error('filter akun tidak berlaku');
});
await step('Home: kartu batas 4 akun membuka sheet Premium', async () => {
  const p = await open('/'); await p.getByRole('button', { name: /Batas 4 akun tercapai/ }).click(); await expectText(p, 'Buka batas dengan Premium');
  await btn(p, 'Lihat paket Premium').click(); await expectText(p, 'Pembelian belum aktif');
});
await step('Transaksi: cari "kopi" -> 2 hasil, hapus filter pulih', async () => {
  const p = await open('/transaksi'); await p.getByLabel('Cari transaksi').fill('kopi'); await p.waitForTimeout(300);
  await expectText(p, '2 dari 28 transaksi');
  await p.getByLabel('Cari transaksi').fill('zzzz'); await expectText(p, 'Tidak ada transaksi yang cocok');
  await btn(p, 'Hapus semua filter').click(); await expectText(p, '28 dari 28 transaksi');
});
await step('Transaksi: chip Pemasukan + sheet Filter akun', async () => {
  const p = await open('/transaksi'); await p.getByRole('checkbox', { name: 'Pemasukan' }).click(); await expectText(p, '1 dari 28 transaksi');
  await p.getByRole('checkbox', { name: 'Semua' }).click(); await p.getByRole('checkbox', { name: 'Filter' }).click();
  await p.getByRole('checkbox', { name: 'Jago Kantong Utama' }).click(); await btn(p, 'Selesai').click(); await expectText(p, 'dari 28 transaksi');
});
await step('Detail: tampil item struk; hapus -> dialog -> transaksi hilang dari daftar', async () => {
  const p = await open('/transaksi'); await p.getByRole('button', { name: /^Indomaret Kemang Raya, Rp 87\.500/ }).click(); await expectText(p, 'Item belanja'); await expectText(p, 'Indomie Goreng');
  await btn(p, 'Hapus transaksi').click(); await expectText(p, 'Hapus transaksi ini?'); await btn(p, 'Hapus').click(); await p.waitForTimeout(700);
  if (await p.getByText('Indomaret Kemang Raya').count()) throw new Error('masih ada');
  await expectText(p, '27 dari 27 transaksi');
});
await step('Detail: transaksi mata uang asing menampilkan konversi + kurs', async () => {
  const p = await open('/trx/t07'); await expectText(p, 'Konversi mata uang'); await expectText(p, '1 TRY = ');
});
await step('Form manual: kosong -> pesan error per field', async () => {
  const p = await open('/tambah'); await btn(p, 'Simpan transaksi').click();
  for (const t of ['Isi nominal lebih dari nol.', 'Tulis nama toko atau keterangan.', 'Pilih kategori.']) await expectText(p, t);
});
await step('Form manual: simpan pengeluaran -> muncul di daftar paling atas', async () => {
  const p = await open('/tambah'); await p.getByRole('textbox', { name: /Nominal/ }).fill('45000'); await p.getByLabel('Toko atau keterangan').fill('Es teh Solo');
  await p.getByRole('checkbox', { name: 'Makan & Minum' }).click(); await btn(p, 'Simpan transaksi').click(); await p.waitForTimeout(700);
  await expectText(p, 'Transaksi tersimpan');
});
await step('Form manual: transfer butuh akun tujuan berbeda', async () => {
  const p = await open('/tambah'); await p.getByRole('tab', { name: 'Transfer' }).click(); await p.getByRole('textbox', { name: /Nominal/ }).fill('100000'); await btn(p, 'Simpan transaksi').click();
  await expectText(p, 'Pilih akun tujuan.');
});
await step('Anggaran: sheet persentase menolak total != 100, menerima 60/20/20', async () => {
  const p = await open('/anggaran'); await btn(p, 'Atur').click(); await btn(p, 'Tambah Kebutuhan').click();
  await expectText(p, 'Total 105%'); if (!(await btn(p, 'Simpan persentase').isDisabled())) throw new Error('tombol tidak disabled');
  await btn(p, 'Kurangi Keinginan').click(); await btn(p, 'Kurangi Tabungan & Utang').click(); await btn(p, 'Tambah Kebutuhan').click();
  await expectText(p, 'Total 100%'); await btn(p, 'Simpan persentase').click(); await expectText(p, '60% dari penghasilan');
});
await step('Coach: tab Recap, Tanya Coach (batas) -> Premium', async () => {
  const p = await open('/coach'); await p.getByRole('tab', { name: 'Recap' }).click(); await expectText(p, 'Minggu lalu kamu belanja');
  await p.getByRole('tab', { name: 'Tanya Coach' }).click(); await expectText(p, 'Tanya Coach khusus Premium'); await btn(p, 'Lihat Premium').click(); await expectText(p, 'Buka batas dengan Premium');
});
await step('Pengaturan: ganti aksen ke Biru, mata uang MYR, toggle notifikasi', async () => {
  const p = await open('/pengaturan'); await p.getByRole('radio', { name: 'Biru' }).click();
  if ((await p.getByRole('radio', { name: 'Biru' }).getAttribute('aria-checked')) !== 'true') throw new Error('aksen tidak terpilih');
  await p.getByRole('button', { name: /Mata uang utama/ }).click(); await p.getByRole('button', { name: /^MYR/ }).click(); await expectText(p, 'MYR');
  const sw = p.getByRole('switch', { name: 'Recap mingguan' }); if ((await sw.getAttribute('aria-checked')) !== 'true') throw new Error('switch awal'); await sw.click(); if ((await sw.getAttribute('aria-checked')) !== 'false') throw new Error('toggle');
});
await step('Pengaturan: Hapus akun menampilkan dialog konfirmasi', async () => {
  const p = await open('/pengaturan'); await p.getByRole('button', { name: /^Hapus akun/ }).click(); await expectText(p, 'Hapus akun dan semua data?'); await btn(p, 'Batal').click();
});
await step('Scan: bidik -> baca -> review -> simpan -> masuk daftar, kuota 15', async () => {
  const p = await open('/scan'); await btn(p, 'Ambil foto struk').click(); await expectText(p, 'Membaca struk'); await expectText(p, 'Cek hasil scan', 5000);
  await expectText(p, 'Keyakinan 62%'); await expectText(p, 'berbeda Rp 3.000');
  await p.getByLabel('2 × Rp 19.500').fill('39000'); await p.waitForTimeout(200);
  if (await p.getByText('berbeda Rp').count()) throw new Error('peringatan selisih tidak hilang setelah item diperbaiki');
  await btn(p, 'Simpan transaksi').click(); await expectText(p, 'Struk tersimpan'); await expectText(p, '29 dari 29 transaksi');
});
await step('Scan: state error -> struk tidak terbaca, foto ulang', async () => {
  const p = await open('/scan?state=error'); await btn(p, 'Ambil foto struk').click(); await expectText(p, 'Struk tidak terbaca', 5000); await btn(p, 'Foto ulang').click(); await expectText(p, 'Posisikan struk');
});
await step('Voice: rekam -> selesai -> review -> simpan semua', async () => {
  const p = await open('/voice'); await btn(p, 'Mulai merekam').click(); await p.waitForTimeout(1300); await expectText(p, '00:01');
  await btn(p, 'Selesai merekam').click(); await expectText(p, 'Cek hasil Voice Log', 5000); await expectText(p, 'tidak ditemukan, memakai BCA Tabungan');
  await btn(p, 'Simpan semua (2)').click(); await expectText(p, '2 transaksi tersimpan'); await expectText(p, '30 dari 30 transaksi');
});
await step('Import: pilih berkas -> baca -> 3 duplikat tidak dicentang -> import 3', async () => {
  const p = await open('/import'); if (!(await btn(p, 'Baca rekening koran').isDisabled())) throw new Error('harus disabled tanpa berkas');
  await btn(p, 'Pilih berkas PDF').click(); await btn(p, 'Baca rekening koran').click(); await expectText(p, 'Cek hasil import', 5000);
  await expectText(p, '3 baris mirip'); await btn(p, 'Import 3 transaksi').click(); await expectText(p, '3 transaksi diimpor'); await expectText(p, '31 dari 31 transaksi');
});
await step('State limit: Scan/Voice/Import menampilkan batas + paywall', async () => {
  for (const [path_, t] of [['/scan?state=limit', 'Kuota scan bulan ini habis'], ['/voice?state=limit', 'Kuota automation bulan ini habis'], ['/import?state=limit', 'Kuota import bulan ini habis']]) {
    const p = await open(path_); await expectText(p, t); await btn(p, 'Lihat Premium').click(); await expectText(p, 'Buka batas dengan Premium');
  }
});
await step('State loading/error/empty tampil di Home, Transaksi, Anggaran, Coach', async () => {
  for (const path_ of ['/', '/transaksi', '/anggaran', '/coach']) {
    const e = await open(`${path_}?state=error`); await expectText(e, 'gagal dimuat'); await btn(e, 'Coba lagi').click(); await e.waitForTimeout(500);
    if (await e.getByText('gagal dimuat').count()) throw new Error(`${path_} retry tidak memulihkan`);
    const l = await open(`${path_}?state=loading`); await l.getByLabel(/^Memuat/).first().waitFor({ timeout: 3000 });
  }
  const h = await open('/?state=empty'); await expectText(h, 'Belum ada transaksi');
  const t = await open('/transaksi?state=empty'); await expectText(t, 'Belum ada transaksi'); await btn(t, 'Catat sekarang').click(); await expectText(t, 'Catat transaksi');
});
await step('Keyboard: Tab menunjukkan ring fokus, Enter mengaktifkan, mouse tidak memunculkan ring', async () => {
  const p = await open('/');
  await btn(p, 'Sembunyikan saldo').click(); await p.waitForTimeout(200);
  const mouseRing = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  if (mouseRing === 'solid') throw new Error('ring muncul setelah klik mouse');
  await p.keyboard.press('Tab'); await p.waitForTimeout(200);
  const ring = await p.evaluate(() => getComputedStyle(document.activeElement.firstElementChild ?? document.activeElement).outlineStyle + '|' + getComputedStyle(document.activeElement).outlineStyle);
  if (!ring.includes('solid')) throw new Error('ring fokus tidak terlihat setelah Tab: ' + ring);
  await p.goto('http://localhost:8095/', { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  if (url(p) !== '/pengaturan') throw new Error('Enter pada tombol profil -> ' + url(p));
});
await step('Escape menutup sheet Catat', async () => {
  const p = await open('/'); await btn(p, 'Catat transaksi').click(); await expectText(p, 'Pilih cara tercepat untukmu');
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  if (await p.getByText('Pilih cara tercepat untukmu').locator('visible=true').count()) throw new Error('sheet masih terbuka');
});
console.log(results.join('\n')); console.log('\nERROR CONSOLE:', errors.length ? [...new Set(errors)].join('\n') : 'tidak ada');
await b.close(); server.close();
if (results.some((r) => r.startsWith('FAIL')) || errors.length) process.exit(1);
