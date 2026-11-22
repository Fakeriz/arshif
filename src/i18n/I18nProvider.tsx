import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

/** Bahasa pilihan disimpan di perangkat: dipilih di layar Sambut sebelum login, bertahan saat dimuat ulang. */
const LANG_KEY = 'arshif.lang';

/** Web: localStorage bisa dibaca sinkron sebelum render pertama (tanpa kedipan bahasa). */
function storedLangSync(): Lang | null {
  if (Platform.OS !== 'web') return null;
  try {
    const v = globalThis.localStorage?.getItem(LANG_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
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
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? storedLangSync() ?? detectLang());
  const touched = useRef(false);

  // Native: baca bahasa tersimpan sekali, kecuali sudah diganti (profil server menang setelah login).
  useEffect(() => {
    if (initialLang || Platform.OS === 'web') return;
    AsyncStorage.getItem(LANG_KEY)
      .then((v) => {
        if (!touched.current && isLang(v)) setLangState(v);
      })
      .catch(() => undefined);
  }, [initialLang]);

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
        touched.current = true;
        setLangState(next);
        AsyncStorage.setItem(LANG_KEY, next).catch(() => undefined);
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
