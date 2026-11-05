import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { AppTabBar } from '@/components/shell/AppTabBar';

/**
 * Tab headless: TabTrigger mendaftarkan rute, pill kaca (AppTabBar) jadi satu-satunya nav yang terlihat.
 * "Anggaran" memakai slot tab "Planning" di PRD selama hub Planning belum dibangun.
 */
export default function TabsLayout() {
  return (
    <Tabs style={styles.root}>
      <TabSlot />
      <TabList style={styles.hidden}>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="transaksi" href="/transaksi" />
        <TabTrigger name="anggaran" href="/anggaran" />
        <TabTrigger name="coach" href="/coach" />
      </TabList>
      <AppTabBar />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: 'none' },
});
