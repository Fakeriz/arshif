import type { Account, AppNotification, NotificationType, Plan, Transaction } from '@/data/types';
import { DEFAULT_SPLIT, splitIsValid, type Split } from '@/lib/budget';
import type { QuotaKey, Usage } from '@/lib/quota';

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
};

/** Data hasil muat penuh dari server. */
export type Loaded = Omit<AppState, 'status'>;

export type Action =
  | { type: 'load/start' }
  | { type: 'load/done'; data: Loaded }
  | { type: 'load/error' }
  | { type: 'reset' }
  | { type: 'usage/set'; usage: Usage }
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
  | { type: 'account/setActive'; id: string };

export const EMPTY_USAGE: Usage = { accounts: 0, scan: 0, automation: 0, importPdf: 0, invoice: 0 };

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
    usage: EMPTY_USAGE,
    hideBalance: false,
    mainCurrency: 'IDR',
    income: 0,
    split: DEFAULT_SPLIT,
    payday: 1,
    notifPrefs: { bill_due: true, budget_alert: true, weekly_recap: true, quota_warning: true },
    activeAccountId: null,
    ratesDate: null,
  };
}

const bump = (usage: Usage, key?: QuotaKey, by = 1): Usage => (key ? { ...usage, [key]: usage[key] + by } : usage);

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'load/start':
      return { ...state, status: state.status === 'ready' ? 'ready' : 'loading' };
    case 'load/done':
      return { ...action.data, status: 'ready' };
    case 'load/error':
      return { ...state, status: state.status === 'ready' ? 'ready' : 'error' };
    case 'reset':
      return initialState();
    case 'usage/set':
      return { ...state, usage: action.usage };
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
      return { ...state, transactions: state.transactions.map((t) => (t.id === action.tx.id ? action.tx : t)) };
    case 'tx/delete':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) };
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
  }
}
