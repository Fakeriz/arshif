import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { AppTabBar } from '@/components/shell/AppTabBar';
import { NavFootprintProvider } from '@/components/shell/Screen';
import { BlurTarget } from '@/components/ui';

/**
 * Tab headless: TabTrigger mendaftarkan rute, pill kaca (AppTabBar) jadi satu-satunya nav yang terlihat.
 * "Anggaran" memakai slot tab "Planning" di PRD selama hub Planning belum dibangun.
 * Coach bukan tab: layar stack yang dibuka dari aksi cepat Home.
 */
export default function TabsLayout() {
  return (
    <NavFootprintProvider>
      <Tabs style={styles.root}>
        {/* Konten tab = sumber blur nav pill di Android (pill berada di luar target). */}
        <BlurTarget style={styles.root} floating={<AppTabBar />}>
          <TabSlot style={styles.slot} />
        </BlurTarget>
        <TabList style={styles.hidden}>
          <TabTrigger name="index" href="/" />
          <TabTrigger name="transaksi" href="/transaksi" />
          <TabTrigger name="anggaran" href="/anggaran" />
          <TabTrigger name="aset" href="/aset" />
        </TabList>
      </Tabs>
    </NavFootprintProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // TabSlot memberi container layar tab flexShrink: 0. Di web itu membuatnya setinggi isinya, sehingga
  // ScrollView di Screen tidak pernah lebih pendek dari kontennya dan halaman tidak bisa digulir.
  // Boleh menyusut = tinggi mengikuti layar, ScrollView yang menggulir. Native (Yoga) tidak terpengaruh.
  slot: { flexShrink: 1, minHeight: 0 },
  hidden: { display: 'none' },
});
