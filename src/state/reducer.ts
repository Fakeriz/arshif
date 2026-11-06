import type { Account, AppNotification, BudgetRecord, LimitGroup, NotificationType, Plan, Transaction } from '@/data/types';
import { DEFAULT_SPLIT, PAYDAY_MAX, PAYDAY_MIN, splitIsValid, type Split } from '@/lib/budget';
import type { UserRate } from '@/lib/fx';
import { EMPTY_USAGE, type QuotaKey, type Usage } from '@/lib/quota';

export type NotifPrefs = Record<Exclude<NotificationType, 'system' | 'monthly_recap' | 'goal_reached' | 'subscription_renewal'>, boolean>;

/** idle = belum login, loading = memuat dari Supabase, ready = data siap, error = gagal memuat. */
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export type AppState = {
  status: LoadStatus;
  email: string;
  displayName: string | null;
  onboarded: boolean;
  accounts: Account[];
  transactions: Transaction[];
  notifications: AppNotification[];
  plan: Plan;
  /** Akhir masa Premium menurut RevenueCat (null = Free, atau Premium tanpa tanggal akhir). */
  premiumUntil: string | null;
  /** Asal Premium: store (App Store/Google Play), web (Xendit/Paddle), manual (admin). */
  premiumSource: 'store' | 'web' | 'manual' | null;
  usage: Usage;
  hideBalance: boolean;
  mainCurrency: string;
  income: number;
  split: Split;
  payday: number;
  notifPrefs: NotifPrefs;
  /** Kartu aktif di Beranda = akun default untuk Catat, Scan, Voice, Import. null = akun pertama. */
  activeAccountId: string | null;
  /** Tanggal kurs yang dipakai untuk agregat ("Kurs per …"). */
  ratesDate: string | null;
  /** Anggaran per periode (FR-BDG-5), terbaru dulu. */
  budgets: BudgetRecord[];
  /** Grup limit gabungan kartu (FR-ACC-6). */
  limitGroups: LimitGroup[];
  /** "Kurs saya" (FR-FX-4). */
  userRates: UserRate[];
  /** Naik setiap riwayat kurs harian bertambah: agregat dihitung ulang. */
  ratesVersion: number;
};

/** Data hasil muat penuh dari server. */
export type Loaded = Omit<AppState, 'status' | 'ratesVersion'>;

export type Action =
  | { type: 'load/start' }
  | { type: 'load/done'; data: Loaded }
  | { type: 'load/error' }
  | { type: 'reset' }
  | { type: 'usage/set'; usage: Usage }
  | { type: 'plan/set'; plan: Plan; premiumUntil: string | null; premiumSource?: AppState['premiumSource'] }
  | { type: 'profile/set'; patch: Partial<Pick<AppState, 'displayName' | 'onboarded' | 'income' | 'payday' | 'mainCurrency'>> }
  | { type: 'account/add'; account: Account }
  | { type: 'notif/add'; notification: AppNotification }
  | { type: 'tx/add'; tx: Transaction; consumes?: QuotaKey }
  | { type: 'tx/addMany'; txs: Transaction[]; consumes?: QuotaKey }
  | { type: 'tx/update'; tx: Transaction }
  | { type: 'tx/delete'; id: string }
  | { type: 'notif/read'; id: string }
  | { type: 'notif/readAll' }
  | { type: 'prefs/hideBalance'; value: boolean }
  | { type: 'prefs/mainCurrency'; code: string }
  | { type: 'prefs/notif'; key: keyof NotifPrefs; value: boolean }
  | { type: 'budget/split'; split: Split }
  | { type: 'account/setBank'; id: string; bank: string }
  | { type: 'account/setActive'; id: string }
  | { type: 'account/credit'; id: string; patch: Pick<Account, 'creditLimit' | 'limitGroupId' | 'annualFee'> }
  | { type: 'prefs/payday'; payday: number }
  | { type: 'budget/save'; budget: BudgetRecord }
  | { type: 'limitGroup/add'; group: LimitGroup; members: string[] }
  | { type: 'limitGroup/update'; group: LimitGroup; members: string[] }
  | { type: 'limitGroup/delete'; id: string }
  | { type: 'userRate/save'; rate: UserRate }
  | { type: 'userRate/delete'; code: string }
  | { type: 'fx/history' }
  /** Tandai/lepas reimbursement atau tautkan pemasukan pengganti (FR-TRX-4). */
  | { type: 'tx/reimburse'; id: string; status: 'pending' | null; reimbursedBy: string | null };


/** State sebelum login / sebelum data datang. Tidak ada data contoh di aplikasi (Fase 2). */
export function initialState(): AppState {
  return {
    status: 'idle',
    email: '',
    displayName: null,
    onboarded: false,
    accounts: [],
    transactions: [],
    notifications: [],
    plan: 'free',
    premiumUntil: null,
    premiumSource: null,
    usage: EMPTY_USAGE,
    hideBalance: false,
    mainCurrency: 'IDR',
    income: 0,
    split: DEFAULT_SPLIT,
    payday: 1,
    notifPrefs: { bill_due: true, budget_alert: true, weekly_recap: true, quota_warning: true },
    activeAccountId: null,
    ratesDate: null,
    budgets: [],
    limitGroups: [],
    userRates: [],
    ratesVersion: 0,
  };
}

/**
 * Form ubah transaksi tidak membawa status reimbursement: status lama dipertahankan. Melepas status hanya
 * lewat aksi `tx/reimburse`.
 */
export function keepReimbursement(next: Transaction, prev: Transaction | undefined): Transaction {
  if (!prev || next.reimburseStatus !== undefined || next.reimbursedBy !== undefined) return next;
  return next.type === 'expense' ? { ...next, reimburseStatus: prev.reimburseStatus, reimbursedBy: prev.reimbursedBy } : next;
}

/** Anggota grup: kartu di `members` masuk grup, kartu lain yang sebelumnya di grup ini dilepas. */
function setMembers(accounts: Account[], groupId: string, members: string[]): Account[] {
  const set = new Set(members);
  return accounts.map((a) => {
    if (set.has(a.id)) return a.limitGroupId === groupId ? a : { ...a, limitGroupId: groupId };
    return a.limitGroupId === groupId ? { ...a, limitGroupId: undefined } : a;
  });
}

const bump = (usage: Usage, key?: QuotaKey, by = 1): Usage => (key ? { ...usage, [key]: usage[key] + by } : usage);

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'load/start':
      return { ...state, status: state.status === 'ready' ? 'ready' : 'loading' };
    case 'load/done':
      return { ...action.data, status: 'ready', ratesVersion: state.ratesVersion + 1 };
    case 'load/error':
      return { ...state, status: state.status === 'ready' ? 'ready' : 'error' };
    case 'reset':
      return initialState();
    case 'usage/set':
      return { ...state, usage: action.usage };
    case 'plan/set':
      return { ...state, plan: action.plan, premiumUntil: action.premiumUntil, premiumSource: action.premiumSource ?? state.premiumSource };
    case 'profile/set':
      return { ...state, ...action.patch };
    case 'account/add':
      return { ...state, accounts: [...state.accounts, action.account], usage: { ...state.usage, accounts: state.accounts.length + 1 } };
    case 'notif/add':
      return state.notifications.some((n) => n.id === action.notification.id) ? state : { ...state, notifications: [action.notification, ...state.notifications] };
    case 'tx/add':
      return { ...state, transactions: [action.tx, ...state.transactions], usage: bump(state.usage, action.consumes) };
    case 'tx/addMany':
      return { ...state, transactions: [...action.txs, ...state.transactions], usage: bump(state.usage, action.consumes) };
    case 'tx/update':
      return { ...state, transactions: state.transactions.map((t) => (t.id === action.tx.id ? keepReimbursement(action.tx, t) : t)) };
    case 'tx/reimburse':
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.id && t.type === 'expense'
            ? { ...t, reimburseStatus: action.reimbursedBy ? 'reimbursed' : (action.status ?? undefined), reimbursedBy: action.reimbursedBy ?? undefined }
            : t,
        ),
      };
    case 'tx/delete':
      // Pemasukan pengganti dihapus = pengeluarannya kembali pending (server: FK on delete set null + trigger).
      return {
        ...state,
        transactions: state.transactions
          .filter((t) => t.id !== action.id)
          .map((t) => (t.reimbursedBy === action.id ? { ...t, reimbursedBy: undefined, reimburseStatus: 'pending' as const } : t)),
      };
    case 'notif/read':
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) };
    case 'notif/readAll':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
    case 'prefs/hideBalance':
      return { ...state, hideBalance: action.value };
    case 'prefs/mainCurrency':
      return { ...state, mainCurrency: action.code };
    case 'prefs/notif':
      return { ...state, notifPrefs: { ...state.notifPrefs, [action.key]: action.value } };
    case 'account/setBank':
      return { ...state, accounts: state.accounts.map((a) => (a.id === action.id ? { ...a, bank: action.bank } : a)) };
    case 'account/setActive':
      return state.accounts.some((a) => a.id === action.id) ? { ...state, activeAccountId: action.id } : state;
    case 'budget/split':
      return splitIsValid(action.split) ? { ...state, split: action.split } : state;
    case 'account/credit':
      return { ...state, accounts: state.accounts.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)) };
    case 'prefs/payday':
      return Number.isInteger(action.payday) && action.payday >= PAYDAY_MIN && action.payday <= PAYDAY_MAX ? { ...state, payday: action.payday } : state;
    case 'budget/save': {
      const rest = state.budgets.filter((b) => b.periodStart !== action.budget.periodStart);
      return { ...state, budgets: [action.budget, ...rest].sort((a, b) => b.periodStart.localeCompare(a.periodStart)) };
    }
    case 'limitGroup/add':
      return { ...state, limitGroups: [...state.limitGroups, action.group], accounts: setMembers(state.accounts, action.group.id, action.members) };
    case 'limitGroup/update':
      return {
        ...state,
        limitGroups: state.limitGroups.map((g) => (g.id === action.group.id ? action.group : g)),
        accounts: setMembers(state.accounts, action.group.id, action.members),
      };
    case 'limitGroup/delete':
      return { ...state, limitGroups: state.limitGroups.filter((g) => g.id !== action.id), accounts: setMembers(state.accounts, action.id, []) };
    case 'userRate/save':
      return { ...state, userRates: [...state.userRates.filter((r) => r.code !== action.rate.code), action.rate].sort((a, b) => a.code.localeCompare(b.code)) };
    case 'userRate/delete':
      return { ...state, userRates: state.userRates.filter((r) => r.code !== action.code) };
    case 'fx/history':
      return { ...state, ratesVersion: state.ratesVersion + 1 };
  }
}
