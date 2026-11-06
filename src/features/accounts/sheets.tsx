import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmountField, AppText, Button, Chip, Input } from '@/components/ui';
import type { AnnualFee } from '@/data/types';
import { FormSheet } from '@/features/planning/kit';
import { useI18n } from '@/i18n';
import { CALENDARS } from '@/i18n/calendar';
import { space } from '@/theme/tokens';

/** Limit kartu kredit/paylater (FR-ACC-3/8). */
export function CreditLimitSheet({ visible, currency, initial, onClose, onSave }: {
  visible: boolean; currency: string; initial: number | undefined; onClose: () => void; onSave: (limit: number | undefined) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState<number | null>(initial ?? null);
  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title={t('acct.limit.editTitle')}
      subtitle={t('acct.limit.editSub')}
      submitLabel={t('acct.common.save')}
      saving={false}
      onSubmit={() => {
        onSave(value && value > 0 ? value : undefined);
        onClose();
      }}
    >
      <AmountField label={`${t('acct.limit.label')} (${currency})`} value={value} onChange={setValue} currency={currency} />
      <AppText variant="caption" tone="muted">
        {t('acct.limit.emptyHint')}
      </AppText>
    </FormSheet>
  );
}

/** Iuran tahunan kartu kredit (FR-ACC-7): nominal, bulan + tanggal tagih, ambang bebas iuran. */
export function AnnualFeeSheet({ visible, currency, initial, onClose, onSave, onRemove }: {
  visible: boolean; currency: string; initial: AnnualFee | undefined; onClose: () => void; onSave: (fee: AnnualFee) => void; onRemove?: () => void;
}) {
  const { t, lang } = useI18n();
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [month, setMonth] = useState<number>(initial?.month ?? 1);
  const [day, setDay] = useState(String(initial?.day ?? 1));
  const [threshold, setThreshold] = useState<number | null>(initial?.waiverThreshold ?? null);
  const [tried, setTried] = useState(false);
  const dayN = Number(day);
  const dayOk = /^\d{1,2}$/.test(day.trim()) && dayN >= 1 && dayN <= 31;
  const amountOk = !!amount && amount > 0;

  const submit = () => {
    setTried(true);
    if (!amountOk || !dayOk) return;
    onSave({ amount: amount!, month, day: dayN, waiverThreshold: threshold && threshold > 0 ? threshold : undefined, paid: initial?.paid ?? [] });
    onClose();
  };

  return (
    <FormSheet visible={visible} onClose={onClose} title={t('acct.fee.editTitle')} subtitle={t('acct.fee.editSub')} submitLabel={t('acct.common.save')} saving={false} onSubmit={submit}>
      <AmountField label={`${t('acct.fee.amount')} (${currency})`} value={amount} onChange={setAmount} currency={currency} error={tried && !amountOk ? t('acct.fee.amountError') : undefined} />
      <View style={styles.block}>
        <AppText variant="caption" tone="secondary">
          {t('acct.fee.month')}
        </AppText>
        <View style={styles.chips}>
          {CALENDARS[lang].monthsShort.map((m, i) => (
            <Chip key={m} label={m} selected={month === i + 1} onPress={() => setMonth(i + 1)} />
          ))}
        </View>
      </View>
      <Input
        label={t('acct.fee.day')}
        value={day}
        onChangeText={setDay}
        keyboardType="number-pad"
        maxLength={2}
        error={tried && !dayOk ? t('acct.fee.dayError') : undefined}
        hint={t('acct.fee.dayHint')}
      />
      <AmountField label={`${t('acct.fee.threshold')} (${currency})`} value={threshold} onChange={setThreshold} currency={currency} />
      <AppText variant="caption" tone="muted">
        {t('acct.fee.thresholdHint')}
      </AppText>
      {onRemove && (
        <Button
          label={t('acct.fee.remove')}
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => {
            onRemove();
            onClose();
          }}
        />
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
