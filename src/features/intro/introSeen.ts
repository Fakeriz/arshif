import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * Penanda perkenalan (layar Sambut + tur) sudah dilihat, per perangkat.
 * Pengguna baru mendarat di Sambut; setelah tur selesai/dilewati, keluar akun berikutnya langsung ke Masuk.
 */
const KEY = 'arshif.introSeen';

/** null = belum dibaca dari penyimpanan. */
let seen: boolean | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(v: boolean) => void>();

function set(v: boolean) {
  seen = v;
  listeners.forEach((fn) => fn(v));
}

export function loadIntroSeen(): Promise<void> {
  if (seen !== null) return Promise.resolve();
  loading ??= AsyncStorage.getItem(KEY)
    .then((v) => set(v === '1'))
    .catch(() => set(false));
  return loading;
}

export function markIntroSeen(): void {
  set(true);
  AsyncStorage.setItem(KEY, '1').catch(() => undefined);
}

/** `null` selama dibaca; setelah itu true/false. */
export function useIntroSeen(): boolean | null {
  const [value, setValue] = useState<boolean | null>(seen);
  useEffect(() => {
    listeners.add(setValue);
    // Bisa sudah terbaca di antara render pertama dan efek ini.
    if (seen !== null) setValue(seen);
    else void loadIntroSeen();
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}

/** Untuk test. */
export function resetIntroSeenForTest(v: boolean | null = null): void {
  seen = v;
  loading = null;
}
