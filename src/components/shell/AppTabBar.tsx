import { Activity, ChartPie, House, ListOrdered } from 'lucide-react-native';
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';

import { GlassTabBar } from '@/components/ui';

import { CaptureSheet } from './CaptureSheet';

type TabKey = 'home' | 'transaksi' | 'anggaran' | 'coach';

const ROUTES: Record<TabKey, '/' | '/transaksi' | '/anggaran' | '/coach'> = {
  home: '/',
  transaksi: '/transaksi',
  anggaran: '/anggaran',
  coach: '/coach',
};

function activeTab(path: string): TabKey {
  if (path.startsWith('/transaksi')) return 'transaksi';
  if (path.startsWith('/anggaran')) return 'anggaran';
  if (path.startsWith('/coach')) return 'coach';
  return 'home';
}

export function AppTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [capture, setCapture] = useState(false);

  return (
    <>
      <GlassTabBar<TabKey>
        value={activeTab(pathname)}
        onChange={(key) => router.navigate(ROUTES[key])}
        onPressAdd={() => setCapture(true)}
        items={[
          { key: 'home', label: 'Home', icon: House },
          { key: 'transaksi', label: 'Transaksi', icon: ListOrdered },
          { key: 'anggaran', label: 'Anggaran', icon: ChartPie },
          { key: 'coach', label: 'Coach', icon: Activity },
        ]}
      />
      <CaptureSheet visible={capture} onClose={() => setCapture(false)} />
    </>
  );
}
