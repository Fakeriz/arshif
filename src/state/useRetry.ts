import { useStore } from './AppStore';

/** "Coba lagi" / tarik untuk muat ulang: ambil ulang semua data dari Supabase. */
export function useRetry(): () => void {
  const { reload } = useStore();
  return () => void reload();
}
