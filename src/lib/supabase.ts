import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/config/public';

/**
 * Klien Supabase. Hanya URL + publishable key (publik) di klien; secret tidak pernah di bundle (PRD Bab 9).
 * Sesi disimpan di AsyncStorage dan diperbarui otomatis (FR-AUTH-1).
 */

const isServer = Platform.OS === 'web' && typeof window === 'undefined';
const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: isServer || isTest ? undefined : AsyncStorage,
    autoRefreshToken: !isServer && !isTest,
    persistSession: !isServer && !isTest,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Native: refresh token hanya saat aplikasi aktif (saran resmi Supabase untuk React Native).
if (Platform.OS !== 'web' && !isTest) {
  AppState.addEventListener('change', (s) => {
    if (s === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
