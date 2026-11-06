import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { AppText, BottomSheet, Icon, ListItem, ProBadge } from '@/components/ui';
import { useLimits } from '@/state/limits';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { captureOptions, type CaptureKey, type MoreOption } from './captureOptions';
import { usePaywall } from './Paywall';

/** Satu kelompok di sheet: judul seksi (opsional) + cara mencatat dan/atau entri fitur lain. */
export type CaptureSection = { key: string; title?: string; keys?: CaptureKey[]; extras?: MoreOption[] };

type CaptureSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Bawaan: satu seksi tanpa judul berisi semua cara mencatat (sheet "+ Catat"). */
  sections?: CaptureSection[];
};

/** Sheet "+ Catat" dan "Lainnya". Fitur yang kuotanya habis membuka Premium, bukan error mentah. */
export function CaptureSheet({ visible, onClose, title, subtitle, sections }: CaptureSheetProps) {
  const router = useRouter();
  const paywall = usePaywall();
  const t = useT();
  const { colors } = useTheme();
  const all = captureOptions(useLimits(), t);
  const groups = (sections ?? [{ key: 'all' }]).map((s) => ({
    ...s,
    // Tanpa `keys`: seksi berisi semua cara mencatat, kecuali seksi yang hanya berisi entri lain (`extras`).
    options: [...(s.keys ? all.filter((o) => s.keys!.includes(o.key)) : s.extras ? [] : all), ...(s.extras ?? [])] as MoreOption[],
  }));

  return (
    <BottomSheet scrollable visible={visible} onClose={onClose} title={title ?? t('shell.capture.title')} subtitle={subtitle ?? t('shell.capture.subtitle')}>
      {groups.map((g, gi) => (
        <View key={g.key} style={gi > 0 ? styles.section : undefined}>
          {g.title && (
            <AppText variant="caption" tone="secondary" accessibilityRole="header" style={styles.sectionTitle}>
              {g.title}
            </AppText>
          )}
          {g.options.map((o, i) => (
            <ListItem
              key={o.key}
              leading={
                <View style={[styles.icon, { backgroundColor: o.limited ? colors.track : colors.accentSoft }]}>
                  <Icon icon={o.icon} color={o.limited ? colors.textSecondary : colors.accentText} />
                </View>
              }
              title={o.title}
              subtitle={o.sub}
              subtitleLines={2}
              trailing={o.limited ? <ProBadge size="sm" /> : undefined}
              chevron={!o.limited}
              divider={i < g.options.length - 1}
              onPress={() => {
                onClose();
                if (o.limited) paywall(o.reason);
                else router.push(o.href);
              }}
            />
          ))}
        </View>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: space.lg },
  sectionTitle: { paddingHorizontal: space.xs, marginBottom: space.xxs },
});
