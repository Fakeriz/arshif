import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useToast } from '@/components/ui';
import * as api from '@/data/remote/smartlog';
import type { Transaction } from '@/data/types';
import { getBank } from '@/constants/banks';
import { useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { processCaptures, type ProcessSummary } from '@/lib/smartlog/process';
import type { Capture } from '@/lib/smartlog/parser';
import { matchSmartLogRule, type SmartLogRule, type SmartLogRuleInput } from '@/lib/smartlog/rules';

import { SmartLogNative } from '../../modules/smart-log';
import { useStore } from './AppStore';
import { useSession } from './session';

export type SmartLogStatus = 'idle' | 'loading' | 'ready' | 'error';

export type SmartLogValue = {
  /** false di iOS, web, dan Expo Go (butuh development build Android). */
  supported: boolean;
  status: SmartLogStatus;
  enabled: boolean;
  permission: boolean;
  links: api.SmartLogLink[];
  rules?: SmartLogRule[];
  review: api.SmartLogItem[];
  recent: api.SmartLogItem[];
  /** Tangkapan yang ditahan di perangkat (kuota habis atau gagal terkirim). */
  held: number;
  reload: () => Promise<void>;
  setEnabled: (value: boolean) => Promise<void>;
  openPermission: () => void;
  setLink: (pkg: string, accountId: string | null) => Promise<void>;
  saveRule?: (input: SmartLogRuleInput) => Promise<void>;
  removeRule?: (id: string) => Promise<void>;
  /** Kuras antrean perangkat lalu proses. Dipanggil saat aplikasi aktif, saat notifikasi masuk, dan saat To Review dibuka. */
  processNow: () => Promise<void>;
  confirm: (item: api.SmartLogItem, tx: Transaction) => Promise<void>;
  dismiss: (item: api.SmartLogItem) => Promise<void>;
  undo: (id: string) => Promise<void>;
};

const heldKey = (userId: string) => `arshif.smartlog.held.${userId}`;
/** Diekspor untuk tes layar; aplikasi memakai <SmartLogProvider>. */
export const SmartLogContext = createContext<SmartLogValue | null>(null);
const Ctx = SmartLogContext;

async function readHeld(userId: string): Promise<Capture[]> {
  try {
    const raw = await AsyncStorage.getItem(heldKey(userId));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as Capture[]) : [];
  } catch {
    return [];
  }
}

/** Simpan tangkapan yang ditahan di perangkat. false = gagal (mis. penyimpanan penuh), untuk ditampilkan ke pengguna. */
async function saveHeld(userId: string, list: Capture[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(heldKey(userId), JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function drainNative(): Capture[] {
  if (!SmartLogNative) return [];
  try {
    const list = JSON.parse(SmartLogNative.drain()) as unknown;
    return Array.isArray(list) ? (list as Capture[]).filter((c) => typeof c?.key === 'string' && typeof c.postedAt === 'number') : [];
  } catch {
    return [];
  }
}

/** Transaksi dari baris To Review, dengan id yang sama supaya konfirmasi ganda tidak membuat dua transaksi. */
export function draftFromItem(item: api.SmartLogItem, rules: SmartLogRule[] = []): Transaction {
  const matched = item.type === 'expense' ? matchSmartLogRule(rules, item.merchant, item.excerpt) : null;
  if (matched?.action === 'transfer' && matched.toAccountId && matched.toAccountId !== item.accountId) {
    return {
      id: item.id,
      type: 'transfer',
      merchant: item.merchant || getBank(item.bank).name,
      categoryKey: 'savings',
      accountId: item.accountId ?? '',
      toAccountId: matched.toAccountId,
      date: item.date,
      time: item.time,
      amount: item.amount,
      currency: item.currency,
      source: 'smartlog',
    };
  }
  return {
    id: item.id,
    type: item.type,
    merchant: item.merchant || getBank(item.bank).name,
    categoryKey: matched?.action === 'categorize' ? matched.categoryKey : 'other',
    accountId: item.accountId ?? '',
    date: item.date,
    time: item.time,
    amount: item.amount,
    currency: item.currency,
    source: 'smartlog',
  };
}

/** Satu instance per pengguna: ganti akun = state Smart Log mulai dari nol. */
export function SmartLogProvider({ children }: { children: ReactNode }) {
  const { userId } = useStore();
  return <SmartLogInner key={userId ?? 'signed-out'}>{children}</SmartLogInner>;
}

function SmartLogInner({ children }: { children: ReactNode }) {
  const { state, userId, applyLocal, commitTx, refreshUsage } = useStore();
  const { ready: sessionReady, session } = useSession();
  const t = useT();
  const { show } = useToast();
  const supported = !!SmartLogNative;
  const [loadStatus, setStatus] = useState<Exclude<SmartLogStatus, 'idle'>>('loading');
  const [data, setData] = useState<api.SmartLogData>({ enabled: false, links: [], rules: [], review: [], recent: [] });
  const [permission, setPermission] = useState(() => SmartLogNative?.hasPermission() ?? false);
  const [held, setHeld] = useState(0);
  const busy = useRef(false);
  const alive = useRef(true);
  const dataRef = useRef(data);
  const txIds = useRef(new Set<string>());
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    txIds.current = new Set(state.transactions.map((x) => x.id));
  }, [state.transactions]);
  const active = !!userId && state.status === 'ready' && state.onboarded && !state.suspended;
  const status: SmartLogStatus = active ? loadStatus : 'idle';

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [next, nextHeld] = await Promise.all([api.loadSmartLog(userId), readHeld(userId)]);
      if (!alive.current) return;
      setData(next);
      setHeld(nextHeld.length);
      setStatus('ready');
    } catch {
      if (alive.current) setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [userId]);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  // Coba lagi dari layar gagal: tampilkan skeleton lagi selama memuat.
  const reload = useCallback(async () => {
    setStatus((s) => (s === 'error' ? 'loading' : s));
    await load();
  }, [load]);

  // Keluar atau ditangguhkan: berhenti menangkap dan buang antrean supaya tidak terbawa ke akun lain di HP yang sama.
  useEffect(() => {
    if ((sessionReady && !session) || state.suspended) {
      SmartLogNative?.configure(false, []);
      if (userId) AsyncStorage.removeItem(heldKey(userId)).catch(() => undefined);
    }
  }, [sessionReady, session, state.suspended, userId]);

  // Listener native hanya menyimpan notifikasi dari aplikasi yang ditautkan, dan hanya saat Smart Log ON.
  // Dipanggil setelah data server dimuat: configure(false) mengosongkan antrean, jangan dipicu nilai awal.
  useEffect(() => {
    if (status !== 'ready') return;
    SmartLogNative?.configure(data.enabled, data.enabled ? data.links.map((l) => l.pkg) : []);
  }, [status, data.enabled, data.links]);

  const undo = useCallback(
    async (id: string) => {
      try {
        await api.undo(id);
        applyLocal({ type: 'tx/delete', id });
        setData((d) => ({ ...d, recent: d.recent.filter((r) => r.id !== id) }));
        show({ tone: 'success', title: t('slog.review.undone') });
      } catch {
        show({ tone: 'error', title: t('slog.review.failed') });
      }
    },
    [applyLocal, show, t],
  );
  const undoRef = useRef(undo);
  useEffect(() => {
    undoRef.current = undo;
  }, [undo]);

  const announce = useCallback(
    (sum: ProcessSummary) => {
      const n = sum.applied.length;
      if (sum.quotaHit) {
        show({ tone: 'warning', title: t('slog.toast.quotaTitle'), message: t('slog.toast.quotaMessage'), actions: [{ label: t('slog.toast.premium'), onPress: () => router.push('/premium') }] });
      } else if (n === 1 && sum.review === 0) {
        const a = sum.applied[0]!;
        const bank = getBank(a.bank).name;
        show({
          tone: 'success',
          title: t('slog.toast.recordedTitle', { amount: formatMoney(a.amount, a.currency) }),
          message: a.merchant ? `${a.merchant} · ${bank}` : bank,
          actions: [
            { label: t('slog.toast.undo'), onPress: () => void undoRef.current(a.id) },
            { label: t('slog.toast.edit'), onPress: () => router.push({ pathname: '/tambah', params: { id: a.id } }) },
          ],
        });
      } else if (n > 0 && sum.review > 0) {
        show({ tone: 'info', title: t('slog.toast.mixed', { applied: n, review: sum.review }), actions: [{ label: t('slog.toast.check'), onPress: () => router.push('/otomasi/tinjau') }] });
      } else if (n > 1) {
        show({ tone: 'success', title: t('slog.toast.recordedMany', { count: n }), actions: [{ label: t('slog.toast.view'), onPress: () => router.push('/otomasi/tinjau') }] });
      } else if (sum.review > 0) {
        show({ tone: 'info', title: t('slog.toast.needsCheck', { count: sum.review }), actions: [{ label: t('slog.toast.check'), onPress: () => router.push('/otomasi/tinjau') }] });
      }
    },
    [show, t],
  );

  const processNow = useCallback(async () => {
    if (!active || !userId || busy.current || !dataRef.current.enabled) return;
    busy.current = true;
    const owner = userId;
    try {
      const fresh = drainNative();
      const previous = await readHeld(owner);
      if (!alive.current || (!fresh.length && !previous.length)) return;
      const seen = new Set<string>();
      const captures = [...previous, ...fresh].filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));
      await saveHeld(owner, captures);
      const sum = await processCaptures(captures, api.ingest);
      if (!alive.current) return;
      if (!(await saveHeld(owner, sum.held)) && alive.current) show({ tone: 'error', title: t('slog.toast.saveFailed') });
      if (!alive.current) return;
      setHeld(sum.held.length);
      if (sum.applied.length || sum.review) {
        const next = await api.loadSmartLog(owner);
        if (!alive.current) return;
        setData(next);
        for (const a of sum.applied) {
          const item = next.recent.find((r) => r.id === a.id);
          if (item && !txIds.current.has(item.id)) {
            const tx = api.appliedTx(item, a);
            applyLocal({ type: 'tx/add', tx: tx.merchant ? tx : { ...tx, merchant: getBank(item.bank).name } });
          }
        }
      }
      refreshUsage();
      announce(sum);
    } catch {
      // Gagal memuat ulang daftar: tangkapan sudah tersimpan di server atau ditahan, dicoba lagi nanti.
    } finally {
      busy.current = false;
    }
  }, [active, userId, applyLocal, refreshUsage, announce, show, t]);


  // Aplikasi kembali aktif: izin bisa berubah di Pengaturan Android, dan antrean perlu dikuras.
  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      setPermission(SmartLogNative?.hasPermission() ?? false);
      void processNow();
    });
    return () => sub.remove();
  }, [active, processNow]);

  // Saat dibuka: proses yang tertangkap selama aplikasi tertutup, setelah pengaturan dari server dimuat.
  useEffect(() => {
    if (!(active && status === 'ready' && data.enabled)) return;
    const id = setTimeout(() => void processNow(), 0);
    return () => clearTimeout(id);
  }, [active, status, data.enabled, processNow]);

  // Notifikasi masuk saat aplikasi terbuka: tunggu sebentar supaya beberapa notifikasi diproses sekaligus.
  useEffect(() => {
    if (!active || !SmartLogNative) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = SmartLogNative.addListener('onCapture', () => {
      clearTimeout(timer);
      timer = setTimeout(() => void processNow(), 1500);
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [active, processNow]);

  const setEnabled = useCallback(
    async (value: boolean) => {
      if (!userId) return;
      setData((d) => ({ ...d, enabled: value }));
      try {
        await api.setEnabled(userId, value);
      } catch (e) {
        setData((d) => ({ ...d, enabled: !value }));
        throw e;
      }
    },
    [userId],
  );

  const setLink = useCallback(async (pkg: string, accountId: string | null) => {
    const before = dataRef.current.links;
    const links = accountId ? [...before.filter((l) => l.pkg !== pkg), { pkg, accountId }] : before.filter((l) => l.pkg !== pkg);
    setData((d) => ({ ...d, links }));
    try {
      if (accountId) await api.setLink(pkg, accountId);
      else await api.removeLink(pkg);
    } catch (e) {
      setData((d) => ({ ...d, links: before }));
      throw e;
    }
  }, []);

  const saveRule = useCallback(async (input: SmartLogRuleInput) => {
    const saved = await api.saveRule(input);
    const key = saved.pattern.trim().toLowerCase();
    setData((d) => ({
      ...d,
      rules: [saved, ...d.rules.filter((r) => r.id !== saved.id && r.pattern.trim().toLowerCase() !== key)],
    }));
  }, []);

  const removeRule = useCallback(async (id: string) => {
    const before = dataRef.current.rules;
    setData((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== id) }));
    try {
      await api.removeRule(id);
    } catch (e) {
      setData((d) => ({ ...d, rules: before }));
      throw e;
    }
  }, []);

  const confirm = useCallback(
    async (item: api.SmartLogItem, tx: Transaction) => {
      // Percobaan ulang setelah transaksi tersimpan tapi konfirmasi gagal: jangan simpan transaksinya lagi.
      if (!txIds.current.has(item.id)) await commitTx({ ...tx, id: item.id, source: 'smartlog' });
      await api.confirm(item.id);
      setData((d) => ({ ...d, review: d.review.filter((r) => r.id !== item.id) }));
    },
    [commitTx],
  );

  const dismiss = useCallback(async (item: api.SmartLogItem) => {
    await api.dismiss(item.id);
    setData((d) => ({ ...d, review: d.review.filter((r) => r.id !== item.id) }));
  }, []);

  const openPermission = useCallback(() => SmartLogNative?.openPermissionSettings(), []);

  const value = useMemo<SmartLogValue>(
    () => ({
      supported, status, enabled: data.enabled, permission, links: data.links, rules: data.rules, review: data.review, recent: data.recent, held,
      reload, setEnabled, openPermission, setLink, saveRule, removeRule, processNow, confirm, dismiss, undo,
    }),
    [supported, status, data, permission, held, reload, setEnabled, openPermission, setLink, saveRule, removeRule, processNow, confirm, dismiss, undo],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSmartLog(): SmartLogValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSmartLog harus dipakai di dalam <SmartLogProvider>');
  return v;
}

export function useSmartLogOptional(): SmartLogValue | null {
  return useContext(Ctx);
}
