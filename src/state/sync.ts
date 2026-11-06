import * as api from '@/data/remote/api';
import type { Transaction } from '@/data/types';
import { convert, withUserRates } from '@/lib/fx';

import { keepReimbursement, type Action, type AppState } from './reducer';

/**
 * Nominal di mata uang akun memakai kurs PADA TANGGAL transaksi (FR-FX-4: belanja memakai kurs harinya).
 * Form menghitung pratinjau dengan kurs terbaru; sebelum disimpan dihitung ulang di sini.
 */
async function withRatesOfDay(tx: Transaction, state: AppState): Promise<Transaction> {
  const acc = state.accounts.find((a) => a.id === tx.accountId);
  const to = tx.toAccountId ? state.accounts.find((a) => a.id === tx.toAccountId) : undefined;
  const needFrom = acc && acc.currency !== tx.currency;
  const needTo = to && to.currency !== tx.currency;
  if (!needFrom && !needTo) return { ...tx, accountAmount: undefined, toAmount: tx.type === 'transfer' ? undefined : tx.toAmount };
  // Kurs harian server pada tanggal itu, dilengkapi "Kurs saya" untuk kode tanpa kurs harian.
  const { table: daily } = await api.ratesOn(tx.date);
  const table = withUserRates(daily, tx.date);
  const rated = (code: string) => code in table;
  return {
    ...tx,
    accountAmount: needFrom && rated(acc.currency) && rated(tx.currency) ? convert(tx.amount, tx.currency, acc.currency, table) : tx.accountAmount,
    toAmount: needTo && rated(to.currency) && rated(tx.currency) ? convert(tx.amount, tx.currency, to.currency, table) : tx.toAmount,
  };
}

/**
 * Efek ke Supabase untuk tiap aksi. Mengembalikan transaksi yang nominalnya berubah setelah dihitung
 * ulang dengan kurs harian, supaya store lokal ikut diperbarui.
 */
export async function syncAction(action: Action, state: AppState, userId: string): Promise<Transaction[]> {
  switch (action.type) {
    case 'tx/add':
    case 'tx/addMany': {
      const txs = action.type === 'tx/add' ? [action.tx] : action.txs;
      const rated = await Promise.all(txs.map((t) => withRatesOfDay(t, state)));
      await api.insertTransactions(rated);
      return rated;
    }
    case 'tx/update': {
      const rated = await withRatesOfDay(keepReimbursement(action.tx, state.transactions.find((t) => t.id === action.tx.id)), state);
      await api.updateTransaction(rated);
      return [rated];
    }
    case 'tx/delete':
      await api.deleteTransaction(action.id);
      return [];
    case 'notif/read':
      await api.markNotificationsRead([action.id]);
      return [];
    case 'notif/readAll':
      await api.markNotificationsRead(state.notifications.filter((n) => !n.read).map((n) => n.id));
      return [];
    case 'prefs/hideBalance':
      await api.updateProfile(userId, { hide_balance: action.value });
      return [];
    case 'prefs/mainCurrency':
      await api.updateProfile(userId, { main_currency: action.code });
      return [];
    case 'prefs/notif':
      await api.updateProfile(userId, { notif_prefs: { ...state.notifPrefs, [action.key]: action.value } });
      return [];
    case 'budget/split':
      await api.updateProfile(userId, { split_needs: action.split.needs, split_wants: action.split.wants, split_savings: action.split.savings });
      return [];
    case 'account/setBank':
      await api.updateAccountBank(action.id, action.bank);
      return [];
    case 'account/setActive':
      await api.updateProfile(userId, { active_account_id: action.id });
      return [];
    case 'account/credit':
      await api.updateAccountCredit(action.id, action.patch);
      return [];
    case 'prefs/payday':
      await api.updateProfile(userId, { payday: action.payday });
      return [];
    case 'budget/save':
      await api.saveBudget(action.budget);
      return [];
    case 'limitGroup/add':
    case 'limitGroup/update': {
      await (action.type === 'limitGroup/add' ? api.insertLimitGroup(action.group) : api.updateLimitGroup(action.group));
      // Kartu yang berubah keanggotaannya saja yang ditulis.
      const members = new Set(action.members);
      const changed = state.accounts.filter((a) => members.has(a.id) !== (a.limitGroupId === action.group.id));
      await Promise.all(changed.map((a) => api.updateAccountCredit(a.id, { ...a, limitGroupId: members.has(a.id) ? action.group.id : undefined })));
      return [];
    }
    case 'limitGroup/delete':
      // Kartu anggota dilepas oleh FK on delete set null.
      await api.deleteLimitGroup(action.id);
      return [];
    case 'tx/reimburse':
      await api.setReimbursement(action.id, action.reimbursedBy ? 'reimbursed' : action.status, action.reimbursedBy);
      return [];
    case 'userRate/save':
      await api.saveUserRate(action.rate);
      return [];
    case 'userRate/delete':
      await api.deleteUserRate(action.code);
      return [];
    default:
      return []; // aksi lokal saja (load/*, usage/set, plan/set, notif/add, account/add, profile/set)
  }
}
