import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { Badge, BottomSheet, Icon, ListItem } from '@/components/ui';
import { useLimits } from '@/state/limits';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { captureOptions, type CaptureKey } from './captureOptions';
import { usePaywall } from './Paywall';

type CaptureSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Subset cara mencatat (sheet "Lainnya" di Home). Bawaan: keempatnya. */
  keys?: CaptureKey[];
  title?: string;
  subtitle?: string;
};

/** Sheet "+ Catat": empat cara mencatat. Fitur yang kuotanya habis membuka Premium, bukan error mentah. */
export function CaptureSheet({ visible, onClose, keys, title, subtitle }: CaptureSheetProps) {
  const router = useRouter();
  const paywall = usePaywall();
  const t = useT();
  const options = captureOptions(useLimits(), t).filter((o) => !keys || keys.includes(o.key));
  const { colors } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title ?? t('shell.capture.title')} subtitle={subtitle ?? t('shell.capture.subtitle')}>
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
          trailing={o.limited ? <Badge label={t('shell.capture.limitBadge')} tone="warning" /> : undefined}
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
