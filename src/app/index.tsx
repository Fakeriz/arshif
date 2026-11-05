import { Redirect } from 'expo-router';

/**
 * Fase 0: aplikasi membuka Lembar Desain untuk persetujuan identitas visual.
 * Di Fase 1 rute ini diganti alur onboarding/Home.
 */
export default function Index() {
  return <Redirect href="/design" />;
}
