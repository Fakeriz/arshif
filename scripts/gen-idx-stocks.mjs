// Buat ulang src/data/idxStocks.ts: daftar saham biasa di BEI untuk pemilih kode aset. Pakai: node scripts/gen-idx-stocks.mjs
// Sumber: scanner publik TradingView (tanpa kunci, tidak resmi; idx.co.id menolak klien otomatis). Hanya dijalankan
// manual saat mau memperbarui snapshot, bukan saat runtime. Kode baru (IPO) di luar snapshot dicari lewat symbol-search.
import fs from 'node:fs';

const res = await fetch('https://scanner.tradingview.com/indonesia/scan', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    columns: ['name', 'description', 'type', 'subtype'],
    filter: [{ left: 'exchange', operation: 'equal', right: 'IDX' }, { left: 'type', operation: 'equal', right: 'stock' }],
    range: [0, 3000],
    sort: { sortBy: 'name', sortOrder: 'asc' },
  }),
});
if (!res.ok) throw new Error(`scanner ${res.status}`);
const { data } = await res.json();
const rows = data
  .map((r) => [r.d[0], String(r.d[1]).trim().replace(/\s+/g, ' ').replace(/^Pt /, 'PT ')])
  .filter(([code, name]) => /^[A-Z0-9.]{1,15}$/.test(code) && name)
  .sort((a, b) => a[0].localeCompare(b[0]));
if (rows.length < 500) throw new Error(`hanya ${rows.length} kode, kemungkinan respons terpotong`);
const date = new Date().toISOString().slice(0, 10);
const body = rows.map(([c, n]) => `  [${JSON.stringify(c)}, ${JSON.stringify(n)}],`).join('\n');
fs.writeFileSync(
  new URL('../src/data/idxStocks.ts', import.meta.url),
  `// Dibuat oleh scripts/gen-idx-stocks.mjs pada ${date} (${rows.length} saham biasa BEI). Jangan diubah manual.\n` +
    `export const IDX_STOCKS_DATE = '${date}';\n\n/** [kode, nama emiten], urut kode. */\nexport const IDX_STOCKS: readonly (readonly [string, string])[] = [\n${body}\n];\n`,
);
console.log(`ditulis ${rows.length} kode`);
