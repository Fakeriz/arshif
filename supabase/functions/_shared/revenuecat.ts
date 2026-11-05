import { RC_ENTITLEMENT_ID, RC_PROJECT_ID, RC_SECRET_KEY } from './env.ts';
import { HttpError } from './http.ts';

const BASE = 'https://api.revenuecat.com/v2';

async function rc(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}/projects/${encodeURIComponent(RC_PROJECT_ID())}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${RC_SECRET_KEY()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

const customer = (userId: string) => `/customers/${encodeURIComponent(userId)}`;

/**
 * Masa aktif entitlement premium menurut RevenueCat (sumber kebenaran).
 * null = tidak aktif; Infinity = aktif tanpa tanggal akhir.
 */
export async function premiumUntil(userId: string): Promise<number | null> {
  const res = await rc(`${customer(userId)}/active_entitlements?limit=100`);
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError('provider_error', 502, { message: `revenuecat_${res.status}` });
  const body = (await res.json()) as { items?: { entitlement_id: string; expires_at: number | null }[] };
  const item = body.items?.find((i) => i.entitlement_id === RC_ENTITLEMENT_ID());
  if (!item) return null;
  if (item.expires_at === null) return Infinity;
  return item.expires_at > Date.now() ? item.expires_at : null;
}

/** Grant entitlement promosi sampai `untilMs`. Pelanggan web-only dibuat dulu di RevenueCat bila belum ada. */
export async function grantPremium(userId: string, untilMs: number): Promise<void> {
  const body = JSON.stringify({ entitlement_id: RC_ENTITLEMENT_ID(), expires_at: Math.round(untilMs) });
  let res = await rc(`${customer(userId)}/actions/grant_entitlement`, { method: 'POST', body });
  if (res.status === 404) {
    const created = await rc('/customers', { method: 'POST', body: JSON.stringify({ id: userId }) });
    if (!created.ok && created.status !== 409) throw new HttpError('provider_error', 502, { message: `revenuecat_create_${created.status}` });
    res = await rc(`${customer(userId)}/actions/grant_entitlement`, { method: 'POST', body });
  }
  if (!res.ok) throw new HttpError('provider_error', 502, { message: `revenuecat_grant_${res.status}` });
}

/** Cabut semua grant promosi premium (refund web). Langganan store tidak tersentuh. */
export async function revokeGrants(userId: string): Promise<void> {
  const res = await rc(`${customer(userId)}/actions/revoke_granted_entitlement`, {
    method: 'POST',
    body: JSON.stringify({ entitlement_id: RC_ENTITLEMENT_ID() }),
  });
  if (!res.ok && res.status !== 404) throw new HttpError('provider_error', 502, { message: `revenuecat_revoke_${res.status}` });
}
