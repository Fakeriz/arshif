import type { SupabaseClient } from '@supabase/supabase-js';

import { HttpError, json } from './http.ts';
import { logEvent } from './logger.ts';

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;

/** Validates optional caller-supplied Idempotency-Key header. */
export function parseIdempotencyKey(req: Request): string | null {
  const raw = req.headers.get('idempotency-key');
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!IDEMPOTENCY_KEY_RE.test(trimmed)) {
    throw new HttpError('bad_request', 400, { message: 'invalid_idempotency_key' });
  }
  return trimmed;
}

/** Deterministic JSON serialization so equivalent payloads produce identical SHA-256 hashes. */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`).join(',')}}`;
}

export async function hashPayload(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalStringify(value));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

type BeginRow = {
  state: 'acquired' | 'completed' | 'in_progress' | 'payload_mismatch';
  status_code: number | null;
  response_body: unknown;
  lease_id: string | null;
};

/**
 * DB-backed idempotency state machine:
 * - Same key + same payload after completion -> replays exact response with X-Idempotent-Replayed: true.
 * - Same key + different payload -> 422 idempotency_payload_mismatch.
 * - Concurrent request in flight -> 409 conflict with Retry-After: 2.
 * - Transient failure before completion -> releases IN_PROGRESS lock so caller can retry safely.
 */
export async function withIdempotency(
  db: SupabaseClient,
  opts: {
    userId: string;
    scope: string;
    key: string | null;
    payload: unknown;
    leaseSec?: number;
    work: () => Promise<{ status?: number; body: unknown }>;
  },
): Promise<Response> {
  if (!opts.key) {
    const res = await opts.work();
    return json(res.body, res.status ?? 200);
  }

  const requestHash = await hashPayload(opts.payload);
  const { data, error } = await db.rpc('idempotency_begin', {
    p_user: opts.userId,
    p_scope: opts.scope,
    p_key: opts.key,
    p_hash: requestHash,
    p_lease_sec: opts.leaseSec ?? 60,
  });
  if (error) {
    logEvent('error', 'idempotency_begin_failed', { scope: opts.scope, userId: opts.userId, code: error.code });
    throw new HttpError('server', 500);
  }

  const row = (Array.isArray(data) ? data[0] : data) as BeginRow | undefined;
  if (!row) throw new HttpError('server', 500);

  if (row.state === 'payload_mismatch') {
    throw new HttpError('bad_request', 422, { message: 'idempotency_payload_mismatch' });
  }
  if (row.state === 'in_progress') {
    throw new HttpError('conflict', 409, { message: 'idempotency_in_progress', retryAfterSec: 2 });
  }
  if (row.state === 'completed') {
    return json(row.response_body, row.status_code ?? 200, { 'X-Idempotent-Replayed': 'true' });
  }

  const leaseId = row.lease_id;
  if (!leaseId) throw new HttpError('server', 500);

  try {
    const res = await opts.work();
    const status = res.status ?? 200;
    if (status < 500) {
      const { error: completeErr } = await db.rpc('idempotency_complete', {
        p_user: opts.userId,
        p_scope: opts.scope,
        p_key: opts.key,
        p_lease: leaseId,
        p_status_code: status,
        p_response: res.body,
      });
      if (completeErr) {
        logEvent('warn', 'idempotency_complete_failed', { scope: opts.scope, userId: opts.userId, code: completeErr.code });
      }
    }
    return json(res.body, status);
  } catch (e) {
    const { error: releaseErr } = await db.rpc('idempotency_release', {
      p_user: opts.userId,
      p_scope: opts.scope,
      p_key: opts.key,
      p_lease: leaseId,
    });
    if (releaseErr) {
      logEvent('warn', 'idempotency_release_failed', { scope: opts.scope, userId: opts.userId, code: releaseErr.code });
    }
    throw e;
  }
}
