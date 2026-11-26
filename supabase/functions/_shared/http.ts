import type { ErrorCode } from './contracts.ts';

/** CORS untuk klien web (Expo web). Native tidak butuh, tapi tidak merugikan. */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export function error(code: ErrorCode, status: number, extra: { quotaKey?: string; message?: string } = {}): Response {
  return json({ error: code, ...extra }, status);
}

/** Error yang dilempar di tengah alur lalu diubah jadi respons di handler terluar. */
export class HttpError extends Error {
  constructor(public code: ErrorCode, public status: number, public extra: { quotaKey?: string; message?: string } = {}) {
    super(code);
  }
}

/** Bungkus handler: OPTIONS, hanya POST, HttpError -> respons, error lain -> 500 tanpa detail ke klien. */
export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return error('bad_request', 405);
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return error(e.code, e.status, e.extra);
      console.error('unhandled', e instanceof Error ? e.message : String(e));
      return error('server', 500);
    }
  });
}

const DEFAULT_MAX_JSON_BYTES = 4 * 1024 * 1024;

export async function readJson(req: Request, maxBytes = DEFAULT_MAX_JSON_BYTES): Promise<unknown> {
  const len = Number(req.headers.get('content-length'));
  if (Number.isFinite(len) && len > maxBytes) throw new HttpError('too_large', 413);
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new HttpError('too_large', 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError('bad_request', 400, { message: 'invalid_json' });
  }
}
