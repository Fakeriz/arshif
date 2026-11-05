import { DEMO_INCOME, DEMO_MAIN_CURRENCY, DEMO_PAYDAY, seedAccounts, seedNotifications, seedTransactions, seedUsage } from '@/data/seed';
import type { Account, AppNotification, NotificationType, Plan, Transaction } from '@/data/types';
import { DEFAULT_SPLIT, splitIsValid, type Split } from '@/lib/budget';
import type { QuotaKey, Usage } from '@/lib/quota';

export type NotifPrefs = Record<Exclude<NotificationType, 'system'>, boolean>;

export type AppState = {
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
};

export type Action =
  | { type: 'tx/add'; tx: Transaction; consumes?: QuotaKey }
  | { type: 'tx/addMany'; txs: Transaction[]; consumes?: QuotaKey }
  | { type: 'tx/update'; tx: Transaction }
  | { type: 'tx/delete'; id: string }
  | { type: 'notif/read'; id: string }
  | { type: 'notif/readAll' }
  | { type: 'prefs/hideBalance'; value: boolean }
  | { type: 'prefs/mainCurrency'; code: string }
  | { type: 'prefs/notif'; key: keyof NotifPrefs; value: boolean }
  | { type: 'budget/split'; split: Split };

export function initialState(): AppState {
  return {
    accounts: seedAccounts,
    transactions: seedTransactions,
    notifications: seedNotifications,
    plan: 'free',
    usage: seedUsage,
    hideBalance: false,
    mainCurrency: DEMO_MAIN_CURRENCY,
    income: DEMO_INCOME,
    split: DEFAULT_SPLIT,
    payday: DEMO_PAYDAY,
    notifPrefs: { bill_due: true, budget_alert: true, weekly_recap: true, quota_warning: true },
  };
}

const bump = (usage: Usage, key?: QuotaKey, by = 1): Usage => (key ? { ...usage, [key]: usage[key] + by } : usage);

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
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
    case 'budget/split':
      return splitIsValid(action.split) ? { ...state, split: action.split } : state;
  }
}
