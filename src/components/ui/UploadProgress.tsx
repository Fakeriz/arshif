import { Check, FileText, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PopOnMount } from './PopIn';
import { ProgressBar } from './ProgressBar';
import { formatPct } from './TrendBadge';

export type UploadProgressProps = { fileName: string; /** 0–1; ≥ 1 = selesai. */ progress: number; icon?: LucideIcon };

/** Status unggah berkas (struk, rekening koran): batang terisi, lalu ikon berganti centang yang meletup. */
export function UploadProgress({ fileName, progress, icon = FileText }: UploadProgressProps) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const done = progress >= 1;
  const status = done ? t('common.ui.uploaded') : t('common.ui.uploading', { pct: formatPct(t, lang, Math.max(0, progress), 0) });

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${fileName}, ${status}`} style={styles.row}>
      <View style={[styles.icon, { backgroundColor: done ? colors.positiveSoft : colors.surfaceSunken }]}>
        <PopOnMount key={String(done)}>
          <Icon icon={done ? Check : icon} color={done ? colors.positive : colors.textSecondary} />
        </PopOnMount>
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {fileName}
        </AppText>
        <AppText variant="caption" tone="muted" numeric aria-live="polite">
          {status}
        </AppText>
        <ProgressBar value={progress} tone={done ? 'positive' : 'accent'} height={6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: space.xs },
});
