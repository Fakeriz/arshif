import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';

import { useToast } from '@/components/ui';
import * as api from '@/data/remote/api';
import { toNotification, type NotificationRow } from '@/data/remote/mappers';
import type { Account } from '@/data/types';
import { useI18n } from '@/i18n';
import { setUsdRates } from '@/lib/fx';
import { supabase } from '@/lib/supabase';
import { accountBalance } from '@/lib/transactions';
import { useTheme } from '@/theme/ThemeProvider';

import { initialState, reducer, type Action, type AppState } from './reducer';
import { useSession } from './session';
import { syncAction } from './sync';

type StoreValue = {
  state: AppState;
  /** Ubah state lokal lalu simpan ke Supabase. Gagal simpan → toast + muat ulang dari server. */
  dispatch: (action: Action) => void;
  reload: () => Promise<void>;
  /** Ambil ulang pemakaian kuota dari server (setelah pekerjaan AI). */
  refreshUsage: () => void;
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
  const { session } = useSession();
  const userId = preset ? null : (session?.user.id ?? null);
  const email = session?.user.email ?? '';
  const { show } = useToast();
  const { t, lang, setLang } = useI18n();
  const { accent, setAccent, mode, setMode } = useTheme();
  const stateRef = useRef(state);
  const [refreshing, setRefreshing] = useState(false);
  stateRef.current = state;
  // Setter tema/bahasa berganti identitas saat nilainya berubah; lewat ref agar reload tidak ikut terpicu.
  const applyPrefs = useRef({ setLang, setAccent, setMode });
  applyPrefs.current = { setLang, setAccent, setMode };
  const currentPrefs = useRef({ lang, accent, mode });
  currentPrefs.current = { lang, accent, mode };
  // Nilai preferensi terakhir yang tersimpan di server, supaya perubahan dari server tidak ditulis balik.
  const synced = useRef<{ lang: string; accent: string; mode: string } | null>(null);
  // true = nilai dari server baru dikirim ke Theme/I18n dan belum terlihat di render; jangan ditulis balik.
  const applying = useRef(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    localDispatch({ type: 'load/start' });
    if (stateRef.current.status === 'ready') setRefreshing(true);
    try {
      const [profile, accounts, transactions, notifications, usage, rates] = await Promise.all([
        api.loadProfile(userId, email), api.loadAccounts(), api.loadTransactions(), api.loadNotifications(), api.loadUsage(), api.loadLatestRates(),
      ]);
      setUsdRates(rates.table, rates.date);
      const cur = currentPrefs.current;
      if (!profile.onboarded) {
        // Pengguna baru: profil masih berisi default DB. Bahasa/aksen/tema perangkat yang dipakai dan disimpan.
        synced.current = { ...cur };
        applying.current = false;
        api.updateProfile(userId, { lang: cur.lang, accent: cur.accent, theme_mode: cur.mode }).catch(() => undefined);
      } else {
        synced.current = { lang: profile.lang, accent: profile.accent, mode: profile.themeMode };
        // Hanya "sedang menerapkan" bila nilai server memang berbeda dari yang tampil sekarang;
        // kalau sama, efek di bawah tidak akan berjalan untuk melepas penanda ini.
        applying.current = cur.lang !== profile.lang || cur.accent !== profile.accent || cur.mode !== profile.themeMode;
        applyPrefs.current.setLang(profile.lang);
        applyPrefs.current.setAccent(profile.accent);
        applyPrefs.current.setMode(profile.themeMode);
      }
      localDispatch({
        type: 'load/done',
        data: {
          email: profile.email, displayName: profile.displayName, onboarded: profile.onboarded, accounts, transactions, notifications,
          plan: profile.plan, usage, hideBalance: profile.hideBalance, mainCurrency: profile.mainCurrency, income: profile.income,
          split: profile.split, payday: profile.payday, notifPrefs: profile.notifPrefs, activeAccountId: profile.activeAccountId, ratesDate: rates.date,
        },
      });
    } catch {
      localDispatch({ type: 'load/error' });
    } finally {
      setRefreshing(false);
    }
  }, [userId, email]);

  // Login → muat; logout → kosongkan.
  useEffect(() => {
    if (preset) return;
    if (userId) void reload();
    else {
      synced.current = null;
      localDispatch({ type: 'reset' });
    }
  }, [userId, reload, preset]);

  // Bahasa, aksen, dan tema disimpan per pengguna (FR-SET-1, FR-SET-4). Hanya perubahan dari pengguna
  // yang ditulis: selama nilai server sedang diterapkan, nilai perangkat lama tidak boleh menimpa profil.
  useEffect(() => {
    const s = synced.current;
    if (!userId || !s) return;
    if (s.lang === lang && s.accent === accent && s.mode === mode) {
      applying.current = false;
      return;
    }
    if (applying.current) return;
    synced.current = { lang, accent, mode };
    api.updateProfile(userId, { lang, accent, theme_mode: mode }).catch(() => show({ tone: 'error', title: t('common.syncFailed'), message: t('common.syncFailedMessage') }));
  }, [userId, lang, accent, mode, show, t]);

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

  const dispatch = useCallback(
    (action: Action) => {
      const before = stateRef.current;
      localDispatch(action);
      if (!userId) return;
      syncAction(action, before, userId)
        .then((rated) => rated.forEach((tx) => localDispatch({ type: 'tx/update', tx })))
        .catch(() => {
          show({ tone: 'error', title: t('common.syncFailed'), message: t('common.syncFailedMessage') });
          void reload();
        });
    },
    [userId, show, t, reload],
  );

  const refreshUsage = useCallback(() => {
    if (!userId) return;
    api.loadUsage().then((usage) => localDispatch({ type: 'usage/set', usage })).catch(() => undefined);
  }, [userId]);

  const value = useMemo(() => ({ state, dispatch, reload, refreshUsage, refreshing, userId }), [state, dispatch, reload, refreshUsage, refreshing, userId]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore harus dipakai di dalam <AppStoreProvider>');
  return ctx;
}

export type AccountWithBalance = Account & { balance: number };

export function useAccounts(): AccountWithBalance[] {
  const { state } = useStore();
  return useMemo(
    () => state.accounts.map((a) => ({ ...a, balance: accountBalance(a, state.transactions) })),
    [state.accounts, state.transactions],
  );
}

/** Akun default untuk pencatatan: kartu aktif di Beranda, atau akun pertama. */
export function useActiveAccountId(): string | null {
  const { state } = useStore();
  const active = state.accounts.find((a) => a.id === state.activeAccountId);
  return (active ?? state.accounts[0])?.id ?? null;
}
