/**
 * Aplikasi bank/dompet yang didukung Smart Log (FR-SLOG-3). Package id dicek ke Google Play 2026-11-05.
 * `bank` = kunci di constants/banks.ts, dipakai untuk normalisasi nama (myBCA -> BCA, Livin -> Mandiri).
 * Beberapa bank punya dua aplikasi yang sama-sama mengirim notifikasi transaksi.
 */
export type SmartLogApp = { pkg: string; bank: string; app: string };

export const SMARTLOG_APPS: SmartLogApp[] = [
  { pkg: 'com.bca.mybca.omni.android', bank: 'bca', app: 'myBCA' },
  { pkg: 'com.bca', bank: 'bca', app: 'BCA mobile' },
  { pkg: 'id.bmri.livin', bank: 'mandiri', app: "Livin' by Mandiri" },
  { pkg: 'id.co.bri.brimo', bank: 'bri', app: 'BRImo' },
  { pkg: 'id.bni.wondr', bank: 'bni', app: 'wondr by BNI' },
  { pkg: 'src.com.bni', bank: 'bni', app: 'BNI Mobile' },
  { pkg: 'com.btpn.dc', bank: 'jenius', app: 'Jenius' },
  { pkg: 'id.co.cimbniaga.mobile.android', bank: 'cimbniaga', app: 'OCTO by CIMB Niaga' },
  { pkg: 'net.myinfosys.PermataMobileX', bank: 'permata', app: 'Permata ME' },
  { pkg: 'com.bsm.activity2', bank: 'bsi', app: 'BSI Mobile' },
  { pkg: 'co.id.bankbsi.superapp', bank: 'bsi', app: 'BYOND by BSI' },
  { pkg: 'com.jago.digitalBanking', bank: 'jago', app: 'Jago' },
  { pkg: 'com.bcadigital.blu', bank: 'blu', app: 'blu' },
  { pkg: 'id.co.bankbkemobile.digitalbank', bank: 'seabank', app: 'SeaBank' },
  { pkg: 'com.gojek.gopay', bank: 'gopay', app: 'GoPay' },
  { pkg: 'com.gojek.app', bank: 'gopay', app: 'Gojek' },
  { pkg: 'ovo.id', bank: 'ovo', app: 'OVO' },
  { pkg: 'id.dana', bank: 'dana', app: 'DANA' },
  { pkg: 'com.shopeepay.id', bank: 'shopeepay', app: 'ShopeePay' },
  { pkg: 'com.shopee.id', bank: 'shopeepay', app: 'Shopee' },
];

const byPkg = new Map(SMARTLOG_APPS.map((a) => [a.pkg, a]));

export function smartLogApp(pkg: string): SmartLogApp | null {
  return byPkg.get(pkg) ?? null;
}

export const SMARTLOG_PACKAGES = SMARTLOG_APPS.map((a) => a.pkg);
