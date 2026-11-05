import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import type { z } from 'zod';

import { supabase } from '@/lib/supabase';

import { ErrorBody, type ErrorCode } from '../../../supabase/functions/_shared/contracts';

/** Kode error yang dibedakan layar. `network` = tidak sampai ke server, `invalid` = jawaban server tidak sesuai kontrak. */
export type FnErrorCode = ErrorCode | 'network' | 'invalid';

export class FnError extends Error {
  constructor(readonly code: FnErrorCode, readonly quotaKey?: string) {
    super(code);
  }
}

/**
 * Panggil Edge Function. Token sesi dikirim otomatis oleh supabase-js; server memverifikasinya.
 * Jawaban sukses divalidasi dengan skema kontrak yang sama dengan server.
 */
export async function invokeFn<S extends z.ZodType>(name: string, body: Record<string, unknown>, schema: S): Promise<z.infer<S>> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const parsed = ErrorBody.safeParse(await (error.context as Response).json().catch(() => null));
      if (parsed.success) throw new FnError(parsed.data.error, parsed.data.quotaKey);
      throw new FnError('server');
    }
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) throw new FnError('network');
    throw new FnError('server');
  }
  const ok = schema.safeParse(data);
  if (!ok.success) throw new FnError('invalid');
  return ok.data;
}
