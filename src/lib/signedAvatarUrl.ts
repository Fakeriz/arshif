import { useEffect, useState } from 'react';

import { avatarUrl } from '@/data/remote/api';

// Signed URL berlaku 1 jam; dipakai ulang 50 menit supaya Beranda, Pengaturan, Profil, dan Kartu tidak meminta ulang tiap render.
const cache = new Map<string, { url: string; until: number }>();
const TTL_MS = 50 * 60 * 1000;

function cachedUrl(path: string): string | null {
  const hit = cache.get(path);
  return hit && hit.until > Date.now() ? hit.url : null;
}

/** Isi cache signed/local URL segera setelah unggah supaya kartu/avatar langsung tampil tanpa kedip. */
export function primeSignedUrl(path: string, url: string): void {
  cache.set(path, { url, until: Date.now() + TTL_MS });
}

/** Signed URL berkas di bucket avatars (foto profil, sampul, atau kartu kustom); null selama memuat, saat gagal, atau tanpa berkas. */
export function useSignedUrl(path: string | null): string | null {
  // Hasil ambil disimpan bersama path-nya: path berganti = hasil lama otomatis tidak dipakai.
  const [fetched, setFetched] = useState<{ path: string; url: string } | null>(null);
  const hit = path ? cachedUrl(path) : null;
  useEffect(() => {
    if (!path || cachedUrl(path)) return;
    let alive = true;
    avatarUrl(path)
      .then((u) => {
        cache.set(path, { url: u, until: Date.now() + TTL_MS });
        if (alive) setFetched({ path, url: u });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [path]);
  return hit ?? (fetched && fetched.path === path ? fetched.url : null);
}
