// Buat ulang src/data/assetLogos.ts: peta kode saham IDX & US/ETF ke slug logo TradingView.
// Pakai: node scripts/gen-asset-logos.mjs
// Sumber: scanner publik TradingView (tanpa kunci, dijalankan manual saat memperbarui snapshot, bukan saat runtime).
import fs from 'node:fs';

const CODE_RE = /^[A-Z0-9.]{1,15}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9/_-]*$/;

async function scan(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json?.data)) throw new Error(`${url} -> respons tidak valid`);
  return json.data;
}

function collectEntries(rows, target) {
  for (const row of rows) {
    if (row?.d?.[2] === 'preferred') continue;
    const rawCode = String(row?.d?.[0] ?? '').trim().toUpperCase();
    const rawSlug = String(row?.d?.[1] ?? '').trim();
    if (!CODE_RE.test(rawCode) || !SLUG_RE.test(rawSlug)) continue;
    if (!target.has(rawCode)) target.set(rawCode, rawSlug);
  }
}

const idxRows = await scan('https://scanner.tradingview.com/indonesia/scan', {
  columns: ['name', 'logoid'],
  filter: [
    { left: 'exchange', operation: 'equal', right: 'IDX' },
    { left: 'type', operation: 'equal', right: 'stock' },
  ],
  range: [0, 3000],
  sort: { sortBy: 'name', sortOrder: 'asc' },
});

const usStockRows = await scan('https://scanner.tradingview.com/america/scan', {
  columns: ['name', 'logoid', 'subtype'],
  filter: [
    { left: 'exchange', operation: 'in_range', right: ['NASDAQ', 'NYSE', 'AMEX', 'CBOE', 'BATS'] },
    { left: 'type', operation: 'in_range', right: ['stock', 'dr'] },
  ],
  range: [0, 1800],
  sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
});

const usFundRows = await scan('https://scanner.tradingview.com/america/scan', {
  columns: ['name', 'logoid'],
  filter: [
    { left: 'exchange', operation: 'in_range', right: ['NASDAQ', 'NYSE', 'AMEX', 'CBOE', 'BATS'] },
    { left: 'type', operation: 'equal', right: 'fund' },
  ],
  range: [0, 600],
  sort: { sortBy: 'aum', sortOrder: 'desc' },
});

const idxMap = new Map();
collectEntries(idxRows, idxMap);

const usMap = new Map();
collectEntries(usStockRows, usMap);
collectEntries(usFundRows, usMap);

if (idxMap.size < 800) throw new Error(`IDX hanya ${idxMap.size} entri, kemungkinan respons terpotong`);
if (usMap.size < 1800) throw new Error(`US hanya ${usMap.size} entri, kemungkinan respons terpotong`);

function formatRecord(map) {
  const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const lines = [];
  for (let i = 0; i < entries.length; i += 4) {
    const chunk = entries
      .slice(i, i + 4)
      .map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`)
      .join(',');
    lines.push(`  ${chunk},`);
  }
  return lines.join('\n');
}

const date = new Date().toISOString().slice(0, 10);
const output =
  `// Dibuat oleh scripts/gen-asset-logos.mjs pada ${date} (${idxMap.size} IDX, ${usMap.size} US/ETF). Jangan diubah manual.\n` +
  `export const ASSET_LOGOS_DATE = '${date}';\n\n` +
  `/** Kode saham BEI -> slug logo TradingView (s3-symbol-logo.tradingview.com/<slug>--96.png). */\n` +
  `export const IDX_LOGO_SLUGS: Readonly<Record<string, string>> = {\n` +
  `${formatRecord(idxMap)}\n` +
  `};\n\n` +
  `/** Kode saham/ADR & ETF AS utama -> slug logo TradingView (s3-symbol-logo.tradingview.com/<slug>--96.png). */\n` +
  `export const US_LOGO_SLUGS: Readonly<Record<string, string>> = {\n` +
  `${formatRecord(usMap)}\n` +
  `};\n`;

fs.writeFileSync(new URL('../src/data/assetLogos.ts', import.meta.url), output);
console.log(`ditulis ${idxMap.size} IDX dan ${usMap.size} US/ETF`);
