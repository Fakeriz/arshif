/**
 * Structured single-line JSON logger with secret/PII redaction and correlation ID helpers.
 * Safe for Supabase Edge Runtime logs and Jest unit tests without external dependencies.
 */

export type LogLevel = 'info' | 'warn' | 'error';

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,128}$/;

const SENSITIVE_KEY_RE =
  /(authorization|cookie|password|passwd|secret|token|api[-_]?key|signature|audio|base64|email|card[-_]?number)/i;

const INLINE_BEARER_RE = /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi;
const INLINE_QUERY_SECRET_RE = /([?&](?:key|api_key|apikey|token|access_token|secret)=)[^&\s"']+/gi;

const MAX_STRING_LEN = 300;
const MAX_DEPTH = 4;

/** Extracts a safe caller correlation ID or creates a fresh UUID v4. */
export function extractRequestId(req: Request): string {
  const raw = req.headers.get('x-request-id')?.trim();
  if (raw && REQUEST_ID_RE.test(raw)) return raw;
  return crypto.randomUUID();
}

/** Recursively redacts secrets, tokens, emails, URL query keys, and oversized base64/text blobs. */
export function redactValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const scrubbed = value
      .replace(INLINE_BEARER_RE, '$1[REDACTED]')
      .replace(INLINE_QUERY_SECRET_RE, '$1[REDACTED]');
    if (scrubbed.length > MAX_STRING_LEN) return `${scrubbed.slice(0, MAX_STRING_LEN)}...[truncated:${scrubbed.length}]`;
    return scrubbed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) return { name: value.name, message: redactValue(value.message, depth + 1) };
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactValue(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? '[REDACTED]' : redactValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Emits a single-line JSON log entry using console.log / console.warn / console.error. */
export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const clean = redactValue(fields) as Record<string, unknown>;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...clean,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
