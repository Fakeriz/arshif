/// <reference path="../../supabase/functions/deno.d.ts" />
import type { SupabaseClient } from '@supabase/supabase-js';

import { MIN_CLIENT_VERSION, validateCoreEnv } from '../../supabase/functions/_shared/env.ts';
import { createHandler, HttpError, json } from '../../supabase/functions/_shared/http.ts';
import {
  canonicalStringify,
  hashPayload,
  parseIdempotencyKey,
  withIdempotency,
} from '../../supabase/functions/_shared/idempotency.ts';
import { extractRequestId, logEvent, redactValue } from '../../supabase/functions/_shared/logger.ts';
import { createTransaction } from '../../supabase/functions/_shared/paddle.ts';
import { createInvoice } from '../../supabase/functions/_shared/xendit.ts';
import { runHealthCheck } from '../../supabase/functions/health/index.ts';

type RpcHandler = (args: Record<string, unknown>) => { data: unknown; error: unknown };

function fakeIdemDb(rpc: Record<string, RpcHandler>) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const db = {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      calls.push({ name, args });
      return rpc[name]?.(args) ?? { data: null, error: null };
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

describe('logger & redaksi observability', () => {
  it('extractRequestId memakai header x-request-id yang valid atau membuat UUID baru', () => {
    const valid = new Request('https://edge.local/test', { headers: { 'x-request-id': 'req_abc-123.xyz' } });
    expect(extractRequestId(valid)).toBe('req_abc-123.xyz');

    const bad = new Request('https://edge.local/test', { headers: { 'x-request-id': 'bad<id> with space' } });
    expect(extractRequestId(bad)).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('redactValue menyensor secret, token, PII, URL query key, dan memotong teks panjang', () => {
    const out = redactValue({
      authorization: 'Bearer secret-jwt',
      accessToken: 'tok_123',
      webhookSecret: 'whsec_999',
      nested: { userEmail: 'user@example.com', safe: 'ok', api_key: 'abc' },
      errUrl: 'GET https://maps.googleapis.com/maps/api/staticmap?center=0,0&key=AIzaSySecretKey1234567890 failed',
      bearerMsg: 'Header Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 rejected',
      longText: 'a'.repeat(350),
    }) as Record<string, unknown>;

    expect(out.authorization).toBe('[REDACTED]');
    expect(out.accessToken).toBe('[REDACTED]');
    expect(out.webhookSecret).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).userEmail).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).api_key).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).safe).toBe('ok');
    expect(out.errUrl).toBe('GET https://maps.googleapis.com/maps/api/staticmap?center=0,0&key=[REDACTED] failed');
    expect(out.bearerMsg).toBe('Header Bearer [REDACTED] rejected');
    expect(String(out.longText)).toContain('...[truncated:350]');
  });

  it('logEvent memancarkan JSON satu baris terstruktur', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      logEvent('info', 'checkout_started', { requestId: 'req-12345678', secret: 'top-secret' });
      expect(spy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(spy.mock.calls[0]![0] as string) as Record<string, unknown>;
      expect(parsed.level).toBe('info');
      expect(parsed.event).toBe('checkout_started');
      expect(parsed.requestId).toBe('req-12345678');
      expect(parsed.secret).toBe('[REDACTED]');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('http shield (correlation ID, Cache-Control, Retry-After, method guard)', () => {
  it('meneruskan X-Request-ID, memasang header keamanan, dan Retry-After pada 429', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const handler = createHandler(
        async (req, ctx) => {
          const url = new URL(req.url);
          if (url.searchParams.get('limit')) {
            throw new HttpError('rate_limited', 429, { retryAfterSec: 45 });
          }
          return json({ requestId: ctx.requestId });
        },
        { service: 'unit-test', methods: ['GET', 'POST'] },
      );

      const okRes = await handler(new Request('https://edge.local/test', { method: 'POST', headers: { 'x-request-id': 'trace-99887766' } }));
      expect(okRes.status).toBe(200);
      expect(okRes.headers.get('X-Request-ID')).toBe('trace-99887766');
      expect(okRes.headers.get('Cache-Control')).toBe('private, no-store');
      expect(okRes.headers.get('X-Content-Type-Options')).toBe('nosniff');
      await expect(okRes.json()).resolves.toEqual({ requestId: 'trace-99887766' });

      const rateRes = await handler(new Request('https://edge.local/test?limit=1', { method: 'POST' }));
      expect(rateRes.status).toBe(429);
      expect(rateRes.headers.get('Retry-After')).toBe('45');
      expect(rateRes.headers.get('X-Request-ID')).toBeTruthy();

      const badMethod = await handler(new Request('https://edge.local/test', { method: 'DELETE' }));
      expect(badMethod.status).toBe(405);
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});

describe('idempotency helper & state machine', () => {
  it('canonicalStringify & hashPayload deterministik terhadap urutan key', async () => {
    const h1 = await hashPayload({ method: 'qris', period: 'yearly', currency: 'IDR' });
    const h2 = await hashPayload({ currency: 'IDR', period: 'yearly', method: 'qris' });
    expect(canonicalStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(h1).toBe(h2);
  });

  it('parseIdempotencyKey memvalidasi format kunci', () => {
    expect(parseIdempotencyKey(new Request('https://edge.local/pay'))).toBeNull();
    expect(parseIdempotencyKey(new Request('https://edge.local/pay', { headers: { 'idempotency-key': 'idem-key-1234' } }))).toBe(
      'idem-key-1234',
    );
    expect(() =>
      parseIdempotencyKey(new Request('https://edge.local/pay', { headers: { 'idempotency-key': 'bad' } })),
    ).toThrow(HttpError);
  });

  it('menyimpan hasil saat acquired, memutar ulang saat completed, menolak payload mismatch & in_progress, dan melepas saat error', async () => {
    const acquiredDb = fakeIdemDb({
      idempotency_begin: () => ({
        data: [{ state: 'acquired', status_code: null, response_body: null, lease_id: 'lease-1' }],
        error: null,
      }),
    });
    const res1 = await withIdempotency(acquiredDb.db, {
      userId: 'u1',
      scope: 'checkout-create',
      key: 'idem-key-1234',
      payload: { period: 'monthly', currency: 'IDR', method: 'qris' },
      work: async () => ({ status: 200, body: { orderId: 'o1' } }),
    });
    expect(res1.status).toBe(200);
    await expect(res1.json()).resolves.toEqual({ orderId: 'o1' });
    expect(acquiredDb.calls.map((c) => c.name)).toEqual(['idempotency_begin', 'idempotency_complete']);
    expect(acquiredDb.calls[1]!.args.p_lease).toBe('lease-1');

    const replayDb = fakeIdemDb({
      idempotency_begin: () => ({
        data: [{ state: 'completed', status_code: 200, response_body: { orderId: 'o1' }, lease_id: null }],
        error: null,
      }),
    });
    const workReplay = jest.fn();
    const res2 = await withIdempotency(replayDb.db, {
      userId: 'u1',
      scope: 'checkout-create',
      key: 'idem-key-1234',
      payload: { period: 'monthly', currency: 'IDR', method: 'qris' },
      work: workReplay,
    });
    expect(workReplay).not.toHaveBeenCalled();
    expect(res2.headers.get('X-Idempotent-Replayed')).toBe('true');

    const mismatchDb = fakeIdemDb({
      idempotency_begin: () => ({
        data: [{ state: 'payload_mismatch', status_code: null, response_body: null, lease_id: null }],
        error: null,
      }),
    });
    await expect(
      withIdempotency(mismatchDb.db, {
        userId: 'u1',
        scope: 'checkout-create',
        key: 'idem-key-1234',
        payload: { period: 'yearly' },
        work: jest.fn(),
      }),
    ).rejects.toMatchObject({ code: 'bad_request', status: 422 });

    const conflictDb = fakeIdemDb({
      idempotency_begin: () => ({
        data: [{ state: 'in_progress', status_code: null, response_body: null, lease_id: null }],
        error: null,
      }),
    });
    await expect(
      withIdempotency(conflictDb.db, {
        userId: 'u1',
        scope: 'checkout-create',
        key: 'idem-key-1234',
        payload: { period: 'monthly' },
        work: jest.fn(),
      }),
    ).rejects.toMatchObject({ code: 'conflict', status: 409, extra: { retryAfterSec: 2 } });

    const failDb = fakeIdemDb({
      idempotency_begin: () => ({
        data: [{ state: 'acquired', status_code: null, response_body: null, lease_id: 'lease-2' }],
        error: null,
      }),
    });
    await expect(
      withIdempotency(failDb.db, {
        userId: 'u1',
        scope: 'checkout-create',
        key: 'idem-key-1234',
        payload: { period: 'monthly' },
        work: async () => Promise.reject(new HttpError('provider_error', 502)),
      }),
    ).rejects.toMatchObject({ code: 'provider_error', status: 502 });
    expect(failDb.calls.map((c) => c.name)).toEqual(['idempotency_begin', 'idempotency_release']);
    expect(failDb.calls[1]!.args.p_lease).toBe('lease-2');
  });
});

describe('payment outbound timeouts & env health validation', () => {
  const originalFetch = globalThis.fetch;
  const originalDeno = (globalThis as { Deno?: unknown }).Deno;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as { Deno?: unknown }).Deno = originalDeno;
  });

  it('xendit & paddle mengubah timeout/network error menjadi HttpError provider_error 502 dengan x-idempotency-key pada Xendit', async () => {
    const env: Record<string, string> = {
      XENDIT_SECRET_KEY: 'xnd_development_test',
      PADDLE_API_KEY: 'pdl_sdbx_test',
      PADDLE_PRICE_MONTHLY: 'pri_m',
      PADDLE_PRICE_YEARLY: 'pri_y',
      PADDLE_ENV: 'sandbox',
    };
    (globalThis as { Deno?: unknown }).Deno = { env: { get: (k: string) => env[k] } };

    const headersSeen: Record<string, string>[] = [];
    globalThis.fetch = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      headersSeen.push((init?.headers as Record<string, string>) ?? {});
      const err = new Error('timed out');
      err.name = 'TimeoutError';
      throw err;
    }) as unknown as typeof fetch;

    await expect(
      createInvoice({
        orderId: 'order-123',
        amount: 25000,
        currency: 'IDR',
        method: 'qris',
        email: null,
        description: 'Test',
        returnUrl: 'https://arshif.test/return',
      }),
    ).rejects.toMatchObject({ code: 'provider_error', status: 502, extra: { message: 'xendit_timeout' } });
    expect(headersSeen[0]!['x-idempotency-key']).toBe('order-123');

    await expect(createTransaction({ orderId: 'order-124', userId: 'u1', period: 'monthly' })).rejects.toMatchObject({
      code: 'provider_error',
      status: 502,
      extra: { message: 'paddle_timeout' },
    });
  });

  it('validateCoreEnv, MIN_CLIENT_VERSION, dan runHealthCheck membedakan live vs ready', async () => {
    const env: Record<string, string> = {
      SUPABASE_URL: 'https://proj.supabase.co',
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_dummy' }),
      MIN_CLIENT_VERSION: '1.2.0',
    };
    (globalThis as { Deno?: unknown }).Deno = { env: { get: (k: string) => env[k] } };

    expect(validateCoreEnv()).toEqual({ ok: true, missing: [] });
    expect(MIN_CLIENT_VERSION()).toBe('1.2.0');

    const dbProbe = jest.fn(async () => 'ok' as const);
    const liveRes = await runHealthCheck(new Request('https://edge.local/health?check=live'), {
      validateEnv: () => ({ ok: true, missing: [] }),
      checkDb: dbProbe,
      minClientVersion: () => '1.2.0',
      nowIso: () => '2026-11-26T00:00:00.000Z',
    });
    expect(liveRes.status).toBe(200);
    expect(dbProbe).not.toHaveBeenCalled();

    const readyRes = await runHealthCheck(new Request('https://edge.local/health?check=ready'), {
      validateEnv: () => ({ ok: true, missing: [] }),
      checkDb: dbProbe,
      minClientVersion: () => '1.2.0',
      nowIso: () => '2026-11-26T00:00:00.000Z',
    });
    expect(readyRes.status).toBe(200);
    expect(dbProbe).toHaveBeenCalledTimes(1);

    const degradedRes = await runHealthCheck(new Request('https://edge.local/health?check=ready'), {
      validateEnv: () => ({ ok: true, missing: [] }),
      checkDb: async () => 'timeout',
      minClientVersion: () => '1.2.0',
      nowIso: () => '2026-11-26T00:00:00.000Z',
    });
    expect(degradedRes.status).toBe(503);
    await expect(degradedRes.json()).resolves.toMatchObject({ ok: false, status: 'degraded', db: 'timeout' });
  });
});
