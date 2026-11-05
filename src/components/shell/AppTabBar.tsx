import { ChartPie, House, ListOrdered, Wallet } from 'lucide-react-native';
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';

import { GlassTabBar } from '@/components/ui';
import { useT } from '@/i18n';

import { CaptureSheet } from './CaptureSheet';
import { useNavFootprint } from './Screen';

type TabKey = 'home' | 'transaksi' | 'anggaran' | 'aset';

const ROUTES: Record<TabKey, '/' | '/transaksi' | '/anggaran' | '/aset'> = {
  home: '/',
  transaksi: '/transaksi',
  anggaran: '/anggaran',
  aset: '/aset',
};

function activeTab(path: string): TabKey {
  if (path.startsWith('/transaksi')) return 'transaksi';
  if (path.startsWith('/anggaran')) return 'anggaran';
  if (path.startsWith('/aset')) return 'aset';
  return 'home';
}

export function AppTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [capture, setCapture] = useState(false);
  const t = useT();
  const { setFootprint } = useNavFootprint();

  return (
    <>
      <GlassTabBar<TabKey>
        value={activeTab(pathname)}
        onChange={(key) => router.navigate(ROUTES[key])}
        onPressAdd={() => setCapture(true)}
        onFootprint={setFootprint}
        items={[
          { key: 'home', label: t('shell.tab.home'), icon: House },
          { key: 'transaksi', label: t('shell.tab.transactions'), icon: ListOrdered },
          { key: 'anggaran', label: t('shell.tab.budget'), icon: ChartPie },
          { key: 'aset', label: t('shell.tab.assets'), icon: Wallet },
        ]}
      />
      <CaptureSheet visible={capture} onClose={() => setCapture(false)} />
    </>
  );
}
