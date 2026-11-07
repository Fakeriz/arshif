import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Asset, AssetAlert, AssetType, NetWorthSnapshot } from '@/data/assets';
import * as api from '@/data/remote/assets';
import { newId } from '@/lib/uuid';

import { useStore } from './AppStore';

export type AssetsStatus = 'idle' | 'loading' | 'ready' | 'error';
type AssetsState = api.AssetsData & { status: AssetsStatus };

const EMPTY: AssetsState = { status: 'idle', assets: [], prices: {}, snapshots: [] };
/** Grafik riwayat menampilkan setahun terakhir. */
const HISTORY_DAYS = 365;

type AssetsValue = AssetsState & {
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

const sinceYmd = () => new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
const upsert = (list: Asset[], item: Asset): Asset[] => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);

/**
 * Aset yang dilacak, harga live terakhirnya, dan snapshot kekayaan bersih. `preset` = data tetap tanpa server (tes).
 * Dimuat setelah data utama siap; tarik-untuk-muat-ulang mengambil harga terbaru.
 */
export function AssetsProvider({ children, preset }: { children: ReactNode; preset?: api.AssetsData }) {
  const { state: app, userId, refreshUsage } = useStore();
  const [state, setState] = useState<AssetsState>(() => (preset ? { ...preset, status: 'ready' } : EMPTY));

  const reload = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'loading' }));
    try {
      const data = await api.loadAssets(sinceYmd());
      setState({ ...data, status: 'ready' });
    } catch {
      setState((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'error' }));
    }
  }, [userId]);

  useEffect(() => {
    if (preset) return;
    if (!userId) {
      setState(EMPTY);
      return;
    }
    if (app.status === 'ready' && app.onboarded) void reload();
  }, [userId, app.status, app.onboarded, reload, preset]);

  const value = useMemo<AssetsValue>(() => {
    // Harga untuk kode baru diambil langsung supaya aset baru tidak menunggu muat ulang.
    const withPrices = async (asset: Asset) => {
      const fresh = asset.priceKey && !state.prices[asset.priceKey] && !preset ? await api.loadPrices([asset]).catch(() => ({})) : {};
      setState((s) => ({ ...s, assets: upsert(s.assets, asset), prices: { ...s.prices, ...fresh } }));
      return asset;
    };
    return {
      ...state,
      reload,
      addAsset: async (type, a) => {
        const asset = await withPrices(await api.insertAsset(newId(), type, a));
        refreshUsage();
        return asset;
      },
      editAsset: async (id, a) => withPrices(await api.updateAsset(id, a)),
      removeAsset: async (id) => {
        await api.deleteAsset(id);
        setState((s) => ({ ...s, assets: s.assets.filter((x) => x.id !== id), alerts: (s.alerts ?? []).filter((x) => x.assetId !== id) }));
        refreshUsage();
      },
      recordSnapshot: (snap) => {
        const today = state.snapshots.find((x) => x.date === snap.date);
        if (today && today.total === snap.total && today.liabilitiesTotal === snap.liabilitiesTotal && today.currency === snap.currency) return;
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
  }, [state, reload, refreshUsage, preset]);

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
}

export function useAssets(): AssetsValue {
  const ctx = useContext(AssetsContext);
  if (!ctx) throw new Error('useAssets di luar AssetsProvider');
  return ctx;
}
