import { useStore } from './AppStore';
import { useAssetsOptional } from './assets';
import { usePlanningOptional } from './planning';

/** "Coba lagi" / tarik untuk muat ulang: ambil ulang semua data dari Supabase. */
export function useRetry(): () => void {
  const { reload } = useStore();
  const assets = useAssetsOptional();
  const planning = usePlanningOptional();
  return () => {
    void reload();
    void assets?.reload();
    void planning?.reload();
  };
}
