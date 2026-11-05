import { Check, Crown } from 'lucide-react-native';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Icon, useToast } from '@/components/ui';
import { QUOTAS } from '@/lib/quota';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const PaywallContext = createContext<((reason: string) => void) | null>(null);

/** Buka sheet Premium dari layar mana pun, dengan alasan yang spesifik (bukan error mentah). */
export function usePaywall(): (reason: string) => void {
  const open = useContext(PaywallContext);
  if (!open) throw new Error('usePaywall harus dipakai di dalam <PaywallProvider>');
  return open;
}

const BENEFITS = [
  `Scan struk ${QUOTAS.premium.scan}/bulan (Free ${QUOTAS.free.scan})`,
  `Import rekening koran PDF ${QUOTAS.premium.importPdf}/bulan (Free ${QUOTAS.free.importPdf})`,
  'Akun, goals, dan tagihan tanpa batas',
  'Voice Log dan automation tanpa batas',
  'Recap bulanan dan Tanya Coach 20 pertanyaan/hari',
  'Alat pajak lengkap dan ekspor PDF',
];

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<string | null>(null);
  const open = useCallback((r: string) => setReason(r), []);
  const { show } = useToast();
  const { colors } = useTheme();

  return (
    <PaywallContext.Provider value={open}>
      {children}
      <BottomSheet visible={reason !== null} onClose={() => setReason(null)} title="Buka batas dengan Premium" subtitle={reason ?? undefined}>
        <View style={styles.list}>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.row}>
              <Icon icon={Check} color={colors.positive} size={18} />
              <AppText variant="body" style={styles.flex}>
                {b}
              </AppText>
            </View>
          ))}
        </View>
        <Button
          label="Lihat paket Premium"
          icon={Crown}
          fullWidth
          onPress={() => {
            setReason(null);
            show({ tone: 'info', title: 'Pembelian belum aktif', message: 'Pilihan paket dan harga muncul setelah RevenueCat terhubung di Fase 3.' });
          }}
        />
        <Button label="Nanti saja" variant="ghost" fullWidth onPress={() => setReason(null)} />
      </BottomSheet>
    </PaywallContext.Provider>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md, marginBottom: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
});
