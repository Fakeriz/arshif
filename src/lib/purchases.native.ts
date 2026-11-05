import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import { RC_ANDROID_KEY, RC_IOS_KEY } from '@/config/public';

/** In-app (FR-PAY-1): RevenueCat, produk arshif_premium_monthly / arshif_premium_yearly, entitlement premium. */
const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
let configured = false;

export type StorePackage = { pkg: PurchasesPackage; price: string };
export type StorePackages = { monthly: StorePackage | null; yearly: StorePackage | null };

export function storeAvailable(): boolean {
  return !!apiKey;
}

/** Hubungkan pembeli RevenueCat dengan pengguna Supabase (app user id = id pengguna). */
export async function identifyPurchaser(userId: string): Promise<void> {
  if (!apiKey) return;
  if (!configured) {
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
    return;
  }
  await Purchases.logIn(userId);
}

export async function forgetPurchaser(): Promise<void> {
  if (!configured) return;
  await Purchases.logOut().catch(() => undefined);
}

export async function loadStorePackages(): Promise<StorePackages> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  const wrap = (pkg: PurchasesPackage | null | undefined) => (pkg ? { pkg, price: pkg.product.priceString } : null);
  return { monthly: wrap(current?.monthly), yearly: wrap(current?.annual) };
}

/** 'cancelled' = pengguna menutup lembar pembayaran toko (bukan error). */
export async function buyPackage(pkg: PurchasesPackage): Promise<'purchased' | 'cancelled'> {
  try {
    await Purchases.purchasePackage(pkg);
    return 'purchased';
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    throw e;
  }
}

export async function restorePurchases(): Promise<void> {
  await Purchases.restorePurchases();
}
