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

await test('kuota bulanan per baris generik: invoice 5/bulan (Free)', async () => {
  await sys(`create table public.invoices (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid())`);
  await sys(`grant insert on public.invoices to authenticated`);
  await sys(`create trigger invoices_quota before insert on public.invoices for each row execute function public.enforce_counter_quota('invoice')`);
  for (let i = 0; i < 5; i++) await as(A, 'insert into public.invoices default values');
  await rejects(as(A, 'insert into public.invoices default values'), /quota_invoice/);
  await sys('drop table public.invoices');
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
  eq(new Date(end).getTime(), new Date(o2.granted_until).getTime() - len1, 'tahunan bergeser maju sebesar 1 bulan');
  const [{ end: end2 }] = await sys(`select public.refund_shift($1) as "end"`, [o1.id]);
  eq(new Date(end2).getTime(), new Date(end).getTime(), 'pengiriman ulang tidak menggeser dua kali');
  await sys(`delete from public.orders`);
  await sys(`insert into public.orders (user_id, provider, period, currency, amount, method) values ($1, 'xendit', 'monthly', 'IDR', 25000, 'qris'), ($2, 'paddle', 'yearly', 'USD', 1500, 'card')`, [A, B]);
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

await test('hapus pengguna: semua data ikut terhapus (cascade)', async () => {
  await sys(`delete from auth.users where id = $1`, [A]);
  for (const t of ['profiles', 'accounts', 'transactions', 'transaction_items', 'notifications', 'usage_counters', 'orders']) {
    const col = t === 'profiles' ? 'id' : 'user_id';
    eq((await sys(`select count(*)::int as n from public.${t} where ${col} = $1`, [A]))[0].n, 0, t);
  }
});

console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} lolos`);
process.exit(failed ? 1 : 0);
