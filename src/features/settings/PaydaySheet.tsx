import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Chip } from '@/components/ui';
import { useI18n } from '@/i18n';
import { budgetPeriod, PAYDAY_MAX, PAYDAY_MIN } from '@/lib/budget';
import { shortDate, todayYmd } from '@/lib/dates';
import { space } from '@/theme/tokens';

const DAYS = Array.from({ length: PAYDAY_MAX - PAYDAY_MIN + 1 }, (_, i) => PAYDAY_MIN + i);

/**
 * Tanggal gajian (FR-BDG-6): bulan budget dimulai di tanggal ini. 1-28 supaya ada di setiap bulan.
 * Pratinjau periode langsung terlihat sebelum menutup sheet.
 */
export function PaydaySheet({ visible, value, onClose, onChange }: { visible: boolean; value: number; onClose: () => void; onChange: (day: number) => void }) {
  const { t, lang } = useI18n();
  const p = budgetPeriod(todayYmd(), value);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('settings.payday.title')} subtitle={t('settings.payday.sub')}>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {DAYS.map((d) => (
          <Chip key={d} label={String(d)} selected={d === value} onPress={() => onChange(d)} />
        ))}
      </View>
      <AppText variant="caption" tone="secondary" aria-live="polite">
        {t('settings.payday.preview', { start: shortDate(p.start, lang), end: shortDate(p.end, lang) })}
      </AppText>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
});
