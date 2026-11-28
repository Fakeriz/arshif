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
function ok(cond, msg = '') {
  if (!cond) throw new Error(msg || 'kondisi tidak terpenuhi');
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

await test('trigger saldo per pernyataan: impor 500 baris, pindah akun massal, hapus massal tetap benar', async () => {
  // Tidak ada lagi trigger saldo per baris (FOR EACH ROW = bit 1 di tgtype).
  const triggers = await sys(`select tgname, (tgtype & 1) = 1 as per_row from pg_trigger where tgrelid = 'public.transactions'::regclass and tgname like 'transactions_balance%' order by tgname`);
  eq(triggers, [
    { tgname: 'transactions_balance_del', per_row: false },
    { tgname: 'transactions_balance_ins', per_row: false },
    { tgname: 'transactions_balance_upd', per_row: false },
  ]);
  const [b0, j0] = [await balance(bca), await balance(jago)];
  // Satu pernyataan, 500 baris: 499 pengeluaran Rp1.000 + satu transfer Rp50.000 BCA -> Jago.
  await as(
    A,
    `insert into public.transactions (type, merchant, category_key, account_id, to_account_id, date, amount, currency, note)
     select case when g = 500 then 'transfer' else 'expense' end, 'Impor ' || g, 'food', $1::uuid,
            case when g = 500 then $2::uuid end, '2026-11-06', case when g = 500 then 50000 else 1000 end, 'IDR', 'bulk'
     from generate_series(1, 500) g`,
    [bca, jago],
  );
  eq([await balance(bca), await balance(jago)], [b0 - 499_000 - 50_000, j0 + 50_000], 'setelah impor');
  // Satu UPDATE memindahkan 100 pengeluaran ke Jago: kedua akun (lama dan baru) dihitung ulang.
  await as(A, `update public.transactions set account_id = $1 where note = 'bulk' and type = 'expense' and merchant ~ '^Impor ([1-9]|[1-9][0-9]|100)$'`, [jago]);
  eq([await balance(bca), await balance(jago)], [b0 - 399_000 - 50_000, j0 + 50_000 - 100_000], 'setelah pindah akun');
  await as(A, `delete from public.transactions where note = 'bulk'`);
  eq([await balance(bca), await balance(jago)], [b0, j0], 'setelah hapus massal');
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

await test('rincian struk: diskon, pajak, lokasi tersimpan; diskon item tidak boleh melebihi harga', async () => {
  const [{ id: tx }] = await as(
    A,
    `insert into public.transactions (type, merchant, category_key, account_id, date, amount, currency, source, subtotal, discount_total, tax_total, tax_included,
       discounts, tax_lines, receipt_no, payment_method, store_address, store_tax_id)
     values ('expense', 'WATSONS - CAROUSEL', 'shopping', $1, '2025-08-06', 63620, 'TRY', 'scan', 95455, 31835, 7184, true,
       $2::jsonb, $3::jsonb, '0039', 'FinansBank', 'Carousel AVM No:21, Bakırköy', 'Anadolu KR. VD. 2120370364') returning id`,
    [bca, JSON.stringify([{ itemName: 'WATSONS TEKRAR KULLA', taxRate: 10, amount: 345 }]), JSON.stringify([{ rate: 10, tax: 4103, gross: 45135 }])],
  );
  await as(A, `insert into public.transaction_items (transaction_id, name, qty, unit_price, total, discount, tax_rate) values ($1, 'WATSONS TEKRAR KULLA', 1, 1595, 1595, 345, 10)`, [tx]);
  eq(await as(A, `select receipt_no, payment_method, tax_total::int, (discounts->0->>'amount')::int as d from public.transactions where id = $1`, [tx]), [{ receipt_no: '0039', payment_method: 'FinansBank', tax_total: 7184, d: 345 }]);
  await rejects(as(A, `insert into public.transaction_items (transaction_id, name, qty, unit_price, total, discount) values ($1, 'x', 1, 100, 100, 101)`, [tx]), /item_discount_le_total/);
  await rejects(as(A, `update public.transactions set discounts = '{"a":1}'::jsonb where id = $1`, [tx]), /check constraint/);
  await as(A, `update public.transactions set payment_method = 'Kredi Kartı' where id = $1`, [tx]);
  await as(A, 'delete from public.transactions where id = $1', [tx]);
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

// ------------------------------------------------------------------ Fase 3: monetisasi
await test('my_usage: semua batas PRD dengan jenisnya (bulanan, harian, total, fitur)', async () => {
  const rows = await as(A, `select key, used, monthly_limit, "window" from public.my_usage() order by key`);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, [r.monthly_limit, r.window]]));
  eq(byKey.goals, [3, 'total']);
  eq(byKey.billsDebts, [3, 'total']);
  eq(byKey.subscriptions, [5, 'total']);
  eq(byKey.coachAsk, [0, 'day']);
  eq(byKey.taxFull, [0, 'feature']);
  eq(byKey.invoice, [5, 'month']);
  eq(byKey.automation, [30, 'month']);
});

await test('Tanya Coach: Free terkunci, Premium 20/hari dengan periode harian', async () => {
  eq((await sys(`select public.quota_try_consume($1, 'coachAsk') as ok`, [A]))[0].ok, false);
  for (let i = 0; i < 20; i++) eq((await sys(`select public.quota_try_consume($1, 'coachAsk') as ok`, [B]))[0].ok, true, `ke-${i + 1}`);
  eq((await sys(`select public.quota_try_consume($1, 'coachAsk') as ok`, [B]))[0].ok, false, 'ke-21');
  eq((await sys(`select period from public.usage_counters where user_id = $1 and key = 'coachAsk'`, [B]))[0].period.length, 10);
  await sys(`select public.quota_refund($1, 'coachAsk')`, [B]);
  eq((await sys(`select public.quota_try_consume($1, 'coachAsk') as ok`, [B]))[0].ok, true, 'gagal dikembalikan');
});

await test('fitur Premium saja: plan_allows', async () => {
  eq((await sys(`select public.plan_allows($1, 'taxFull') as ok`, [A]))[0].ok, false);
  eq((await sys(`select public.plan_allows($1, 'pdfExport') as ok`, [B]))[0].ok, true);
  await rejects(as(A, `select public.plan_allows($1, 'taxFull')`, [A]), /permission denied/);
});

await test('planning: batas Free dihitung dari yang aktif (goals 3, tagihan + utang 3, langganan 5)', async () => {
  const goal = (n) => as(A, `insert into public.goals (name, target, currency) values ($1, 100000, 'IDR') returning id`, [n]);
  const [{ id: g1 }] = await goal('Dana darurat');
  await goal('Laptop');
  await goal('Liburan');
  await rejects(goal('Keempat'), /quota_goals/);
  await as(A, `insert into public.goal_deposits (goal_id, amount, date) values ($1, 100000, '2026-11-08')`, [g1]);
  await goal('Keempat');
  eq((await as(A, `select used from public.my_usage() where key = 'goals'`))[0].used, 3);

  const bill = (n) => as(A, `insert into public.bills (name, amount, currency, frequency, due_date, anchor_day) values ($1, 50000, 'IDR', 'monthly', '2026-11-20', 20) returning id`, [n]);
  const debt = (n) => as(A, `insert into public.debts (kind, counterparty, principal, currency) values ('debt', $1, 300000, 'IDR') returning id, balance`, [n]);
  await bill('Listrik');
  await bill('Internet');
  const [{ id: d1 }] = await debt('Budi');
  await rejects(bill('Air'), /quota_billsDebts/);
  await rejects(debt('Sari'), /quota_billsDebts/);
  await as(A, `insert into public.debt_payments (debt_id, amount, date) values ($1, 300000, '2026-11-08')`, [d1]);
  await debt('Sari');

  const sub = (n) => as(A, `insert into public.subscriptions (name, amount, currency, cycle, next_renewal, anchor_day) values ($1, 54000, 'IDR', 'monthly', '2026-11-10', 10) returning id`, [n]);
  const subs = [];
  for (const n of ['Netflix', 'Spotify', 'YouTube', 'iCloud', 'ChatGPT']) subs.push((await sub(n))[0].id);
  await rejects(sub('Disney'), /quota_subscriptions/);
  await as(A, `update public.subscriptions set status = 'cancelled' where id = $1`, [subs[0]]);
  await sub('Disney');
  await rejects(as(A, `update public.subscriptions set status = 'active' where id = $1`, [subs[0]]), /quota_subscriptions/);

  for (let i = 0; i < 5; i++) await as(B, `insert into public.goals (name, target, currency) values ('g', 1, 'IDR')`);
});

await test('planning: setoran goal menambah terkumpul; tercapai -> completed + notifikasi', async () => {
  const [{ id: g }] = await as(B, `insert into public.goals (name, target, currency) values ('Motor', 1000000, 'IDR') returning id`);
  await as(B, `insert into public.goal_deposits (goal_id, amount, date) values ($1, 400000, '2026-11-01')`, [g]);
  eq(await as(B, 'select collected::int, status from public.goals where id = $1', [g]), [{ collected: 400000, status: 'active' }]);
  await as(B, `insert into public.goal_deposits (goal_id, amount, date) values ($1, 600000, '2026-11-08')`, [g]);
  eq(await as(B, 'select collected::int, status from public.goals where id = $1', [g]), [{ collected: 1000000, status: 'completed' }]);
  eq(await as(B, `select type, href, vars->>'name' as name from public.notifications where type = 'goal_reached'`), [{ type: 'goal_reached', href: '/rencana/goals', name: 'Motor' }]);
  await rejects(as(B, 'update public.goals set collected = 5 where id = $1', [g]), /permission denied/);
});

await test('planning: referensi ke akun/goal orang lain ditolak', async () => {
  await rejects(as(B, `insert into public.goals (name, target, currency, account_id) values ('x', 1, 'IDR', $1)`, [bca]), /account_not_owned/);
  const [{ id: g }] = await as(A, `select id from public.goals limit 1`);
  await rejects(as(B, `insert into public.goal_deposits (goal_id, amount, date) values ($1, 1, '2026-11-08')`, [g]), /goal_not_owned|row-level security/);
});

await test('planning: tandai lunas tagihan memajukan jatuh tempo (hari jangkar 31), idempoten', async () => {
  const [{ id: b }] = await as(B, `insert into public.bills (name, amount, currency, frequency, due_date, anchor_day) values ('Sewa', 2500000, 'IDR', 'monthly', '2026-01-31', 31) returning id`);
  const [{ id: acc }] = await as(B, `insert into public.accounts (bank, name, type, currency) values ('cash', 'Dompet', 'cash', 'IDR') returning id`);
  const tx = async () => (await as(B, `insert into public.transactions (type, merchant, category_key, account_id, date, amount, currency) values ('expense', 'Sewa', 'bills', $1, '2026-01-31', 2500000, 'IDR') returning id`, [acc]))[0].id;
  const t1 = await tx();
  eq(await as(B, 'select due_date::text, paid_periods::text from public.bill_mark_paid($1, $2)', [b, t1]), [{ due_date: '2026-02-28', paid_periods: '{2026-01-31}' }]);
  eq(await as(B, 'select due_date::text from public.bill_mark_paid($1, $2)', [b, t1]), [{ due_date: '2026-02-28' }]);
  eq(await as(B, 'select due_date::text, paid_periods::text from public.bill_mark_paid($1, $2)', [b, await tx()]), [{ due_date: '2026-03-31', paid_periods: '{2026-01-31,2026-02-28}' }]);
  await rejects(as(B, `update public.bills set paid_periods = '{}' where id = $1`, [b]), /permission denied/);
  const [{ id: other }] = await as(A, `select id from public.transactions limit 1`);
  await rejects(as(B, 'select * from public.bill_mark_paid($1, $2)', [b, other]), /transaction_not_owned/);
  await rejects(as(A, 'select * from public.bill_mark_paid($1, $2)', [b, other]), /bill_not_found/);
  eq(await sys(`select public.next_due('2026-11-30', 'quarterly', 30)::text a, public.next_due('2024-02-29', 'yearly', 29)::text b, public.next_due('2026-11-28', 'weekly', 28)::text c`), [{ a: '2027-02-28', b: '2025-02-28', c: '2026-12-05' }]);
});

await test('planning: pembayaran utang mengurangi saldo, tidak boleh melebihi, lunas = paid', async () => {
  const [{ id: d, balance: bal }] = await as(B, `insert into public.debts (kind, counterparty, principal, apr_bp, min_payment, currency) values ('debt', 'Kartu kredit', 1000000, 2400, 100000, 'IDR') returning id, balance`);
  eq(Number(bal), 1000000);
  await as(B, `insert into public.debt_payments (debt_id, amount, date) values ($1, 400000, '2026-11-08')`, [d]);
  await rejects(as(B, `insert into public.debt_payments (debt_id, amount, date) values ($1, 700000, '2026-11-08')`, [d]), /payment_exceeds_balance/);
  await as(B, `insert into public.debt_payments (debt_id, amount, date) values ($1, 600000, '2026-11-09')`, [d]);
  eq(await as(B, 'select balance::int, status from public.debts where id = $1', [d]), [{ balance: 0, status: 'paid' }]);
  await rejects(as(B, `update public.debts set balance = 5 where id = $1`, [d]), /permission denied/);
});

await test('planning: split bill milik sendiri; piutang hanya boleh merujuk split sendiri', async () => {
  const parts = JSON.stringify([{ id: 'me', name: 'Rani', owner: true, share: 300000 }, { id: 'x', name: 'Ani', owner: false, share: 200000 }]);
  const [{ id: s }] = await as(B, `insert into public.split_bills (title, currency, total, mode, date, participants) values ('Makan', 'IDR', 500000, 'equal', '2026-11-08', $1::jsonb) returning id`, [parts]);
  await as(B, `insert into public.debts (kind, counterparty, principal, currency, split_bill_id) values ('receivable', 'Ani', 200000, 'IDR', $1)`, [s]);
  eq((await as(A, 'select count(*)::int n from public.split_bills'))[0].n, 0);
  await rejects(as(A, `insert into public.debts (kind, counterparty, principal, currency, split_bill_id) values ('receivable', 'x', 1, 'IDR', $1)`, [s]), /split_bill_not_owned|quota_billsDebts/);
  await rejects(as(B, `insert into public.split_bills (title, currency, total, mode, date, participants) values ('x', 'IDR', 1, 'equal', '2026-11-08', '[]'::jsonb)`), /check constraint/);
});

await test('planning: pengingat tagihan H-3/H dan langganan H-2 sekali saja, mulai 07.00 lokal', async () => {
  await sys(`update public.profiles set timezone = 'Asia/Jakarta' where id = $1`, [B]);
  await sys(`update public.profiles set timezone = 'Mars/Olympus' where id = $1`, [A]);
  eq((await sys('select timezone from public.profiles where id = $1', [A]))[0].timezone, 'Asia/Jakarta');
  await as(B, `insert into public.bills (name, amount, currency, frequency, due_date, anchor_day) values ('PLN', 350000, 'IDR', 'monthly', '2026-11-10', 10), ('Wifi', 300000, 'IDR', 'monthly', '2026-11-07', 7)`);
  await as(B, `insert into public.subscriptions (name, amount, currency, cycle, next_renewal, anchor_day) values ('Netflix', 54000, 'IDR', 'monthly', '2026-11-09', 9), ('Lama', 1000, 'IDR', 'monthly', '2026-10-01', 1)`);
  const before = async () => Number((await sys(`select count(*) from public.notifications where user_id = $1 and type in ('bill_due', 'subscription_renewal')`, [B]))[0].count);
  // 06.00 WIB: belum waktunya.
  eq((await sys(`select public.planning_reminders('2026-11-07 06:00+07') n`))[0].n, 0);
  eq((await sys(`select public.planning_reminders('2026-11-07 07:30+07') n`))[0].n, 3);
  eq((await sys(`select public.planning_reminders('2026-11-07 09:30+07') n`))[0].n, 0);
  eq(await before(), 3);
  eq((await as(B, `select title_key from public.notifications where type = 'bill_due' order by title_key`)).map((r) => r.title_key), ['domain.notif.billSoonTitle', 'domain.notif.billTodayTitle']);
  eq((await as(B, `select next_renewal::text from public.subscriptions where name = 'Lama'`))[0].next_renewal, '2026-12-01');
});

// ------------------------------------------------------------------ Fase 6: invoice & penawaran, gerbang alat pajak
const inv = (user, kind = 'invoice', extra = {}) =>
  as(
    user,
    `insert into public.invoices (kind, client_name, issue_date, due_date, currency, items, discount, tax_bp)
     values ($1, 'PT Klien', $2, $3, 'IDR', $4::jsonb, $5, $6) returning id, number, status, subtotal, tax, total`,
    [kind, extra.issue ?? '2026-11-10', extra.due ?? null, JSON.stringify(extra.items ?? [{ id: '1', name: 'Desain logo', qty: 1, unitPrice: 2500000 }]), extra.discount ?? 0, extra.taxBp ?? 0],
  );

await test('invoice: nomor INV-2026-0001, 0002; penawaran terpisah QUO-2026-0001; pengguna lain urutannya sendiri', async () => {
  const [a1] = await inv(A);
  const [a2] = await inv(A);
  const [q1] = await inv(A, 'quote');
  const [b1] = await inv(B);
  eq([a1.number, a2.number, q1.number, b1.number], ['INV-2026-0001', 'INV-2026-0002', 'QUO-2026-0001', 'INV-2026-0001']);
  const [n27] = await inv(B, 'invoice', { issue: '2027-01-02' });
  eq(n27.number, 'INV-2027-0001', 'tahun baru mulai dari 0001');
  await as(A, `update public.invoices set issue_date = '2027-03-01' where id = $1`, [a2.id]);
  eq((await as(A, 'select number from public.invoices where id = $1', [a2.id]))[0].number, 'INV-2026-0002', 'nomor tidak berubah saat diedit');
  await rejects(as(A, `update public.invoices set number = 'INV-2026-9999' where id = $1`, [a1.id]), /permission denied/);
});

await test('invoice: jumlah dihitung server dari item (qty pecahan, diskon, pajak 11%)', async () => {
  const items = [{ id: 'a', name: 'Konsultasi', qty: 1.5, unitPrice: 333333 }, { id: 'b', name: 'Revisi', qty: 2, unitPrice: 150000 }];
  // 1,5 × 333.333 = 499.999,5 -> 500.000; + 300.000 = 800.000; diskon 50.000 -> 750.000; PPN 11% = 82.500
  const [r] = await inv(B, 'invoice', { items, discount: 50000, taxBp: 1100 });
  eq([Number(r.subtotal), Number(r.tax), Number(r.total)], [800000, 82500, 832500]);
  await rejects(inv(B, 'invoice', { items: [{ id: 'x', name: 'A', qty: 1, unitPrice: 1000 }], discount: 5000 }), /invoice_discount_exceeds/);
  await rejects(inv(B, 'invoice', { items: [{ id: 'x', name: 'A', qty: 0.333, unitPrice: 1000 }] }), /invoice_item_invalid/);
  await rejects(as(B, `update public.invoices set total = 1 where id = $1`, [r.id]), /permission denied/);
});

await test('invoice: tandai Dibayar -> tepat satu transaksi pemasukan; dua kali tetap satu', async () => {
  const [acc] = await as(B, `select id from public.accounts limit 1`);
  const [r] = await inv(B, 'invoice', { items: [{ id: 'a', name: 'Website', qty: 1, unitPrice: 4000000 }] });
  const before = await balance(acc.id);
  const tx = (id) => as(B, `insert into public.transactions (id, type, merchant, category_key, account_id, date, amount, currency, source) values ($1, 'income', 'PT Klien', 'freelance', $2, '2026-11-10', 4000000, 'IDR', 'invoice')`, [id, acc.id]);
  await tx(r.id);
  const [p1] = await as(B, `select * from public.invoice_mark_paid($1, $2)`, [r.id, r.id]);
  eq(p1.status, 'paid');
  // Tandai lagi: transaksi kedua dengan id yang sama ditolak, RPC mengembalikan hasil yang sama.
  await rejects(tx(r.id), /duplicate key/);
  const [p2] = await as(B, `select * from public.invoice_mark_paid($1, $2)`, [r.id, r.id]);
  eq(p2.transaction_id, r.id);
  eq((await as(B, `select count(*)::int as n from public.transactions where id = $1`, [r.id]))[0].n, 1);
  eq(await balance(acc.id), before + 4000000, 'saldo akun naik sekali');
  // Transaksi lain untuk invoice yang sama ditolak; invoice lunas terkunci.
  const [{ id: other }] = await as(B, `insert into public.transactions (type, merchant, category_key, account_id, date, amount, currency) values ('income', 'x', 'freelance', $1, '2026-11-10', 4000000, 'IDR') returning id`, [acc.id]);
  await rejects(as(B, `select * from public.invoice_mark_paid($1, $2)`, [r.id, other]), /invoice_already_paid/);
  await rejects(as(B, `update public.invoices set client_name = 'Lain' where id = $1`, [r.id]), /invoice_locked/);
});

await test('invoice: Dibayar hanya lewat RPC, transaksi harus cocok, penawaran tidak bisa dibayar', async () => {
  const [acc] = await as(B, `select id from public.accounts limit 1`);
  const [r] = await inv(B);
  await rejects(as(B, `update public.invoices set status = 'paid' where id = $1`, [r.id]), /invoice_paid_via_rpc/);
  await as(B, `update public.invoices set status = 'sent' where id = $1`, [r.id]);
  await as(B, `insert into public.transactions (id, type, merchant, category_key, account_id, date, amount, currency) values ($1, 'income', 'x', 'freelance', $2, '2026-11-10', 100, 'IDR')`, [r.id, acc.id]);
  await rejects(as(B, `select * from public.invoice_mark_paid($1, $2)`, [r.id, r.id]), /transaction_mismatch/);
  const [q] = await inv(B, 'quote');
  await rejects(as(B, `select * from public.invoice_mark_paid($1, $2)`, [q.id, r.id]), /quote_cannot_be_paid/);
  await rejects(as(B, `update public.invoices set status = 'paid' where id = $1`, [q.id]), /invoices_status_kind|invoice_paid_via_rpc/);
  await as(B, `update public.invoices set status = 'accepted' where id = $1`, [q.id]);
  // Insert dengan status Dibayar diabaikan: selalu Draf.
  const [d] = await as(B, `insert into public.invoices (kind, client_name, issue_date, currency, items) values ('invoice', 'x', '2026-11-10', 'IDR', '[{"id":"1","name":"a","qty":1,"unitPrice":1}]') returning status`);
  eq(d.status, 'draft');
});

await test('invoice: RLS, pengguna lain tidak melihat atau membayar invoice A', async () => {
  const [r] = await inv(A);
  eq(await as(B, `select id from public.invoices where id = $1`, [r.id]), []);
  await rejects(as(B, `select * from public.invoice_mark_paid($1, $2)`, [r.id, r.id]), /invoice_not_found/);
  await rejects(as(A, `select * from public.invoice_counters`), /permission denied/);
});

await test('invoice: Free 5/bulan gabungan (invoice + penawaran), ke-6 ditolak; Premium tanpa batas', async () => {
  const D = '00000000-0000-4000-8000-00000000000d';
  await sys(`insert into auth.users (id, email) values ('${D}', 'd@example.com')`);
  for (let i = 0; i < 3; i++) await inv(D);
  await inv(D, 'quote');
  await inv(D, 'quote');
  await rejects(inv(D), /quota_invoice/);
  await rejects(inv(D, 'quote'), /quota_invoice/);
  eq((await as(D, `select used, monthly_limit from public.my_usage() where key = 'invoice'`))[0], { used: 5, monthly_limit: 5 });
  // Bulan lalu tidak dihitung: hanya penghitung bulan berjalan yang dipakai.
  await sys(`update public.usage_counters set period = '2026-01' where user_id = $1 and key = 'invoice'`, [D]);
  await inv(D);
  // Premium (B) sudah membuat > 5 di atas tanpa ditolak.
  eq((await as(B, `select count(*)::int as n from public.invoices`))[0].n >= 6, true);
});

await test('alat pajak + PDF Export: gerbang server (Free ditolak quota_*, Premium boleh)', async () => {
  await rejects(as(A, `select public.feature_gate('taxFull')`), /quota_taxFull/);
  await rejects(as(A, `select public.feature_gate('pdfExport')`), /quota_pdfExport/);
  eq((await as(B, `select public.feature_gate('taxFull') as ok`))[0].ok, true);
  eq((await as(B, `select public.feature_gate('pdfExport') as ok`))[0].ok, true);
  await rejects(as(B, `select public.feature_gate('scan')`), /unknown_feature/);
});

await test('harga: publik bisa dibaca (anon), tidak bisa ditulis', async () => {
  await db.exec(`set role anon`);
  try {
    const rows = (await db.query(`select period, currency, amount::int from public.prices order by currency, period`)).rows;
    eq(rows.find((r) => r.currency === 'IDR' && r.period === 'monthly').amount, 25000);
    eq(rows.find((r) => r.currency === 'MYR' && r.period === 'yearly').amount, 6900);
    eq(rows.find((r) => r.currency === 'USD' && r.period === 'monthly').amount, 150);
  } finally {
    await db.exec('reset role');
  }
  await rejects(as(A, `update public.prices set amount = 1`), /permission denied/);
});

await test('pesanan: hanya dibaca pemiliknya, semua penulisan lewat server', async () => {
  await sys(`insert into public.orders (user_id, provider, period, currency, amount, method) values ($1, 'xendit', 'monthly', 'IDR', 25000, 'qris'), ($2, 'paddle', 'yearly', 'USD', 1500, 'card')`, [A, B]);
  eq(await as(A, 'select provider from public.orders'), [{ provider: 'xendit' }]);
  await rejects(as(A, `insert into public.orders (user_id, provider, period, currency, amount) values ($1, 'xendit', 'monthly', 'IDR', 1)`, [A]), /permission denied/);
  await rejects(as(A, `update public.orders set status = 'paid'`), /permission denied/);
  await rejects(as(A, 'select * from public.webhook_events'), /permission denied/);
  await rejects(as(A, 'select * from public.admin_users'), /permission denied/);
});

await test('pesanan: klien tidak bisa membaca granted_by dan grant_error', async () => {
  await rejects(as(A, 'select grant_error from public.orders'), /permission denied/);
  await rejects(as(A, 'select granted_by from public.orders'), /permission denied/);
  eq((await as(A, 'select status from public.orders'))[0].status, 'pending');
});

await test('reserve_grant: dua pesanan lunas bertumpuk, percobaan ulang memakai target yang sama', async () => {
  await sys(`delete from public.orders`);
  const [{ id: o1 }] = await sys(`insert into public.orders (user_id, provider, period, currency, amount, status) values ($1, 'xendit', 'monthly', 'IDR', 25000, 'paid') returning id`, [A]);
  const [{ id: o2 }] = await sys(`insert into public.orders (user_id, provider, period, currency, amount, status) values ($1, 'xendit', 'yearly', 'IDR', 250000, 'paid') returning id`, [A]);
  const [g1] = await sys(`select * from public.reserve_grant($1, null)`, [o1]);
  const [g2] = await sys(`select * from public.reserve_grant($1, null)`, [o2]);
  eq(new Date(g2.granted_from).getTime(), new Date(g1.granted_until).getTime(), 'tahunan mulai saat bulanan berakhir');
  const [again] = await sys(`select * from public.reserve_grant($1, now() + interval '5 years')`, [o1]);
  eq(new Date(again.granted_until).getTime(), new Date(g1.granted_until).getTime(), 'retry tidak memperpanjang lagi');
  const [{ id: o3 }] = await sys(`insert into public.orders (user_id, provider, period, currency, amount) values ($1, 'xendit', 'monthly', 'IDR', 25000) returning id`, [A]);
  await rejects(sys(`select * from public.reserve_grant($1, null)`, [o3]), /order_not_paid/);
  await rejects(as(A, `select * from public.reserve_grant($1, null)`, [o1]), /permission denied/);
});

await test('refund_shift: hanya durasi pesanan yang di-refund yang hilang, sekali saja', async () => {
  const [o1, o2] = (await sys(`select id, granted_from, granted_until from public.orders where user_id = $1 and status = 'paid' and granted_until is not null order by granted_from`, [A]));
  const len1 = new Date(o1.granted_until).getTime() - new Date(o1.granted_from).getTime();
  await sys(`update public.orders set status = 'refunded' where id = $1`, [o1.id]);
  const [{ end }] = await sys(`select public.refund_shift($1) as "end"`, [o1.id]);
  // Pesanan pertama mulai "sekarang", jadi sisa yang belum terpakai = hampir seluruh durasinya.
  ok(Math.abs(new Date(end).getTime() - (new Date(o2.granted_until).getTime() - len1)) < 60_000, 'tahunan bergeser maju sebesar sisa 1 bulan');
  const [{ end: end2 }] = await sys(`select public.refund_shift($1) as "end"`, [o1.id]);
  eq(new Date(end2).getTime(), new Date(end).getTime(), 'pengiriman ulang tidak menggeser dua kali');
  await sys(`delete from public.orders`);
  await sys(`insert into public.orders (user_id, provider, period, currency, amount, method) values ($1, 'xendit', 'monthly', 'IDR', 25000, 'qris'), ($2, 'paddle', 'yearly', 'USD', 1500, 'card')`, [A, B]);
});

await test('refund_shift: refund di tengah masa aktif tidak memotong hari yang sudah dibayar pesanan berikutnya', async () => {
  await sys(`delete from public.orders`);
  // A: 20 hari lalu sampai 10 hari lagi (sisa 10 hari). B: bertumpuk setelah A, 30 hari.
  const [{ id: a }] = await sys(`insert into public.orders (user_id, provider, period, currency, amount, status, granted_from, granted_until)
    values ($1, 'xendit', 'monthly', 'IDR', 25000, 'refunded', now() - interval '20 days', now() + interval '10 days') returning id`, [A]);
  const [{ granted_until: bUntil }] = await sys(`insert into public.orders (user_id, provider, period, currency, amount, status, granted_from, granted_until)
    values ($1, 'xendit', 'monthly', 'IDR', 25000, 'paid', now() + interval '10 days', now() + interval '40 days') returning granted_until`, [A]);
  const [{ end }] = await sys(`select public.refund_shift($1) as "end"`, [a]);
  const shifted = new Date(bUntil).getTime() - new Date(end).getTime();
  ok(Math.abs(shifted - 10 * 86_400_000) < 60_000, `B hanya maju 10 hari (sisa A), bukan 30: ${shifted}`);
  await sys(`delete from public.orders`);
  await sys(`insert into public.orders (user_id, provider, period, currency, amount, method) values ($1, 'xendit', 'monthly', 'IDR', 25000, 'qris'), ($2, 'paddle', 'yearly', 'USD', 1500, 'card')`, [A, B]);
});

await test('Premium yang sudah lewat premium_until langsung memakai batas Free', async () => {
  await sys(`update public.profiles set plan = 'premium', premium_until = now() - interval '1 minute' where id = $1`, [A]);
  eq((await sys(`select public.plan_allows($1, 'pdfExport') as ok`, [A]))[0].ok, false, 'pdfExport tertutup setelah habis');
  await sys(`update public.profiles set premium_until = now() + interval '1 day' where id = $1`, [A]);
  eq((await sys(`select public.plan_allows($1, 'pdfExport') as ok`, [A]))[0].ok, true, 'masih aktif = Premium');
  await sys(`update public.profiles set plan = 'free', premium_until = null where id = $1`, [A]);
});

await test('quota_refund mengembalikan ke periode saat kuota diambil', async () => {
  const last = await sys(`select to_char((now() - interval '1 month') at time zone 'utc', 'YYYY-MM') as p`);
  await sys(`insert into public.usage_counters (user_id, period, key, used) values ($1, $2, 'scan', 3)
    on conflict (user_id, period, key) do update set used = 3`, [A, last[0].p]);
  await sys(`select public.quota_refund($1, 'scan', now() - interval '1 month')`, [A]);
  eq((await sys(`select used from public.usage_counters where user_id = $1 and period = $2 and key = 'scan'`, [A, last[0].p]))[0].used, 2);
});

await test('paket dan masa Premium tidak bisa diubah klien', async () => {
  await rejects(as(A, `update public.profiles set plan = 'premium'`), /permission denied/);
  await rejects(as(A, `update public.profiles set premium_until = now() + interval '1 year'`), /permission denied/);
});

await test('admin: RPC ditolak untuk non-admin, terbuka untuk admin', async () => {
  await rejects(as(A, 'select * from public.admin_orders()'), /not_admin/);
  await rejects(as(A, `select * from public.admin_find_user('b@example.com')`), /not_admin/);
  eq((await as(A, 'select public.is_admin() as a'))[0].a, false);
  await sys(`insert into public.admin_users (user_id) values ($1)`, [B]);
  eq((await as(B, 'select count(*)::int as n from public.admin_orders()'))[0].n, 2);
  eq((await as(B, `select plan from public.admin_find_user(' A@Example.com ')`))[0].plan, 'free');
  await sys(`insert into public.ai_jobs (user_id, kind, status, latency_ms) values ($1, 'scan', 'ok', 1000), ($1, 'scan', 'failed', 3000), ($1, 'scan', 'limited', null)`, [A]);
  const [scan] = await as(B, `select * from public.admin_ai_usage(30) where kind = 'scan'`);
  eq([scan.total, scan.failed, scan.limited, Number(scan.fail_ratio), scan.avg_latency_ms], [3, 1, 1, 0.5, 2000]);
});

// ---------------------------------------------------------------- Smart Log (Fase 5)
const C = '00000000-0000-4000-8000-00000000000c';
await sys(`insert into auth.users (id, email) values ('${C}', 'c@example.com')`);
let cBca, cUsd;
let seq = 0;
const ingest = async (user, o = {}) => {
  seq++;
  const v = {
    key: `cap-${seq}`, pkg: 'com.bca.mybca.omni.android', bank: 'bca', date: '2026-11-05', time: '12:00', type: 'expense',
    amount: 45000, currency: 'IDR', merchant: 'KOPI SENJA', excerpt: 'Pembayaran QRIS Rp 45.000 di KOPI SENJA', fp: `fp-${seq}`, doubts: [], ...o,
  };
  const [{ r }] = await as(user, `select public.smartlog_ingest($1, $2, $3, now(), $4, $5, $6, $7, $8, $9, $10, $11, $12) as r`,
    [v.key, v.pkg, v.bank, v.date, v.time, v.type, v.amount, v.currency, v.merchant, v.excerpt, v.fp, v.doubts]);
  return r;
};
const automationUsed = async (user) => (await as(user, `select used from public.my_usage() where key = 'automation'`))[0].used;

await test('smartlog: automation OFF = tidak diproses, kuota tidak terpakai', async () => {
  [{ id: cBca }] = await as(C, `insert into public.accounts (bank, name, type, currency, opening_balance) values ('bca', 'BCA', 'tabungan', 'IDR', 1000000) returning id`);
  [{ id: cUsd }] = await as(C, `insert into public.accounts (bank, name, type, currency) values ('jenius', 'Jenius USD', 'tabungan', 'USD') returning id`);
  eq((await ingest(C)).status, 'disabled');
  eq(await automationUsed(C), 0);
});

await test('smartlog: tautan package hanya ke akun sendiri; pengguna lain tidak melihat', async () => {
  await as(C, `update public.profiles set smartlog_enabled = true`);
  await as(C, `insert into public.smartlog_links (package, account_id) values ('com.bca.mybca.omni.android', $1), ('com.btpn.dc', $2)`, [cBca, cUsd]);
  await rejects(as(C, `insert into public.smartlog_links (package, account_id) values ('id.dana', $1)`, [bca]), /account_not_owned/);
  await rejects(as(C, `insert into public.smartlog_links (package, account_id) values ('bukan package', $1)`, [cBca]), /check/);
  eq(await as(B, 'select count(*)::int as n from public.smartlog_links'), [{ n: 0 }]);
});

let applied, appliedFp;
await test('smartlog: kasus yakin (expense + IDR + tertaut + lolos cek) langsung tercatat', async () => {
  applied = await ingest(C);
  appliedFp = `fp-${seq}`;
  eq([applied.status, applied.reasons], ['applied', []]);
  const tx = await as(C, `select source, amount, merchant, category_key, date::text, time::text from public.transactions where id = $1`, [applied.id]);
  eq(tx, [{ source: 'smartlog', amount: 45000, merchant: 'KOPI SENJA', category_key: 'other', date: '2026-11-05', time: '12:00:00' }]);
  eq(await balance(cBca), 955000);
  eq((await as(C, `select excerpt from public.smartlog_items where id = $1`, [applied.id]))[0].excerpt, null, 'teks tidak disimpan');
  eq(await automationUsed(C), 1);
});

await test('smartlog: kirim ulang notifikasi yang sama (capture_key) idempoten', async () => {
  const again = await as(C, `select public.smartlog_ingest($1, 'com.bca.mybca.omni.android', 'bca', now(), '2026-11-05', '12:00', 'expense', 45000, 'IDR', 'KOPI SENJA', '', $2, '{}') as r`, [`cap-${seq}`, `fp-${seq}`]);
  eq([again[0].r.status, again[0].r.id, again[0].r.repeat], ['applied', applied.id, true]);
  eq((await as(C, `select count(*)::int as n from public.transactions`))[0].n, 1);
  eq(await automationUsed(C), 1);
});

await test('smartlog: notifikasi sama masuk dua kali -> To Review, tidak tercatat dua kali', async () => {
  const dup = await ingest(C, { fp: appliedFp });
  eq([dup.status, dup.reasons], ['review', ['duplicate']]);
  // Nominal dan waktu sama dengan transaksi yang sudah ada (mis. dicatat manual) juga dianggap duplikat.
  const near = await ingest(C, { time: '12:07' });
  eq([near.status, near.reasons], ['review', ['duplicate']]);
  eq((await as(C, `select count(*)::int as n from public.transactions`))[0].n, 1);
  eq((await ingest(C, { time: '12:20' })).status, 'applied', 'selisih > 10 menit bukan duplikat');
});

await test('smartlog: yang meragukan masuk To Review dengan alasannya', async () => {
  eq((await ingest(C, { pkg: 'id.dana', bank: 'dana', time: '13:00' })).reasons, ['no_link']);
  eq((await ingest(C, { type: 'income', time: '13:01' })).reasons, ['not_expense']);
  eq((await ingest(C, { pkg: 'com.btpn.dc', bank: 'jenius', currency: 'USD', amount: 1250, time: '13:02' })).reasons, ['not_idr']);
  eq((await ingest(C, { pkg: 'com.btpn.dc', bank: 'jenius', time: '13:03' })).reasons, ['account_currency']);
  eq((await ingest(C, { doubts: ['multiple_amounts', 'karangan'], time: '13:04' })).reasons, ['multiple_amounts']);
  const rows = await as(C, `select count(*)::int as n from public.smartlog_items where status = 'review' and excerpt is not null`);
  eq(rows[0].n, 7);
});

await test('smartlog: konfirmasi dari To Review mencatat transaksi sekali saja', async () => {
  const item = await ingest(C, { pkg: 'id.dana', bank: 'dana', amount: 30000, time: '14:00' });
  await rejects(as(C, `select public.smartlog_confirm($1)`, [item.id]), /transaction_missing/);
  await as(C, `insert into public.transactions (id, type, merchant, category_key, account_id, date, time, amount, currency, source)
               values ($1, 'expense', 'Warteg', 'food', $2, '2026-11-05', '14:00', 30000, 'IDR', 'smartlog')`, [item.id, cBca]);
  await as(C, `select public.smartlog_confirm($1)`, [item.id]);
  eq((await as(C, `select status, excerpt, transaction_id = id as linked from public.smartlog_items where id = $1`, [item.id])), [{ status: 'confirmed', excerpt: null, linked: true }]);
  await rejects(as(C, `select public.smartlog_confirm($1)`, [item.id]), /not_in_review/);
  await rejects(as(C, `insert into public.transactions (id, type, category_key, account_id, date, amount, currency) values ($1, 'expense', 'food', $2, '2026-11-05', 30000, 'IDR')`, [item.id, cBca]), /duplicate key|unique/);
});

await test('smartlog: abaikan dari To Review; undo menghapus transaksi auto-apply', async () => {
  const item = await ingest(C, { pkg: 'id.dana', bank: 'dana', time: '15:00' });
  await as(C, `select public.smartlog_dismiss($1)`, [item.id]);
  eq((await as(C, `select status from public.smartlog_items where id = $1`, [item.id]))[0].status, 'dismissed');
  const before = await balance(cBca);
  const auto = await ingest(C, { amount: 20000, time: '16:00' });
  eq(await balance(cBca), before - 20000);
  await as(C, `select public.smartlog_undo($1)`, [auto.id]);
  eq(await balance(cBca), before);
  eq((await as(C, `select count(*)::int as n from public.transactions where id = $1`, [auto.id]))[0].n, 0);
  await rejects(as(C, `select public.smartlog_undo($1)`, [auto.id]), /not_applied/);
  await rejects(as(B, `select public.smartlog_dismiss($1)`, [item.id]), /not_in_review/);
});

await test('smartlog: baris hanya ditulis lewat RPC; pengguna lain tidak melihat', async () => {
  await rejects(as(C, `insert into public.smartlog_items (user_id, capture_key, package, bank, posted_at, date, time, type, amount, currency, status, fingerprint)
                       values ($1, 'x', 'id.dana', 'dana', now(), '2026-11-05', '10:00', 'expense', 1, 'IDR', 'applied', 'x')`, [C]), /permission denied/);
  await rejects(as(C, `update public.smartlog_items set status = 'confirmed'`), /permission denied/);
  eq(await as(B, 'select count(*)::int as n from public.smartlog_items'), [{ n: 0 }]);
});

await test('smartlog: kuota automation Free 30/bulan; habis = tidak diproses + diberi tahu sekali', async () => {
  const used = await automationUsed(C);
  for (let i = used; i < 30; i++) await sys(`select public.quota_try_consume($1, 'automation')`, [C]);
  const before = (await as(C, 'select count(*)::int as n from public.smartlog_items'))[0].n;
  eq((await ingest(C, { time: '18:00' })).status, 'quota');
  eq((await ingest(C, { time: '18:30' })).status, 'quota');
  eq((await as(C, 'select count(*)::int as n from public.smartlog_items'))[0].n, before, 'tidak ada baris baru');
  eq((await as(C, `select count(*)::int as n from public.notifications where type = 'quota_warning'`))[0].n, 1);
  await sys(`update public.profiles set plan = 'premium' where id = $1`, [C]);
  eq((await ingest(C, { time: '19:00' })).status, 'applied', 'Premium tanpa batas');
});

// ---------------------------------------------------------------- Fase 7 (migrasi 13)
const E = '00000000-0000-4000-8000-00000000000e';
await sys(`insert into auth.users (id, email) values ('${E}', 'e@example.com')`);
let dCard1, dCard2, dSave;

await test('payday: 1-28 diterima, 29 ditolak', async () => {
  await as(E, `update public.profiles set payday = 25`);
  eq(await as(E, 'select payday from public.profiles'), [{ payday: 25 }]);
  await rejects(as(E, `update public.profiles set payday = 29`), /payday_check/);
});

await test('anggaran per periode: satu baris per periode, limit kategori divalidasi, RLS', async () => {
  await as(E, `insert into public.budgets (period_start, total, category_limits) values ('2026-10-25', 5000000, '{"food": 1500000, "transport": 500000}')`);
  await rejects(as(E, `insert into public.budgets (period_start, total) values ('2026-10-25', 1)`), /duplicate key/);
  await rejects(as(E, `insert into public.budgets (period_start, total, category_limits) values ('2026-09-25', 1, '{"food": -5}')`), /budget_limit_invalid/);
  await rejects(as(E, `insert into public.budgets (period_start, total, category_limits) values ('2026-09-25', 1, '{"food": 1.5}')`), /budget_limit_invalid/);
  await as(E, `update public.budgets set total = 6000000 where period_start = '2026-10-25'`);
  eq(await as(E, `select total::int as total, category_limits->>'food' as food from public.budgets`), [{ total: 6000000, food: '1500000' }]);
  eq(await as(B, 'select count(*)::int as n from public.budgets'), [{ n: 0 }], 'pengguna lain');
});

await test('kartu kredit + paylater: limit tersimpan; tabungan tidak bisa punya limit/grup/iuran', async () => {
  [{ id: dCard1 }] = await as(E, `insert into public.accounts (bank, name, type, currency, credit_limit) values ('bca', 'BCA Visa', 'kartu_kredit', 'IDR', 10000000) returning id`);
  [{ id: dCard2 }] = await as(E, `insert into public.accounts (bank, name, type, currency, credit_limit) values ('kredivo', 'Kredivo', 'paylater', 'IDR', 5000000) returning id`);
  [{ id: dSave }] = await as(E, `insert into public.accounts (bank, name, type, currency, credit_limit, annual_fee, annual_fee_month, annual_fee_day) values ('bca', 'BCA', 'tabungan', 'IDR', 999, 100, 1, 1) returning id`);
  eq(await as(E, 'select credit_limit::int as l, annual_fee from public.accounts where id = $1', [dSave]), [{ l: null, annual_fee: null }]);
  eq(await as(E, 'select type, credit_limit::int as l from public.accounts where id = $1', [dCard2]), [{ type: 'paylater', l: 5000000 }]);
});

await test('grup limit: kartu ditautkan ke grup sendiri; grup orang lain ditolak; hapus grup melepas kartu', async () => {
  const [{ id: g }] = await as(E, `insert into public.limit_groups (name, currency, shared_limit) values ('BCA gabungan', 'IDR', 12000000) returning id`);
  await as(E, `update public.accounts set limit_group_id = $1 where id in ($2, $3)`, [g, dCard1, dCard2]);
  eq(await as(E, 'select count(*)::int as n from public.accounts where limit_group_id = $1', [g]), [{ n: 2 }]);
  const [{ id: other }] = await as(B, `insert into public.limit_groups (name, currency, shared_limit) values ('Milik B', 'IDR', 1) returning id`);
  await rejects(as(E, `update public.accounts set limit_group_id = $1 where id = $2`, [other, dCard1]), /limit_group_not_owned|row-level/);
  await as(E, `delete from public.limit_groups where id = $1`, [g]);
  eq(await as(E, 'select count(*)::int as n from public.accounts where limit_group_id is not null'), [{ n: 0 }]);
});

await test('iuran tahunan: nominal + tanggal tagih + riwayat bayar tersimpan; bentuk setengah ditolak', async () => {
  await as(E, `update public.accounts set annual_fee = 300000, annual_fee_month = 3, annual_fee_day = 15, fee_waiver_threshold = 20000000, annual_fee_paid = '{2026-03-15}' where id = $1`, [dCard1]);
  eq(await as(E, `select annual_fee::int as fee, annual_fee_month as m, annual_fee_day as d, annual_fee_paid::text as paid from public.accounts where id = $1`, [dCard1]),
    [{ fee: 300000, m: 3, d: 15, paid: '{2026-03-15}' }]);
  await rejects(as(E, `update public.accounts set annual_fee_month = null where id = $1`, [dCard1]), /accounts_annual_fee_shape/);
  await as(E, `update public.accounts set annual_fee = 1, annual_fee_month = 1, annual_fee_day = 1 where id = $1`, [dCard2]);
  eq(await as(E, 'select annual_fee from public.accounts where id = $1', [dCard2]), [{ annual_fee: null }], 'paylater tanpa iuran');
});

await test('kurs saya: satu per kode, milik sendiri, kode = basis ditolak', async () => {
  await as(E, `insert into public.user_rates (code, base, rate) values ('SAR', 'IDR', 4350)`);
  await as(E, `update public.user_rates set rate = 4400 where code = 'SAR'`);
  eq(await as(E, `select code, base, rate::float as rate from public.user_rates`), [{ code: 'SAR', base: 'IDR', rate: 4400 }]);
  await rejects(as(E, `insert into public.user_rates (code, base, rate) values ('IDR', 'IDR', 1)`), /check/);
  eq(await as(B, 'select count(*)::int as n from public.user_rates'), [{ n: 0 }]);
});

await test('reimbursement: pending -> reimbursed lewat tautan pemasukan; hapus pengganti = pending lagi', async () => {
  const [{ id: e }] = await as(E, `insert into public.transactions (type, merchant, category_key, account_id, date, amount, currency, reimburse_status) values ('expense', 'Makan bareng', 'food', $1, '2026-11-05', 300000, 'IDR', 'pending') returning id`, [dCard1]);
  eq(await as(E, 'select reimburse_status from public.transactions where id = $1', [e]), [{ reimburse_status: 'pending' }]);
  const [{ id: inc }] = await as(E, `insert into public.transactions (type, merchant, category_key, account_id, date, amount, currency) values ('income', 'Ani transfer', 'other', $1, '2026-11-06', 300000, 'IDR') returning id`, [dSave]);
  await as(E, `update public.transactions set reimbursed_by = $1 where id = $2`, [inc, e]);
  eq(await as(E, 'select reimburse_status from public.transactions where id = $1', [e]), [{ reimburse_status: 'reimbursed' }]);
  await rejects(as(E, `update public.transactions set type = 'expense' where id = $1`, [inc]), /reimbursement_linked/);
  await rejects(as(E, `update public.transactions set reimbursed_by = $1 where id = $1`, [e]), /reimbursement_link_invalid/);
  await as(E, `delete from public.transactions where id = $1`, [inc]);
  eq(await as(E, 'select reimburse_status, reimbursed_by from public.transactions where id = $1', [e]), [{ reimburse_status: 'pending', reimbursed_by: null }]);
  const [{ id: bInc }] = await as(B, `select id from public.transactions where user_id = $1 and type = 'income' limit 1`, [B]).then((r) => (r.length ? r : [{ id: e }]));
  if (bInc !== e) await rejects(as(E, `update public.transactions set reimbursed_by = $1 where id = $2`, [bInc, e]), /reimbursement_link_invalid/);
  const [{ id: i2 }] = await as(E, `insert into public.transactions (type, merchant, category_key, account_id, date, amount, currency, reimburse_status) values ('income', 'Bonus', 'salary', $1, '2026-11-06', 1, 'IDR', 'pending') returning id`, [dSave]);
  eq(await as(E, 'select reimburse_status from public.transactions where id = $1', [i2]), [{ reimburse_status: null }], 'hanya pengeluaran');
});

const G = '00000000-0000-4000-8000-00000000000f';
await sys(`insert into auth.users (id, email) values ('${G}', 'g@example.com')`);

await test('admin: RPC admin ditolak untuk bukan admin; tabel admin tidak terbaca klien', async () => {
  for (const sql of ['select public.admin_dashboard()', `select * from public.admin_search_users('')`, `select public.admin_user_detail('${G}')`,
    'select public.admin_fx_status()', `select public.admin_broadcast('all', 'x', 'y')`, `select public.admin_broadcast_count('all')`]) {
    await rejects(as(G, sql), /not_admin/);
  }
  for (const t of ['admin_users', 'user_activity_days', 'fx_sync_runs']) await rejects(as(G, `select * from public.${t}`), /permission denied/);
  await rejects(as(G, `update public.profiles set suspended_at = now(), last_seen_at = now() where id = '${G}'`), /permission denied/);
});

await test('admin: last seen + DAU, dasbor, cari pengguna, detail kuota', async () => {
  await sys(`insert into public.admin_users (user_id) values ('${A}')`);
  await as(G, 'select public.touch_last_seen()');
  await as(G, 'select public.touch_last_seen()');
  eq(await sys(`select count(*)::int n from public.user_activity_days where user_id = '${G}'`), [{ n: 1 }], 'satu baris per hari');
  const [{ admin_dashboard: d }] = await as(A, 'select public.admin_dashboard()');
  eq([d.dau, d.dau_7.length, typeof d.total_users, d.revenue_month], [1, 7, 'number', {}]);
  const found = await as(A, `select email, is_admin from public.admin_search_users('G@EXAMPLE')`);
  eq(found, [{ email: 'g@example.com', is_admin: false }]);
  eq((await as(A, `select count(*)::int n from public.admin_search_users('%')`))[0].n, 0, 'wildcard di-escape');
  const [{ admin_user_detail: u }] = await as(A, `select public.admin_user_detail('${G}')`);
  eq([u.email, u.plan, u.usage.some((x) => x.key === 'scan')], ['g@example.com', 'free', true]);
});

await test('admin: broadcast ke segmen + satu email; pengguna disuspend tidak menerima', async () => {
  eq((await as(A, `select public.admin_broadcast_count('email', 'g@example.com') n`))[0].n, 1);
  const [{ n }] = await as(A, `select public.admin_broadcast('email', 'Halo', 'Uji broadcast', 'g@example.com') n`);
  eq(n, 1);
  eq(await as(G, `select title_key, vars->>'message' m from public.notifications where title_key = 'domain.notif.broadcastTitle'`), [{ title_key: 'domain.notif.broadcastTitle', m: 'Uji broadcast' }]);
  await rejects(as(A, `select public.admin_broadcast('all', '', 'x')`), /invalid_broadcast/);
  await rejects(as(A, `select public.admin_broadcast('vip', 'a', 'b')`), /invalid_segment/);
  await sys(`update public.profiles set suspended_at = now() where id = '${G}'`);
  eq((await as(A, `select public.admin_broadcast('free', 'a', 'b') n`))[0].n, (await sys(`select count(*)::int n from public.profiles where plan = 'free' and suspended_at is null`))[0].n);
  eq((await as(G, `select count(*)::int n from public.notifications where title_key = 'domain.notif.broadcastTitle'`))[0].n, 1, 'G tidak menerima kedua');
  await sys(`update public.profiles set suspended_at = null where id = '${G}'`);
});

await test('admin: status kurs membaca log sinkronisasi', async () => {
  await sys(`insert into public.fx_sync_runs (trigger, ok, rate_date, codes) values ('admin', true, '2026-11-05', 31)`);
  const [{ admin_fx_status: s }] = await as(A, 'select public.admin_fx_status()');
  eq([s.runs.length, s.runs[0].trigger, s.runs[0].ok], [1, 'admin', true]);
});

await test('aset: aturan kolom per jenis + kunci harga netral', async () => {
  const [{ price_key: k }] = await as(A, `insert into public.assets (type, symbol, name, quantity, currency) values ('stock_id', 'BBCA', 'Bank Central Asia', 100, 'IDR') returning price_key`);
  eq(k, 'IDX:BBCA');
  // Jenis live tanpa jumlah, emas selain XAU, dan aset manual tanpa nilai ditolak.
  await rejects(as(A, `insert into public.assets (type, symbol, name, currency) values ('stock_us', 'AAPL', 'Apple', 'USD')`), /assets_live_fields/);
  await rejects(as(A, `insert into public.assets (type, symbol, name, quantity, currency) values ('gold', 'XAG', 'Perak', 10, 'IDR')`), /assets_live_fields/);
  await rejects(as(A, `insert into public.assets (type, name, currency) values ('property', 'Rumah', 'IDR')`), /assets_live_fields/);
  await rejects(as(A, `insert into public.assets (type, symbol, name, quantity, currency) values ('crypto', 'btc', 'Bitcoin', 0.5, 'USD')`), /assets_symbol_check/);
  const [{ price_key: m }] = await as(A, `insert into public.assets (type, name, currency, value_override) values ('property', 'Rumah', 'IDR', 900000000) returning price_key`);
  eq(m, null);
  // Jenis tidak bisa diubah; nilai lain bisa.
  await rejects(as(A, `update public.assets set type = 'other' where name = 'Rumah'`), /permission denied/);
  await as(A, `update public.assets set value_override = 950000000 where name = 'Rumah'`);
  eq((await as(B, `select count(*)::int as n from public.assets`))[0].n, 0, 'aset A tidak terlihat B');
});

await test('aset: Free maksimal 5, Premium tanpa batas', async () => {
  const add = (u, n) => as(u, `insert into public.assets (type, name, currency, value_override) values ('other', $1, 'IDR', 1000)`, [n]);
  // A sudah punya 2 aset dari tes sebelumnya.
  await add(A, 'Tiga');
  await add(A, 'Empat');
  await add(A, 'Lima');
  await rejects(add(A, 'Enam'), /quota_assets/);
  eq((await as(A, `select used from public.my_usage() where key = 'assets'`))[0].used, 5);
  await as(A, `delete from public.assets where name = 'Lima'`);
  await add(A, 'Enam');
  for (let i = 0; i < 7; i++) await add(B, `B${i}`);
  await as(B, `delete from public.assets`);
});

await test('aset: harga publik hanya-baca, log sync tertutup', async () => {
  await sys(`insert into public.asset_prices (symbol, price, currency, source) values ('IDX:BBCA', 5200, 'IDR', 'uji')`);
  eq((await as(B, `select price::float as p from public.asset_prices where symbol = 'IDX:BBCA'`))[0].p, 5200);
  await rejects(as(A, `insert into public.asset_prices (symbol, price, currency, source) values ('US:AAPL', 1, 'USD', 'x')`), /permission denied/);
  await rejects(as(A, `update public.asset_prices set price = 1`), /permission denied/);
  await rejects(sys(`insert into public.asset_prices (symbol, price, currency, source) values ('NASDAQ:AAPL', 1, 'USD', 'x')`), /asset_prices_symbol_check/);
  await sys(`insert into public.asset_price_runs (trigger, ok, source, symbols, updated) values ('cron', true, 'uji', 1, 1)`);
  await rejects(as(A, `select * from public.asset_price_runs`), /permission denied/);
});

await test('aset: snapshot kekayaan bersih satu per hari, milik sendiri', async () => {
  const snap = (u, total) =>
    as(u, `insert into public.net_worth_snapshots (date, total, assets_total, liabilities_total, currency) values ('2026-11-14', $1, $1, 0, 'IDR')
           on conflict (user_id, date) do update set date = excluded.date, total = excluded.total, assets_total = excluded.assets_total,
             liabilities_total = excluded.liabilities_total, currency = excluded.currency`, [total]);
  await snap(A, 1000);
  await snap(A, 2500);
  eq((await as(A, `select total::int as t from public.net_worth_snapshots`)).map((r) => r.t), [2500]);
  eq((await as(B, `select count(*)::int as n from public.net_worth_snapshots`))[0].n, 0);
  await rejects(as(A, `insert into public.net_worth_snapshots (user_id, date, total, assets_total, liabilities_total, currency) values ($1, '2026-11-13', 1, 1, 0, 'IDR')`, [B]), /permission denied/);
});

await test('alert harga (Fase 5): ambang kecil 0,1% terlewati -> satu notifikasi, tidak berulang; pasang lagi pakai harga baru', async () => {
  // A punya BBCA dari tes aset; harga IDX:BBCA 5200 dari tes harga publik.
  const [{ id: bbca }] = await as(A, `select id from public.assets where symbol = 'BBCA'`);
  const [al] = await as(A, `insert into public.asset_price_alerts (asset_id, pct) values ($1, 0.1) returning base_price::float as base, currency, triggered_at`, [bbca]);
  eq([al.base, al.currency, al.triggered_at], [5200, 'IDR', null], 'patokan dari asset_prices');
  // Klien tidak bisa memalsukan patokan atau status terkirim.
  await rejects(as(A, `update public.asset_price_alerts set base_price = 1`), /permission denied/);
  await rejects(as(A, `update public.asset_price_alerts set triggered_at = now()`), /permission denied/);
  eq((await sys(`select public.price_alerts() n`))[0].n, 0, 'harga belum bergerak');
  await sys(`update public.asset_prices set price = 5204 where symbol = 'IDX:BBCA'`);
  eq((await sys(`select public.price_alerts() n`))[0].n, 0, '+0,077% di bawah ambang 0,1%');
  await sys(`update public.asset_prices set price = 5206 where symbol = 'IDX:BBCA'`);
  eq((await sys(`select public.price_alerts() n`))[0].n, 1, '+0,115% melewati ambang');
  const [n] = await as(A, `select type, title_key, message_key, href, vars from public.notifications where type = 'price_alert'`);
  eq([n.type, n.title_key, n.message_key, n.href], ['price_alert', 'domain.notif.priceUpTitle', 'domain.notif.priceAlertMessage', '/aset']);
  eq([n.vars.symbol, Number(n.vars.change), Number(n.vars.threshold), Number(n.vars.price), n.vars.priceCurrency], ['BBCA', 0.1, 0.1, 5206, 'IDR']);
  eq((await sys(`select public.price_alerts() n`))[0].n, 0, 'alert yang sudah terkirim tidak berulang tiap jam');
  // Pasang lagi: patokan jadi harga sekarang, lalu turun melewati ambang.
  eq((await as(A, `update public.asset_price_alerts set pct = 0.1 returning base_price::float as b, triggered_at`, []))[0], { b: 5206, triggered_at: null });
  await sys(`update public.asset_prices set price = 5190 where symbol = 'IDX:BBCA'`);
  eq((await sys(`select public.price_alerts() n`))[0].n, 1);
  eq((await as(A, `select title_key from public.notifications where type = 'price_alert' order by created_at desc, title_key limit 2`)).map((r) => r.title_key).sort(), ['domain.notif.priceDownTitle', 'domain.notif.priceUpTitle']);
  eq((await as(B, `select count(*)::int n from public.asset_price_alerts`))[0].n, 0, 'alert A tidak terlihat B');
  await sys(`update public.asset_prices set price = 5200 where symbol = 'IDX:BBCA'`);
});

await test('alert harga: hanya aset sendiri, harus sudah ada harga live, ambang 0,1 sampai 50, ikut terhapus bersama aset', async () => {
  const [{ id: bbca }] = await as(A, `select id from public.assets where symbol = 'BBCA'`);
  await rejects(as(B, `insert into public.asset_price_alerts (asset_id, pct) values ($1, 5)`, [bbca]), /alert_not_owner/);
  // A sudah di batas 5 aset Free: kasus berikut memakai B.
  const [{ id: zq }] = await as(B, `insert into public.assets (type, symbol, name, quantity, currency) values ('stock_us', 'ZZZQ', 'Tanpa harga', 1, 'USD') returning id`);
  await rejects(as(B, `insert into public.asset_price_alerts (asset_id, pct) values ($1, 5)`, [zq]), /alert_no_price/);
  await sys(`insert into public.asset_prices (symbol, price, currency, source) values ('US:ZZZQ', 10, 'USD', 'uji')`);
  await rejects(as(B, `insert into public.asset_price_alerts (asset_id, pct) values ($1, 0.05)`, [zq]), /pct_check/);
  await rejects(as(B, `insert into public.asset_price_alerts (asset_id, pct) values ($1, 51)`, [zq]), /pct_check/);
  await as(B, `insert into public.asset_price_alerts (asset_id, pct) values ($1, 5)`, [zq]);
  await as(B, `delete from public.assets where id = $1`, [zq]);
  eq((await sys(`select count(*)::int n from public.asset_price_alerts where asset_id = $1`, [zq]))[0].n, 0, 'cascade');
  // Riwayat harga: publik hanya-baca.
  await sys(`insert into public.asset_price_history (symbol, day, price, currency) values ('IDX:BBCA', '2026-11-01', 5000, 'IDR')`);
  eq((await as(B, `select price::float p from public.asset_price_history where symbol = 'IDX:BBCA'`))[0].p, 5000);
  await rejects(as(A, `insert into public.asset_price_history (symbol, day, price, currency) values ('IDX:BBCA', '2026-11-02', 1, 'IDR')`), /permission denied/);
});

await test('rate limit AI: hitung + catat sekaligus (ai_job_start), ke-11 dalam semenit ditolak', async () => {
  await sys(`delete from public.ai_jobs where user_id = $1`, [B]);
  for (let i = 0; i < 10; i++) {
    const [{ id }] = await sys(`select public.ai_job_start($1, 'scan') as id`, [B]);
    if (!id) throw new Error(`ke-${i + 1} seharusnya lolos`);
  }
  // Baris 'started' langsung terhitung: permintaan berikutnya tidak menunggu job sebelumnya selesai.
  eq((await sys(`select count(*)::int as n from public.ai_jobs where user_id = $1 and status = 'started'`, [B]))[0].n, 10, 'started');
  eq((await sys(`select public.ai_job_start($1, 'scan') as id`, [B]))[0].id, null, 'ke-11');
  eq((await sys(`select status, error from public.ai_jobs where user_id = $1 and status = 'limited'`, [B])), [{ status: 'limited', error: 'rate_limited' }]);
  // Di luar jendela semenit: lolos lagi.
  await sys(`update public.ai_jobs set created_at = now() - interval '2 minutes' where user_id = $1`, [B]);
  if (!(await sys(`select public.ai_job_start($1, 'coach') as id`, [B]))[0].id) throw new Error('setelah semenit seharusnya lolos');
  await rejects(as(B, `select public.ai_job_start($1, 'scan')`, [B]), /permission denied/);
});

await test('kuota narasi Coach: harian, Free 10 / Premium 30, ke-(batas+1) ditolak', async () => {
  eq(await sys(`select plan, monthly_limit, "window" from public.plan_limits where key = 'coachNarration' order by plan`), [
    { plan: 'free', monthly_limit: 10, window: 'day' },
    { plan: 'premium', monthly_limit: 30, window: 'day' },
  ]);
  const [{ plan }] = await sys(`select plan from public.profiles where id = $1`, [B]);
  const limit = plan === 'premium' ? 30 : 10;
  for (let i = 0; i < limit; i++) eq((await sys(`select public.quota_try_consume($1, 'coachNarration') as ok`, [B]))[0].ok, true, `ke-${i + 1}`);
  eq((await sys(`select public.quota_try_consume($1, 'coachNarration') as ok`, [B]))[0].ok, false, `ke-${limit + 1}`);
});

await test('sinkron paket: tulisan dengan tiket lama tidak menimpa tulisan yang lebih baru', async () => {
  const [{ t: older }] = await sys(`select public.plan_sync_ticket() as t`);
  const [{ t: newer }] = await sys(`select public.plan_sync_ticket() as t`);
  // Renewal (tiket baru) menulis premium lebih dulu; expiry (tiket lama, baca lebih awal) datang terakhir.
  const [w1] = await sys(`select * from public.plan_sync_apply($1, $2, 'premium', now() + interval '30 days', 'store')`, [B, newer]);
  eq([w1.o_plan, w1.o_applied], ['premium', true], 'renewal');
  const [w2] = await sys(`select * from public.plan_sync_apply($1, $2, 'free', null, null)`, [B, older]);
  eq([w2.o_plan, w2.o_applied], ['premium', false], 'expiry basi diabaikan');
  eq((await sys(`select plan from public.profiles where id = $1`, [B]))[0].plan, 'premium');
  const [{ t: latest }] = await sys(`select public.plan_sync_ticket() as t`);
  eq((await sys(`select * from public.plan_sync_apply($1, $2, 'free', null, null)`, [B, latest]))[0].o_applied, true, 'sinkron lebih baru tetap bisa menurunkan');
  await rejects(as(B, `select public.plan_sync_ticket()`), /permission denied/);
  await rejects(as(B, `select * from public.plan_sync_apply($1, 999999, 'premium', null, null)`, [B]), /permission denied/);
});

await test('webhook: duplikat hanya bila selesai atau klaim < 5 menit; klaim macet bisa diambil ulang', async () => {
  const claim = async (id) => (await sys(`select public.webhook_claim('xendit', $1) as ok`, [id]))[0].ok;
  eq(await claim('inv-1:PAID'), true, 'klaim pertama');
  eq(await claim('inv-1:PAID'), false, 'kiriman ulang saat masih diproses');
  // Fungsi mati di tengah: klaim tidak pernah selesai. Setelah 5 menit, kiriman ulang diproses lagi.
  await sys(`update public.webhook_events set claimed_at = now() - interval '6 minutes' where event_id = 'inv-1:PAID'`);
  eq(await claim('inv-1:PAID'), true, 'klaim macet diambil ulang');
  await sys(`select public.webhook_done('xendit', 'inv-1:PAID')`);
  await sys(`update public.webhook_events set claimed_at = now() - interval '6 minutes' where event_id = 'inv-1:PAID'`);
  eq(await claim('inv-1:PAID'), false, 'sudah selesai tetap duplikat');
  await rejects(as(B, `select public.webhook_claim('xendit', 'x')`), /permission denied/);
  await rejects(as(B, `select public.webhook_done('xendit', 'x')`), /permission denied/);
});

await test('harga aset: asset_price_keys mengembalikan SEMUA kunci unik (lebih dari 1000), terurut', async () => {
  // Isi massal tanpa trigger batas Free (pengujian volume, bukan alur pengguna).
  await db.exec(`set session_replication_role = replica`);
  try {
    await sys(
      `insert into public.assets (user_id, type, symbol, name, quantity, currency)
       select $1::uuid, 'stock_id', 'S' || g, 'Saham ' || g, 1, 'IDR' from generate_series(0, 1099) g
       union all select $1::uuid, 'stock_id', 'S0', 'Duplikat', 1, 'IDR' from generate_series(1, 50)`,
      [B],
    );
  } finally {
    await db.exec(`set session_replication_role = origin`);
  }
  const [{ keys }] = await sys(`select public.asset_price_keys() as keys`);
  const [{ n }] = await sys(`select count(distinct price_key)::int as n from public.assets where price_key is not null`);
  eq(keys.length, n, 'semua kunci unik');
  if (n < 1100) throw new Error(`seharusnya >= 1100 kunci, didapat ${n}`);
  eq(keys, [...keys].sort(), 'terurut');
  eq(new Set(keys).size, keys.length, 'tanpa duplikat');
  if (!keys.includes('IDX:S1099')) throw new Error('kunci setelah baris ke-1000 hilang');
  await rejects(as(B, `select public.asset_price_keys()`), /permission denied/);
  await sys(`delete from public.assets where user_id = $1 and symbol ~ '^S[0-9]+$'`, [B]);
});

await test('hapus pengguna: semua data ikut terhapus (cascade)', async () => {
  await as(A, `insert into public.smartlog_rules (pattern, action, category_key) values ('kopi cascade', 'categorize', 'food')`);
  const kept = await sys(`select id from public.orders where user_id = $1`, [A]);
  if (kept.length === 0) throw new Error('prasyarat: A punya pesanan');
  await sys(`delete from auth.users where id = $1`, [A]);
  await sys(`delete from auth.users where id = $1`, [E]);
  // Riwayat pembayaran tetap ada (audit, refund/chargeback, pendapatan), tanpa pemilik.
  eq(
    (await sys(`select user_id from public.orders where id = any($1::uuid[])`, [kept.map((o) => o.id)])).map((o) => o.user_id),
    kept.map(() => null),
    'pesanan disimpan tanpa pemilik',
  );
  for (const id of [A, E]) for (const t of ['budgets', 'limit_groups', 'user_rates']) eq((await sys(`select count(*)::int as n from public.${t} where user_id = $1`, [id]))[0].n, 0, t);
  for (const t of ['profiles', 'accounts', 'transactions', 'transaction_items', 'notifications', 'usage_counters', 'smartlog_links', 'smartlog_items', 'smartlog_rules', 'invoices', 'invoice_counters', 'assets', 'net_worth_snapshots']) {
    const col = t === 'profiles' ? 'id' : 'user_id';
    eq((await sys(`select count(*)::int as n from public.${t} where ${col} = $1`, [A]))[0].n, 0, t);
  }
});

// ---------------------------------------------------------------- cadangan: restore_rows (security invoker)
const RC = '00000000-0000-4000-8000-0000000000c1';
const RD = '00000000-0000-4000-8000-0000000000d1';
await sys(`insert into auth.users (id, email) values ('${RC}', 'rc@example.com'), ('${RD}', 'rd@example.com')`);
const accC = '11111111-1111-4111-8111-111111111111';
const txC = '22222222-2222-4222-8222-222222222222';
const restore = (user, table, rows) => as(user, 'select public.restore_rows($1, $2::jsonb) as r', [table, JSON.stringify(rows)]).then((x) => ({ restored: x[0].r.restored, skipped: x[0].r.skipped }));

await test('restore: akun + transaksi dipulihkan; saldo dihitung trigger, saldo di file diabaikan', async () => {
  eq(await restore(RC, 'accounts', [{ id: accC, bank: 'bca', name: 'BCA', type: 'tabungan', currency: 'IDR', opening_balance: 500000, balance: 999999999 }]), { restored: 1, skipped: 0 });
  eq(await restore(RC, 'transactions', [{ id: txC, type: 'expense', merchant: 'Kopi', category_key: 'hangout', account_id: accC, date: '2026-11-05', amount: 28000, currency: 'IDR' }]), { restored: 1, skipped: 0 });
  eq(await balance(accC), 472000);
  eq((await sys('select user_id from public.accounts where id = $1', [accC]))[0].user_id, RC);
});

await test('restore diulang: tidak ada data ganda, saldo tetap', async () => {
  eq(await restore(RC, 'transactions', [{ id: txC, type: 'expense', merchant: 'Kopi', category_key: 'hangout', account_id: accC, date: '2026-11-05', amount: 28000, currency: 'IDR' }]), { restored: 1, skipped: 0 });
  eq((await sys('select count(*)::int as n from public.transactions where user_id = $1', [RC]))[0].n, 1);
  eq(await balance(accC), 472000);
});

await test('restore tidak bisa menimpa data pengguna lain walau id sama', async () => {
  const r = await restore(RD, 'transactions', [{ id: txC, type: 'expense', merchant: 'DIBAJAK', category_key: 'other', account_id: accC, date: '2026-11-05', amount: 1, currency: 'IDR' }]);
  eq(r, { restored: 0, skipped: 1 });
  eq((await sys('select merchant, user_id from public.transactions where id = $1', [txC]))[0], { merchant: 'Kopi', user_id: RC });
  // Lewat akun D sendiri yang sah: id transaksi C tetap tidak bisa diambil alih.
  const accD = '44444444-4444-4444-8444-444444444444';
  eq(await restore(RD, 'accounts', [{ id: accD, bank: 'bca', name: 'D', type: 'tabungan', currency: 'IDR' }]), { restored: 1, skipped: 0 });
  eq(await restore(RD, 'transactions', [{ id: txC, type: 'expense', merchant: 'DIBAJAK', category_key: 'other', account_id: accD, date: '2026-11-05', amount: 1, currency: 'IDR' }]), { restored: 0, skipped: 1 });
  eq((await sys('select merchant, user_id from public.transactions where id = $1', [txC]))[0], { merchant: 'Kopi', user_id: RC });
});

await test('restore hanya untuk tabel data pengguna (paket, kuota, profil ditolak)', async () => {
  for (const t of ['profiles', 'usage_counters', 'orders', 'plan_limits']) await rejects(restore(RC, t, []), /restore_table_not_allowed/);
});

await test('restore tetap tunduk pada kuota paket Free (akun ke-5 dilewati)', async () => {
  const rows = Array.from({ length: 4 }, (_, i) => ({ id: `33333333-3333-4333-8333-33333333333${i}`, bank: 'bca', name: `Akun ${i}`, type: 'tabungan', currency: 'IDR' }));
  const r = await restore(RC, 'accounts', rows);
  eq(r, { restored: 3, skipped: 1 });
});

// ---------------------------------------------------------------- regresi audit & perbaikan bug (20261126000030)
const RE = '00000000-0000-4000-8000-0000000000e1';
const RF = '00000000-0000-4000-8000-0000000000f1';
await sys(`insert into auth.users (id, email) values ('${RE}', 're@example.com'), ('${RF}', 'rf@example.com')`);

await test('debt_payments_apply: tolak lintas pengguna, lunas saat penuh, aktif lagi saat hapus', async () => {
  const [{ id: debtId }] = await as(
    RE,
    `insert into public.debts (kind, counterparty, principal, currency)
     values ('debt', 'Bank RE', 100000, 'IDR') returning id`,
  );
  // Pengguna lain ditolak oleh RLS, dan trigger juga menolak spoofing user_id lintas pemilik.
  await rejects(
    as(RF, `insert into public.debt_payments (debt_id, amount, date) values ($1, 10000, '2026-11-26')`, [debtId]),
    /row-level security|debt_not_owned/,
  );
  await rejects(
    sys(`insert into public.debt_payments (debt_id, user_id, amount, date) values ($1, $2, 10000, '2026-11-26')`, [debtId, RF]),
    /debt_not_owned/,
  );

  // Bayar sebagian -> saldo berkurang, status tetap active.
  await as(RE, `insert into public.debt_payments (debt_id, amount, date) values ($1, 60000, '2026-11-26')`, [debtId]);
  eq((await as(RE, `select balance::int as b, status from public.debts where id = $1`, [debtId]))[0], { b: 40000, status: 'active' });

  // Melebihi sisa saldo ditolak.
  await rejects(
    as(RE, `insert into public.debt_payments (debt_id, amount, date) values ($1, 50000, '2026-11-26')`, [debtId]),
    /payment_exceeds_balance/,
  );

  // Pelunasan penuh -> balance 0 dan status paid; bayar lagi ditolak.
  const [{ id: fullPayId }] = await as(
    RE,
    `insert into public.debt_payments (debt_id, amount, date) values ($1, 40000, '2026-11-26') returning id`,
    [debtId],
  );
  eq((await as(RE, `select balance::int as b, status from public.debts where id = $1`, [debtId]))[0], { b: 0, status: 'paid' });
  await rejects(
    as(RE, `insert into public.debt_payments (debt_id, amount, date) values ($1, 1, '2026-11-26')`, [debtId]),
    /debt_closed/,
  );

  // Klien tidak diizinkan menghapus langsung; saat baris pembayaran terhapus (cascade/admin), saldo & status kembali active.
  await rejects(as(RE, `delete from public.debt_payments where id = $1`, [fullPayId]), /permission denied/);
  await sys(`delete from public.debt_payments where id = $1`, [fullPayId]);
  eq((await as(RE, `select balance::int as b, status from public.debts where id = $1`, [debtId]))[0], { b: 40000, status: 'active' });
});

await test('profiles_notif_prefs_check: tolak non-objek, nilai non-boolean, dan payload > 1024 byte', async () => {
  await rejects(as(RE, `update public.profiles set notif_prefs = '"bad"'::jsonb where id = auth.uid()`), /profiles_notif_prefs_check/);
  await rejects(as(RE, `update public.profiles set notif_prefs = '{"debt_due":"yes"}'::jsonb where id = auth.uid()`), /profiles_notif_prefs_check/);
  await rejects(
    as(RE, `update public.profiles set notif_prefs = jsonb_build_object('bill_due', true, 'pad', repeat('x', 1100)) where id = auth.uid()`),
    /profiles_notif_prefs_check/,
  );
  await as(RE, `update public.profiles set notif_prefs = '{"bill_due":false,"price_alert":true}'::jsonb where id = auth.uid()`);
  const [{ prefs }] = await as(RE, `select notif_prefs as prefs from public.profiles where id = auth.uid()`);
  eq(prefs, { bill_due: false, price_alert: true });
});

await test('restore_rows: UUID tidak valid dilewati (skipped: 1) & saldo akun tetap akurat', async () => {
  const accRE = '44444444-4444-4444-8444-4444444444e1';
  const txRE1 = '55555555-5555-4555-8555-5555555555e1';
  const txRE2 = '55555555-5555-4555-8555-5555555555e2';

  const accRes = await restore(RE, 'accounts', [
    { id: accRE, bank: 'bca', name: 'Kas RE', type: 'tabungan', currency: 'IDR', opening_balance: 500000 },
  ]);
  eq(accRes, { restored: 1, skipped: 0 }, 'restore akun RE');

  const badUuid = await restore(RE, 'accounts', [
    { id: 'bukan-uuid', bank: 'bca', name: 'Rusak', type: 'tabungan', currency: 'IDR' },
  ]);
  eq(badUuid, { restored: 0, skipped: 1 }, 'uuid rusak dilewati');

  const txRes = await restore(RE, 'transactions', [
    { id: txRE1, type: 'expense', merchant: 'Kopi', category_key: 'food', account_id: accRE, date: '2026-11-20', time: '09:00', amount: 25000, currency: 'IDR' },
    { id: txRE2, type: 'income', merchant: 'Refund', category_key: 'other', account_id: accRE, date: '2026-11-21', time: '10:00', amount: 100000, currency: 'IDR' },
  ]);
  eq(txRes, { restored: 2, skipped: 0 }, 'restore transaksi RE');
  eq((await sys(`select balance::int as b from public.accounts where id = $1`, [accRE]))[0].b, 575000, 'saldo terhitung dari opening + tx');
});

await test('akun ditangguhkan diblokir pada bill_mark_paid & smartlog_ingest, serta paket premium kedaluwarsa turun ke Free', async () => {
  const accRE = '44444444-4444-4444-8444-4444444444e1';
  const [{ id: billId }] = await as(
    RE,
    `insert into public.bills (name, amount, currency, frequency, due_date, anchor_day, account_id)
     values ('Listrik', 150000, 'IDR', 'monthly', '2026-11-25', 25, $1) returning id`,
    [accRE],
  );
  const [{ id: txId }] = await as(
    RE,
    `insert into public.transactions (type, merchant, category_key, account_id, date, time, amount, currency)
     values ('expense', 'PLN', 'bills', $1, '2026-11-25', '10:00', 150000, 'IDR') returning id`,
    [accRE],
  );

  await sys(`update public.profiles set suspended_at = now(), smartlog_enabled = true where id = $1`, [RE]);
  await rejects(as(RE, `select * from public.bill_mark_paid($1, $2)`, [billId, txId]), /account_suspended/);
  const [{ res }] = await as(
    RE,
    `select public.smartlog_ingest('cap-re-1', 'com.bca', 'bca', now(), '2026-11-25', '10:00', 'expense', 50000, 'IDR', 'Kopi', 'excerpt', 'fp-re-1', '{}') as res`,
  );
  eq(res.status, 'disabled', 'smartlog ditangguhkan');

  await sys(`update public.profiles set plan = 'premium', premium_until = now() - interval '1 day', suspended_at = null where id = $1`, [RF]);
  const [{ freeLimit }] = await sys(`select monthly_limit::int as "freeLimit" from public.plan_limits where plan = 'free' and key = 'accounts'`);
  const [{ rfLimit }] = await as(RF, `select monthly_limit::int as "rfLimit" from public.my_usage() where key = 'accounts'`);
  eq(rfLimit, freeLimit, 'premium kedaluwarsa memakai batas Free');
});

await test('smartlog_rules: RLS lintas akun, kategorisasi otomatis, dan aturan transfer hapus keraguan topup', async () => {
  const R1 = '00000000-0000-4000-8000-0000000000e2';
  const R2 = '00000000-0000-4000-8000-0000000000f2';
  await sys(`insert into auth.users (id, email) values ('${R1}', 'r1@example.com'), ('${R2}', 'r2@example.com')`);
  const [{ id: accBank }] = await as(R1, `insert into public.accounts (bank, name, type, currency, opening_balance) values ('bca', 'BCA R1', 'tabungan', 'IDR', 1000000) returning id`);
  const [{ id: accWallet }] = await as(R1, `insert into public.accounts (bank, name, type, currency, opening_balance) values ('gopay', 'GoPay R1', 'ewallet', 'IDR', 0) returning id`);
  const [{ id: accOther }] = await as(R2, `insert into public.accounts (bank, name, type, currency, opening_balance) values ('mandiri', 'Mandiri R2', 'tabungan', 'IDR', 0) returning id`);

  await as(R1, `update public.profiles set smartlog_enabled = true where id = auth.uid()`);
  await as(R1, `insert into public.smartlog_links (package, account_id) values ('com.bca', $1)`, [accBank]);

  // Tidak boleh membuat aturan transfer ke akun milik pengguna lain.
  await rejects(
    as(R1, `insert into public.smartlog_rules (pattern, action, category_key, to_account_id) values ('Kirim Luar', 'transfer', 'savings', $1)`, [accOther]),
    /account_not_owned/,
  );

  // Aturan kategori + isolasi RLS untuk pengguna lain.
  const [{ id: catRuleId }] = await as(
    R1,
    `insert into public.smartlog_rules (pattern, action, category_key) values ('kopi kenangan', 'categorize', 'food') returning id`,
  );
  eq((await as(R2, `select id from public.smartlog_rules where id = $1`, [catRuleId])).length, 0, 'RLS tolak baca rule user lain');

  const [{ res: catRes }] = await as(
    R1,
    `select public.smartlog_ingest('cap-rule-1', 'com.bca', 'bca', now(), '2026-11-26', '09:00', 'expense', 50000, 'IDR', 'KOPI KENANGAN', 'Bayar QRIS KOPI KENANGAN Rp 50.000', 'fp-rule-1', '{}') as res`,
  );
  eq(catRes.status, 'applied', 'rule kategori auto-apply');
  eq(catRes.category_key, 'food', 'kategori dari rule diterapkan');
  eq((await as(R1, `select category_key from public.transactions where id = $1`, [catRes.id]))[0].category_key, 'food');

  // Aturan transfer ke dompet sendiri: menghapus keraguan topup dan memperbarui saldo kedua akun.
  await as(
    R1,
    `insert into public.smartlog_rules (pattern, action, category_key, to_account_id) values ('gopay topup', 'transfer', 'savings', $1)`,
    [accWallet],
  );
  const [{ res: trfRes }] = await as(
    R1,
    `select public.smartlog_ingest('cap-rule-2', 'com.bca', 'bca', now(), '2026-11-26', '10:00', 'expense', 150000, 'IDR', 'GOPAY TOPUP', 'Top up GoPay Rp 150.000 berhasil', 'fp-rule-2', array['topup']) as res`,
  );
  eq(trfRes.status, 'applied', 'rule transfer hapus keraguan topup');
  eq(trfRes.tx_type, 'transfer', 'tx_type menjadi transfer');
  eq(trfRes.to_account_id, accWallet, 'tujuan transfer sesuai rule');
  eq((await as(R1, `select type, to_account_id from public.transactions where id = $1`, [trfRes.id]))[0], { type: 'transfer', to_account_id: accWallet });
  eq((await sys(`select balance::int as b from public.accounts where id = $1`, [accBank]))[0].b, 800000, 'saldo bank berkurang 50rb + 150rb');
  eq((await sys(`select balance::int as b from public.accounts where id = $1`, [accWallet]))[0].b, 150000, 'saldo dompet tujuan bertambah 150rb');

  // Pemulihan cadangan (restore_rows) untuk smartlog_rules harus idempoten dan menolak akun tujuan pengguna lain.
  const R3 = '00000000-0000-4000-8000-0000000000e3';
  const accR3 = '66666666-6666-4666-8666-6666666666e3';
  await sys(`insert into auth.users (id, email) values ('${R3}', 'r3@example.com')`);
  eq(await restore(R3, 'accounts', [{ id: accR3, bank: 'gopay', name: 'GoPay R3', type: 'ewallet', currency: 'IDR' }]), { restored: 1, skipped: 0 });
  const ruleRows = [
    { id: '77777777-7777-4777-8777-7777777777e1', pattern: 'indomaret', action: 'categorize', category_key: 'groceries', to_account_id: null },
    { id: '77777777-7777-4777-8777-7777777777e2', pattern: 'gopay topup', action: 'transfer', category_key: 'savings', to_account_id: accR3 },
  ];
  eq(await restore(R3, 'smartlog_rules', ruleRows), { restored: 2, skipped: 0 }, 'restore smartlog_rules');
  eq(await restore(R3, 'smartlog_rules', ruleRows), { restored: 2, skipped: 0 }, 'restore smartlog_rules idempoten');
  eq((await sys(`select count(*)::int as n from public.smartlog_rules where user_id = $1`, [R3]))[0].n, 2, 'jumlah rule R3 tetap 2');
  eq(
    await restore(R3, 'smartlog_rules', [{ id: '77777777-7777-4777-8777-7777777777e3', pattern: 'curang', action: 'transfer', category_key: 'savings', to_account_id: accOther }]),
    { restored: 0, skipped: 1 },
    'restore rule dengan akun tujuan milik orang lain dilewati',
  );
});

await test('idempotency_keys: akses klien diblokir, state machine & stale lease bekerja atomik', async () => {
  const S1 = '00000000-0000-4000-8000-0000000000f5';
  await sys(`insert into auth.users (id, email) values ('${S1}', 's1@example.com')`);
  await rejects(as(S1, 'select * from public.idempotency_keys'), /permission denied/);
  await rejects(as(S1, `select * from public.idempotency_begin($1, 'checkout-create', 'idem-client-1', '1234567890abcdef')`, [S1]), /permission denied/);

  const scope = 'checkout-create';
  const key = 'idem-checkout-test-1';
  const hashA = 'aaaa1111bbbb2222cccc3333dddd4444';
  const hashB = 'ffff9999eeee8888dddd7777cccc6666';

  const first = (await sys(`select state, status_code, response_body, lease_id from public.idempotency_begin($1, $2, $3, $4, 60)`, [S1, scope, key, hashA]))[0];
  eq(
    { state: first.state, status_code: first.status_code, response_body: first.response_body },
    { state: 'acquired', status_code: null, response_body: null },
    'begin pertama acquired',
  );
  ok(first.lease_id, 'lease_id pertama terisi');

  eq(
    (await sys(`select state, status_code, response_body from public.idempotency_begin($1, $2, $3, $4, 60)`, [S1, scope, key, hashA]))[0],
    { state: 'in_progress', status_code: null, response_body: null },
    'request paralel saat in_progress ditahan',
  );
  eq(
    (await sys(`select state from public.idempotency_begin($1, $2, $3, $4, 60)`, [S1, scope, key, hashB]))[0].state,
    'payload_mismatch',
    'payload berbeda ditolak',
  );

  // Lease kedaluwarsa (> 60 detik) diambil alih dengan fencing token (lease_id) baru.
  await sys(`update public.idempotency_keys set updated_at = now() - interval '90 seconds' where user_id = $1 and scope = $2 and key = $3`, [S1, scope, key]);
  const second = (await sys(`select state, lease_id from public.idempotency_begin($1, $2, $3, $4, 60)`, [S1, scope, key, hashA]))[0];
  eq(second.state, 'acquired', 'stale lease diambil alih');
  ok(second.lease_id && second.lease_id !== first.lease_id, 'fencing lease_id berubah saat takeover');

  // Worker zombie lama (first.lease_id) tidak boleh menghapus atau menimpa lease milik worker baru (second.lease_id).
  await sys(`select public.idempotency_release($1, $2, $3, $4::uuid)`, [S1, scope, key, first.lease_id]);
  await sys(`select public.idempotency_complete($1, $2, $3, $4::uuid, 200, '{"zombie":true}'::jsonb)`, [S1, scope, key, first.lease_id]);
  eq((await sys(`select status from public.idempotency_keys where user_id = $1 and scope = $2 and key = $3`, [S1, scope, key]))[0].status, 'in_progress', 'zombie worker ditolak fencing token');

  const cachedBody = { orderId: '11111111-1111-4111-8111-111111111111', provider: 'xendit', checkoutUrl: 'https://pay.test/1', transactionId: null };
  await sys(`select public.idempotency_complete($1, $2, $3, $4::uuid, 200, $5::jsonb)`, [S1, scope, key, second.lease_id, JSON.stringify(cachedBody)]);
  eq(
    (await sys(`select state, status_code, response_body from public.idempotency_begin($1, $2, $3, $4, 60)`, [S1, scope, key, hashA]))[0],
    { state: 'completed', status_code: 200, response_body: cachedBody },
    'completed memutar ulang response tepat',
  );

  // Release hanya menghapus in_progress dengan lease yang cocok, bukan completed.
  await sys(`select public.idempotency_release($1, $2, $3, $4::uuid)`, [S1, scope, key, second.lease_id]);
  eq((await sys(`select status from public.idempotency_keys where user_id = $1 and scope = $2 and key = $3`, [S1, scope, key]))[0].status, 'completed');

  const keyFail = 'idem-checkout-test-2';
  const failBegin = (await sys(`select lease_id from public.idempotency_begin($1, $2, $3, $4, 60)`, [S1, scope, keyFail, hashA]))[0];
  await sys(`select public.idempotency_release($1, $2, $3, $4::uuid)`, [S1, scope, keyFail, failBegin.lease_id]);
  eq(
    (await sys(`select state from public.idempotency_begin($1, $2, $3, $4, 60)`, [S1, scope, keyFail, hashA]))[0].state,
    'acquired',
    'key bisa dipakai ulang setelah release',
  );
  await sys(`delete from public.idempotency_keys where user_id = $1`, [S1]);
});

await test('deterministic lock ordering pada transfer dua arah menjaga saldo tepat tanpa error lock_timeout', async () => {
  const S1 = '00000000-0000-4000-8000-0000000000f5';
  const [{ id: accS1 }] = await as(S1, `insert into public.accounts (bank, name, type, currency, opening_balance) values ('bca', 'BCA S1', 'tabungan', 'IDR', 500000) returning id`);
  const [{ id: accS2 }] = await as(S1, `insert into public.accounts (bank, name, type, currency, opening_balance) values ('jago', 'Jago S1', 'tabungan', 'IDR', 100000) returning id`);
  const [b0, j0] = [await balance(accS1), await balance(accS2)];
  await as(
    S1,
    `insert into public.transactions (type, merchant, category_key, account_id, to_account_id, date, amount, currency, note)
     values
       ('transfer', 'Arah AB', 'savings', $1::uuid, $2::uuid, '2026-11-26', 75000, 'IDR', 'lock-order-test'),
       ('transfer', 'Arah BA', 'savings', $2::uuid, $1::uuid, '2026-11-26', 25000, 'IDR', 'lock-order-test')`,
    [accS1, accS2],
  );
  eq([await balance(accS1), await balance(accS2)], [b0 - 50000, j0 + 50000], 'saldo transfer dua arah');
  await as(S1, `delete from public.transactions where note = 'lock-order-test'`);
  eq([await balance(accS1), await balance(accS2)], [b0, j0], 'saldo kembali setelah hapus');
});

await test('admin: admin_ops_overview ditolak untuk bukan admin dan mengembalikan ringkasan operasional lengkap', async () => {
  await rejects(as(G, 'select public.admin_ops_overview()'), /not_admin/);
  const ADM2 = '00000000-0000-4000-8000-0000000000fa';
  await sys(`insert into auth.users (id, email) values ('${ADM2}', 'adm2@example.com')`);
  await sys(`insert into public.admin_users (user_id) values ('${ADM2}')`);
  await sys(`insert into public.asset_price_runs (trigger, ok, source, symbols, updated, failed, duration_ms) values ('admin', true, 'yahoo-idx', 12, 11, array['IDX:TEST'], 340)`);
  const [{ admin_ops_overview: o }] = await as(ADM2, 'select public.admin_ops_overview()');
  eq(o.dau_30.length, 30, 'dau_30 berisi 30 hari');
  eq(typeof o.onboarded_users, 'number', 'onboarded_users bertipe angka');
  ok(Array.isArray(o.asset_runs) && o.asset_runs.some((r) => r.source === 'yahoo-idx' && r.failed_count === 1 && r.duration_ms === 340), 'asset_runs memuat log terbaru');
  ok(Array.isArray(o.recent_broadcasts) && o.recent_broadcasts.some((b) => b.title === 'Halo' && b.message === 'Uji broadcast'), 'recent_broadcasts memuat broadcast sebelumnya');
  ok(o.currencies && typeof o.currencies === 'object' && Object.keys(o.currencies).length > 0, 'currencies terisi');
  ok(o.langs && typeof o.langs === 'object' && Object.keys(o.langs).length > 0, 'langs terisi');
});

await test('Paket 3: alert rearm base_price sama, hapus alert saat ganti symbol/value_override, notif_prefs price_alert, dan hard cap 200', async () => {
  const PA = '00000000-0000-4000-8000-0000000000a9';
  await sys(`insert into auth.users (id, email) values ('${PA}', 'pa@example.com')`);
  await sys(`update public.profiles set plan = 'premium', premium_until = now() + interval '30 days' where id = $1`, [PA]);
  await sys(
    `insert into public.asset_prices (symbol, price, currency, source)
     values ('IDX:BBCA', 5200, 'IDR', 'uji'), ('IDX:BBRI', 4500, 'IDR', 'uji')
     on conflict (symbol) do update set price = excluded.price, currency = excluded.currency`,
  );

  // 1. Rearming pada base_price yang sama persis (5200 -> 5206 -> trigger -> 5200 -> rearm -> 5206 -> trigger) mengirim KEDUA notifikasi.
  const [{ id: a1 }] = await as(
    PA,
    `insert into public.assets (type, symbol, name, quantity, currency)
     values ('stock_id', 'BBCA', 'BCA PA', 100, 'IDR') returning id`,
  );
  const [al0] = await as(PA, `insert into public.asset_price_alerts (asset_id, pct) values ($1, 0.1) returning rearm_seq, base_price::float as base`, [a1]);
  eq([al0.rearm_seq, al0.base], [0, 5200], 'arm awal rearm_seq = 0');

  await sys(`update public.asset_prices set price = 5206 where symbol = 'IDX:BBCA'`);
  eq((await sys(`select public.price_alerts() n`))[0].n, 1, 'trigger pertama');
  eq((await as(PA, `select count(*)::int n from public.notifications where type = 'price_alert'`))[0].n, 1, 'notif pertama terkirim');

  await sys(`update public.asset_prices set price = 5200 where symbol = 'IDX:BBCA'`);
  const [al1] = await as(PA, `update public.asset_price_alerts set pct = 0.1 where asset_id = $1 returning rearm_seq, base_price::float as base, triggered_at`, [a1]);
  eq([al1.rearm_seq, al1.base, al1.triggered_at], [1, 5200, null], 'rearm menaikkan rearm_seq meski base_price sama');

  await sys(`update public.asset_prices set price = 5206 where symbol = 'IDX:BBCA'`);
  eq((await sys(`select public.price_alerts() n`))[0].n, 1, 'trigger kedua pada base_price sama');
  eq((await as(PA, `select count(*)::int n from public.notifications where type = 'price_alert'`))[0].n, 2, 'kedua notifikasi terkirim tanpa dedupe drop');

  // 2. notif_prefs price_alert = false menahan price_alerts().
  await sys(`update public.asset_prices set price = 5200 where symbol = 'IDX:BBCA'`);
  await as(PA, `update public.asset_price_alerts set pct = 0.1 where asset_id = $1`, [a1]);
  await as(PA, `update public.profiles set notif_prefs = '{"price_alert":false}'::jsonb where id = auth.uid()`);
  await sys(`update public.asset_prices set price = 5300 where symbol = 'IDX:BBCA'`);
  eq((await sys(`select public.price_alerts() n`))[0].n, 0, 'notif_prefs price_alert=false menekan alert');
  eq((await as(PA, `select count(*)::int n from public.notifications where type = 'price_alert'`))[0].n, 2, 'tidak ada notif tambahan saat dimatikan');
  await as(PA, `update public.profiles set notif_prefs = '{"price_alert":true}'::jsonb where id = auth.uid()`);

  // 3. Mengubah symbol atau mengisi value_override otomatis menghapus alert; insert alert pada aset manual override ditolak.
  await as(PA, `update public.assets set symbol = 'BBRI' where id = $1`, [a1]);
  eq((await sys(`select count(*)::int n from public.asset_price_alerts where asset_id = $1`, [a1]))[0].n, 0, 'ganti symbol menghapus alert basi');

  await as(PA, `insert into public.asset_price_alerts (asset_id, pct) values ($1, 5)`, [a1]);
  await as(PA, `update public.assets set value_override = 500000 where id = $1`, [a1]);
  eq((await sys(`select count(*)::int n from public.asset_price_alerts where asset_id = $1`, [a1]))[0].n, 0, 'isi value_override menghapus alert');
  await rejects(as(PA, `insert into public.asset_price_alerts (asset_id, pct) values ($1, 5)`, [a1]), /alert_manual_override/);

  // 4. Constraint symbol pada asset_price_history menolak format titik ganda/tepi.
  await rejects(
    sys(`insert into public.asset_price_history (symbol, day, price, currency) values ('IDX:.BBCA', '2026-11-27', 5000, 'IDR')`),
    /asset_price_history_symbol_check/,
  );

  // 5. Hard cap 200 aset pada pengguna Premium melempar limit_assets_max (bukan quota_assets).
  await db.exec(`set session_replication_role = replica`);
  try {
    await sys(
      `insert into public.assets (user_id, type, name, currency, value_override)
       select $1::uuid, 'other', 'Aset Cap ' || g, 'IDR', 1000 from generate_series(1, 198) g`,
      [PA],
    );
  } finally {
    await db.exec(`set session_replication_role = origin`);
  }
  // Total saat ini 199 (a1 + 198): aset ke-200 masih lolos, ke-201 ditolak dengan limit_assets_max.
  await as(PA, `insert into public.assets (type, name, currency, value_override) values ('other', 'Aset ke-200', 'IDR', 1000)`);
  await rejects(
    as(PA, `insert into public.assets (type, name, currency, value_override) values ('other', 'Aset ke-201', 'IDR', 1000)`),
    /limit_assets_max/,
  );
  await sys(`update public.asset_prices set price = 5200 where symbol = 'IDX:BBCA'`);
});

await test('emoney & card_style: jenis emoney, saldo, kredit dibersihkan, finish material, dan kepemilikan foto kartu', async () => {
  const EM = '00000000-0000-4000-8000-0000000000e9';
  await sys(`insert into auth.users (id, email) values ('${EM}', 'em@example.com')`);
  // Akun e-money (Flazz & Mandiri) dengan credit_limit/annual_fee -> dibersihkan menjadi null oleh accounts_check_credit.
  const [flazz] = await as(
    EM,
    `insert into public.accounts (bank, name, type, currency, opening_balance, credit_limit, annual_fee)
     values ('flazz', 'Flazz', 'emoney', 'IDR', 250000, 1000000, 100000)
     returning id, balance, credit_limit, annual_fee`,
  );
  eq([Number(flazz.balance), flazz.credit_limit, flazz.annual_fee], [250000, null, null], 'flazz emoney awal & credit dibersihkan');

  const [mandiriEm] = await as(
    EM,
    `insert into public.accounts (bank, name, type, currency, opening_balance)
     values ('mandiri', 'Mandiri', 'emoney', 'IDR', 100000) returning id, balance`,
  );
  eq(Number(mandiriEm.balance), 100000, 'mandiri emoney');

  await as(EM, `insert into public.transactions (type, merchant, category_key, account_id, date, amount, currency) values ('expense', 'Tol Dalam Kota', 'transport', $1, '2026-11-28', 11000, 'IDR')`, [flazz.id]);
  eq(await balance(flazz.id), 239000, 'saldo flazz berkurang setelah transaksi tol');

  // card_style valid: motif baru, material finish, dan foto kartu milik sendiri.
  for (const style of ['kawung', 'obsidian:guilloche', 'titanium:rings', `photo:${EM}/card1.jpg`]) {
    await as(EM, `update public.accounts set card_style = $1 where id = $2`, [style, flazz.id]);
    eq((await as(EM, `select card_style from public.accounts where id = $1`, [flazz.id]))[0].card_style, style, `card_style ${style}`);
  }

  // Foto milik pengguna lain ditolak trigger kepemilikan.
  await rejects(as(EM, `update public.accounts set card_style = $1 where id = $2`, [`photo:${B}/card1.jpg`, flazz.id]), /card_photo_not_owned/);

  // Format tidak valid / path traversal ditolak (trigger kepemilikan atau check constraint).
  await rejects(as(EM, `update public.accounts set card_style = 'photo:../evil.jpg' where id = $1`, [flazz.id]), /card_photo_not_owned|accounts_card_style_check/);
  await rejects(as(EM, `update public.accounts set card_style = $1 where id = $2`, [`photo:${EM}/../evil.jpg`, flazz.id]), /accounts_card_style_check/);
  await rejects(as(EM, `update public.accounts set card_style = 'bad:style:here' where id = $1`, [flazz.id]), /accounts_card_style_check/);
});

console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} lolos`);
process.exit(failed ? 1 : 0);
