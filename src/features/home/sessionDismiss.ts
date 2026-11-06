import { useState } from 'react';

/** Kartu yang ditutup pengguna. Sengaja hanya di memori: setelah aplikasi dibuka ulang, kartunya muncul lagi. */
const dismissed = new Set<string>();

export function useSessionDismiss(key: string): [boolean, () => void] {
  const [gone, setGone] = useState(() => dismissed.has(key));
  return [
    gone,
    () => {
      dismissed.add(key);
      setGone(true);
    },
  ];
}

/** Hanya untuk tes: kembalikan ke keadaan aplikasi baru dibuka. */
export function resetSessionDismiss() {
  dismissed.clear();
}
