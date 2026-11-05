import { useStore } from './AppStore';

export type LoadState = 'ready' | 'loading' | 'error';

/** Keadaan muat data layar dari status store (Supabase). */
export function useLoadState(): LoadState {
  const { state } = useStore();
  if (state.status === 'loading' || state.status === 'idle') return 'loading';
  if (state.status === 'error') return 'error';
  return 'ready';
}
