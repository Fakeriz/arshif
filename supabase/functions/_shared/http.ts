import type { ErrorCode } from './contracts.ts';
import { extractRequestId, logEvent } from './logger.ts';

/** CORS untuk klien web (Expo web). Native tidak butuh, tapi tidak merugikan. */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-request-id, idempotency-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-request-id, retry-after, x-idempotent-replayed',
};

const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-store',
  Vary: 'Authorization',
  'X-Content-Type-Options': 'nosniff',
};

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export function error(
  code: ErrorCode,
  status: number,
  extra: { quotaKey?: string; message?: string; retryAfterSec?: number } = {},
): Response {
  const { retryAfterSec, ...bodyExtra } = extra;
  const headers: Record<string, string> = {};
  const retry = retryAfterSec ?? (status === 429 ? 60 : status === 409 ? 2 : undefined);
  if (typeof retry === 'number' && Number.isFinite(retry) && retry > 0) {
    headers['Retry-After'] = String(Math.ceil(retry));
  }
  return json({ error: code, ...bodyExtra }, status, headers);
}

/** Error yang dilempar di tengah alur lalu diubah jadi respons di handler terluar. */
export class HttpError extends Error {
  constructor(
    public code: ErrorCode,
    public status: number,
    public extra: { quotaKey?: string; message?: string; retryAfterSec?: number } = {},
  ) {
    super(code);
  }
}

export type RequestContext = { requestId: string };
export type Handler = (req: Request, ctx: RequestContext) => Promise<Response>;
export type ServeOptions = { service?: string; methods?: readonly ('GET' | 'POST')[] };

function withRequestId(res: Response, requestId: string): Response {
  try {
    if (res.body !== undefined) {
      const headers = new Headers(res.headers);
      headers.set('X-Request-ID', requestId);
      if (!headers.has('X-Content-Type-Options')) headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    }
    res.headers.set('X-Request-ID', requestId);
    if (!res.headers.has('X-Content-Type-Options')) res.headers.set('X-Content-Type-Options', 'nosniff');
    return res;
  } catch {
    res.headers.set('X-Request-ID', requestId);
    return res;
  }
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '/';
  }
}

/** Bungkus handler HTTP dengan correlation ID, log JSON terstruktur, CORS, dan penanganan error seragam. */
export function createHandler(handler: Handler, opts: ServeOptions = {}): (req: Request) => Promise<Response> {
  const service = opts.service ?? 'edge';
  const methods = opts.methods ?? ['POST'];

  return async (req: Request): Promise<Response> => {
    const requestId = extractRequestId(req);
    const startedAt = Date.now();
    const path = safePath(req.url);

    if (req.method === 'OPTIONS') {
      return withRequestId(new Response('ok', { status: 200, headers: corsHeaders }), requestId);
    }
    if (!methods.includes(req.method as 'GET' | 'POST')) {
      const res = withRequestId(error('bad_request', 405), requestId);
      logEvent('warn', 'http_method_not_allowed', { service, requestId, method: req.method, path, status: 405, durationMs: Date.now() - startedAt });
      return res;
    }

    try {
      const raw = await handler(req, { requestId });
      const res = withRequestId(raw, requestId);
      logEvent(res.status >= 500 ? 'error' : res.status >= 400 ? 'warn' : 'info', 'http_request', {
        service,
        requestId,
        method: req.method,
        path,
        status: res.status,
        durationMs: Date.now() - startedAt,
      });
      return res;
    } catch (e) {
      if (e instanceof HttpError) {
        const res = withRequestId(error(e.code, e.status, e.extra), requestId);
        logEvent(e.status >= 500 ? 'error' : 'warn', 'http_error', {
          service,
          requestId,
          method: req.method,
          path,
          status: e.status,
          code: e.code,
          durationMs: Date.now() - startedAt,
        });
        return res;
      }
      logEvent('error', 'unhandled_exception', {
        service,
        requestId,
        method: req.method,
        path,
        status: 500,
        durationMs: Date.now() - startedAt,
        error: e instanceof Error ? e.message : String(e),
      });
      return withRequestId(error('server', 500), requestId);
    }
  };
}

/** Bungkus handler ke Deno.serve. */
export function serve(handler: Handler, opts: ServeOptions = {}): void {
  Deno.serve(createHandler(handler, opts));
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
