import { getLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { makeT, type TFunction } from './translate';
import { DEFAULT_LANG, isLang, LANGS, type Lang } from './types';

type I18nValue = { lang: Lang; setLang: (lang: Lang) => void; t: TFunction };

const I18nContext = createContext<I18nValue | null>(null);

/** Bahasa perangkat bila didukung, selain itu Indonesia (PRD: default Indonesia). */
export function detectLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode;
    return isLang(code) ? code : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

type I18nProviderProps = {
  children: ReactNode;
  /** Bahasa tersimpan milik pengguna. Fase 2: dibaca dari profil Supabase. */
  initialLang?: Lang;
  /** Dipanggil saat pengguna mengganti bahasa, untuk disimpan per pengguna. */
  onLangChange?: (lang: Lang) => void;
};

export function I18nProvider({ children, initialLang, onLangChange }: I18nProviderProps) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? detectLang());

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = LANGS.find((l) => l.key === lang)?.bcp47 ?? lang;
    }
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      t: makeT(lang),
      setLang: (next) => {
        setLangState(next);
        onLangChange?.(next);
      },
    }),
    [lang, onLangChange],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const FALLBACK: I18nValue = { lang: DEFAULT_LANG, t: makeT(DEFAULT_LANG), setLang: () => undefined };

/** Tanpa provider (mis. test komponen tunggal) jatuh ke Indonesia, bukan error. */
export function useI18n(): I18nValue {
  return useContext(I18nContext) ?? FALLBACK;
}

export function useT(): TFunction {
  return useI18n().t;
}
