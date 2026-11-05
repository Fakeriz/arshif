import { StyleSheet, View } from 'react-native';

import { AmountInput, AppText, Card, Input, Tabs } from '@/components/ui';
import { useT } from '@/i18n';
import { BUCKETS, DEFAULT_SPLIT } from '@/lib/budget';
import { space } from '@/theme/tokens';

import { splitTotal, type SetupDraft } from './draft';

type Errors = { income?: boolean; payday?: boolean; split?: boolean };
type Props = { value: SetupDraft; errors: Errors; onChange: (patch: Partial<SetupDraft>) => void };

/** Penghasilan, tanggal gajian, dan pembagian 50/30/20 atau kustom (FR-BDG-1, FR-BDG-6). */
export function StepBudget({ value, errors, onChange }: Props) {
  const t = useT();
  const custom = value.splitMode === 'custom';
  const total = splitTotal(value.split);
  return (
    <Card>
      <View style={styles.block}>
        <AmountInput
          label={t('auth.setup.budget.income')}
          value={value.income}
          onChange={(income) => onChange({ income })}
          currency={value.mainCurrency}
          error={errors.income ? t('auth.setup.budget.errorIncome') : undefined}
        />
        <Input
          label={t('auth.setup.budget.payday')}
          value={value.payday}
          onChangeText={(payday) => onChange({ payday: payday.replace(/\D/g, '').slice(0, 2) })}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={2}
          hint={errors.payday ? undefined : t('auth.setup.budget.paydayHint')}
          error={errors.payday ? t('auth.setup.budget.errorPayday') : undefined}
        />
        <View style={styles.group}>
          <AppText variant="caption" tone="secondary">
            {t('auth.setup.budget.style')}
          </AppText>
          <Tabs
            items={[
              { key: 'preset', label: t('auth.setup.budget.preset') },
              { key: 'custom', label: t('auth.setup.budget.custom') },
            ]}
            value={custom ? 'custom' : 'preset'}
            onChange={(k) => onChange(k === 'preset' ? { splitMode: k, split: DEFAULT_SPLIT } : { splitMode: k })}
            accessibilityLabel={t('auth.setup.budget.style')}
          />
        </View>
        {custom && (
          <View style={styles.group}>
            {BUCKETS.map(({ key }) => {
              const label = t(`domain.bucket.${key}`);
              return (
                <Input
                  key={key}
                  label={t('auth.setup.budget.percent', { label })}
                  value={String(value.split[key])}
                  onChangeText={(v) => onChange({ split: { ...value.split, [key]: Number(v.replace(/\D/g, '').slice(0, 3) || '0') } })}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={3}
                />
              );
            })}
            <AppText variant="caption" tone={total === 100 ? 'secondary' : 'warning'} accessibilityLiveRegion="polite">
              {errors.split || total !== 100 ? t('auth.setup.budget.errorTotal', { total }) : t('auth.setup.budget.total', { total })}
            </AppText>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.lg },
  group: { gap: space.sm },
});
