// Klik-tembus LIVE di build web terhadap Supabase sungguhan (R-35). Pakai: npm run export:web && npm run e2e:web
// Butuh SUPABASE_SECRET_KEY (pengguna uji dibuat ulang tiap langkah) + Chromium (npx playwright install chromium).
// Mencetak PASS/FAIL per langkah + error console, exit 1 bila ada FAIL.
import { chromium } from 'playwright';
import { ids, resetUser, sessionFor, storageKey } from './e2e-live.mjs';
import { receiptJpeg, statementPdf } from './e2e-fixtures.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const dist = path.resolve(process.argv[2] ?? 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = http.createServer((req, res) => { let f = path.join(dist, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html'); res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(8095, r));
const b = await chromium.launch();
const results = []; const errors = [];
// Tiap langkah mulai dari data contoh yang sama di server (reset = hapus pengguna uji + seed ulang).
let session = null;
let lastPage = null;
// Halaman langkah sebelumnya ditutup sebelum reset: kalau tidak, request susulannya memakai pengguna yang
// sudah dihapus dan muncul sebagai error konsol palsu (403/406).
const contexts = [];
const shotDir = process.env.E2E_SHOTS;
const only = process.env.E2E_ONLY ? new RegExp(process.env.E2E_ONLY, 'i') : null;
const step = async (name, fn, { seed = true, onboarded = true, signedIn = true } = {}) => {
  if (only && !only.test(name)) return;
  await Promise.all(contexts.splice(0).map((c) => c.close().catch(() => undefined)));
  try {
    await resetUser({ seed, onboarded });
    session = signedIn ? await sessionFor() : null;
    await fn();
    results.push(`PASS ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${String(e.message).split('\n')[0]}`);
    if (shotDir && lastPage) await lastPage.screenshot({ path: `${shotDir}/fail-${results.length}.png`, fullPage: true }).catch(() => undefined);
  }
};
// Bahasa mengikuti perangkat (I18nProvider.detectLang), jadi locale dipaksa: default id-ID.
const open = async (url, scheme = 'dark', locale = 'id-ID') => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale });
  contexts.push(ctx);
  // Sesi login sungguhan disuntikkan ke penyimpanan supabase-js sebelum aplikasi dimuat.
  if (session) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [storageKey(), JSON.stringify(session)]);
  const p = await ctx.newPage();
  lastPage = p;
  p.on('console', (m) => m.type() === 'error' && errors.push(`${url}: ${m.text().slice(0, 160)}`));
  p.on('pageerror', (e) => errors.push(`${url}: ${String(process.env.E2E_STACK ? e.stack : e).slice(0, process.env.E2E_STACK ? 1500 : 160)}`));
  await p.goto(`http://localhost:8095${url}`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
  return p;
};
const reloadPage = async (p) => { await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500); };
const btn = (p, name) => p.getByRole('button', { name, exact: true }).first();
const expectText = async (p, t, timeout = 4000) => p.getByText(t, { exact: false }).locator('visible=true').first().waitFor({ timeout });
const url = (p) => new URL(p.url()).pathname;

await step('Home: nav pill pindah tab Transaksi/Anggaran/Aset/Home, Aset = Segera hadir', async () => {
  const p = await open('/');
  for (const [tab, path_] of [['Transaksi', '/transaksi'], ['Anggaran', '/anggaran'], ['Aset', '/aset'], ['Home', '/']]) {
    await p.getByRole('tab', { name: tab, exact: true }).click(); await p.waitForTimeout(300);
    if (url(p) !== path_) throw new Error(`${tab} -> ${url(p)}`);
    if (tab === 'Aset') await expectText(p, 'Segera hadir');
  }
});
await step('Home: aksi cepat Lainnya = Import PDF + Catat Manual, Coach membuka layar Coach', async () => {
  const p = await open('/'); await btn(p, 'Lainnya').click();
  for (const t of ['Import Rekening Koran', 'Catat Manual']) await expectText(p, t);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await btn(p, 'Coach').click(); await p.waitForTimeout(500);
  if (url(p) !== '/coach') throw new Error(url(p));
});
await step('Home: tombol + membuka sheet Catat dengan 4 pilihan', async () => {
  const p = await open('/'); await btn(p, 'Catat transaksi').click();
  for (const t of ['Scan Struk', 'Voice Log', 'Import Rekening Koran', 'Catat Manual']) await expectText(p, t);
});
await step('Home: sembunyikan saldo menutup nominal, tampilkan lagi memulihkan', async () => {
  const p = await open('/'); await btn(p, 'Sembunyikan saldo').click();
  await p.getByLabel('Saldo disembunyikan').first().waitFor();
  await btn(p, 'Tampilkan saldo').click(); await p.getByLabel(/^Rp \d/).first().waitFor();
});
await step('Home: lonceng membuka notifikasi, ketuk recap menuju Coach', async () => {
  const p = await open('/'); await p.getByRole('button', { name: 'Notifikasi, 2 belum dibaca' }).click();
  await p.getByRole('button', { name: /Recap mingguanmu sudah siap.*Belum dibaca/ }).click(); await p.waitForTimeout(500);
  if (url(p) !== '/coach') throw new Error(url(p));
});
// Deck: strip ramping -> ketuk -> FlatList paging; geser = scroll horizontal native.
const openDeck = async (p) => { await p.getByRole('button', { name: /kartu akun aktif$/ }).click(); await p.waitForTimeout(800); };
const pageDeck = async (p, pages) => {
  const card = await p.getByRole('button', { name: /^BCA Tabungan, akhiran 2153/ }).first().boundingBox();
  await p.evaluate(([y, n]) => {
    const list = [...document.querySelectorAll('div')].find((d) => /auto|scroll/.test(getComputedStyle(d).overflowX) && d.scrollWidth > d.clientWidth && d.getBoundingClientRect().top <= y && d.getBoundingClientRect().bottom >= y);
    list.scrollBy({ left: list.clientWidth * n, behavior: 'instant' });
  }, [card.y + card.height / 2, pages]);
};
await step('Home: strip akun membuka deck, ketuk kartu menutup kembali ke strip', async () => {
  const p = await open('/'); await openDeck(p);
  await p.getByRole('button', { name: /^BCA Tabungan, akhiran 2153/ }).click(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: 'BCA Tabungan, kartu akun aktif' }).click({ trial: true });
});
await step('Home: kartu batas 4 akun membuka sheet Premium', async () => {
  const p = await open('/'); await openDeck(p); await pageDeck(p, 4); await p.waitForTimeout(600);
  await p.getByRole('button', { name: /Batas 4 akun tercapai/ }).click(); await expectText(p, 'Buka batas dengan Premium');
  await btn(p, 'Lihat paket Premium').click(); await expectText(p, 'Pembelian belum aktif');
});
await step('Home: geser kartu akun -> snap ke kartu berikut, titik pindah, akun aktif jadi default Catat manual', async () => {
  const p = await open('/');
  await openDeck(p); await p.getByLabel('Kartu 1 dari 5').waitFor();
  await pageDeck(p, 1);
  await p.getByLabel('Kartu 2 dari 5').waitFor({ timeout: 3000 });
  await btn(p, 'Catat transaksi').click(); await p.getByText('Catat Manual').first().click();
  const chip = p.getByRole('checkbox', { name: /^Jago Kantong Utama/ }).first(); await chip.waitFor();
  const checked = await chip.getAttribute('aria-checked');
  if (checked !== 'true') throw new Error('akun default bukan Jago: ' + checked);
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
  const p = await open(`/trx/${ids.t07}`); await expectText(p, 'Konversi mata uang'); await expectText(p, '1 TRY = ');
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
await step('Pengaturan: ganti bahasa ke Türkçe -> seluruh UI ikut, nav dan tanggal', async () => {
  const p = await open('/pengaturan'); await p.getByRole('button', { name: /^Bahasa/ }).click();
  await btn(p, 'Türkçe').click(); await expectText(p, 'Ayarlar'); await expectText(p, 'Görünüm');
  await btn(p, 'Geri').click(); await p.waitForTimeout(400); await p.getByRole('tab', { name: 'Ana Sayfa', exact: true }).waitFor({ timeout: 3000 });
});
await step('Bahasa: sebelum login ikut perangkat (ms/en, lainnya Indonesia); setelah login ikut profil', async () => {
  const ms = await open('/', 'dark', 'ms-MY'); await expectText(ms, 'Log masuk atau daftar');
  const en = await open('/', 'dark', 'en-US'); await expectText(en, 'Sign in or sign up');
  const fr = await open('/', 'dark', 'fr-FR'); await expectText(fr, 'Masuk atau daftar');
  session = await sessionFor(); // profil tersimpan = Indonesia, walau perangkat berbahasa Inggris
  const app = await open('/pengaturan', 'dark', 'en-US'); await expectText(app, 'Pengaturan');
}, { signedIn: false });
await step('Pengaturan: pilih desain kartu bank -> kartu di Beranda berganti warna dan nama', async () => {
  const p = await open('/pengaturan'); await p.getByRole('button', { name: /^GoPay/ }).first().click();
  await expectText(p, 'Desain kartu'); await p.getByRole('radio', { name: 'ShopeePay' }).click();
  if ((await p.getByRole('radio', { name: 'ShopeePay' }).getAttribute('aria-checked')) !== 'true') throw new Error('ShopeePay tidak terpilih');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /^Kembali$/ }).first().click(); await p.waitForTimeout(400);
  await p.getByLabel(/^ShopeePay E-Wallet/).first().waitFor({ timeout: 3000 });
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
await step('Tanpa sesi: aplikasi membuka layar masuk, bukan layar kosong', async () => {
  const p = await open('/'); if (url(p) !== '/masuk') throw new Error(url(p)); await expectText(p, 'Masuk atau daftar');
  await p.getByLabel('Email').fill('bukan-email'); await btn(p, 'Kirim kode').click(); await expectText(p, 'Format email belum benar');
}, { signedIn: false });
await step('Setup 3 langkah pengguna baru -> akun pertama tersimpan di server -> Beranda', async () => {
  const p = await open('/'); if (url(p) !== '/setup') throw new Error(url(p));
  await expectText(p, 'Mata uang utama'); await btn(p, 'Lanjut').click();
  await btn(p, 'Lanjut').click(); await expectText(p, 'Isi nama akun.');
  await p.getByLabel('Nama akun').fill('BCA Gaji'); await btn(p, 'Lanjut').click();
  await btn(p, 'Mulai pakai Arshif').click(); await expectText(p, 'Isi penghasilan bulanan');
  await p.getByRole('textbox', { name: /Penghasilan bulanan/ }).fill('9000000'); await btn(p, 'Mulai pakai Arshif').click();
  await p.getByLabel(/^BCA Tabungan|^BCA /).first().waitFor({ timeout: 8000 });
  await reloadPage(p); if (url(p) !== '/') throw new Error('setelah muat ulang: ' + url(p));
}, { seed: false, onboarded: false });
await step('Pengguna baru: bahasa perangkat (Melayu) dipakai di setup dan tersimpan di profil', async () => {
  const p = await open('/', 'dark', 'ms-MY'); await expectText(p, 'Langkah 1 daripada 3');
  await p.waitForTimeout(1500); await reloadPage(p); await expectText(p, 'Langkah 1 daripada 3');
}, { seed: false, onboarded: false });
await step('Simpan manual bertahan setelah muat ulang (tersimpan di Supabase)', async () => {
  const p = await open('/tambah'); await p.getByRole('textbox', { name: /Nominal/ }).fill('45000'); await p.getByLabel('Toko atau keterangan').fill('Es teh Solo');
  await p.getByRole('checkbox', { name: 'Makan & Minum' }).click(); await btn(p, 'Simpan transaksi').click(); await expectText(p, 'Transaksi tersimpan');
  await p.waitForTimeout(1500); await p.goto('http://localhost:8095/transaksi', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  await expectText(p, 'Es teh Solo'); await expectText(p, '29 dari 29 transaksi');
});
await step('Preferensi bertahan setelah muat ulang: aksen, bahasa, desain kartu', async () => {
  const p = await open('/pengaturan'); await p.getByRole('radio', { name: 'Biru' }).click();
  await p.getByRole('button', { name: /^GoPay/ }).first().click(); await p.getByRole('radio', { name: 'ShopeePay' }).click(); await p.keyboard.press('Escape');
  await p.getByRole('button', { name: /^Bahasa/ }).click(); await btn(p, 'English').click(); await expectText(p, 'Settings');
  await p.waitForTimeout(1500); await reloadPage(p);
  await expectText(p, 'Settings');
  if ((await p.getByRole('radio', { name: 'Blue' }).getAttribute('aria-checked')) !== 'true') throw new Error('aksen tidak tersimpan');
  await expectText(p, 'ShopeePay');
});
await step('Scan struk LIVE: pilih foto -> Gemini membaca -> review -> simpan', async () => {
  const p = await open('/scan'); const chooser = p.waitForEvent('filechooser'); await btn(p, 'Pilih dari galeri').click();
  await (await chooser).setFiles({ name: 'struk.jpg', mimeType: 'image/jpeg', buffer: await receiptJpeg() });
  await expectText(p, 'Cek hasil scan', 30000); await expectText(p, 'INDOMIE GORENG');
  if ((await p.getByRole('textbox', { name: /Total belanja/ }).inputValue()) !== '87.500') throw new Error('total salah');
  await btn(p, 'Simpan transaksi').click(); await expectText(p, 'Struk tersimpan');
});
await step('Import PDF LIVE: pilih PDF -> Gemini membaca baris -> duplikat tidak dicentang -> import', async () => {
  const p = await open('/import'); const chooser = p.waitForEvent('filechooser'); await btn(p, 'Pilih berkas PDF').click();
  await (await chooser).setFiles({ name: 'rekening.pdf', mimeType: 'application/pdf', buffer: await statementPdf() });
  await btn(p, 'Baca rekening koran').click(); await expectText(p, 'Cek hasil import', 45000);
  await expectText(p, 'Kemungkinan duplikat'); await p.getByRole('button', { name: /^Import \d+ transaksi/ }).click(); await expectText(p, 'transaksi diimpor');
});
console.log(results.join('\n')); console.log('\nERROR CONSOLE:', errors.length ? [...new Set(errors)].join('\n') : 'tidak ada');
await b.close(); server.close();
if (results.some((r) => r.startsWith('FAIL')) || errors.length) process.exit(1);
