import { en } from './locales/en';
import { id, type Messages } from './locales/id';
import { ms } from './locales/ms';
import { tr } from './locales/tr';
import type { Catalog, Lang, Paths, Vars } from './types';

export type MsgKey = Paths<Messages>;

const CATALOGS: Record<Lang, Messages> = { id, ms, tr, en };

function lookup(catalog: Catalog, key: string): string | undefined {
  let node: string | Catalog | undefined = catalog;
  for (const part of key.split('.')) {
    if (node == null || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Terjemahkan `key` ke `lang`. `{nama}` diganti dari `vars`.
 * Bentuk tunggal: bila `vars.count === 1` dan ada kunci `<key>_one`, kunci itu yang dipakai
 * (perlu untuk Inggris; ID/MS/TR tidak membedakan).
 * Kunci yang hilang jatuh ke Indonesia, lalu ke kunci itu sendiri (tidak pernah layar kosong).
 */
export function translate(lang: Lang, key: MsgKey | string, vars?: Vars): string {
  const cat = CATALOGS[lang] as unknown as Catalog;
  const one = vars?.count === 1 ? lookup(cat, `${key}_one`) : undefined;
  const raw = one ?? lookup(cat, key) ?? lookup(CATALOGS.id as unknown as Catalog, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export type TFunction = (key: MsgKey, vars?: Vars) => string;

export function makeT(lang: Lang): TFunction {
  return (key, vars) => translate(lang, key, vars);
}

/** Untuk test: katalog mentah per bahasa. */
export function catalogFor(lang: Lang): Messages {
  return CATALOGS[lang];
}
