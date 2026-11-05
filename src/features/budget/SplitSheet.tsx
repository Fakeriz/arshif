import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Icon, PressableScale } from '@/components/ui';
import { BUCKETS, splitIsValid, type Split } from '@/lib/budget';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const STEP = 5;

export function SplitSheet({ visible, onClose, split, onSave }: { visible: boolean; onClose: () => void; split: Split; onSave: (s: Split) => void }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(split);
  useEffect(() => {
    if (visible) setDraft(split);
  }, [visible, split]);

  const total = draft.needs + draft.wants + draft.savings;
  const valid = splitIsValid(draft);
  const bump = (key: keyof Split, by: number) => setDraft((d) => ({ ...d, [key]: Math.max(0, Math.min(100, d[key] + by)) }));

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Atur persentase anggaran" subtitle="Total harus tepat 100%">
      <View style={styles.list}>
        {BUCKETS.map((b) => (
          <View key={b.key} style={styles.row}>
            <AppText variant="bodyStrong" style={styles.flex}>
              {b.label}
            </AppText>
            <PressableScale accessibilityLabel={`Kurangi ${b.label}`} onPress={() => bump(b.key, -STEP)} focusRadius={radius.full} style={[styles.btn, { backgroundColor: colors.track }]}>
              <Icon icon={Minus} color={colors.text} />
            </PressableScale>
            <AppText variant="h3" numeric style={styles.value} aria-live="polite">
              {`${draft[b.key]}%`}
            </AppText>
            <PressableScale accessibilityLabel={`Tambah ${b.label}`} onPress={() => bump(b.key, STEP)} focusRadius={radius.full} style={[styles.btn, { backgroundColor: colors.track }]}>
              <Icon icon={Plus} color={colors.text} />
            </PressableScale>
          </View>
        ))}
      </View>
      <AppText variant="caption" tone={valid ? 'positive' : 'negative'} aria-live="polite" style={styles.total}>
        {valid ? 'Total 100%, siap disimpan' : `Total ${total}%. ${total > 100 ? `Kurangi ${total - 100}%` : `Tambah ${100 - total}%`} agar pas 100%.`}
      </AppText>
      <Button
        label="Simpan persentase"
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
