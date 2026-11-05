import type { MsgKey } from '@/i18n';

type AuthLikeError = { status?: number; code?: string; message?: string; name?: string } | null | undefined;

/**
 * Error Supabase Auth → kunci pesan spesifik (bukan error mentah).
 * status 0 / AuthRetryableFetchError = jaringan; 429 / *_rate_limit = terlalu sering.
 */
export function authErrorKey(err: AuthLikeError, scope: 'signIn' | 'verify'): MsgKey {
  const status = err?.status;
  const code = err?.code ?? '';
  if (err?.name === 'AuthRetryableFetchError' || status === 0 || /fetch|network/i.test(err?.message ?? '')) return `auth.${scope}.errorNetwork`;
  if (status === 429 || code.includes('rate_limit')) return `auth.${scope}.errorRate`;
  if (scope === 'signIn' && (code === 'email_address_invalid' || code === 'validation_failed')) return 'auth.signIn.errorInvalid';
  if (scope === 'verify' && (code === 'otp_expired' || status === 403 || status === 401)) return 'auth.verify.errorCode';
  return `auth.${scope}.errorGeneric`;
}
