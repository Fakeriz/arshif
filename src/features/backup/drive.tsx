import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { BACKUP_MIME } from './service';

// Web: tutup jendela login Google setelah kembali ke Arshif.
WebBrowser.maybeCompleteAuthSession();

/**
 * Client ID OAuth dari Google Cloud Console (env saat build). Tanpa client ID untuk platform ini, fitur Drive disembunyikan.
 * Scope drive.file: Arshif hanya bisa melihat dan membuat berkas yang dibuatnya sendiri, bukan seluruh isi Drive.
 */
// Dibaca saat dipakai (bukan saat modul dimuat); Expo tetap menanam nilai EXPO_PUBLIC_* saat build.
const clientIds = () => ({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
});
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

/** Client ID untuk platform yang sedang berjalan (web/android/ios). Kosong = Drive nonaktif, hook auth tidak pernah dipanggil. */
export function activeClientId(): string | undefined {
  const ids = clientIds();
  return Platform.OS === 'web' ? ids.webClientId : Platform.OS === 'ios' ? ids.iosClientId : ids.androidClientId;
}

export type DriveFile = { id: string; name: string; createdTime: string; size: number };

export class DriveError extends Error {
  constructor(readonly code: 'cancelled' | 'auth' | 'network' | 'quota') {
    super(code);
  }
}

async function call(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
  } catch {
    throw new DriveError('network');
  }
  if (res.status === 401) throw new DriveError('auth');
  if (res.status === 403) throw new DriveError('quota');
  if (!res.ok) throw new DriveError('network');
  return res;
}

/** Unggah resumable (multipart dibatasi 5 MB, cadangan dengan struk bisa jauh lebih besar). */
async function upload(token: string, name: string, bytes: Uint8Array): Promise<void> {
  const start = await call(`${UPLOAD}?uploadType=resumable`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': BACKUP_MIME },
    body: JSON.stringify({ name, mimeType: BACKUP_MIME }),
  });
  const session = start.headers.get('Location');
  if (!session) throw new DriveError('network');
  await call(session, token, { method: 'PUT', headers: { 'Content-Type': BACKUP_MIME }, body: bytes as unknown as BodyInit });
}

async function list(token: string): Promise<DriveFile[]> {
  const q = encodeURIComponent("name contains '.arshif' and trashed = false");
  const res = await call(`${API}?q=${q}&orderBy=createdTime desc&pageSize=50&fields=files(id,name,createdTime,size)`, token);
  const data = (await res.json()) as { files?: { id: string; name: string; createdTime: string; size?: string }[] };
  return (data.files ?? []).map((f) => ({ id: f.id, name: f.name, createdTime: f.createdTime, size: Number(f.size ?? 0) }));
}

async function download(token: string, id: string): Promise<Uint8Array> {
  const res = await call(`${API}/${encodeURIComponent(id)}?alt=media`, token);
  return new Uint8Array(await res.arrayBuffer());
}

/** Satu aksi Drive yang butuh token akses. */
type DriveJob<T> = { (token: string): Promise<T> };

/**
 * Login Google (sekali per sesi aplikasi; token tidak disimpan) lalu unggah/daftar/unduh cadangan.
 * Tiap aksi meminta login bila belum ada token.
 */
function useGoogleDrive() {
  const [request, response, promptAsync] = Google.useAuthRequest({ ...clientIds(), scopes: [SCOPE] });
  const token = useRef<string | null>(null);
  const waiting = useRef<{ resolve: (t: string) => void; reject: (e: Error) => void } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!response || !waiting.current) return;
    const w = waiting.current;
    waiting.current = null;
    if (response.type === 'success' && response.authentication?.accessToken) {
      token.current = response.authentication.accessToken;
      w.resolve(token.current);
    } else w.reject(new DriveError(response.type === 'cancel' || response.type === 'dismiss' ? 'cancelled' : 'auth'));
  }, [response]);

  const getToken = useCallback(async (): Promise<string> => {
    if (token.current) return token.current;
    if (!request) throw new DriveError('auth');
    const p = new Promise<string>((resolve, reject) => (waiting.current = { resolve, reject }));
    // Dipanggil langsung dari ketukan (web: popup harus di dalam ketukan pengguna).
    void promptAsync();
    return p;
  }, [request, promptAsync]);

  /** Token kedaluwarsa (1 jam): login ulang sekali lalu ulangi aksinya. */
  const withToken = useCallback(
    async <T,>(fn: DriveJob<T>): Promise<T> => {
      setBusy(true);
      try {
        try {
          return await fn(await getToken());
        } catch (e) {
          if (!(e instanceof DriveError) || e.code !== 'auth' || !token.current) throw e;
          token.current = null;
          return await fn(await getToken());
        }
      } finally {
        setBusy(false);
      }
    },
    [getToken],
  );

  return {
    ready: !!request,
    busy,
    upload: (name: string, bytes: Uint8Array) => withToken((t) => upload(t, name, bytes)),
    list: () => withToken(list),
    download: (id: string) => withToken((t) => download(t, id)),
  };
}

export type DriveApi = ReturnType<typeof useGoogleDrive>;
const DriveContext = createContext<DriveApi | null>(null);

/** Satu-satunya tempat useAuthRequest dipanggil; hanya dirender oleh DriveGate bila client ID platform ini ada. */
function DriveConnected({ children }: { children: ReactNode }) {
  return <DriveContext.Provider value={useGoogleDrive()}>{children}</DriveContext.Provider>;
}

/**
 * Gerbang konfigurasi: expo-auth-session melempar error bila client ID platform aktif kosong, jadi hook-nya hanya dipanggil
 * di dalam DriveConnected yang dirender bila dikonfigurasi (hook tidak pernah dipanggil kondisional).
 */
export function DriveGate({ children }: { children: ReactNode }) {
  return activeClientId() ? <DriveConnected>{children}</DriveConnected> : <>{children}</>;
}

/** null = Google Drive belum dikonfigurasi untuk platform ini (tampilkan tombol nonaktif). */
export function useDrive(): DriveApi | null {
  return useContext(DriveContext);
}
