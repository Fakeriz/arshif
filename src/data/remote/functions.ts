import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import type { z } from 'zod';

import { supabase } from '@/lib/supabase';
import { newId } from '@/lib/uuid';

import { ErrorBody, type ErrorCode } from '../../../supabase/functions/_shared/contracts';

/** Kode error yang dibedakan layar. `network` = tidak sampai ke server, `invalid` = jawaban server tidak sesuai kontrak. */
export type FnErrorCode = ErrorCode | 'network' | 'invalid';

export class FnError extends Error {
  constructor(
    readonly code: FnErrorCode,
    readonly quotaKey?: string,
    readonly requestId?: string,
    readonly retryAfterSec?: number,
  ) {
    super(code);
  }
}

export type InvokeOptions = {
  idempotencyKey?: string;
  headers?: Record<string, string>;
};

/**
 * Panggil Edge Function. Token sesi dikirim otomatis oleh supabase-js; server memverifikasinya.
 * Jawaban sukses divalidasi dengan skema kontrak yang sama dengan server.
 */
export async function invokeFn<S extends z.ZodType>(
  name: string,
  body: Record<string, unknown>,
  schema: S,
  opts?: InvokeOptions,
): Promise<z.infer<S>> {
  const requestId = opts?.headers?.['X-Request-ID'] ?? newId();
  const headers: Record<string, string> = {
    'X-Request-ID': requestId,
    ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
    ...(opts?.headers ?? {}),
  };
  const { data, error } = await supabase.functions.invoke(name, { body, headers });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response | undefined;
      const serverRequestId = res?.headers?.get?.('x-request-id') ?? requestId;
      const retryRaw = Number(res?.headers?.get?.('retry-after'));
      const retryAfterSec = Number.isFinite(retryRaw) && retryRaw > 0 ? retryRaw : undefined;
      const parsed = ErrorBody.safeParse(await res?.json?.().catch(() => null));
      if (parsed.success) throw new FnError(parsed.data.error, parsed.data.quotaKey, serverRequestId, retryAfterSec);
      throw new FnError('server', undefined, serverRequestId, retryAfterSec);
    }
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      throw new FnError('network', undefined, requestId);
    }
    throw new FnError('server', undefined, requestId);
  }
  const ok = schema.safeParse(data);
  if (!ok.success) throw new FnError('invalid', undefined, requestId);
  return ok.data;
}
