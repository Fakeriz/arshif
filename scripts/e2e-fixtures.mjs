// Berkas uji sintetis yang isinya diketahui pasti: struk (JPEG) dan rekening koran (PDF).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// Mesin CI/server sering tanpa font sistem: Chromium lalu merender teks kosong. Font disematkan langsung.
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fontDir = path.join(root, 'node_modules/@expo-google-fonts/plus-jakarta-sans');
const ttf = (file) => {
  const dir = fs.readdirSync(fontDir).find((d) => fs.existsSync(path.join(fontDir, d, file)));
  return fs.readFileSync(path.join(fontDir, dir, file)).toString('base64');
};
const FONTS = { 400: ttf('PlusJakartaSans_500Medium.ttf'), 700: ttf('PlusJakartaSans_700Bold.ttf') };
const FONT_CSS = '<style>body, table, th, td, h2, p { font-family: F !important; }</style>';

/** @font-face dari CSS gagal dimuat di Chromium headless ini; FontFace lewat JS dari bytes berhasil. */
async function loadFonts(p) {
  await p.evaluate(async (fonts) => {
    for (const [weight, b64] of Object.entries(fonts)) {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const face = new FontFace('F', bytes, { weight });
      document.fonts.add(await face.load());
    }
  }, FONTS);
}

const RECEIPT_HTML = `${FONT_CSS}<body style="font-family:monospace;padding:24px;background:#fff;color:#111;font-size:16px">
  <h2 style="text-align:center;margin:0">INDOMARET</h2><p style="text-align:center;margin:4px 0 16px">KEMANG RAYA JAKARTA<br>05-11-2026 08:14</p>
  <table style="width:100%"><tr><td>INDOMIE GORENG 5 x 3.500</td><td align=right>17.500</td></tr>
  <tr><td>TELUR AYAM 1KG</td><td align=right>29.000</td></tr><tr><td>SUSU UHT 1L 2 x 19.500</td><td align=right>39.000</td></tr>
  <tr><td>KANTONG BELANJA</td><td align=right>2.000</td></tr></table><hr>
  <table style="width:100%"><tr><td><b>TOTAL</b></td><td align=right><b>87.500</b></td></tr><tr><td>TUNAI</td><td align=right>100.000</td></tr>
  <tr><td>KEMBALI</td><td align=right>12.500</td></tr></table><p style="text-align:center">TERIMA KASIH</p></body>`;

const STATEMENT_HTML = `${FONT_CSS}<body style="font-family:Arial;font-size:12px;padding:32px">
  <h2>BANK CENTRAL ASIA - REKENING TAHAPAN</h2><p>No. Rekening 1234562153 · Periode 25/10/2026 - 04/11/2026 · Mata uang IDR</p>
  <table border=1 cellspacing=0 cellpadding=6 style="width:100%;border-collapse:collapse">
  <tr><th>Tanggal</th><th>Keterangan</th><th>Mutasi</th><th>Saldo</th></tr>
  <tr><td>29/10/2026</td><td>DEBIT APOTEK K-24 KEMANG</td><td>87.500 DB</td><td>13.412.500</td></tr>
  <tr><td>30/10/2026</td><td>BIAYA ADM BULANAN</td><td>12.500 DB</td><td>13.400.000</td></tr>
  <tr><td>31/10/2026</td><td>TRSF E-BANKING CR DARI AYAH</td><td>500.000 CR</td><td>13.900.000</td></tr>
  <tr><td>01/11/2026</td><td>TRSF SEWA KOS NOVEMBER</td><td>1.750.000 DB</td><td>12.150.000</td></tr>
  <tr><td>02/11/2026</td><td>BUNGA TABUNGAN</td><td>8.300 CR</td><td>12.158.300</td></tr></table></body>`;

async function render(fn) {
  const b = await chromium.launch();
  try {
    return await fn(await b.newPage({ viewport: { width: 420, height: 640 } }));
  } finally {
    await b.close();
  }
}

export const receiptJpeg = () => render(async (p) => (await p.setContent(RECEIPT_HTML), await loadFonts(p), p.screenshot({ type: 'jpeg', quality: 85, fullPage: true })));
export const statementPdf = () => render(async (p) => (await p.setContent(STATEMENT_HTML), await loadFonts(p), p.pdf({ format: 'A4' })));
