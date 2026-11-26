import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';

import { useToast } from '@/components/ui';
import * as api from '@/data/remote/api';
import { toNotification, type NotificationRow } from '@/data/remote/mappers';
import type { Account, Transaction } from '@/data/types';
import { useI18n } from '@/i18n';
import { loadLatestRates } from '@/data/fxLatest';
import { addRateHistory, historyCodes, setRateHistory, setUsdRates, setUserRates } from '@/lib/fx';
import { addDays } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { EMPTY_CATEGORY_SETTINGS, setUserCategories } from '@/constants/categories';

import { changedSlices, initialState, keepReimbursement, mergePending, reducer, undoActions, type Action, type AppState } from './reducer';
import { useSession } from './session';
import { syncAction } from './sync';

type StoreValue = {
  state: AppState;
  /** Ubah state lokal lalu simpan ke Supabase. Gagal simpan → toast + muat ulang dari server. */
  dispatch: (action: Action) => void;
  reload: () => Promise<void>;
  /** Ambil ulang pemakaian kuota dari server (setelah pekerjaan AI). */
  refreshUsage: () => void;
  /**
   * Tambah transaksi dan TUNGGU sampai tersimpan (Planning: transaksi harus ada sebelum tagihan/utang/goal
   * merujuknya). Gagal = transaksi lokal dibatalkan dan error dilempar ke pemanggil.
   */
  commitTx: (tx: Transaction) => Promise<Transaction>;
  /** Ubah state lokal saja: datanya sudah ditulis server (mis. transaksi auto-apply Smart Log). */
  applyLocal: (action: Action) => void;
  /** Sedang memuat ulang data yang sudah ada (tarik untuk muat ulang). */
  refreshing: boolean;
  userId: string | null;
};

const StoreContext = createContext<StoreValue | null>(null);

/**
 * Store aplikasi. Data dimuat dari Supabase setelah login; setiap aksi diterapkan dulu ke layar
 * (optimistik) lalu disimpan. `preset` = state tetap tanpa server (test dan Lembar Desain).
 */
export function AppStoreProvider({ children, preset }: { children: ReactNode; preset?: AppState }) {
  const [state, localDispatch] = useReducer(reducer, undefined, () => preset ?? initialState());
  // Registri getCategory/categoryLabel (dipanggil di banyak tempat tanpa state) diisi saat render, sebelum anak dirender.
  useMemo(() => setUserCategories(state.categories), [state.categories]);
  const { session } = useSession();
  const userId = preset ? null : (session?.user.id ?? null);
  const email = session?.user.email ?? '';
  const { show } = useToast();
  const { t, lang, setLang } = useI18n();
  const { mode, setMode } = useTheme();
  const stateRef = useRef(state);
  const [refreshing, setRefreshing] = useState(false);
  stateRef.current = state;
  // Transaksi yang penyimpanannya masih berjalan (id -> versi lokal terbaru). Muat ulang mempertahankannya.
  const pending = useRef(new Map<string, Transaction>());
  // Transaksi yang penghapusannya masih berjalan: muat ulang tidak boleh memunculkannya lagi.
  const deleting = useRef(new Set<string>());
  // Muat ulang yang sedang berjalan: hasil yang usang (ada muat ulang lebih baru) dibuang, dan perubahan
  // yang selesai disimpan SELAMA muat ulang (tidak ada di potret server) tetap dipertahankan.
  const reloadSeq = useRef(0);
  const sessionSeq = useRef(0);
  const prevUserRef = useRef<string | null>(null);
  const reloading = useRef(false);
  const settledDuringReload = useRef(new Map<string, Transaction>());
  const deletedDuringReload = useRef(new Set<string>());
  const dirtyDuringReload = useRef(new Set<keyof AppState>());
  // Simpanan per transaksi diantrekan: tambah lalu hapus cepat tidak boleh tiba di server terbalik.
  const chains = useRef(new Map<string, Promise<unknown>>());
  // Kode mata uang yang riwayat kursnya sudah dicoba dimuat.
  const historyTried = useRef(new Set<string>());
  // "Kurs saya" dipasang ke modul kurs saat render, supaya agregat di render yang sama sudah memakainya.
  const appliedRates = useRef(state.userRates);
  if (appliedRates.current !== state.userRates) {
    appliedRates.current = state.userRates;
    setUserRates(state.userRates);
  }
  // Setter tema/bahasa berganti identitas saat nilainya berubah; lewat ref agar reload tidak ikut terpicu.
  const applyPrefs = useRef({ setLang, setMode });
  applyPrefs.current = { setLang, setMode };
  const currentPrefs = useRef({ lang, mode });
  currentPrefs.current = { lang, mode };
  // Nilai preferensi terakhir yang tersimpan di server, supaya perubahan dari server tidak ditulis balik.
  const synced = useRef<{ lang: string; mode: string } | null>(null);
  // true = nilai dari server baru dikirim ke Theme/I18n dan belum terlihat di render; jangan ditulis balik.
  const applying = useRef(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    const seq = ++reloadSeq.current;
    reloading.current = true;
    settledDuringReload.current.clear();
    deletedDuringReload.current.clear();
    dirtyDuringReload.current.clear();
    localDispatch({ type: 'load/start' });
    if (stateRef.current.status === 'ready') setRefreshing(true);
    try {
      const [profile, accounts, transactions, notifications, usage, rates, budgets, limitGroups, userRates] = await Promise.all([
        api.loadProfile(userId, email), api.loadAccounts(), api.loadTransactions(), api.loadNotifications(), api.loadUsage(),
        // Kurs hari ini dari klien (er-api -> jsDelivr -> pages.dev), server Frankfurter terakhir, lalu cache 7 hari.
        loadLatestRates({ server: api.loadLatestRates }),
        api.loadBudgets(), api.loadLimitGroups(), api.loadUserRates(),
      ]);
      if (seq !== reloadSeq.current) return;
      setUsdRates(rates.table, rates.date);
      setUserRates(userRates);
      api.touchLastSeen().catch(() => undefined);
      // Riwayat kurs harian untuk semua kode yang dipakai, sejak transaksi tertua (FR-FX-4).
      const codes = usedCodes(accounts, transactions, profile.mainCurrency, limitGroups.map((g) => g.currency));
      const oldest = transactions.reduce<string | null>((min, t) => (min === null || t.date < min ? t.date : min), null);
      const rateHistory = oldest ? await api.loadRateHistory(codes, addDays(oldest, -7)) : [];
      if (seq !== reloadSeq.current) return;
      setRateHistory(rateHistory);
      historyTried.current = new Set(codes);
      const cur = currentPrefs.current;
      if (!profile.onboarded) {
        // Pengguna baru: profil masih berisi default DB. Bahasa/tema perangkat yang dipakai dan disimpan.
        synced.current = { ...cur };
        applying.current = false;
        api.updateProfile(userId, { lang: cur.lang, theme_mode: cur.mode }).catch(() => undefined);
      } else {
        synced.current = { lang: profile.lang, mode: profile.themeMode };
        // Hanya "sedang menerapkan" bila nilai server memang berbeda dari yang tampil sekarang;
        // kalau sama, efek di bawah tidak akan berjalan untuk melepas penanda ini.
        applying.current = cur.lang !== profile.lang || cur.mode !== profile.themeMode;
        applyPrefs.current.setLang(profile.lang);
        applyPrefs.current.setMode(profile.themeMode);
      }
      const removed = new Set([...deleting.current, ...deletedDuringReload.current]);
      const kept = [...pending.current.values(), ...settledDuringReload.current.values()];
      const loaded = {
          email: profile.email, displayName: profile.displayName, avatarPath: profile.avatarPath, coverPath: profile.coverPath, onboarded: profile.onboarded, suspended: profile.suspended, accounts,
          transactions: mergePending(transactions, kept).filter((x) => !removed.has(x.id)),
          notifications,
          plan: profile.plan, premiumUntil: profile.premiumUntil, premiumSource: profile.premiumSource, usage, hideBalance: profile.hideBalance, includeAssets: profile.includeAssets, categories: profile.categories, mainCurrency: profile.mainCurrency, income: profile.income,
          split: profile.split, payday: profile.payday, notifPrefs: profile.notifPrefs, activeAccountId: profile.activeAccountId, ratesDate: rates.date, ratesStale: rates.stale,
          budgets, limitGroups, userRates,
      };
      // Bagian yang diubah pengguna selama muat ulang memakai nilai lokal, bukan potret server yang lebih tua.
      const current = stateRef.current as unknown as Record<string, unknown>;
      for (const k of dirtyDuringReload.current) if (k in loaded) (loaded as Record<string, unknown>)[k] = current[k];
      localDispatch({ type: 'load/done', data: loaded });
    } catch {
      if (seq === reloadSeq.current) localDispatch({ type: 'load/error' });
    } finally {
      if (seq === reloadSeq.current) {
        reloading.current = false;
        setRefreshing(false);
      }
    }
  }, [userId, email]);

  // Login → muat; logout / ganti akun → bersihkan seluruh state + ref + singleton agar tidak bocor lintas akun.
  useEffect(() => {
    if (preset) return;
    if (prevUserRef.current !== userId) {
      prevUserRef.current = userId;
      sessionSeq.current += 1;
      reloadSeq.current += 1;
      reloading.current = false;
      pending.current.clear();
      deleting.current.clear();
      settledDuringReload.current.clear();
      deletedDuringReload.current.clear();
      dirtyDuringReload.current.clear();
      chains.current.clear();
      historyTried.current.clear();
      synced.current = null;
      applying.current = false;
      setRefreshing(false);
      setUserRates([]);
      setRateHistory([]);
      setUserCategories(EMPTY_CATEGORY_SETTINGS);
      localDispatch({ type: 'reset' });
    }
    if (userId) void reload();
  }, [userId, reload, preset]);

  // Bahasa dan tema disimpan per pengguna (FR-SET-1). Hanya perubahan dari pengguna
  // yang ditulis: selama nilai server sedang diterapkan, nilai perangkat lama tidak boleh menimpa profil.
  useEffect(() => {
    const s = synced.current;
    if (!userId || !s) return;
    if (s.lang === lang && s.mode === mode) {
      applying.current = false;
      return;
    }
    if (applying.current) return;
    synced.current = { lang, mode };
    api.updateProfile(userId, { lang, theme_mode: mode }).catch(() => show({ tone: 'error', title: t('common.syncFailed'), message: t('common.syncFailedMessage') }));
  }, [userId, lang, mode, show, t]);

  // Mata uang baru (transaksi/akun dengan kode yang belum punya riwayat kurs): muat riwayatnya.
  useEffect(() => {
    if (!userId || state.status !== 'ready') return;
    const codes = usedCodes(state.accounts, state.transactions, state.mainCurrency, state.limitGroups.map((g) => g.currency));
    const fresh = codes.filter((c) => !historyTried.current.has(c) && !historyCodes().includes(c));
    if (fresh.length === 0) return;
    fresh.forEach((c) => historyTried.current.add(c));
    const oldest = state.transactions.reduce<string | null>((min, t) => (min === null || t.date < min ? t.date : min), null);
    api
      .loadRateHistory(fresh, addDays(oldest ?? state.ratesDate ?? '2026-01-01', -7))
      .then((rows) => {
        if (rows.length === 0) return;
        addRateHistory(rows);
        localDispatch({ type: 'fx/history' });
      })
      .catch(() => fresh.forEach((c) => historyTried.current.delete(c)));
  }, [userId, state.status, state.accounts, state.transactions, state.mainCurrency, state.limitGroups, state.ratesDate]);

  // Paket bisa berubah di server saat aplikasi di latar (grant manual, webhook pembayaran): baca ulang paket
  // dan kuota setiap aplikasi kembali aktif, supaya fitur Premium tidak tertahan state Free yang lama.
  useEffect(() => {
    if (!userId) return;
    const sub = RNAppState.addEventListener('change', (next) => {
      if (next !== 'active' || stateRef.current.status !== 'ready') return;
      api.touchLastSeen().catch(() => undefined);
      api
        .loadPlan(userId)
        .then((p) => {
          const cur = stateRef.current;
          if (cur.plan !== p.plan || cur.premiumUntil !== p.premiumUntil) localDispatch({ type: 'plan/set', plan: p.plan, premiumUntil: p.premiumUntil, premiumSource: p.premiumSource });
        })
        .catch(() => undefined);
      api.loadUsage().then((usage) => localDispatch({ type: 'usage/set', usage })).catch(() => undefined);
    });
    return () => sub.remove();
  }, [userId]);

  // Lonceng live (FR-NOTIF-1): notifikasi baru masuk lewat Realtime.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) =>
        localDispatch({ type: 'notif/add', notification: toNotification(payload.new as NotificationRow) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const track = (txs: Transaction[]) => txs.forEach((x) => pending.current.set(x.id, x));
  // Hanya dilepas bila belum ada versi lebih baru (edit setelah tambah) yang sedang disimpan.
  const settle = (txs: Transaction[]) =>
    txs.forEach((x) => {
      if (pending.current.get(x.id) !== x) return;
      pending.current.delete(x.id);
      if (reloading.current) settledDuringReload.current.set(x.id, x);
    });
  const settleDelete = (id: string) => {
    deleting.current.delete(id);
    if (reloading.current) deletedDuringReload.current.add(id);
  };
  const inOrder = <T,>(ids: string[], run: () => Promise<T>): Promise<T> => {
    const prev = Promise.all(ids.map((id) => chains.current.get(id)?.catch(() => undefined)));
    const p = prev.then(run);
    ids.forEach((id) => chains.current.set(id, p));
    void p.catch(() => undefined).then(() => ids.forEach((id) => chains.current.get(id) === p && chains.current.delete(id)));
    return p;
  };

  const dispatch = useCallback(
    (action: Action) => {
      const before = stateRef.current;
      localDispatch(action);
      if (!userId) return;
      const saving =
        action.type === 'tx/add' ? [action.tx]
          : action.type === 'tx/addMany' ? action.txs
            : action.type === 'tx/update' ? [keepReimbursement(action.tx, before.transactions.find((x) => x.id === action.tx.id))]
              : [];
      track(saving);
      const deleted = action.type === 'tx/delete' ? action.id : null;
      if (deleted) deleting.current.add(deleted);
      if (reloading.current && !saving.length && !deleted) changedSlices(before, action).forEach((k) => dirtyDuringReload.current.add(k));
      const ids = deleted ? [deleted] : saving.map((x) => x.id);
      const opSession = sessionSeq.current;
      inOrder(ids, () => syncAction(action, before, userId))
        .then((rated) => {
          if (opSession !== sessionSeq.current) return;
          settle(saving);
          if (deleted) settleDelete(deleted);
          rated.forEach((tx) => localDispatch({ type: 'tx/rates', tx }));
        })
        .catch(() => {
          if (opSession !== sessionSeq.current) return;
          settle(saving);
          if (deleted) settleDelete(deleted);
          // Batalkan dulu di layar (muat ulang juga gagal saat offline), lalu ambil versi server.
          undoActions(action, before).forEach(localDispatch);
          show({ tone: 'error', title: t('common.syncFailed'), message: t('common.syncFailedMessage') });
          void reload();
        });
    },
    [userId, show, t, reload],
  );

  const refreshUsage = useCallback(() => {
    if (!userId) return;
    const opSession = sessionSeq.current;
    api.loadUsage().then((usage) => opSession === sessionSeq.current && localDispatch({ type: 'usage/set', usage })).catch(() => undefined);
  }, [userId]);

  const commitTx = useCallback(
    async (tx: Transaction): Promise<Transaction> => {
      const before = stateRef.current;
      localDispatch({ type: 'tx/add', tx });
      if (!userId) return tx;
      const opSession = sessionSeq.current;
      track([tx]);
      try {
        const [rated] = await inOrder([tx.id], () => syncAction({ type: 'tx/add', tx }, before, userId));
        if (opSession === sessionSeq.current) {
          settle([tx]);
          localDispatch({ type: 'tx/rates', tx: rated });
        }
        return rated;
      } catch (e) {
        if (opSession === sessionSeq.current) {
          settle([tx]);
          localDispatch({ type: 'tx/delete', id: tx.id });
        }
        throw e;
      }
    },
    [userId],
  );

  const value = useMemo(
    () => ({ state, dispatch, reload, refreshUsage, commitTx, applyLocal: localDispatch, refreshing, userId }),
    [state, dispatch, reload, refreshUsage, commitTx, refreshing, userId],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore harus dipakai di dalam <AppStoreProvider>');
  return ctx;
}

export type AccountWithBalance = Account & { balance: number };

/** Semua kode mata uang yang dipakai pengguna (untuk riwayat kurs dan pemeriksaan kurs hilang). */
export function usedCodes(accounts: Account[], txs: Transaction[], main: string, extra: string[] = []): string[] {
  const set = new Set<string>([main, ...extra]);
  for (const a of accounts) set.add(a.currency);
  for (const t of txs) set.add(t.currency);
  return [...set].sort();
}

/** Akun default untuk pencatatan: kartu aktif di Beranda, atau akun pertama. */
export function useActiveAccountId(): string | null {
  const { state } = useStore();
  const active = state.accounts.find((a) => a.id === state.activeAccountId);
  return (active ?? state.accounts[0])?.id ?? null;
}
