import { Check, Crown } from 'lucide-react-native';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Icon } from '@/components/ui';
import { useT, type TFunction } from '@/i18n';
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

function benefits(t: TFunction): string[] {
  return [
    t('shell.paywall.benefitScan', { premium: QUOTAS.premium.scan ?? 0, free: QUOTAS.free.scan ?? 0 }),
    t('shell.paywall.benefitPdf', { premium: QUOTAS.premium.importPdf ?? 0, free: QUOTAS.free.importPdf ?? 0 }),
    t('shell.paywall.benefitUnlimited'),
    t('shell.paywall.benefitVoice'),
    t('shell.paywall.benefitCoach'),
    t('shell.paywall.benefitTax'),
  ];
}

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<string | null>(null);
  const open = useCallback((r: string) => setReason(r), []);
  const { colors } = useTheme();
  const t = useT();

  return (
    <PaywallContext.Provider value={open}>
      {children}
      <BottomSheet scrollable visible={reason !== null} onClose={() => setReason(null)} title={t('shell.paywall.title')} subtitle={reason ?? undefined}>
        <View style={styles.list}>
          {benefits(t).map((b) => (
            <View key={b} style={styles.row}>
              <Icon icon={Check} color={colors.positive} size={18} />
              <AppText variant="body" style={styles.flex}>
                {b}
              </AppText>
            </View>
          ))}
        </View>
        <Button
          label={t('shell.paywall.cta')}
          icon={Crown}
          fullWidth
          onPress={() => {
            const alasan = reason ?? undefined;
            setReason(null);
            router.push({ pathname: '/premium', params: alasan ? { alasan } : {} });
          }}
        />
        <Button label={t('shell.paywall.later')} variant="ghost" fullWidth onPress={() => setReason(null)} />
      </BottomSheet>
    </PaywallContext.Provider>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md, marginBottom: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
});
