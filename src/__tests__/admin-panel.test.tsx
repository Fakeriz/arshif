import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AdminScreen from '@/app/admin';
import { ToastProvider } from '@/components/ui';
import * as remoteApi from '@/data/remote/api';
import * as remoteFunctions from '@/data/remote/functions';
import * as adminApi from '@/features/admin/adminApi';
import { CommandPalette } from '@/features/admin/CommandPalette';
import { copy } from '@/features/admin/copy';
import { DashboardSection } from '@/features/admin/Dashboard';
import { addDaysIso, daysRemaining, formatRate, msLabel, pct } from '@/features/admin/format';
import { AiSection, OrdersSection } from '@/features/admin/Logs';
import { BroadcastSection, FxSection } from '@/features/admin/Ops';
import { UsersSection } from '@/features/admin/Users';
import { I18nProvider } from '@/i18n';
import * as sessionMod from '@/state/session';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPush = jest.fn();
const mockSetParams = jest.fn();
let mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>{`REDIRECT:${href}`}</Text>;
  },
  useRouter: () => ({ push: mockPush, setParams: mockSetParams, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/theme/viewTransition', () => ({
  withThemeTransition: (fn: () => void) => fn(),
}));

const wrap = (ui: ReactNode) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 1200, height: 900 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="light">
          <ToastProvider>{ui}</ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );

const sampleDashboard: remoteApi.AdminDashboard = {
  today: '2026-11-27',
  total_users: 120,
  new_today: 4,
  dau: 28,
  dau_7: [
    { day: '2026-11-21', users: 14 },
    { day: '2026-11-22', users: 19 },
    { day: '2026-11-23', users: 21 },
    { day: '2026-11-24', users: 18 },
    { day: '2026-11-25', users: 24 },
    { day: '2026-11-26', users: 22 },
    { day: '2026-11-27', users: 28 },
  ],
  premium_users: 18,
  premium_by_source: { store: 8, web: 6, manual: 4 },
  suspended_users: 1,
  ai_today: {
    scan: { total: 42, failed: 2 },
    voice: { total: 15, failed: 0 },
  },
  revenue_month: { IDR: 150000 },
  paid_orders_month: 6,
};

const sampleOps: adminApi.AdminOpsOverview = {
  today: '2026-11-27',
  onboarded_users: 96,
  dau_30: Array.from({ length: 30 }, (_, i) => ({
    day: `2026-11-${String(Math.max(1, i + 1)).padStart(2, '0')}`,
    users: 10 + (i % 15),
  })),
  currencies: { IDR: 100, MYR: 15, TRY: 5 },
  langs: { id: 102, ms: 12, en: 6 },
  asset_runs: [
    {
      ran_at: '2026-11-27T13:30:00Z',
      trigger: 'admin',
      ok: true,
      source: 'yahoo-idx',
      symbols: 20,
      updated: 20,
      failed_count: 0,
      failed_sample: [],
      error: null,
      duration_ms: 420,
    },
  ],
  webhooks_7d: { xendit: 4, revenuecat: 7 },
  stuck_orders: 1,
  recent_broadcasts: [
    {
      sent_at: '2026-11-27T10:00:00Z',
      title: 'Pemeliharaan singkat',
      message: 'Sistem sudah normal kembali.',
      recipients: 45,
    },
  ],
};

const sampleFxStatus: remoteApi.AdminFxStatus = {
  latest_rate_date: '2026-11-27',
  latest_fetched_at: '2026-11-27T12:00:00Z',
  codes: 31,
  runs: [
    {
      ran_at: new Date().toISOString(),
      trigger: 'admin',
      ok: true,
      rate_date: '2026-11-27',
      codes: 31,
      error: null,
    },
  ],
};

const sampleUsers: remoteApi.AdminUserRow[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'pro@arshif.test',
    display_name: 'Nadia Pro',
    plan: 'premium',
    premium_until: '2026-12-27T00:00:00Z',
    premium_source: 'manual',
    suspended_at: null,
    last_seen_at: '2026-11-27T13:00:00Z',
    created_at: '2026-10-01T00:00:00Z',
    is_admin: false,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'free@arshif.test',
    display_name: 'Budi Free',
    plan: 'free',
    premium_until: null,
    premium_source: null,
    suspended_at: '2026-11-20T00:00:00Z',
    last_seen_at: '2026-11-19T12:00:00Z',
    created_at: '2026-11-01T00:00:00Z',
    is_admin: false,
  },
];

const sampleUserDetail: remoteApi.AdminUserDetail = {
  ...sampleUsers[0],
  onboarded: true,
  main_currency: 'IDR',
  lang: 'id',
  usage: [
    { key: 'scan', used: 12, limit: 300, window: 'month' },
    { key: 'accounts', used: 3, limit: null, window: 'total' },
    { key: 'pdfExport', used: 0, limit: null, window: 'feature' },
  ],
  orders: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      provider: 'manual',
      period: 'custom',
      status: 'paid',
      days: 30,
      currency: 'IDR',
      amount: 0,
      created_at: '2026-11-01T00:00:00Z',
      granted_until: '2027-01-01T00:00:00Z',
    },
  ],
  ai_30d: { scan: 12, coach: 5 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  jest.replaceProperty(Platform, 'OS', 'web');
  if (typeof globalThis.window === 'object' && globalThis.window !== null) {
    Object.assign(globalThis.window, {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Admin copy hygiene & formatters', () => {
  it('copy.ts bebas dari karakter em dash (U+2014) dan buzzword AI', () => {
    const strings: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === 'string') {
        strings.push(v);
      } else if (typeof v === 'function') {
        const out = (v as (...args: unknown[]) => unknown)('contoh', 10, '27 Nov 2026');
        if (typeof out === 'string') strings.push(out);
      } else if (Array.isArray(v)) {
        v.forEach(walk);
      } else if (v && typeof v === 'object') {
        Object.values(v).forEach(walk);
      }
    };
    walk(copy);
    expect(strings.length).toBeGreaterThan(50);
    for (const s of strings) {
      expect(s).not.toContain('\u2014');
      expect(s.toLowerCase()).not.toMatch(/ai-powered|revolutionary|game-changer|next-gen/);
    }
  });

  it('format helpers dan CSV builder memformat data operasional secara akurat', () => {
    expect(pct(0.124)).toBe('12,4%');
    expect(pct(null)).toBe('-');
    expect(msLabel(340)).toBe('340 md');
    expect(msLabel(1450)).toBe('1,5 dtk');
    expect(formatRate(16250.5)).toBe('16.250,5');
    const now = Date.parse('2026-11-27T00:00:00Z');
    expect(daysRemaining('2026-12-04T00:00:00Z', now)).toBe(7);
    expect(daysRemaining('2026-11-20T00:00:00Z', now)).toBe(0);
    expect(addDaysIso('2026-12-04T00:00:00Z', 7, now)).toBe('2026-12-11T00:00:00.000Z');
    expect(addDaysIso(null, 7, now)).toBe('2026-12-04T00:00:00.000Z');

    const csv = adminApi.buildCsv(['email', 'note'], [['a@b.com', 'halo, "dunia"']]);
    expect(csv.startsWith('\uFEFFemail,note\r\n')).toBe(true);
    expect(csv).toContain('"halo, ""dunia"""');
  });

  it('probeSystemHealth mengembalikan status ready saat server merespons dan unreachable saat gagal jaringan', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, status: 'ready', service: 'health', db: 'ok', env: 'ok', minClientVersion: '1.0.0', ts: '2026-11-27T12:00:00Z' }),
      } as Response)
      .mockRejectedValueOnce(new Error('offline'));

    const okRes = await adminApi.probeSystemHealth();
    expect(okRes.status).toBe('ready');
    expect(okRes.db).toBe('ok');
    expect(okRes.minClientVersion).toBe('1.0.0');

    const failRes = await adminApi.probeSystemHealth();
    expect(failRes.ok).toBe(false);
    expect(failRes.status).toBe('unreachable');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('AdminScreen gate & platform guard', () => {
  it('mengarahkan ulang ke / di platform native (non-web)', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await wrap(<AdminScreen />);
    expect(screen.getByText('REDIRECT:/')).toBeTruthy();
  });

  it('menampilkan ajakan masuk saat belum login', async () => {
    jest.spyOn(sessionMod, 'useSession').mockReturnValue({ session: null, ready: true, setSession: jest.fn() } as unknown as ReturnType<typeof sessionMod.useSession>);
    await wrap(<AdminScreen />);
    expect(await screen.findByText('Masuk untuk membuka panel admin')).toBeTruthy();
    expect(screen.getByText('Masuk dengan email')).toBeTruthy();
  });

  it('menolak akun non-admin dan tidak menampilkan dasbor', async () => {
    jest.spyOn(sessionMod, 'useSession').mockReturnValue({
      session: { user: { id: 'u1', email: 'user@arshif.test' } },
      ready: true,
      setSession: jest.fn(),
    } as unknown as ReturnType<typeof sessionMod.useSession>);
    jest.spyOn(remoteApi, 'isAdmin').mockResolvedValue(false);

    await wrap(<AdminScreen />);
    expect(await screen.findByText('Akun ini bukan admin')).toBeTruthy();
    expect(screen.queryByText('Pengguna aktif hari ini')).toBeNull();
  });
});

describe('DashboardSection', () => {
  it('merender HeroInkPanel DAU, KPI, AI, Pendapatan, kesehatan sistem, dan pilihan hari grafik', async () => {
    jest.spyOn(remoteApi, 'adminDashboard').mockResolvedValue(sampleDashboard);
    jest.spyOn(adminApi, 'fetchAdminOpsOverview').mockResolvedValue(sampleOps);
    jest.spyOn(remoteApi, 'adminFxStatus').mockResolvedValue(sampleFxStatus);
    const onNavigate = jest.fn();

    await wrap(
      <DashboardSection
        onNavigate={onNavigate}
        health={{ ok: true, status: 'ready', db: 'ok', env: 'ok', minClientVersion: '1.0.0', rttMs: 64 }}
      />,
    );

    expect(await screen.findByText('Pengguna aktif hari ini')).toBeTruthy();
    expect(screen.getByText('Aktif 7 hari terakhir')).toBeTruthy();
    expect(screen.getByText('Total pengguna')).toBeTruthy();
    expect(screen.getByText('Pengguna Pro')).toBeTruthy();
    expect(screen.getByText('Pemakaian AI hari ini')).toBeTruthy();
    expect(screen.getByText('Estimasi pendapatan bulan ini')).toBeTruthy();
    expect(screen.getByText('Server siap · 64 md')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('21 Nov 2026: 14'));
    expect(screen.getByText('21 Nov 2026: 14 pengguna aktif')).toBeTruthy();
  });

  it('tetap berjalan mulus ketika admin_ops_overview mengembalikan null (migrasi belum aktif)', async () => {
    jest.spyOn(remoteApi, 'adminDashboard').mockResolvedValue(sampleDashboard);
    jest.spyOn(adminApi, 'fetchAdminOpsOverview').mockResolvedValue(null);
    jest.spyOn(remoteApi, 'adminFxStatus').mockResolvedValue(sampleFxStatus);

    await wrap(<DashboardSection health={{ ok: true, status: 'ready', db: 'ok', rttMs: 50 }} />);

    expect(await screen.findByText('Pengguna aktif hari ini')).toBeTruthy();
    expect(screen.getByText('Belum ada log sinkron harga aset.')).toBeTruthy();
  });
});

describe('UsersSection', () => {
  it('memfilter kohort, membuka detail pengguna, memakai preset 7 hari, grant Pro, dan loncat ke Broadcast', async () => {
    jest.spyOn(adminApi, 'searchAdminUsers').mockResolvedValue(sampleUsers);
    jest.spyOn(remoteApi, 'adminUserDetail').mockResolvedValue(sampleUserDetail);
    const invokeSpy = jest.spyOn(remoteFunctions, 'invokeFn').mockResolvedValue({
      plan: 'premium',
      premiumUntil: '2027-01-03T00:00:00Z',
      suspendedAt: null,
      revenueCat: false,
    });
    const onNavigate = jest.fn();

    await wrap(<UsersSection onNavigate={onNavigate} />);

    expect(await screen.findByText('pro@arshif.test')).toBeTruthy();
    expect(screen.getByText('free@arshif.test')).toBeTruthy();

    // Filter kohort Pro -> sembunyikan pengguna Free
    await fireEvent.press(screen.getByLabelText('Pro, 1'));
    expect(screen.queryByText('free@arshif.test')).toBeNull();

    // Pilih pengguna Pro -> tampil detail + kuota
    await fireEvent.press(screen.getByLabelText('pro@arshif.test'));
    expect(await screen.findByText('Kuota periode ini')).toBeTruthy();
    expect(screen.getByText('Scan struk')).toBeTruthy();

    // Klik preset 7 hari -> tombol berubah jadi Beri Pro 7 hari
    await fireEvent.press(screen.getByLabelText('7 hari'));
    await fireEvent.press(screen.getByLabelText('Beri Pro 7 hari'));

    await waitFor(() => expect(invokeSpy).toHaveBeenCalledWith('admin-user', { action: 'grant', userId: sampleUsers[0].id, days: 7 }, expect.anything()));
    expect(await screen.findByText(/Pro aktif sampai 3 Jan 2027/)).toBeTruthy();

    // Kirim pesan loncat ke Broadcast dengan email pengguna
    await fireEvent.press(screen.getByLabelText('Kirim pesan'));
    expect(onNavigate).toHaveBeenCalledWith({ bagian: 'broadcast', email: 'pro@arshif.test' });
  });
});

describe('AiSection & OrdersSection', () => {
  it('AiSection merender ringkasan SLO, 4 layanan, filter kegagalan, dan tautan pengguna', async () => {
    jest.spyOn(remoteApi, 'adminAiUsage').mockResolvedValue([
      { kind: 'scan', total: 50, ok: 47, failed: 3, limited: 0, fail_ratio: 0.06, avg_latency_ms: 1200, p95_latency_ms: 2800 },
      { kind: 'voice', total: 20, ok: 20, failed: 0, limited: 0, fail_ratio: 0, avg_latency_ms: 850, p95_latency_ms: 1400 },
    ]);
    jest.spyOn(adminApi, 'fetchAdminAiFailures').mockResolvedValue([
      { created_at: '2026-11-27T11:00:00Z', kind: 'scan', email: 'pro@arshif.test', error: 'unreadable', latency_ms: 920 },
      { created_at: '2026-11-27T10:00:00Z', kind: 'coach', email: 'free@arshif.test', error: 'ai_failed', latency_ms: 1500 },
    ]);
    const onNavigate = jest.fn();

    await wrap(<AiSection onNavigate={onNavigate} />);

    expect((await screen.findAllByText('Scan struk (OCR)')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Voice Log').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Import PDF').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tanya Coach').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rasio gagal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Latensi rata-rata').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByLabelText('Scan'));
    expect(screen.queryByText('ai_failed')).toBeNull();
    expect(screen.queryByLabelText('Lihat pengguna: free@arshif.test')).toBeNull();
    expect(screen.getAllByText('unreadable').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByLabelText('Lihat pengguna: pro@arshif.test'));
    expect(onNavigate).toHaveBeenCalledWith({ bagian: 'pengguna', q: 'pro@arshif.test' });
  });

  it('OrdersSection menampilkan peringatan konfigurasi, filter penyedia, dan sorotan grant bermasalah', async () => {
    jest.spyOn(adminApi, 'fetchAdminOrders').mockResolvedValue([
      {
        id: 'ord-1111-2222',
        user_id: 'u1',
        email: 'pro@arshif.test',
        provider: 'xendit',
        period: 'monthly',
        currency: 'IDR',
        amount: 25000,
        method: 'qris',
        status: 'paid',
        created_at: '2026-11-27T09:00:00Z',
        paid_at: '2026-11-27T09:05:00Z',
        granted_until: null,
        grant_error: 'rc_timeout',
      },
      {
        id: 'ord-3333-4444',
        user_id: 'u2',
        email: 'free@arshif.test',
        provider: 'manual',
        period: 'custom',
        currency: 'IDR',
        amount: 0,
        method: null,
        status: 'paid',
        created_at: '2026-11-26T09:00:00Z',
        paid_at: null,
        granted_until: '2026-12-26T00:00:00Z',
        grant_error: null,
      },
    ]);

    await wrap(<OrdersSection />);

    expect(await screen.findByText(/Kunci Xendit dan Paddle belum diisi/)).toBeTruthy();
    expect(screen.getByText('Grant bermasalah: rc_timeout')).toBeTruthy();
    expect(screen.getByText('1 grant tertahan')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Grant manual'));
    expect(screen.queryByText('Grant bermasalah: rc_timeout')).toBeNull();
    expect(screen.getByText('free@arshif.test')).toBeTruthy();
  });
});

describe('FxSection & BroadcastSection', () => {
  it('FxSection menampilkan tabel kurs koridor, harga aset live, dan menjalankan sinkron FX & aset', async () => {
    jest.spyOn(remoteApi, 'adminFxStatus').mockResolvedValue(sampleFxStatus);
    jest.spyOn(adminApi, 'fetchLatestFxRates').mockResolvedValue([
      { rate_date: '2026-11-27', code: 'IDR', per_usd: 16000, source: 'frankfurter', fetched_at: '2026-11-27T12:00:00Z' },
      { rate_date: '2026-11-27', code: 'MYR', per_usd: 4, source: 'frankfurter', fetched_at: '2026-11-27T12:00:00Z' },
    ]);
    jest.spyOn(adminApi, 'fetchLiveAssetPrices').mockResolvedValue([
      { symbol: 'IDX:BBCA', price: 9850, currency: 'IDR', source: 'yahoo-idx', fetched_at: '2026-11-27T12:00:00Z', quoted_at: '2026-11-27T11:50:00Z' },
      { symbol: 'CRYPTO:BTC', price: 95000, currency: 'USD', source: 'coingecko', fetched_at: '2026-11-27T12:00:00Z', quoted_at: null },
    ]);
    jest.spyOn(adminApi, 'fetchAdminOpsOverview').mockResolvedValue(sampleOps);
    jest.spyOn(remoteFunctions, 'invokeFn').mockResolvedValue({ date: '2026-11-27', codes: 31, backfilledDays: 0 });
    jest.spyOn(adminApi, 'triggerAssetPricesSync').mockResolvedValue({
      symbols: 2,
      updated: 2,
      failed: [],
      providers: [{ source: 'yahoo-idx', symbols: 1, updated: 1, error: null, ms: 210 }],
    });

    await wrap(<FxSection />);

    expect(await screen.findByText('Sinkronisasi terakhir')).toBeTruthy();
    expect(screen.getByText('1 MYR = Rp 4.000')).toBeTruthy();
    expect(screen.getByText('IDX:BBCA')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Sinkronkan sekarang'));
    expect(await screen.findByText(/Sinkron selesai/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Sinkronkan harga aset'));
    expect(await screen.findByText(/Sinkron harga aset selesai: 2\/2 simbol diperbarui/)).toBeTruthy();
  });

  it('BroadcastSection menerapkan templat cepat, memperbarui pratinjau InkCard, dan mengirim ke satu email', async () => {
    jest.useFakeTimers();
    jest.spyOn(adminApi, 'fetchAdminOpsOverview').mockResolvedValue(sampleOps);
    jest.spyOn(remoteApi, 'adminBroadcastCount').mockResolvedValue(1);
    const sendSpy = jest.spyOn(remoteApi, 'adminBroadcast').mockResolvedValue(1);

    await wrap(<BroadcastSection />);

    // Templat cepat memperbarui judul, isi, dan pratinjau InkCard
    await fireEvent.press(screen.getByLabelText('Pemeliharaan terjadwal'));
    expect(screen.getByText('Pemeliharaan sistem singkat')).toBeTruthy();

    // Isi satu email & tunggu hitung penerima
    await fireEvent.changeText(screen.getByLabelText('Email penerima'), 'e2e@arshif.test');
    await act(async () => {
      jest.advanceTimersByTime(350);
    });
    expect(await screen.findAllByText('1 penerima')).toBeTruthy();

    // Klik kirim lalu konfirmasi dialog
    await fireEvent.press(screen.getByLabelText('Kirim ke 1 penerima'));
    const confirmBtns = await screen.findAllByLabelText('Kirim ke 1 penerima');
    await fireEvent.press(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => expect(sendSpy).toHaveBeenCalledWith('email', 'Pemeliharaan sistem singkat', expect.any(String), 'e2e@arshif.test'));
    expect(await screen.findByText('Terkirim ke 1 penerima.')).toBeTruthy();
    jest.useRealTimers();
  });
});

describe('CommandPalette', () => {
  it('mencari pengguna secara langsung dan melompat ke detail pengguna terpilih', async () => {
    jest.useFakeTimers();
    jest.spyOn(adminApi, 'searchAdminUsers').mockResolvedValue([sampleUsers[0]]);
    const onNavigate = jest.fn();
    const onClose = jest.fn();

    await wrap(
      <CommandPalette
        visible
        onClose={onClose}
        activeSection="dasbor"
        onNavigate={onNavigate}
        onCheckHealth={jest.fn()}
        onSyncFx={jest.fn()}
        onSyncAssets={jest.fn()}
        onChangeTheme={jest.fn()}
        onOpenApp={jest.fn()}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText('Perintah cepat'), 'pro@arshif');
    await act(async () => {
      jest.advanceTimersByTime(260);
    });

    const userRow = await screen.findByLabelText('pro@arshif.test');
    await fireEvent.press(userRow);
    expect(onNavigate).toHaveBeenCalledWith({
      bagian: 'pengguna',
      uid: sampleUsers[0].id,
      q: 'pro@arshif.test',
    });
    expect(onClose).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
