// Screenshot every Arshif screen while signed in (e2e test user), light + dark, for visual review.
// Usage: SUPABASE_SECRET_KEY=... node scripts/shots.mjs <baseUrl> <outDir> [routeFilter]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { ids, resetUser, sessionFor, storageKey } from './e2e-live.mjs';

const [base = 'http://localhost:8099', out = 'shots', filter] = process.argv.slice(2);
const schemes = (process.env.SHOTS_SCHEMES || 'light,dark').split(',');
fs.mkdirSync(out, { recursive: true });

const ROUTES = [
  '/', '/transaksi', '/anggaran', '/aset', '/tambah', '/scan', '/voice', '/import', `/trx/${ids.t01}`,
  `/akun/${ids['a-bca']}`, '/akun/grup', '/alat', '/alat/cicilan', '/alat/ekspor', '/alat/kurs', '/alat/laporan', '/alat/pajak',
  '/coach', '/harga', '/kurs-saya', '/invoice', '/invoice/form', '/otomasi', '/otomasi/tinjau',
  '/pengaturan', '/pengaturan/akun', '/pengaturan/data', '/pengaturan/keuangan', '/pengaturan/notifikasi', '/pengaturan/paket', '/pengaturan/tampilan',
  '/premium', '/rencana/goals', '/rencana/langganan', '/rencana/simulator', '/rencana/split', '/rencana/tagihan', '/rencana/utang', '/design',
].filter((r) => !filter || new RegExp(filter).test(r));

await resetUser({ seed: true, onboarded: true });
const session = await sessionFor();
const b = await chromium.launch();
const errors = [];
for (const scheme of schemes) {
  // SHOTS_HEIGHT besar = seluruh isi halaman terlihat (konten RN web ada di dalam ScrollView setinggi viewport).
  const ctx = await b.newContext({ viewport: { width: 390, height: Number(process.env.SHOTS_HEIGHT) || 844 }, colorScheme: scheme, locale: 'id-ID' });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [storageKey(), JSON.stringify(session)]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${p.url()}: ${String(e).slice(0, 160)}`));
  for (const r of ROUTES) {
    await p.goto(base + r, { waitUntil: 'networkidle' }).catch(() => undefined);
    // First visit compiles the bundle; wait for real text instead of a fixed delay.
    await p.waitForFunction(() => document.body.innerText.trim().length > 20, null, { timeout: 60000 }).catch(() => undefined);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(1200);
    const name = (r === '/' ? 'home' : r.slice(1).replace(/\//g, '_')).slice(0, 40);
    await p.screenshot({ path: `${out}/${name}.${scheme}.png`, fullPage: true });
  }
  await ctx.close();
}
await b.close();
console.log(`${ROUTES.length * 2} shots -> ${out}`);
if (errors.length) console.log(errors.join('\n'));
