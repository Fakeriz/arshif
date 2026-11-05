/** Web: tidak ada pembelian toko. Premium web lewat checkout Xendit/Paddle (lib/checkout). */
export type StorePackage = { pkg: never; price: string };
export type StorePackages = { monthly: StorePackage | null; yearly: StorePackage | null };

export function storeAvailable(): boolean {
  return false;
}
export async function identifyPurchaser(_userId: string): Promise<void> {}
export async function forgetPurchaser(): Promise<void> {}
export async function loadStorePackages(): Promise<StorePackages> {
  return { monthly: null, yearly: null };
}
export async function buyPackage(_pkg: never): Promise<'purchased' | 'cancelled'> {
  return 'cancelled';
}
export async function restorePurchases(): Promise<void> {}
