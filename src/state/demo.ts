import { useGlobalSearchParams } from 'expo-router';

/**
 * Fase 1: state layar bisa dipaksa lewat `?state=` agar semua keadaan bisa dilihat dan
 * dicek visual (loading, empty, error, limit). Dihapus di Fase 2 saat data datang dari server.
 */
export type DemoState = 'ready' | 'loading' | 'empty' | 'error' | 'limit';

const VALID: DemoState[] = ['loading', 'empty', 'error', 'limit'];

export function useDemoState(): DemoState {
  const { state } = useGlobalSearchParams<{ state?: string }>();
  const value = Array.isArray(state) ? state[0] : state;
  return VALID.includes(value as DemoState) ? (value as DemoState) : 'ready';
}
