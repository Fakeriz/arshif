import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * Preferensi kecil per perangkat (AsyncStorage) yang dibagi antar-komponen: semua pemakai hook yang sama
 * ikut berubah saat salah satunya mengubah nilai. Dibaca sekali dari penyimpanan.
 */
export function makeDevicePref<T>(key: string, fallback: T, valid: (v: unknown) => v is T) {
  let current = fallback;
  let loaded = false;
  const listeners = new Set<(v: T) => void>();
  const set = (v: T) => {
    current = v;
    listeners.forEach((fn) => fn(v));
  };
  return function useDevicePref(): [T, (v: T) => void] {
    const [value, setValue] = useState(current);
    useEffect(() => {
      listeners.add(setValue);
      setValue(current);
      if (!loaded) {
        loaded = true;
        AsyncStorage.getItem(key)
          .then((raw) => {
            if (raw === null) return;
            // Nilai lama disimpan sebagai teks mentah (mis. "garis"), yang baru sebagai JSON: terima keduanya.
            let v: unknown = raw;
            try {
              v = JSON.parse(raw);
            } catch {
              /* teks mentah */
            }
            if (valid(v)) set(v);
          })
          .catch(() => undefined);
      }
      return () => {
        listeners.delete(setValue);
      };
    }, []);
    const update = useCallback((v: T) => {
      set(v);
      AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => undefined);
    }, []);
    return [value, update];
  };
}
