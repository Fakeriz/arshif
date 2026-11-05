import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Icon, PressableScale } from '@/components/ui';
import { useT } from '@/i18n';
import { BUCKETS, splitIsValid, type Split } from '@/lib/budget';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const STEP = 5;

export function SplitSheet({ visible, onClose, split, onSave }: { visible: boolean; onClose: () => void; split: Split; onSave: (s: Split) => void }) {
  const { colors } = useTheme();
  const t = useT();
  const [draft, setDraft] = useState(split);
  useEffect(() => {
    if (visible) setDraft(split);
  }, [visible, split]);

  const total = draft.needs + draft.wants + draft.savings;
  const valid = splitIsValid(draft);
  const bump = (key: keyof Split, by: number) => setDraft((d) => ({ ...d, [key]: Math.max(0, Math.min(100, d[key] + by)) }));

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('budget.split.title')} subtitle={t('budget.split.subtitle')}>
      <View style={styles.list}>
        {BUCKETS.map((b) => {
          const label = t(`domain.bucket.${b.key}`);
          return (
            <View key={b.key} style={styles.row}>
              <AppText variant="bodyStrong" style={styles.flex}>
                {label}
              </AppText>
              <PressableScale accessibilityLabel={t('budget.split.decrease', { label })} onPress={() => bump(b.key, -STEP)} focusRadius={radius.full} style={[styles.btn, { backgroundColor: colors.track }]}>
                <Icon icon={Minus} color={colors.text} />
              </PressableScale>
              <AppText variant="h3" numeric style={styles.value} aria-live="polite">
                {`${draft[b.key]}%`}
              </AppText>
              <PressableScale accessibilityLabel={t('budget.split.increase', { label })} onPress={() => bump(b.key, STEP)} focusRadius={radius.full} style={[styles.btn, { backgroundColor: colors.track }]}>
                <Icon icon={Plus} color={colors.text} />
              </PressableScale>
            </View>
          );
        })}
      </View>
      <AppText variant="caption" tone={valid ? 'positive' : 'negative'} aria-live="polite" style={styles.total}>
        {valid ? t('budget.split.valid') : total > 100 ? t('budget.split.over', { total, n: total - 100 }) : t('budget.split.under', { total, n: 100 - total })}
      </AppText>
      <Button
        label={t('budget.split.save')}
        fullWidth
        disabled={!valid}
        onPress={() => {
          onSave(draft);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  btn: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  value: { width: 56, textAlign: 'center' },
  total: { marginVertical: space.xl },
});
