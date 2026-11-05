/** Bahasa aplikasi (PRD Bab 2): Indonesia (default), Melayu, Turki, Inggris. */
export type Lang = 'id' | 'ms' | 'tr' | 'en';

export const LANGS: { key: Lang; nativeName: string; bcp47: string }[] = [
  { key: 'id', nativeName: 'Bahasa Indonesia', bcp47: 'id-ID' },
  { key: 'ms', nativeName: 'Bahasa Melayu', bcp47: 'ms-MY' },
  { key: 'tr', nativeName: 'Türkçe', bcp47: 'tr-TR' },
  { key: 'en', nativeName: 'English', bcp47: 'en' },
];

export const DEFAULT_LANG: Lang = 'id';

export function isLang(v: unknown): v is Lang {
  return v === 'id' || v === 'ms' || v === 'tr' || v === 'en';
}

/** Bentuk katalog: pohon objek dengan daun string. */
export type Catalog = { [key: string]: string | Catalog };

/** Semua jalur bertitik ke daun string, mis. "home.greeting.morning". */
export type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type Vars = Record<string, string | number>;
