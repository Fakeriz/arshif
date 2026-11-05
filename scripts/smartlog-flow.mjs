// Alur Smart Log ujung ke ujung tanpa HP: parser + pemrosesan aplikasi (src/lib/smartlog) + migrasi SQL (PGlite).
// Pakai: npm run test:smartlog
import { register } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

register('./ts-hooks.mjs', import.meta.url);
const { processCaptures } = await import('../src/lib/smartlog/process.ts');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const U = '00000000-0000-4000-8000-0000000000f1';
const db = new PGlite();
const results = [];
let failed = 0;

async function as(user, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); set role ${user ? 'authenticated' : 'postgres'};`);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}
async function test(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
  } catch (e) {
    failed++;
    results.push(`FAIL ${name}: ${e.message}`);
  }
}

/** Sama dengan data/remote/smartlog.ts ingest(), tapi lewat SQL langsung sebagai pengguna. */
const ingest = async (c, p, date, time) => {
  const [{ r }] = await as(U, 'select public.smartlog_ingest($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) as r',
    [c.key, c.pkg, p.bank, new Date(c.postedAt).toISOString(), date, time, p.type, p.amount, p.currency, p.merchant, p.excerpt, p.fingerprint, p.doubts]);
  return r;
};

let seq = 0;
const NOW = Date.UTC(2026, 10, 5, 7, 0);
const cap = (pkg, title, text) => {
  seq++;
  return { key: `k${seq}`, pkg, title, text, postedAt: NOW + seq * 30 * 60_000 };
};
const txCount = async () => (await as(U, 'select count(*)::int as n from public.transactions'))[0].n;
const balance = async () => Number((await as(null, 'select balance from public.accounts where id = $1', [bca]))[0].balance);

await db.exec(fs.readFileSync(path.join(root, 'supabase/tests/supabase-stub.sql'), 'utf8'));
for (const f of fs.readdirSync(path.join(root, 'supabase/migrations')).sort()) {
  if (f.includes('cron')) continue;
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8').replace(/^create extension.*$/gm, ''));
}
await as(null, `insert into auth.users (id, email) values ('${U}', 'smartlog@example.com')`);
const [{ id: bca }] = await as(U, `insert into public.accounts (bank, name, type, currency, opening_balance) values ('bca', 'BCA', 'tabungan', 'IDR', 1000000) returning id`);
await as(U, 'update public.profiles set smartlog_enabled = true');
await as(U, `insert into public.smartlog_links (package, account_id) values ('com.bca.mybca.omni.android', $1)`, [bca]);

const PAID = 'Pembayaran QRIS Rp 45.000,00 di KOPI SENJA berhasil. Saldo Rp 955.000';
let reviewId, appliedId, firstCapture;

await test('yakin -> tercatat; meragukan dan duplikat -> To Review; OTP/promo dibuang', async () => {
  firstCapture = cap('com.bca.mybca.omni.android', 'Transaksi Berhasil', PAID);
  const sum = await processCaptures([
    firstCapture,
    cap('id.dana', 'DANA', 'Pembayaran Rp 30.000 ke WARTEG berhasil'),
    cap('com.bca.mybca.omni.android', 'Kode OTP', 'Kode OTP 482913. Jangan berikan kepada siapa pun.'),
    cap('com.bca.mybca.omni.android', 'Promo', 'Diskon 50% s.d. Rp 100.000 untuk pembayaran QRIS'),
    // Notifikasi yang sama datang dua kali (kunci beda, isi sama).
    cap('com.bca.mybca.omni.android', 'Transaksi Berhasil', PAID),
  ], ingest, NOW);
  assert.deepEqual([sum.applied.length, sum.review, sum.dropped, sum.held.length], [1, 2, 2, 0]);
  appliedId = sum.applied[0].id;
  assert.equal(await txCount(), 1);
  assert.equal(await balance(), 955000);
  const review = await as(U, `select id, reasons from public.smartlog_items where status = 'review' order by created_at`);
  assert.deepEqual(review.map((r) => r.reasons), [['no_link'], ['duplicate']]);
  reviewId = review[0].id;
});

await test('antrean yang sama terkirim ulang: tidak tercatat dua kali', async () => {
  const again = await processCaptures([firstCapture], ingest, NOW);
  assert.deepEqual([again.applied.length, again.review], [0, 0]);
  assert.equal(await txCount(), 1);
});

await test('konfirmasi dari To Review mencatat transaksinya', async () => {
  // Aplikasi menyimpan transaksi dengan id baris (commitTx), lalu menandai baris terkonfirmasi.
  await as(U, `insert into public.transactions (id, type, merchant, category_key, account_id, date, time, amount, currency, source)
               values ($1, 'expense', 'WARTEG', 'food', $2, '2026-11-05', '14:30', 30000, 'IDR', 'smartlog')`, [reviewId, bca]);
  await as(U, 'select public.smartlog_confirm($1)', [reviewId]);
  assert.equal(await txCount(), 2);
  assert.equal(await balance(), 925000);
  assert.equal((await as(U, 'select status from public.smartlog_items where id = $1', [reviewId]))[0].status, 'confirmed');
});

await test('Undo untuk yang tercatat otomatis menghapus transaksinya', async () => {
  await as(U, 'select public.smartlog_undo($1)', [appliedId]);
  assert.equal(await txCount(), 1);
  assert.equal(await balance(), 970000);
});

await test('kuota habis: notifikasi ditahan di perangkat, diproses setelah Premium', async () => {
  await as(null, `insert into public.usage_counters (user_id, period, key, used) values ($1, public.current_period(), 'automation', 30)
                  on conflict (user_id, period, key) do update set used = 30`, [U]);
  const captures = [
    cap('com.bca.mybca.omni.android', 'Transaksi Berhasil', 'Pembayaran QRIS Rp 20.000 di BAKSO berhasil'),
    cap('com.bca.mybca.omni.android', 'Transaksi Berhasil', 'Pembayaran QRIS Rp 12.000 di PARKIR berhasil'),
  ];
  const held = await processCaptures(captures, ingest, NOW);
  assert.equal(held.quotaHit, true);
  assert.deepEqual(held.held.map((c) => c.key), captures.map((c) => c.key));
  assert.equal(await txCount(), 1);
  assert.equal((await as(U, `select count(*)::int as n from public.notifications where type = 'quota_warning'`))[0].n, 1);
  await as(null, `update public.profiles set plan = 'premium' where id = $1`, [U]);
  const retry = await processCaptures(held.held, ingest, NOW);
  assert.deepEqual([retry.applied.length, retry.quotaHit], [2, false]);
  assert.equal(await txCount(), 3);
});

await test('gagal jaringan: tangkapan ditahan untuk dicoba ulang', async () => {
  const c = cap('com.bca.mybca.omni.android', 'Transaksi Berhasil', 'Pembayaran QRIS Rp 7.000 di FOTOKOPI berhasil');
  const sum = await processCaptures([c], async () => { throw new Error('network'); }, NOW);
  assert.deepEqual(sum.held.map((x) => x.key), [c.key]);
});

await test('automation OFF: tidak ada yang diproses', async () => {
  await as(U, 'update public.profiles set smartlog_enabled = false');
  const sum = await processCaptures([cap('com.bca.mybca.omni.android', 'Transaksi Berhasil', 'Pembayaran QRIS Rp 9.000 di ES TEH berhasil')], ingest, NOW);
  assert.deepEqual([sum.applied.length, sum.review, sum.held.length], [0, 0, 0]);
});

console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} lolos`);
process.exit(failed ? 1 : 0);
