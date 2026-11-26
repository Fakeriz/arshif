/**
 * Lokasi transaksi lewat Google Maps Platform: cari tempat (teks), tempat terdekat (GPS), dan gambar peta statis.
 * Kunci API hanya di server. Dibatasi per pengguna (place_lookup_start) karena setiap panggilan Google berbayar.
 */
import { adminClient, requireUser, toBase64 } from '../_shared/auth.ts';
import { PlacesRequest, type Place } from '../_shared/contracts.ts';
import { configured, GOOGLE_MAPS_API_KEY } from '../_shared/env.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { logEvent } from '../_shared/logger.ts';

const PLACES = 'https://places.googleapis.com/v1/places';
const FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location';
/** Warna pin = aksen kuningan (DESIGN.md). */
const PIN = '0x735214';
const DARK_STYLE = [
  'element:geometry|color:0x1d1d1b',
  'element:labels.text.fill|color:0x9a9a96',
  'element:labels.text.stroke|color:0x1d1d1b',
  'feature:road|element:geometry|color:0x3a3a37',
  'feature:water|element:geometry|color:0x0e0e0d',
  'feature:poi|visibility:off',
];

type GPlace = { id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } };

function toPlaces(list: GPlace[] | undefined): Place[] {
  return (list ?? []).flatMap((p) => {
    const name = p.displayName?.text?.trim().slice(0, 120);
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    if (!name || typeof lat !== 'number' || typeof lng !== 'number') return [];
    return [{ name, address: p.formattedAddress?.slice(0, 240) ?? null, lat, lng, placeId: p.id?.slice(0, 300) ?? null }];
  });
}

async function google(path: string, body: unknown): Promise<Place[]> {
  const res = await fetch(`${PLACES}:${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY(), 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    logEvent('error', 'places_provider_error', { action: path, status: res.status });
    throw new HttpError('provider_error', 502);
  }
  return toPlaces(((await res.json()) as { places?: GPlace[] }).places).slice(0, 8);
}

serve(
  async (req) => {
    const user = await requireUser(req);
    const input = PlacesRequest.safeParse(await readJson(req));
    if (!input.success) throw new HttpError('bad_request', 400);
    if (!configured('GOOGLE_MAPS_API_KEY')) throw new HttpError('not_configured', 503);
    const { data: allowed, error } = await adminClient().rpc('place_lookup_start', { p_user: user.id });
    if (error) throw new HttpError('server', 500);
    if (!allowed) throw new HttpError('rate_limited', 429, { retryAfterSec: 60 });

    const body = input.data;
    if (body.action === 'search') {
      const near = body.near ? { locationBias: { circle: { center: { latitude: body.near.lat, longitude: body.near.lng }, radius: 30_000 } } } : {};
      return json({ places: await google('searchText', { textQuery: body.query, languageCode: body.lang, pageSize: 6, ...near }) });
    }
    if (body.action === 'nearby') {
      const center = { latitude: body.at.lat, longitude: body.at.lng };
      return json({
        places: await google('searchNearby', { locationRestriction: { circle: { center, radius: 150 } }, rankPreference: 'DISTANCE', maxResultCount: 6, languageCode: body.lang }),
      });
    }

    const at = `${body.at.lat.toFixed(6)},${body.at.lng.toFixed(6)}`;
    const q = new URLSearchParams({ center: at, zoom: '16', size: '320x150', scale: '2', format: 'png8', markers: `color:${PIN}|${at}`, key: GOOGLE_MAPS_API_KEY() });
    if (body.dark) for (const s of DARK_STYLE) q.append('style', s);
    const res = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${q}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/png')) {
      logEvent('error', 'places_staticmap_error', { status: res.status });
      throw new HttpError('provider_error', 502);
    }
    return json({ image: `data:image/png;base64,${toBase64(new Uint8Array(await res.arrayBuffer()))}` });
  },
  { service: 'places' },
);
