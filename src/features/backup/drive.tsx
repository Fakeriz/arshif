import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import { getRandomBytes } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { BACKUP_MIME } from './service';
import { DRIVE_REDIRECT_PATH, DRIVE_STATE_KEY, loadWebToken, saveWebToken, type DriveToken } from './driveToken';

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

async function call(url: string, token: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: init.signal ?? controller.signal,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new DriveError('network');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) throw new DriveError('auth');
  if (res.status === 403) throw new DriveError('quota');
  if (!res.ok) throw new DriveError('network');
  return res;
}

/** Unggah resumable (multipart dibatasi 5 MB, cadangan dengan struk bisa jauh lebih besar). */
async function upload(token: string, name: string, bytes: Uint8Array): Promise<DriveFile> {
  const start = await call(`${UPLOAD}?uploadType=resumable`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': BACKUP_MIME },
    body: JSON.stringify({ name, mimeType: BACKUP_MIME }),
  });
  const session = start.headers.get('Location');
  if (!session) throw new DriveError('network');
  const done = await call(session, token, { method: 'PUT', headers: { 'Content-Type': BACKUP_MIME }, body: bytes as unknown as BodyInit }, 120_000);
  const f = (await done.json().catch(() => ({}))) as { id?: string };
  return { id: f.id ?? '', name, createdTime: new Date().toISOString(), size: bytes.length };
}

async function list(token: string): Promise<DriveFile[]> {
  const q = encodeURIComponent("name contains '.arshif' and trashed = false");
  const res = await call(`${API}?q=${q}&orderBy=createdTime desc&pageSize=50&fields=files(id,name,createdTime,size)`, token);
  const data = (await res.json()) as { files?: { id: string; name: string; createdTime: string; size?: string }[] };
  return (data.files ?? []).map((f) => ({ id: f.id, name: f.name, createdTime: f.createdTime, size: Number(f.size ?? 0) }));
}

/** Akun Google yang terhubung (endpoint about Drive bisa dibaca dengan scope drive.file). */
async function about(token: string): Promise<string | null> {
  const res = await call(`https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)`, token);
  return ((await res.json()) as { user?: { emailAddress?: string } }).user?.emailAddress ?? null;
}

async function download(token: string, id: string): Promise<Uint8Array> {
  const res = await call(`${API}/${encodeURIComponent(id)}?alt=media`, token, {}, 120_000);
  return new Uint8Array(await res.arrayBuffer());
}

/** Satu aksi Drive yang butuh token akses. */
type DriveJob<T> = { (token: string): Promise<T> };

const HISTORY_KEY = 'arshif.drive.history';

/** Status + aksi Drive yang dipakai layar Cadangan (sama untuk web dan native). */
export type DriveApi = {
  connected: boolean;
  /** Email akun Google yang terhubung (null bila belum terbaca). */
  account: string | null;
  busy: boolean;
  /** Riwayat cadangan di Drive: dari Drive saat terhubung, dari simpanan perangkat bila belum. */
  history: DriveFile[];
  connect(): void;
  disconnect(): void;
  upload(name: string, bytes: Uint8Array): Promise<void>;
  download(id: string): Promise<Uint8Array>;
};

const DriveContext = createContext<DriveApi | null>(null);

/** Inti bersama: token -> akun, riwayat, unggah, unduh. Token kedaluwarsa (401) = putus, pengguna menghubungkan ulang. */
function useDriveCore(live: string | null, clear: () => void, connect: () => void): DriveApi {
  // Email disimpan bersama token pemiliknya: token berganti/putus = email lama otomatis tidak dipakai.
  const [acc, setAcc] = useState<{ token: string; email: string | null } | null>(null);
  const account = acc && acc.token === live ? acc.email : null;
  const [history, setHistory] = useState<DriveFile[]>([]);
  const historyRef = useRef<DriveFile[]>([]);
  const [busy, setBusy] = useState(false);

  const saveHistory = useCallback((filesOrUpdater: DriveFile[] | ((prev: DriveFile[]) => DriveFile[])) => {
    const next = (typeof filesOrUpdater === 'function' ? filesOrUpdater(historyRef.current) : filesOrUpdater).slice(0, 50);
    historyRef.current = next;
    setHistory(next);
    void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const run = useCallback(
    async <T,>(job: DriveJob<T>): Promise<T> => {
      if (!live) throw new DriveError('auth');
      setBusy(true);
      try {
        return await job(live);
      } catch (e) {
        // Token kedaluwarsa/dicabut: putus, pengguna menghubungkan ulang.
        if (e instanceof DriveError && e.code === 'auth') clear();
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [live, clear],
  );

  useEffect(() => {
    void AsyncStorage.getItem(HISTORY_KEY)
      .then((v) => {
        if (!v) return;
        const parsed = JSON.parse(v) as DriveFile[];
        historyRef.current = parsed;
        setHistory(parsed);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!live) return;
    // Sekali tiap token baru: akun + riwayat, tanpa indikator sibuk (bukan aksi pengguna). 401 = putus.
    const onError = (e: unknown) => (e instanceof DriveError && e.code === 'auth' ? clear() : undefined);
    about(live).then((email) => setAcc({ token: live, email }), onError);
    list(live).then(saveHistory, onError);
  }, [live, clear, saveHistory]);

  return {
    connected: !!live,
    account,
    busy,
    history,
    connect,
    disconnect: clear,
    upload: async (name, bytes) => {
      const f = await run((t) => upload(t, name, bytes));
      saveHistory((prev) => [f, ...prev.filter((h) => h.id !== f.id)]);
    },
    download: (id) => run((t) => download(t, id)),
  };
}

/**
 * Web: login dengan pindah halaman (bukan popup). Popup di browser HP/PWA terbuka sebagai tab baru dan Google kembali ke
 * Arshif di tab itu, sehingga aplikasi tampak dibuka ulang dan hasil login tidak pernah sampai. Token ditangkap saat
 * aplikasi dimuat (driveToken.captureDriveRedirect) dan disimpan di sessionStorage sampai kedaluwarsa.
 */
function DriveWeb({ clientId, children }: { clientId: string; children: ReactNode }) {
  // Token kedaluwarsa sudah disaring loadWebToken; kedaluwarsa di tengah jalan ditangani 401 -> clear.
  const [token, setToken] = useState<DriveToken | null>(loadWebToken);
  const clear = useCallback(() => {
    saveWebToken(null);
    setToken(null);
  }, []);
  const connect = useCallback(() => {
    const state = Array.from(getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(DRIVE_STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${window.location.origin}${DRIVE_REDIRECT_PATH}`,
      response_type: 'token',
      scope: SCOPE,
      include_granted_scopes: 'true',
      prompt: 'select_account',
      state,
    });
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }, [clientId]);
  return <DriveContext.Provider value={useDriveCore(token?.token ?? null, clear, connect)}>{children}</DriveContext.Provider>;
}

/** Android/iOS: login lewat expo-auth-session (kembali ke aplikasi lewat skema URL). Token di memori selama aplikasi terbuka. */
function DriveNative({ children }: { children: ReactNode }) {
  const [request, response, promptAsync] = Google.useAuthRequest({ ...clientIds(), scopes: [SCOPE] });
  // Token diturunkan dari hasil login terakhir; Putuskan hanya menandai token itu sebagai sudah diputus.
  const [cleared, setCleared] = useState<string | null>(null);
  const fresh = response?.type === 'success' ? (response.authentication?.accessToken ?? null) : null;
  const token = fresh && fresh !== cleared ? fresh : null;
  const clear = useCallback(() => setCleared(fresh), [fresh]);
  const connect = useCallback(() => (request ? void promptAsync() : undefined), [request, promptAsync]);
  return <DriveContext.Provider value={useDriveCore(token, clear, connect)}>{children}</DriveContext.Provider>;
}

/**
 * Gerbang konfigurasi: tanpa client ID platform aktif, tidak ada komponen Drive yang dirender (expo-auth-session melempar
 * error bila client ID kosong) dan tombol Drive tampil nonaktif. Hook tidak pernah dipanggil kondisional.
 */
export function DriveGate({ children }: { children: ReactNode }) {
  const id = activeClientId();
  if (!id) return <>{children}</>;
  return Platform.OS === 'web' ? <DriveWeb clientId={id}>{children}</DriveWeb> : <DriveNative>{children}</DriveNative>;
}

/** null = Google Drive belum dikonfigurasi untuk platform ini (tampilkan tombol nonaktif). */
export function useDrive(): DriveApi | null {
  return useContext(DriveContext);
}
