// Uji migrasi Supabase (skema, trigger saldo, kuota, RLS) di PGlite tanpa Docker.
// Pakai: npm run test:db. Migrasi cron (pg_cron/pg_net/vault) tidak diuji di sini.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const db = new PGlite();
const results = [];
let failed = 0;

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
await db.exec(read('supabase/tests/supabase-stub.sql'));
for (const f of fs.readdirSync(path.join(root, 'supabase/migrations')).sort()) {
  if (f.includes('cron')) continue;
  const sql = read(`supabase/migrations/${f}`).replace(/^create extension.*$/gm, '');
  try {
    await db.exec(sql);
  } catch (e) {
    console.error(`MIGRASI GAGAL ${f}: ${e.message}`);
    process.exit(1);
  }
}

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

/** Jalankan sebagai pengguna (role authenticated + klaim sub), seperti PostgREST. */
async function as(user, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); set role ${user ? 'authenticated' : 'postgres'};`);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}
const sys = (sql, params) => as(null, sql, params);

async function test(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
  } catch (e) {
    failed++;
    results.push(`FAIL ${name}: ${e.message}`);
  }
}
function eq(actual, expected, msg = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${msg} diharapkan ${JSON.stringify(expected)}, didapat ${JSON.stringify(actual)}`);
}
async function rejects(promise, pattern) {
  try {
    await promise;
  } catch (e) {
    if (pattern && !pattern.test(e.message)) throw new Error(`error salah: ${e.message}`);
    return;
  }
  throw new Error('seharusnya ditolak');
}
const balance = async (id) => Number((await sys('select balance from public.accounts where id = $1', [id]))[0].balance);

await sys(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com')`);

await test('profil dibuat otomatis saat daftar, paket free', async () => {
  eq((await as(A, 'select plan, lang, main_currency from public.profiles')), [{ plan: 'free', lang: 'id', main_currency: 'IDR' }]);
});

let bca, jago, mbb;
await test('akun baru: saldo = saldo awal', async () => {
  [{ id: bca }] = await as(A, `insert into public.accounts (bank, name, type, currency, opening_balance) values ('bca', 'BCA', 'tabungan', 'IDR', 1000000) returning id`);
  [{ id: jago }] = await as(A, `insert into public.accounts (bank, name, type, currency, opening_balance) values ('jago', 'Jago', 'tabungan', 'IDR', 0) returning id`);
  [{ id: mbb }] = await as(A, `insert into public.accounts (bank, name, type, currency, opening_balance) values ('maybank', 'Maybank', 'tabungan', 'MYR', 50000) returning id`);
  eq(await balance(bca), 1000000);
});

await test('trigger saldo: pengeluaran, pemasukan, transfer, mata uang asing, ubah, hapus', async () => {
  const [{ id: exp }] = await as(A, `insert into public.transactions (type, merchant, category_key, account_id, date, amount, currency) values ('expense', 'Kopi', 'hangout', $1, '2026-11-05', 28000, 'IDR') returning id`, [bca]);
  eq(await balance(bca), 972000, 'setelah pengeluaran');
  await as(A, `insert into public.transactions (type, merchant, category_key, account_id, date, amount, currency) values ('income', 'Gaji', 'salary', $1, '2026-11-05', 500000, 'IDR')`, [bca]);
  eq(await balance(bca), 1472000, 'setelah pemasukan');
  await as(A, `insert into public.transactions (type, category_key, account_id, to_account_id, date, amount, currency) values ('transfer', 'savings', $1, $2, '2026-11-05', 200000, 'IDR')`, [bca, jago]);
  eq([await balance(bca), await balance(jago)], [1272000, 200000], 'setelah transfer');
  // Struk TRY dibayar dari akun MYR: yang dipotong dari akun = account_amount.
  await as(A, `insert into public.transactions (type, merchant, category_key, account_id, date, amount, currency, account_amount) values ('expense', 'Migros', 'groceries', $1, '2026-11-02', 64750, 'TRY', 7032)`, [mbb]);
  eq(await balance(mbb), 42968, 'mata uang asing');
  await as(A, `update public.transactions set amount = 30000 where id = $1`, [exp]);
  eq(await balance(bca), 1270000, 'setelah ubah nominal');
  await as(A, `delete from public.transactions where id = $1`, [exp]);
  eq(await balance(bca), 1300000, 'setelah hapus');
});

await test('ubah saldo awal menggeser saldo; saldo tidak bisa ditulis langsung', async () => {
  await as(A, `update public.accounts set opening_balance = 1100000 where id = $1`, [bca]);
  eq(await balance(bca), 1400000);
  await rejects(as(A, `update public.accounts set balance = 999 where id = $1`, [bca]), /permission denied/);
});

await test('paket tidak bisa diubah klien (Premium hanya dari server)', async () => {
  await rejects(as(A, `update public.profiles set plan = 'premium'`), /permission denied/);
});

await test('RLS: B tidak melihat dan tidak bisa mengubah data A', async () => {
  eq(await as(B, 'select count(*)::int as n from public.accounts'), [{ n: 0 }]);
  eq(await as(B, 'select count(*)::int as n from public.transactions'), [{ n: 0 }]);
  eq(await as(B, `update public.accounts set name = 'dibajak' where id = $1 returning id`, [bca]), []);
  eq(await as(B, `delete from public.transactions returning id`), []);
});

await test('B tidak bisa mencatat transaksi ke akun A', async () => {
  await rejects(as(B, `insert into public.transactions (type, category_key, account_id, date, amount, currency) values ('expense', 'food', $1, '2026-11-05', 1000, 'IDR')`, [bca]), /account_not_owned/);
});

await test('B tidak bisa transfer ke akun A dari akunnya sendiri', async () => {
  const [{ id: own }] = await as(B, `insert into public.accounts (bank, name, type, currency) values ('cash', 'Dompet', 'cash', 'IDR') returning id`);
  await rejects(as(B, `insert into public.transactions (type, category_key, account_id, to_account_id, date, amount, currency) values ('transfer', 'savings', $1, $2, '2026-11-05', 1000, 'IDR')`, [own, bca]), /account_not_owned/);
});

await test('user_id palsu di insert ditolak RLS', async () => {
  await rejects(as(B, `insert into public.accounts (user_id, bank, name, type, currency) values ($1, 'bca', 'x', 'cash', 'IDR')`, [A]), /permission denied|row-level security/);
});

await test('receipt_path harus di folder sendiri', async () => {
  await rejects(as(A, `insert into public.transactions (type, category_key, account_id, date, amount, currency, receipt_path) values ('expense', 'food', $1, '2026-11-05', 1000, 'IDR', $2)`, [bca, `${B}/x.jpg`]), /receipt_not_owned/);
});

await test('item struk: hanya untuk transaksi sendiri', async () => {
  const [{ id: tx }] = await as(A, `insert into public.transactions (type, merchant, category_key, account_id, date, amount, currency, source) values ('expense', 'Indomaret', 'groceries', $1, '2026-11-05', 87500, 'IDR', 'scan') returning id`, [bca]);
  await as(A, `insert into public.transaction_items (transaction_id, name, qty, unit_price, total) values ($1, 'Telur', 1, 29000, 29000)`, [tx]);
  await rejects(as(B, `insert into public.transaction_items (transaction_id, name, qty, unit_price, total) values ($1, 'x', 1, 1, 1)`, [tx]), /transaction_not_owned|row-level security/);
  eq(await as(B, 'select count(*)::int as n from public.transaction_items'), [{ n: 0 }]);
});

await test('batas Free 4 akun ditegakkan di server', async () => {
  await as(A, `insert into public.accounts (bank, name, type, currency) values ('gopay', 'GoPay', 'ewallet', 'IDR')`);
  await rejects(as(A, `insert into public.accounts (bank, name, type, currency) values ('ovo', 'OVO', 'ewallet', 'IDR')`), /quota_accounts/);
});

await test('kuota: klien tidak bisa memanggil quota_try_consume', async () => {
  await rejects(as(A, `select public.quota_try_consume($1, 'scan')`, [A]), /permission denied/);
});

await test('kuota scan Free 20/bulan: ke-21 ditolak, refund mengembalikan', async () => {
  for (let i = 0; i < 20; i++) eq((await sys(`select public.quota_try_consume($1, 'scan') as ok`, [A]))[0].ok, true, `ke-${i + 1}`);
  eq((await sys(`select public.quota_try_consume($1, 'scan') as ok`, [A]))[0].ok, false, 'ke-21');
  await sys(`select public.quota_refund($1, 'scan')`, [A]);
  eq((await sys(`select public.quota_try_consume($1, 'scan') as ok`, [A]))[0].ok, true, 'setelah refund');
});

await test('my_usage hanya milik sendiri dan menghitung akun', async () => {
  const rows = await as(A, `select key, used, monthly_limit from public.my_usage() order by key`);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, [r.used, r.monthly_limit]]));
  eq(byKey.scan, [20, 20]);
  eq(byKey.accounts, [4, 4]);
  eq((await as(B, `select used from public.my_usage() where key = 'scan'`))[0].used, 0);
});

await test('premium: scan 300, akun tanpa batas', async () => {
  await sys(`update public.profiles set plan = 'premium' where id = $1`, [B]);
  for (let i = 0; i < 5; i++) await as(B, `insert into public.accounts (bank, name, type, currency) values ('bca', 'Akun ${i}', 'tabungan', 'IDR')`);
  eq((await as(B, `select monthly_limit from public.my_usage() where key = 'scan'`))[0].monthly_limit, 300);
});

await test('notifikasi: klien hanya membaca dan menandai miliknya', async () => {
  await sys(`insert into public.notifications (user_id, type, title_key, message_key) values ($1, 'system', 'a', 'b'), ($2, 'system', 'a', 'b')`, [A, B]);
  eq(await as(A, 'select count(*)::int as n from public.notifications'), [{ n: 1 }]);
  eq((await as(A, `update public.notifications set read_at = now() returning user_id`)).length, 1);
  await rejects(as(A, `insert into public.notifications (user_id, type, title_key, message_key) values ($1, 'system', 'x', 'y')`, [A]), /permission denied/);
  await rejects(as(A, `update public.notifications set title_key = 'x'`), /permission denied/);
});

await test('kurs: bisa dibaca, tidak bisa ditulis klien', async () => {
  await sys(`insert into public.fx_rates (rate_date, code, per_usd) values ('2026-11-04', 'IDR', 18129)`);
  eq((await as(A, 'select per_usd::text from public.fx_rates'))[0].per_usd, '18129.0000000000');
  await rejects(as(A, `insert into public.fx_rates (rate_date, code, per_usd) values ('2026-11-05', 'IDR', 1)`), /permission denied/);
});

await test('akun aktif harus milik sendiri', async () => {
  await as(A, `update public.profiles set active_account_id = $1`, [jago]);
  const [{ id: bAcc }] = await as(B, 'select id from public.accounts limit 1');
  await rejects(as(A, `update public.profiles set active_account_id = $1`, [bAcc]), /account_not_owned/);
});

await test('ai_jobs dan usage_counters tidak bisa ditulis klien', async () => {
  await rejects(as(A, `insert into public.ai_jobs (user_id, kind, status) values ($1, 'scan', 'ok')`, [A]), /permission denied/);
  await rejects(as(A, `update public.usage_counters set used = 0`), /permission denied/);
});

await test('storage: hanya folder sendiri', async () => {
  await as(A, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${A}/r1.jpg`]);
  await rejects(as(A, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${B}/r1.jpg`]), /row-level security/);
  eq(await as(B, `select count(*)::int as n from storage.objects where bucket_id = 'receipts'`), [{ n: 0 }]);
  await as(A, `insert into storage.objects (bucket_id, name) values ('statements', $1)`, [`${A}/s.pdf`]);
  eq(await as(A, `select count(*)::int as n from storage.objects where bucket_id = 'statements'`), [{ n: 0 }], 'rekening koran tidak bisa dibaca balik');
});

await test('hapus pengguna: semua data ikut terhapus (cascade)', async () => {
  await sys(`delete from auth.users where id = $1`, [A]);
  for (const t of ['profiles', 'accounts', 'transactions', 'transaction_items', 'notifications', 'usage_counters']) {
    const col = t === 'profiles' ? 'id' : 'user_id';
    eq((await sys(`select count(*)::int as n from public.${t} where ${col} = $1`, [A]))[0].n, 0, t);
  }
});

console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} lolos`);
process.exit(failed ? 1 : 0);
