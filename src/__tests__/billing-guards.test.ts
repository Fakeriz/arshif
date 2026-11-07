/// <reference path="../../supabase/functions/deno.d.ts" />
/**
 * Kabel Edge Functions untuk audit 6, 10, 11 (logika SQL-nya diuji di scripts/db-test.mjs):
 * runAiJob memakai ai_job_start, syncPlan memakai tiket berurutan, webhook memakai klaim yang bisa pulih.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { deleteAccount } from '../../supabase/functions/_shared/account.ts';
import { adminGrant } from '../../supabase/functions/_shared/admin-grant.ts';
import { grantOrder, handleEventOnce, refundOrder, syncPlan, type OrderRow } from '../../supabase/functions/_shared/entitlement.ts';
import { runAiJob } from '../../supabase/functions/_shared/guard.ts';
import { HttpError } from '../../supabase/functions/_shared/http.ts';

type Res = { data: unknown; error: unknown };
type Call = { kind: 'rpc' | 'from'; name: string; method?: string; args: unknown[] };

/** Klien Supabase palsu: rpc per nama fungsi, query builder yang bisa di-await per tabel. */
/** Tabel bisa berupa fungsi yang menerima rantai metode query (mis. ['insert','select','single']) untuk jawaban per query. */
type Table = Res | ((chain: string[]) => Res);

function fakeDb(rpc: Record<string, (args: Record<string, unknown>) => Res>, tables: Record<string, Table> = {}, extra: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const builder = (table: string, chain: string[] = []): unknown =>
    new Proxy(
      {},
      {
        get(_, prop: string) {
          if (prop === 'then') {
            const t = tables[table];
            return (resolve: (r: Res) => void) => resolve((typeof t === 'function' ? t(chain) : t) ?? { data: null, error: null });
          }
          return (...args: unknown[]) => {
            calls.push({ kind: 'from', name: table, method: prop, args });
            return builder(table, [...chain, prop]);
          };
        },
      },
    );
  const db = {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      calls.push({ kind: 'rpc', name, args: [args] });
      return rpc[name]?.(args) ?? { data: null, error: null };
    },
    from: (table: string) => builder(table),
    ...extra,
  };
  return { db: db as unknown as SupabaseClient, calls };
}

beforeAll(() => {
  // Modul Edge Functions membaca env lewat Deno.env; tanpa kunci RevenueCat, paket diambil dari tabel orders.
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: () => undefined } };
});

describe('runAiJob (audit 6)', () => {
  it('ai_job_start menolak (batas per menit): 429, AI tidak dipanggil', async () => {
    const { db } = fakeDb({ ai_job_start: () => ({ data: null, error: null }) });
    const work = jest.fn();
    await expect(runAiJob(db, 'u1', 'coach', 'coachNarration', work)).rejects.toMatchObject({ code: 'rate_limited', status: 429 });
    expect(work).not.toHaveBeenCalled();
  });

  it('kuota habis: 402 quota, baris job ditutup sebagai limited', async () => {
    const { db, calls } = fakeDb({ ai_job_start: () => ({ data: 'job-1', error: null }), quota_try_consume: () => ({ data: false, error: null }) });
    const work = jest.fn();
    await expect(runAiJob(db, 'u1', 'coach', 'coachNarration', work)).rejects.toMatchObject({ code: 'quota', status: 402, extra: { quotaKey: 'coachNarration' } });
    expect(work).not.toHaveBeenCalled();
    expect(calls).toContainEqual(expect.objectContaining({ name: 'ai_jobs', method: 'update', args: [expect.objectContaining({ status: 'limited', error: 'quota_coachNarration' })] }));
    expect(calls).toContainEqual(expect.objectContaining({ name: 'ai_jobs', method: 'eq', args: ['id', 'job-1'] }));
  });

  it('berhasil: baris started yang sama ditutup ok; gagal: kuota dikembalikan, ditutup failed', async () => {
    const ok = fakeDb({ ai_job_start: () => ({ data: 'job-2', error: null }), quota_try_consume: () => ({ data: true, error: null }) });
    await expect(runAiJob(ok.db, 'u1', 'coach', 'coachNarration', async () => 'narasi')).resolves.toBe('narasi');
    expect(ok.calls).toContainEqual(expect.objectContaining({ name: 'ai_jobs', method: 'update', args: [expect.objectContaining({ status: 'ok' })] }));
    // Tidak ada insert baris kedua: hitungan rate limit memakai baris dari ai_job_start.
    expect(ok.calls.some((c) => c.name === 'ai_jobs' && c.method === 'insert')).toBe(false);

    const bad = fakeDb({ ai_job_start: () => ({ data: 'job-3', error: null }), quota_try_consume: () => ({ data: true, error: null }) });
    await expect(runAiJob(bad.db, 'u1', 'coach', 'coachNarration', async () => Promise.reject(new HttpError('ai_failed', 502)))).rejects.toMatchObject({ code: 'ai_failed' });
    expect(bad.calls).toContainEqual(expect.objectContaining({ kind: 'rpc', name: 'quota_refund', args: [{ p_user: 'u1', p_key: 'coachNarration' }] }));
    expect(bad.calls).toContainEqual(expect.objectContaining({ name: 'ai_jobs', method: 'update', args: [expect.objectContaining({ status: 'failed', error: 'ai_failed' })] }));
  });
});

describe('syncPlan (audit 10)', () => {
  it('tiket diambil sebelum membaca status; sinkron lebih baru sudah menulis = kembalikan yang tersimpan', async () => {
    const { db, calls } = fakeDb(
      {
        plan_sync_ticket: () => ({ data: 7, error: null }),
        plan_sync_apply: () => ({ data: [{ o_plan: 'premium', o_premium_until: '2026-12-07T00:00:00.000Z', o_applied: false }], error: null }),
      },
      { orders: { data: null, error: null } },
    );
    // Bacaan basi (tidak ada pesanan aktif) ingin menulis free, tapi renewal dengan tiket lebih baru sudah menang.
    await expect(syncPlan(db, 'u1')).resolves.toEqual({ plan: 'premium', premiumUntil: '2026-12-07T00:00:00.000Z' });
    const ticketAt = calls.findIndex((c) => c.name === 'plan_sync_ticket');
    const readAt = calls.findIndex((c) => c.name === 'orders');
    expect(ticketAt).toBeGreaterThanOrEqual(0);
    expect(ticketAt).toBeLessThan(readAt);
    expect(calls).toContainEqual(expect.objectContaining({ name: 'plan_sync_apply', args: [{ p_user: 'u1', p_ticket: 7, p_plan: 'free', p_until: null, p_source: null }] }));
    // Profil tidak lagi ditulis langsung (tanpa tiket).
    expect(calls.some((c) => c.name === 'profiles' && c.method === 'update')).toBe(false);
  });
});

describe('handleEventOnce (audit 11)', () => {
  const ok = () => new Response(JSON.stringify({ ok: true }));

  it('klaim ditolak (selesai atau masih diproses): jawab duplikat, pekerjaan tidak dijalankan', async () => {
    const { db } = fakeDb({ webhook_claim: () => ({ data: false, error: null }) });
    const work = jest.fn(async () => ok());
    const res = await handleEventOnce(db, 'xendit', 'inv-1:PAID', work);
    expect(await res.json()).toEqual({ ok: true, duplicate: true });
    expect(work).not.toHaveBeenCalled();
  });

  it('berhasil: ditandai selesai (webhook_done) setelah pekerjaan, bukan sebelumnya', async () => {
    const { db, calls } = fakeDb({ webhook_claim: () => ({ data: true, error: null }) });
    const work = jest.fn(async () => {
      expect(calls.some((c) => c.name === 'webhook_done')).toBe(false);
      return ok();
    });
    await handleEventOnce(db, 'paddle', 'evt-1', work);
    expect(work).toHaveBeenCalledTimes(1);
    expect(calls).toContainEqual(expect.objectContaining({ kind: 'rpc', name: 'webhook_done', args: [{ p_provider: 'paddle', p_event: 'evt-1' }] }));
  });

  it('gagal: klaim yang belum selesai dilepas supaya kiriman ulang diproses, error diteruskan', async () => {
    const { db, calls } = fakeDb({ webhook_claim: () => ({ data: true, error: null }) });
    await expect(handleEventOnce(db, 'revenuecat', 'evt-2', async () => Promise.reject(new Error('db_down')))).rejects.toThrow('db_down');
    expect(calls).toContainEqual(expect.objectContaining({ name: 'webhook_events', method: 'delete' }));
    expect(calls).toContainEqual(expect.objectContaining({ name: 'webhook_events', method: 'is', args: ['processed_at', null] }));
    expect(calls.some((c) => c.name === 'webhook_done')).toBe(false);
  });
});

describe('hapus akun (audit 8)', () => {
  /** auth + storage palsu yang mencatat urutan panggilan. */
  function accountDb(opts: { deleteError?: boolean; listError?: boolean } = {}) {
    const steps: string[] = [];
    const files: Record<string, string[]> = { receipts: ['a.jpg', 'b.jpg'], statements: ['s.pdf'] };
    const extra = {
      auth: {
        admin: {
          deleteUser: async (id: string) => {
            steps.push(`deleteUser:${id}`);
            return { error: opts.deleteError ? { message: 'boom' } : null };
          },
        },
      },
      storage: {
        from: (bucket: string) => ({
          list: async () => {
            steps.push(`list:${bucket}`);
            if (opts.listError) return { data: null, error: { message: 'down' } };
            return { data: files[bucket].map((name) => ({ name })), error: null };
          },
          remove: async (paths: string[]) => {
            steps.push(`remove:${bucket}:${paths.length}`);
            files[bucket] = [];
            return { error: null };
          },
        }),
      },
    };
    return { db: fakeDb({}, {}, extra).db, steps };
  }

  it('pengguna dihapus DULU, baru berkas', async () => {
    const { db, steps } = accountDb();
    await expect(deleteAccount(db, 'u1')).resolves.toEqual({ deleted: true, files: 3 });
    expect(steps[0]).toBe('deleteUser:u1');
    expect(steps).toContain('remove:receipts:2');
    expect(steps).toContain('remove:statements:1');
  });

  it('hapus pengguna gagal: error, berkas (foto struk) tidak disentuh', async () => {
    const { db, steps } = accountDb({ deleteError: true });
    await expect(deleteAccount(db, 'u1')).rejects.toMatchObject({ code: 'server', status: 500 });
    expect(steps).toEqual(['deleteUser:u1']);
  });

  it('akun terhapus tapi berkas gagal dihapus: tetap sukses, ditandai filesPending', async () => {
    const { db } = accountDb({ listError: true });
    await expect(deleteAccount(db, 'u1')).resolves.toEqual({ deleted: true, files: 0, filesPending: true });
  });
});

describe('pesanan tanpa pemilik (akun dihapus, audit 8)', () => {
  const orphan: OrderRow = { id: 'o1', user_id: null, provider: 'xendit', period: 'monthly', status: 'paid', days: null, granted_until: null, grant_error: 'pending' };

  it('grantOrder: tidak memberi grant ke siapa pun, tidak menyentuh RevenueCat/profil', async () => {
    const { db, calls } = fakeDb({});
    await expect(grantOrder(db, orphan)).resolves.toBeNull();
    expect(calls).toEqual([]);
  });

  it('refundOrder: status refund tetap tercatat, tidak ada geser/cabut grant', async () => {
    const { db, calls } = fakeDb({}, { orders: { data: { ...orphan, status: 'refunded' }, error: null } });
    await refundOrder(db, 'o1');
    expect(calls.some((c) => c.kind === 'rpc')).toBe(false);
  });
});

describe('grant admin (audit 9)', () => {
  const order = { id: 'o9', user_id: 'u1', provider: 'manual', period: 'custom', status: 'paid', days: 30, granted_until: null, grant_error: 'pending' };
  /** orders: insert -> pesanan baru; baca grant_error setelahnya -> nilai `grantError`; query lain kosong. */
  const ordersTable = (grantError: string | null) => (chain: string[]): Res => {
    if (chain.includes('insert')) return { data: order, error: null };
    if (chain.includes('maybeSingle') && !chain.includes('gt') && !chain.includes('not')) return { data: { grant_error: grantError }, error: null };
    return { data: null, error: null };
  };
  const inserts = (calls: Call[]) => calls.filter((c) => c.name === 'orders' && c.method === 'insert').length;

  it('aktivasi gagal sesaat: jawab queued (bukan 502), hanya satu pesanan dibuat', async () => {
    const { db, calls } = fakeDb({ reserve_grant: () => ({ data: null, error: { code: '503' } }) }, { orders: ordersTable('reserve_grant_503') });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(adminGrant(db, 'admin1', 'u1', 30)).resolves.toEqual({ queued: true });
    spy.mockRestore();
    expect(inserts(calls)).toBe(1);
    // Pesanan ditandai untuk dicoba ulang cron, bukan dibatalkan.
    expect(calls).toContainEqual(expect.objectContaining({ name: 'orders', method: 'update', args: [expect.objectContaining({ grant_error: 'reserve_grant_503' })] }));
  });

  it('aktivasi berhasil: queued false', async () => {
    const until = '2026-12-07T00:00:00.000Z';
    const { db } = fakeDb(
      {
        reserve_grant: () => ({ data: [{ granted_until: until }], error: null }),
        plan_sync_ticket: () => ({ data: 1, error: null }),
        plan_sync_apply: () => ({ data: [{ o_plan: 'premium', o_premium_until: until, o_applied: true }], error: null }),
      },
      { orders: ordersTable(null) },
    );
    await expect(adminGrant(db, 'admin1', 'u1', 30)).resolves.toEqual({ queued: false });
  });

  it('pesanan gagal disimpan: tetap error 500 (tidak ada yang tercatat, aman diklik lagi)', async () => {
    const { db } = fakeDb({}, { orders: { data: null, error: { code: '500' } } });
    await expect(adminGrant(db, 'admin1', 'u1', 30)).rejects.toMatchObject({ code: 'server', status: 500 });
  });
});
