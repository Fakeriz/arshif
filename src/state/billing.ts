import { useCallback, useEffect } from 'react';

import { invokeFn } from '@/data/remote/functions';
import { forgetPurchaser, identifyPurchaser } from '@/lib/purchases';

import { CheckoutResponse, FUNCTIONS, SyncResponse } from '../../supabase/functions/_shared/contracts';
import { useStore } from './AppStore';

/**
 * Cocokkan paket dengan RevenueCat lewat server (entitlement-sync), lalu perbarui paket + kuota di layar.
 * Dipakai setelah beli/pulihkan di aplikasi dan saat pesanan web lunas.
 */
export function useSyncPlan(): () => Promise<SyncResponse> {
  const { dispatch, refreshUsage } = useStore();
  return useCallback(async () => {
    const r = await invokeFn(FUNCTIONS.entitlementSync, {}, SyncResponse);
    dispatch({ type: 'plan/set', plan: r.plan, premiumUntil: r.premiumUntil });
    refreshUsage();
    return r;
  }, [dispatch, refreshUsage]);
}

export function createCheckout(input: { period: 'monthly' | 'yearly'; currency: 'IDR' | 'MYR' | 'USD'; method: string }): Promise<CheckoutResponse> {
  return invokeFn(FUNCTIONS.checkout, input, CheckoutResponse);
}

/** Pembeli RevenueCat mengikuti sesi: login = identitas pengguna Supabase, logout = anonim lagi. */
export function PurchasesBridge() {
  const { userId } = useStore();
  useEffect(() => {
    if (userId) identifyPurchaser(userId).catch(() => undefined);
    else forgetPurchaser().catch(() => undefined);
  }, [userId]);
  return null;
}
