import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge, BottomSheet, Icon, ListItem } from '@/components/ui';
import { useLimits } from '@/state/limits';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { captureOptions } from './captureOptions';
import { usePaywall } from './Paywall';

/** Sheet "+ Catat": empat cara mencatat. Fitur yang kuotanya habis membuka Premium, bukan error mentah. */
export function CaptureSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const paywall = usePaywall();
  const options = captureOptions(useLimits());
  const { colors } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Catat transaksi" subtitle="Pilih cara tercepat untukmu">
      {options.map((o, i) => (
        <ListItem
          key={o.key}
          leading={
            <View style={[styles.icon, { backgroundColor: o.limited ? colors.track : colors.accentSoft }]}>
              <Icon icon={o.icon} color={o.limited ? colors.textSecondary : colors.accentText} />
            </View>
          }
          title={o.title}
          subtitle={o.sub}
          trailing={o.limited ? <Badge label="Batas" tone="warning" /> : undefined}
          chevron={!o.limited}
          divider={i < options.length - 1}
          onPress={() => {
            onClose();
            if (o.limited) paywall(o.reason);
            else router.push(o.href);
          }}
        />
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
