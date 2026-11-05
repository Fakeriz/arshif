import { useRouter } from 'expo-router';

/** Fase 1: "Coba lagi" menghapus paksaan state di URL. Fase 2: memicu refetch sungguhan. */
export function useRetry(): () => void {
  const router = useRouter();
  return () => router.setParams({ state: '' });
}
