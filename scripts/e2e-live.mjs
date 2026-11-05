// Fixture e2e LIVE: pengguna uji di proyek Supabase sungguhan, tanpa email.
// Butuh env SUPABASE_SECRET_KEY (kunci admin; JANGAN di-commit). Dipakai oleh scripts/e2e-web.mjs.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cfg = fs.readFileSync(path.join(root, 'src/config/public.ts'), 'utf8');
export const SUPABASE_URL = /'(https:\/\/[^']+supabase\.co)'/.exec(cfg)[1];
const PUBLISHABLE = /'(sb_publishable_[^']+)'/.exec(cfg)[1];
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!SECRET) throw new Error('Set SUPABASE_SECRET_KEY untuk e2e live');

const admin = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
export const E2E_EMAIL = 'e2e@arshif.test';

/** id fixture → uuid tetap, supaya langkah e2e bisa merujuk "t07" dsb. */
const uuid = (tag) => `00000000-0000-4000-8000-${tag.padStart(12, '0')}`;
export const ids = new Proxy({}, { get: (_, k) => uuid(Buffer.from(String(k)).toString('hex').slice(0, 12)) });

const ACCOUNTS = [
  ['a-bca', 'bca', 'BCA Tabungan', 'tabungan', 'IDR', 18_500_000, '2153'],
  ['a-jago', 'jago', 'Jago Kantong Utama', 'tabungan', 'IDR', 9_200_000, '8810'],
  ['a-gopay', 'gopay', 'GoPay', 'ewallet', 'IDR', 1_200_000, null],
  ['a-mbb', 'maybank', 'Maybank Savings', 'tabungan', 'MYR', 180_000, '4402'],
];

// [id, tanggal, jam, merchant, kategori, akun, nominal, tipe, sumber, mata uang, nominal di akun]
const TXS = [
  ['t01', '2026-11-05', '08:14', 'Indomaret Kemang Raya', 'groceries', 'a-bca', 87_500, 'expense', 'scan'],
  ['t02', '2026-11-05', '07:52', 'Kopi Kenangan', 'hangout', 'a-gopay', 28_000, 'expense', 'voice'],
  ['t03', '2026-11-04', '18:31', 'GoRide ke Sudirman', 'transport', 'a-gopay', 23_000],
  ['t04', '2026-11-04', '12:40', 'Warteg Bahari', 'food', 'a-gopay', 32_000, 'expense', 'voice'],
  ['t05', '2026-11-03', '19:05', 'Tesco Extra Ampang', 'groceries', 'a-mbb', 14_260, 'expense', 'scan', 'MYR'],
  ['t06', '2026-11-03', '08:42', 'Grab ke KLCC', 'transport', 'a-mbb', 1_840, 'expense', 'manual', 'MYR'],
  ['t07', '2026-11-02', '12:40', 'Migros Kadıköy', 'groceries', 'a-mbb', 64_750, 'expense', 'scan', 'TRY', 5_260],
  ['t08', '2026-11-02', '20:10', 'Spotify Premium', 'entertainment', 'a-jago', 54_990],
  ['t09', '2026-11-01', '10:05', 'Sewa kos November', 'housing', 'a-bca', 1_750_000],
  ['t10', '2026-11-01', '09:20', 'Token listrik PLN', 'utilities', 'a-bca', 200_000],
  ['t11', '2026-10-31', '19:30', 'Ayam Geprek Bensu', 'food', 'a-gopay', 45_000, 'expense', 'voice'],
  ['t12', '2026-10-30', '14:00', 'Paket data Telkomsel', 'phone', 'a-gopay', 100_000],
  ['t13', '2026-10-29', '16:15', 'Klinik Pratama Kemang', 'health', 'a-bca', 250_000],
  ['t14', '2026-10-29', '16:50', 'Apotek K-24', 'health', 'a-bca', 87_500, 'expense', 'scan'],
  ['t15', '2026-10-28', '21:00', 'Kaos polos, Tokopedia', 'shopping', 'a-jago', 189_000],
  ['t16', '2026-10-28', '15:30', 'Kopi Tuku', 'hangout', 'a-gopay', 32_000],
  ['t17', '2026-10-27', '09:00', 'Transfer ke Jago', 'savings', 'a-bca', 2_000_000, 'transfer'],
  ['t18', '2026-10-27', '18:45', 'Alfamart Cipete', 'groceries', 'a-bca', 64_200],
  ['t19', '2026-10-26', '19:00', 'Bioskop XXI Kuningan', 'entertainment', 'a-gopay', 100_000],
  ['t20', '2026-10-26', '13:10', 'Nasi Padang Sederhana', 'food', 'a-gopay', 38_000],
  ['t21', '2026-10-25', '09:00', 'Gaji Oktober, PT Sinar Niaga', 'salary', 'a-bca', 14_250_000, 'income'],
  ['t22', '2026-10-25', '09:30', 'Setoran dana darurat', 'savings', 'a-bca', 1_500_000],
  ['t23', '2026-10-24', '12:20', 'Soto Betawi Haji Husein', 'food', 'a-gopay', 41_000],
  ['t24', '2026-10-23', '08:30', 'GoRide ke Kuningan', 'transport', 'a-gopay', 19_000],
  ['t25', '2026-10-22', '20:15', 'Hypermart Cilandak', 'groceries', 'a-bca', 312_400],
  ['t26', '2026-10-21', '19:40', 'Nongkrong, Fore Coffee', 'hangout', 'a-gopay', 58_000],
  ['t27', '2026-10-20', '13:00', 'Bakmi GM', 'food', 'a-gopay', 67_000],
  ['t28', '2026-10-26', '17:25', 'Cicilan laptop', 'debt', 'a-bca', 750_000],
];

const ITEMS = [['Indomie Goreng', 5, 3_500, 17_500], ['Telur Ayam 1 kg', 1, 29_000, 29_000], ['Susu UHT 1 L', 2, 19_500, 39_000], ['Kantong belanja', 1, 2_000, 2_000]];

const NOTIFS = [
  ['weekly_recap', 'domain.notif.recapTitle', 'domain.notif.recapMessage', {}, '/coach', false],
  ['budget_alert', 'domain.notif.budgetTitle', 'domain.notif.budgetMessage', { pct: 82, amount: 'Rp 35.010', days: 20 }, null, false],
  ['bill_due', 'domain.notif.billTitle', 'domain.notif.billMessage', { biller: 'TNB', amount: 'RM 142.30' }, null, true],
];

const must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

async function findUser() {
  const { users } = must(await admin.auth.admin.listUsers({ perPage: 200 }));
  return users.find((u) => u.email === E2E_EMAIL) ?? null;
}

/** Pengguna uji dengan data contoh, dibuat ulang dari nol (hapus = cascade). */
export async function resetUser({ seed = true, onboarded = true } = {}) {
  const old = await findUser();
  if (old) must(await admin.auth.admin.deleteUser(old.id));
  const { user } = must(await admin.auth.admin.createUser({ email: E2E_EMAIL, email_confirm: true }));
  if (!onboarded) return user.id;
  must(await admin.from('profiles').update({ display_name: 'Rani Pratiwi', main_currency: 'IDR', payday: 25, monthly_income: 14_250_000, onboarded_at: new Date().toISOString() }).eq('id', user.id));
  if (!seed) return user.id;
  // created_at berurutan: urutan kartu di Beranda = urutan pembuatan akun.
  const t0 = Date.now();
  must(await admin.from('accounts').insert(ACCOUNTS.map(([id, bank, name, type, currency, opening, last4], i) => ({ id: ids[id], user_id: user.id, bank, name, type, currency, opening_balance: opening, last4, created_at: new Date(t0 + i * 1000).toISOString() }))));
  must(
    await admin.from('transactions').insert(
      TXS.map(([id, date, time, merchant, category_key, acc, amount, type = 'expense', source = 'manual', currency = 'IDR', accountAmount = null]) => ({
        id: ids[id], user_id: user.id, date, time, merchant, category_key, account_id: ids[acc], amount, type, source, currency,
        account_amount: accountAmount, to_account_id: type === 'transfer' ? ids['a-jago'] : null,
      })),
    ),
  );
  must(await admin.from('transaction_items').insert(ITEMS.map(([name, qty, unit_price, total], position) => ({ transaction_id: ids.t01, user_id: user.id, position, name, qty, unit_price, total }))));
  must(await admin.from('notifications').insert(NOTIFS.map(([type, title_key, message_key, vars, href, read]) => ({ user_id: user.id, type, title_key, message_key, vars, href, read_at: read ? new Date().toISOString() : null }))));
  return user.id;
}

/** Sesi login sungguhan tanpa email: admin membuat kode OTP, lalu diverifikasi seperti di aplikasi. */
export async function sessionFor(email = E2E_EMAIL) {
  const link = must(await admin.auth.admin.generateLink({ type: 'magiclink', email }));
  const anon = createClient(SUPABASE_URL, PUBLISHABLE, { auth: { persistSession: false } });
  const { session } = must(await anon.auth.verifyOtp({ email, token: link.properties.email_otp, type: 'email' }));
  return session;
}

/** Kunci AsyncStorage (= localStorage di web) yang dipakai supabase-js untuk menyimpan sesi. */
export const storageKey = () => `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
