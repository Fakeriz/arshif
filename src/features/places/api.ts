import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { FnError, invokeFn } from '@/data/remote/functions';
import type { TxPlace } from '@/data/types';

import { FUNCTIONS, PlaceMapResult, PlacesResult, type Lang, type Place } from '../../../supabase/functions/_shared/contracts';

export type LatLng = { lat: number; lng: number };

const toTxPlace = (p: Place): TxPlace => ({ name: p.name, address: p.address ?? undefined, lat: p.lat, lng: p.lng, placeId: p.placeId ?? undefined });

export async function searchPlaces(query: string, lang: Lang, near: LatLng | null): Promise<TxPlace[]> {
  const r = await invokeFn(FUNCTIONS.places, { action: 'search', query, lang, near }, PlacesResult);
  return r.places.map(toTxPlace);
}

export async function nearbyPlaces(at: LatLng, lang: Lang): Promise<TxPlace[]> {
  const r = await invokeFn(FUNCTIONS.places, { action: 'nearby', at, lang }, PlacesResult);
  return r.places.map(toTxPlace);
}

/** Peta statis berbayar per panggilan: disimpan per koordinat selama aplikasi terbuka. */
const maps = new Map<string, Promise<string>>();
export function placeMapImage(at: LatLng, dark: boolean): Promise<string> {
  const key = `${at.lat.toFixed(5)},${at.lng.toFixed(5)},${dark ? 'd' : 'l'}`;
  let p = maps.get(key);
  if (!p) {
    p = invokeFn(FUNCTIONS.places, { action: 'map', at, dark }, PlaceMapResult).then((r) => r.image);
    p.catch(() => maps.delete(key));
    maps.set(key, p);
  }
  return p;
}

/**
 * Posisi sekarang. ask=false tidak pernah memunculkan dialog izin (dipakai tebakan otomatis);
 * ask=true memintanya sekali (tombol "Lokasi saya"). 'denied' = pengguna menolak izin.
 */
export async function currentPosition(ask: boolean): Promise<LatLng | 'denied' | null> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return ask ? 'denied' : null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export function openInMaps(p: TxPlace): void {
  const q = new URLSearchParams({ api: '1', query: `${p.lat},${p.lng}` });
  if (p.placeId) q.set('query_place_id', p.placeId);
  void Linking.openURL(`https://www.google.com/maps/search/?${q}`);
}

/** Kode error → kunci pesan untuk layar. */
export const placeErrorKey = (e: unknown) =>
  e instanceof Error && e.message === 'denied'
    ? ('tx.place.permissionDenied' as const)
    : e instanceof Error && e.message === 'gps'
      ? ('tx.place.gpsFailed' as const)
      : e instanceof FnError && e.code === 'not_configured'
    ? ('tx.place.notConfigured' as const)
    : e instanceof FnError && e.code === 'rate_limited'
      ? ('tx.place.rateLimited' as const)
      : ('tx.place.failed' as const);
