import { CalendarDays, CircleAlert, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { dayLong, parseYMD } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Calendar, dateKey } from './Calendar';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export type DateFieldProps = {
  label: string;
  /** "YYYY-MM-DD" atau '' bila kosong. */
  value: string;
  onChange: (value: string) => void;
  /** Pesan galat di bawah kolom; true = pesan bawaan "Pilih tanggal". */
  error?: boolean | string;
  /** Boleh kosong: sheet menampilkan tombol "Hapus tanggal". */
  optional?: boolean;
  /** Peringatan lunak (mis. OCR kurang yakin); kalah prioritas dari error. */
  warning?: string;
  minDate?: Date;
  maxDate?: Date;
};

/** Kolom tanggal: tampil seperti input, ketuk membuka kalender di bottom sheet (Motion Kit "Kalender"). */
export function DateField({ label, value, onChange, error, optional, warning, minDate, maxDate }: DateFieldProps) {
  const { colors, scheme } = useTheme();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const valid = YMD.test(value);
  const selected = valid ? (({ y, m, d }) => new Date(y, m - 1, d))(parseYMD(value)) : null;
  const message = typeof error === 'string' ? error : error ? t('common.ui.pickDate') : undefined;

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <PressableScale
        accessibilityLabel={`${label}, ${valid ? dayLong(value, lang) : t('common.ui.pickDate')}`}
        onPress={() => setOpen(true)}
        focusRadius={radius.field}
        scaleTo={0.99}
        style={[
          styles.field,
          { backgroundColor: scheme === 'dark' ? colors.surfaceAlt : colors.surface, borderColor: message ? colors.negative : warning ? colors.warning : colors.borderStrong },
        ]}
      >
        <AppText variant="body" tone={valid ? 'primary' : 'muted'} numberOfLines={1} style={styles.flex}>
          {valid ? dayLong(value, lang) : t('common.ui.pickDate')}
        </AppText>
        <Icon icon={CalendarDays} color={colors.textMuted} size={layout.iconSize.md - 2} />
      </PressableScale>
      {message ? (
        <View style={styles.message} aria-live="polite">
          <Icon icon={CircleAlert} color={colors.negative} size={layout.iconSize.sm} />
          <AppText variant="caption" tone="negative" style={styles.flex}>
            {message}
          </AppText>
        </View>
      ) : warning ? (
        <View style={styles.message}>
          <Icon icon={TriangleAlert} color={colors.warning} size={layout.iconSize.sm} />
          <AppText variant="caption" tone="warning" style={styles.flex}>
            {warning}
          </AppText>
        </View>
      ) : null}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={styles.sheet}>
          <Calendar
            value={selected}
            onChange={(d) => {
              onChange(dateKey(d));
              setOpen(false);
            }}
            minDate={minDate}
            maxDate={maxDate}
          />
          {optional && valid ? (
            <Button
              label={t('common.ui.clearDate')}
              variant="ghost"
              onPress={() => {
                onChange('');
                setOpen(false);
              }}
            />
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  field: {
    minHeight: layout.inputHeight,
    borderRadius: radius.field,
    borderWidth: layout.hairline,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  flex: { flex: 1 },
  message: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  sheet: { gap: space.md, paddingBottom: space.sm },
});
