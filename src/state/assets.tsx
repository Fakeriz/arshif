import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';

import type { Asset, AssetAlert, AssetPrice, AssetType, NetWorthSnapshot } from '@/data/assets';
import * as api from '@/data/remote/assets';
import { addDays, todayYmd } from '@/lib/dates';
import { newId } from '@/lib/uuid';

import { useStore } from './AppStore';

export type AssetsStatus = 'idle' | 'loading' | 'ready' | 'error';
type AssetsState = api.AssetsData & { status: AssetsStatus };

const EMPTY: AssetsState = { status: 'idle', assets: [], prices: {}, snapshots: [] };
/** Grafik riwayat menampilkan setahun terakhir. */
const HISTORY_DAYS = 365;
const FOREGROUND_REFRESH_MS = 60_000;

type AssetsValue = AssetsState & {
  refreshing: boolean;
  /** Kode aset baru/diubah yang belum punya harga di server; menunggu sync pertama. */
  pendingPriceKeys: string[];
  reload: () => Promise<void>;
  addAsset: (type: AssetType, a: api.AssetInput) => Promise<Asset>;
  editAsset: (id: string, a: api.AssetInput) => Promise<Asset>;
  removeAsset: (id: string) => Promise<void>;
  /** Simpan snapshot hari ini bila angkanya berubah (maksimal satu baris per hari di server). */
  recordSnapshot: (s: NetWorthSnapshot) => void;
  /** Pasang alert harga (atau pasang lagi dengan ambang baru); patokan = harga terakhir di server. */
  saveAlert: (assetId: string, pct: number) => Promise<AssetAlert>;
  removeAlert: (id: string) => Promise<void>;
};

const AssetsContext = createContext<AssetsValue | null>(null);

const sinceYmd = () => addDays(todayYmd(), -HISTORY_DAYS);
const upsert = (list: Asset[], item: Asset): Asset[] => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);

/**
 * Aset yang dilacak, harga live terakhirnya, dan snapshot kekayaan bersih. `preset` = data tetap tanpa server (tes).
 * Dimuat setelah data utama siap; tarik-untuk-muat-ulang dan kembali ke foreground mengambil harga terbaru.
 */
export function AssetsProvider({ children, preset }: { children: ReactNode; preset?: api.AssetsData }) {
  const { state: app, userId, refreshUsage } = useStore();
  const [state, setState] = useState<AssetsState>(() => (preset ? { ...preset, status: 'ready' } : EMPTY));
  const [refreshing, setRefreshing] = useState(false);
  const [pendingPriceKeys, setPendingPriceKeys] = useState<string[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const reloadSeq = useRef(0);
  const lastLoadedAt = useRef(0);
  const prevUserRef = useRef<string | null>(userId);

  const reload = useCallback(async () => {
    if (!userId) return;
    const seq = ++reloadSeq.current;
    if (stateRef.current.status === 'ready') setRefreshing(true);
    setState((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'loading' }));
    try {
      const data = await api.loadAssets(sinceYmd());
      if (seq === reloadSeq.current) {
        lastLoadedAt.current = Date.now();
        setState({ ...data, status: 'ready' });
        setPendingPriceKeys((prev) => prev.filter((k) => !data.prices[k]));
      }
    } catch {
      if (seq === reloadSeq.current) setState((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'error' }));
    } finally {
      if (seq === reloadSeq.current) setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (preset) return;
    if (prevUserRef.current !== userId) {
      prevUserRef.current = userId;
      reloadSeq.current += 1;
      lastLoadedAt.current = 0;
      setRefreshing(false);
      setPendingPriceKeys([]);
      setState(EMPTY);
    }
    if (userId && app.status === 'ready' && app.onboarded) void reload();
  }, [userId, app.status, app.onboarded, reload, preset]);

  useEffect(() => {
    if (preset || !userId || app.status !== 'ready' || !app.onboarded) return;
    const sub = RNAppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      if (Date.now() - lastLoadedAt.current < FOREGROUND_REFRESH_MS) return;
      void reload();
    });
    return () => sub.remove();
  }, [preset, userId, app.status, app.onboarded, reload]);

  const value = useMemo<AssetsValue>(() => {
    // Harga untuk kode baru diambil langsung supaya aset baru tidak menunggu muat ulang.
    const withPrices = async (asset: Asset) => {
      const hasPrice = Boolean(asset.priceKey && stateRef.current.prices[asset.priceKey]);
      const fresh: Record<string, AssetPrice> =
        asset.priceKey && !hasPrice && !preset ? await api.loadPrices([asset]).catch(() => ({})) : {};
      if (!preset && asset.priceKey) {
        if (hasPrice || fresh[asset.priceKey]) {
          setPendingPriceKeys((prev) => prev.filter((k) => k !== asset.priceKey));
        } else {
          setPendingPriceKeys((prev) => (prev.includes(asset.priceKey!) ? prev : [...prev, asset.priceKey!]));
        }
      }
      setState((s) => ({ ...s, assets: upsert(s.assets, asset), prices: { ...s.prices, ...fresh } }));
      return asset;
    };
    return {
      ...state,
      refreshing,
      pendingPriceKeys,
      reload,
      addAsset: async (type, a) => {
        const asset = await withPrices(await api.insertAsset(newId(), type, a));
        refreshUsage();
        return asset;
      },
      editAsset: async (id, a) => {
        const prev = stateRef.current.assets.find((x) => x.id === id);
        const asset = await withPrices(await api.updateAsset(id, a));
        if (prev?.priceKey !== asset.priceKey || asset.valueOverride !== undefined) {
          setState((s) => ({ ...s, alerts: (s.alerts ?? []).filter((x) => x.assetId !== id) }));
        }
        return asset;
      },
      removeAsset: async (id) => {
        await api.deleteAsset(id);
        setState((s) => ({ ...s, assets: s.assets.filter((x) => x.id !== id), alerts: (s.alerts ?? []).filter((x) => x.assetId !== id) }));
        refreshUsage();
      },
      recordSnapshot: (snap) => {
        const today = state.snapshots.find((x) => x.date === snap.date);
        if (today && today.total === snap.total && today.assetsTotal === snap.assetsTotal && today.liabilitiesTotal === snap.liabilitiesTotal && today.currency === snap.currency) return;
        setState((s) => ({ ...s, snapshots: [...s.snapshots.filter((x) => x.date !== snap.date), snap].sort((a, b) => a.date.localeCompare(b.date)) }));
        if (!preset) api.saveSnapshot(snap).catch(() => undefined);
      },
      saveAlert: async (assetId, pct) => {
        const existing = (state.alerts ?? []).find((x) => x.assetId === assetId);
        const alert = await api.saveAlert(assetId, pct, existing?.id);
        setState((s) => ({ ...s, alerts: [...(s.alerts ?? []).filter((x) => x.assetId !== assetId), alert] }));
        return alert;
      },
      removeAlert: async (id) => {
        await api.deleteAlert(id);
        setState((s) => ({ ...s, alerts: (s.alerts ?? []).filter((x) => x.id !== id) }));
      },
    };
  }, [state, refreshing, pendingPriceKeys, reload, refreshUsage, preset]);

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
}

export function useAssets(): AssetsValue {
  const ctx = useContext(AssetsContext);
  if (!ctx) throw new Error('useAssets di luar AssetsProvider');
  return ctx;
}

export function useAssetsOptional(): AssetsValue | null {
  return useContext(AssetsContext);
}
