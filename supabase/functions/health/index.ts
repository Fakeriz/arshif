/**
 * Split liveness vs readiness endpoint:
 * - GET/POST ?check=live  -> checks local Edge process only (no DB probe).
 * - GET/POST ?check=ready -> checks core env + PostgreSQL connectivity with 2s timeout.
 */
import { adminClient } from '../_shared/auth.ts';
import { MIN_CLIENT_VERSION, validateCoreEnv } from '../_shared/env.ts';
import { createHandler, json, serve } from '../_shared/http.ts';

const DB_TIMEOUT_MS = 2_000;

export type HealthDeps = {
  validateEnv: () => { ok: boolean; missing: string[] };
  checkDb: (timeoutMs: number) => Promise<'ok' | 'error' | 'timeout'>;
  minClientVersion: () => string;
  nowIso: () => string;
};

async function defaultCheckDb(timeoutMs: number): Promise<'ok' | 'error' | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const db = adminClient();
    const probe: Promise<'ok' | 'error'> = (async () => {
      try {
        const { error } = await db.from('prices').select('period').limit(1);
        return error ? 'error' : 'ok';
      } catch {
        return 'error';
      }
    })();
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutMs);
    });
    return await Promise.race([probe, timeout]);
  } catch {
    return 'error';
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function runHealthCheck(req: Request, overrides: Partial<HealthDeps> = {}): Promise<Response> {
  const deps: HealthDeps = {
    validateEnv: overrides.validateEnv ?? validateCoreEnv,
    checkDb: overrides.checkDb ?? defaultCheckDb,
    minClientVersion: overrides.minClientVersion ?? MIN_CLIENT_VERSION,
    nowIso: overrides.nowIso ?? (() => new Date().toISOString()),
  };

  let check = 'live';
  try {
    const url = new URL(req.url);
    check = url.searchParams.get('check') ?? (url.pathname.endsWith('/ready') ? 'ready' : 'live');
  } catch {
    check = 'live';
  }

  const ts = deps.nowIso();
  if (check !== 'ready') {
    return json({
      ok: true,
      status: 'live',
      service: 'arshif-edge',
      minClientVersion: deps.minClientVersion(),
      ts,
    });
  }

  const envCheck = deps.validateEnv();
  if (!envCheck.ok && !overrides.checkDb) {
    return json(
      {
        ok: false,
        status: 'degraded',
        service: 'arshif-edge',
        db: 'error',
        env: 'missing',
        minClientVersion: deps.minClientVersion(),
        ts,
      },
      503,
    );
  }

  const dbState = await deps.checkDb(DB_TIMEOUT_MS);
  const ready = envCheck.ok && dbState === 'ok';
  return json(
    {
      ok: ready,
      status: ready ? 'ready' : 'degraded',
      service: 'arshif-edge',
      db: dbState,
      env: envCheck.ok ? 'ok' : 'missing',
      minClientVersion: deps.minClientVersion(),
      ts,
    },
    ready ? 200 : 503,
  );
}

export const healthHandler = createHandler((req) => runHealthCheck(req), {
  service: 'health',
  methods: ['GET', 'POST'],
});

if (typeof (globalThis as { Deno?: { serve?: unknown } }).Deno?.serve === 'function') {
  serve((req) => runHealthCheck(req), { service: 'health', methods: ['GET', 'POST'] });
}
