// Uji LIVE terhadap proyek Supabase (Fase 2 checkpoint): login sungguhan, RLS, trigger saldo, kuota,
// kurs, dan Edge Functions. Butuh env SUPABASE_SECRET_KEY (tidak di-commit). Pakai: npm run test:live
import { createClient } from '@supabase/supabase-js';

import { receiptJpeg } from './e2e-fixtures.mjs';
import { E2E_EMAIL, ids, resetUser, sessionFor, SUPABASE_URL } from './e2e-live.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cfg = fs.readFileSync(path.join(root, 'src/config/public.ts'), 'utf8');
const PUBLISHABLE = /'(sb_publishable_[^']+)'/.exec(cfg)[1];
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const OTHER = 'e2e-other@arshif.test';

const results = [];
let failed = 0;
async function test(name, fn) {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push(`PASS ${name} (${Date.now() - t0} ms)${note ? ` · ${note}` : ''}`);
  } catch (e) {
    failed++;
    results.push(`FAIL ${name}: ${e.message}`);
  }
}
const must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Klien sebagai pengguna yang sudah login (token sungguhan dari verifyOtp). */
async function clientFor(email) {
  const session = await sessionFor(email);
  const c = createClient(SUPABASE_URL, PUBLISHABLE, { auth: { persistSession: false } });
  must(await c.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }));
  return { c, userId: session.user.id };
}

async function invoke(c, name, body) {
  const { data, error } = await c.functions.invoke(name, { body });
  if (!error) return { status: 200, data };
  const res = error.context;
  return { status: res?.status ?? 0, data: await res?.json?.().catch(() => null) };
}

const usageOf = async (c, key) => (must(await c.rpc('my_usage')).find((r) => r.key === key)?.used ?? -1);

await resetUser();
const old = (must(await admin.auth.admin.listUsers({ perPage: 200 }))).users.find((u) => u.email === OTHER);
if (old) must(await admin.auth.admin.deleteUser(old.id));
must(await admin.auth.admin.createUser({ email: OTHER, email_confirm: true }));

const A = await clientFor(E2E_EMAIL);
const B = await clientFor(OTHER);

await test('login sungguhan: kode OTP diverifikasi Supabase Auth, sesi berisi pengguna', async () => {
  assert(A.userId && B.userId && A.userId !== B.userId, 'sesi tidak valid');
  const { data } = await A.c.auth.getUser();
  assert(data.user?.email === E2E_EMAIL, 'getUser salah');
});

await test('profil + data contoh terbaca lewat RLS milik sendiri', async () => {
  const accounts = must(await A.c.from('accounts').select('id, balance'));
  const txs = must(await A.c.from('transactions').select('id'));
  assert(accounts.length === 4 && txs.length === 28, `akun ${accounts.length}, transaksi ${txs.length}`);
  return `4 akun, 28 transaksi`;
});

await test('RLS live: pengguna lain tidak melihat dan tidak bisa mengubah data', async () => {
  assert(must(await B.c.from('accounts').select('id')).length === 0, 'B melihat akun A');
  assert(must(await B.c.from('transactions').update({ merchant: 'x' }).eq('id', ids.t01).select('id')).length === 0, 'B mengubah transaksi A');
  const { error } = await B.c.from('transactions').insert({ type: 'expense', category_key: 'food', account_id: ids['a-bca'], date: '2026-11-05', amount: 1, currency: 'IDR' });
  assert(error && /account_not_owned/.test(error.message), `insert ke akun A tidak ditolak: ${error?.message}`);
});

await test('trigger saldo live: pengeluaran memotong saldo akun', async () => {
  const before = must(await A.c.from('accounts').select('balance').eq('id', ids['a-gopay']).single()).balance;
  must(await A.c.from('transactions').insert({ type: 'expense', merchant: 'Es teh', category_key: 'food', account_id: ids['a-gopay'], date: '2026-11-05', amount: 5000, currency: 'IDR' }));
  const after = must(await A.c.from('accounts').select('balance').eq('id', ids['a-gopay']).single()).balance;
  assert(Number(before) - Number(after) === 5000, `${before} → ${after}`);
  return `Rp ${before} → Rp ${after}`;
});

await test('paket dan saldo tidak bisa ditulis klien', async () => {
  const p = await A.c.from('profiles').update({ plan: 'premium' }).eq('id', A.userId);
  const s = await A.c.from('accounts').update({ balance: 1 }).eq('id', ids['a-bca']);
  assert(p.error && s.error, 'update plan/balance lolos');
});

await test('kurs live terbaca klien (ECB via Frankfurter)', async () => {
  const rows = must(await A.c.from('fx_rates').select('rate_date, code, per_usd').in('code', ['IDR', 'MYR', 'TRY']).order('rate_date', { ascending: false }).limit(3));
  assert(rows.length === 3, 'kurs kosong');
  return rows.map((r) => `${r.code} ${Number(r.per_usd)}`).join(', ') + ` per USD, ${rows[0].rate_date}`;
});

await test('Edge Function menolak tanpa login (401) dan input salah (400)', async () => {
  const anon = createClient(SUPABASE_URL, PUBLISHABLE, { auth: { persistSession: false } });
  const r1 = await invoke(anon, 'scan-receipt', { path: `${A.userId}/x.jpg`, lang: 'id' });
  const r2 = await invoke(A.c, 'scan-receipt', { path: '../etc/passwd', lang: 'id' });
  const r3 = await invoke(A.c, 'scan-receipt', { path: `${B.userId}/x.jpg`, lang: 'id' });
  assert(r1.status === 401 && r2.status === 400 && [400, 403].includes(r3.status), `${r1.status} ${r2.status} ${r3.status}`);
  return `anon ${r1.status}, path aneh ${r2.status}, folder orang lain ${r3.status}`;
});

let scanNote = '';
await test('scan struk live: unggah ke bucket privat → scan-receipt (Gemini)', async () => {
  const path_ = `${A.userId}/smoke-${Date.now()}.jpg`;
  must(await A.c.storage.from('receipts').upload(path_, await receiptJpeg(), { contentType: 'image/jpeg' }));
  const before = await usageOf(A.c, 'scan');
  const r = await invoke(A.c, 'scan-receipt', { path: path_, lang: 'id' });
  const after = await usageOf(A.c, 'scan');
  if (r.status === 200) {
    assert(r.data.total === 87500, `total ${r.data.total}`);
    assert(after === before + 1, `kuota ${before} → ${after}`);
    scanNote = `${r.data.merchant}, total ${r.data.total}, ${r.data.items.length} item, kategori ${r.data.categoryKey}`;
    return scanNote;
  }
  // Tanpa GEMINI_API_KEY: harus gagal bersih dan kuota TIDAK terpotong.
  assert(after === before, `kuota terpotong saat gagal: ${before} → ${after}`);
  throw new Error(`HTTP ${r.status} ${JSON.stringify(r.data)} (kuota tidak terpotong: ${before} → ${after})`);
});

await test('struk orang lain tidak bisa dibaca/diunduh', async () => {
  const list = must(await B.c.storage.from('receipts').list(A.userId));
  assert(list.length === 0, 'B melihat berkas A');
});

await test('Smart Log live: auto-apply, duplikat ke To Review, konfirmasi, undo, RLS', async () => {
  const ingest = async (key, fp, time, pkg = 'com.bca.mybca.omni.android') => must(await A.c.rpc('smartlog_ingest', {
    p_capture_key: `${key}-${Date.now()}`, p_package: pkg, p_bank: 'bca', p_posted_at: new Date().toISOString(), p_date: '2026-11-06',
    p_time: time, p_type: 'expense', p_amount: 45000, p_currency: 'IDR', p_merchant: 'KOPI SENJA', p_excerpt: 'Pembayaran QRIS Rp 45.000 di KOPI SENJA',
    p_fingerprint: `${fp}-${Date.now()}`, p_doubts: [],
  }));
  assert((await ingest('off', 'off', '10:00')).status === 'disabled', 'OFF harus disabled');
  must(await A.c.from('profiles').update({ smartlog_enabled: true }).eq('id', A.userId));
  // Sama dengan setLink di aplikasi: update dulu, insert bila belum ada.
  const linked = must(await A.c.from('smartlog_links').update({ account_id: ids['a-bca'] }).eq('package', 'com.bca.mybca.omni.android').select('package'));
  if (!linked.length) must(await A.c.from('smartlog_links').insert({ package: 'com.bca.mybca.omni.android', account_id: ids['a-bca'] }));
  const again = must(await A.c.from('smartlog_links').update({ account_id: ids['a-gopay'] }).eq('package', 'com.bca.mybca.omni.android').select('package'));
  assert(again.length === 1, 'ganti kartu tautan gagal');
  must(await A.c.from('smartlog_links').update({ account_id: ids['a-bca'] }).eq('package', 'com.bca.mybca.omni.android'));
  const used0 = await usageOf(A.c, 'automation');
  const applied = await ingest('a', 'a', '10:00');
  assert(applied.status === 'applied', JSON.stringify(applied));
  const tx = must(await A.c.from('transactions').select('source, amount').eq('id', applied.id).single());
  assert(tx.source === 'smartlog' && Number(tx.amount) === 45000, JSON.stringify(tx));
  const dup = await ingest('b', 'b', '10:05');
  assert(dup.status === 'review' && dup.reasons.includes('duplicate'), JSON.stringify(dup));
  must(await A.c.from('transactions').insert({ id: dup.id, type: 'expense', merchant: 'KOPI SENJA', category_key: 'food', account_id: ids['a-bca'], date: '2026-11-06', time: '10:05', amount: 45000, currency: 'IDR', source: 'smartlog' }));
  must(await A.c.rpc('smartlog_confirm', { p_item: dup.id }));
  must(await A.c.rpc('smartlog_undo', { p_item: applied.id }));
  const gone = must(await A.c.from('transactions').select('id').eq('id', applied.id));
  assert(gone.length === 0, 'undo tidak menghapus transaksi');
  assert((await usageOf(A.c, 'automation')) === used0 + 2, 'kuota automation tidak terpotong 2');
  assert(must(await B.c.from('smartlog_items').select('id')).length === 0, 'B melihat baris A');
  const forged = await A.c.from('smartlog_items').update({ status: 'confirmed' }).eq('id', applied.id);
  assert(forged.error, 'klien bisa menulis smartlog_items');
  return `kuota automation ${used0} → ${used0 + 2}`;
});

await test('hapus akun: delete-account menghapus pengguna + data (cascade)', async () => {
  const r = await invoke(B.c, 'delete-account', { confirm: 'DELETE' });
  assert(r.status === 200 && r.data.deleted === true, `HTTP ${r.status} ${JSON.stringify(r.data)}`);
  const users = must(await admin.auth.admin.listUsers({ perPage: 200 })).users;
  assert(!users.some((u) => u.email === OTHER), 'pengguna masih ada');
});

console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} lolos`);
process.exit(failed ? 1 : 0);
