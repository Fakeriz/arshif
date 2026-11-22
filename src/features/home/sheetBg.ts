import { presetValue } from '@/lib/cover';

import { makeDevicePref } from './devicePref';

/**
 * Latar lembar di belakang kartu saldo Beranda, dipilih dari menu titik tiga kartu. Disimpan per perangkat.
 * plain = batu polos (bawaan); cover = sampul profil pengguna; sisanya preset sampul monokrom.
 */
export const SHEET_BGS = ['plain', 'cover', 'garis', 'lingkar', 'batu'] as const;
export type SheetBg = (typeof SHEET_BGS)[number];

const isBg = (v: unknown): v is SheetBg => (SHEET_BGS as readonly unknown[]).includes(v);

/** Nilai untuk ProfileCover: sampul profil apa adanya, atau preset. undefined = polos. */
export function coverValueFor(bg: SheetBg, coverPath: string | null): string | null | undefined {
  if (bg === 'plain') return undefined;
  if (bg === 'cover') return coverPath;
  return presetValue(bg);
}

export const useSheetBg = makeDevicePref<SheetBg>('arshif.home.sheetBg', 'plain', isBg);

/** Pemilih akun Beranda: true = dompet bertumpuk (seperti Akun & kartu), false = strip ringkas yang bisa dibuka. */
export const useWalletStack = makeDevicePref<boolean>('arshif.home.walletStack', true, (v): v is boolean => typeof v === 'boolean');
