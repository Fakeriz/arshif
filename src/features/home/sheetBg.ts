import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { presetValue } from '@/lib/cover';

/**
 * Latar lembar di belakang kartu saldo Beranda, dipilih dari menu titik tiga kartu. Disimpan per perangkat.
 * plain = batu polos (bawaan); cover = sampul profil pengguna; sisanya preset sampul monokrom.
 */
export const SHEET_BGS = ['plain', 'cover', 'garis', 'lingkar', 'batu'] as const;
export type SheetBg = (typeof SHEET_BGS)[number];

const KEY = 'arshif.home.sheetBg';
let current: SheetBg = 'plain';
let loaded = false;
const listeners = new Set<(v: SheetBg) => void>();
const isBg = (v: unknown): v is SheetBg => (SHEET_BGS as readonly unknown[]).includes(v);

/** Nilai untuk ProfileCover: sampul profil apa adanya, atau preset. null = polos. */
export function coverValueFor(bg: SheetBg, coverPath: string | null): string | null | undefined {
  if (bg === 'plain') return undefined;
  if (bg === 'cover') return coverPath;
  return presetValue(bg);
}

export function useSheetBg(): [SheetBg, (v: SheetBg) => void] {
  const [value, setValue] = useState(current);
  useEffect(() => {
    listeners.add(setValue);
    if (!loaded) {
      loaded = true;
      AsyncStorage.getItem(KEY)
        .then((v) => {
          if (isBg(v)) {
            current = v;
            listeners.forEach((fn) => fn(v));
          }
        })
        .catch(() => undefined);
    }
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  const update = useCallback((v: SheetBg) => {
    current = v;
    listeners.forEach((fn) => fn(v));
    AsyncStorage.setItem(KEY, v).catch(() => undefined);
  }, []);
  return [value, update];
}
