import { StyleSheet, View } from 'react-native';

import { AmountInput, AppText, BankCard, Card, Chip, Input } from '@/components/ui';
import type { AccountType } from '@/data/types';
import { useT } from '@/i18n';
import { PINNED_CURRENCIES } from '@/lib/money';
import { space } from '@/theme/tokens';

import { BankGrid } from './BankGrid';
import type { SetupDraft } from './draft';

const TYPES: AccountType[] = ['tabungan', 'cash', 'ewallet', 'kartu_kredit', 'paylater'];

type Props = { value: SetupDraft['account']; mainCurrency: string; nameError: boolean; onChange: (next: SetupDraft['account']) => void };

/** Akun pertama: nama, jenis, desain kartu bank, mata uang, saldo sekarang. */
export function StepAccount({ value, mainCurrency, nameError, onChange }: Props) {
  const t = useT();
  const set = (patch: Partial<SetupDraft['account']>) => onChange({ ...value, ...patch });
  const currencies = [...new Set([mainCurrency, ...PINNED_CURRENCIES])];
  return (
    <>
      <View style={styles.preview}>
        <BankCard bank={value.bank} accountType={t(`domain.accountType.${value.type}`)} balance={value.opening ?? 0} currency={value.currency} />
      </View>
      <Card>
        <View style={styles.block}>
          <Input
            label={t('auth.setup.account.name')}
            placeholder={t('auth.setup.account.namePlaceholder')}
            value={value.name}
            onChangeText={(name) => set({ name })}
            maxLength={60}
            error={nameError ? t('auth.setup.account.errorName') : undefined}
          />
          <Field label={t('auth.setup.account.type')}>
            {TYPES.map((type) => (
              <Chip key={type} label={t(`domain.accountType.${type}`)} selected={value.type === type} onPress={() => set({ type })} />
            ))}
          </Field>
          <Field label={t('auth.setup.account.currency')}>
            {currencies.map((c) => (
              <Chip key={c} label={c} selected={value.currency === c} onPress={() => set({ currency: c })} />
            ))}
          </Field>
          <AmountInput label={t('auth.setup.account.opening')} value={value.opening} onChange={(opening) => set({ opening })} currency={value.currency} />
        </View>
      </Card>
      <Card>
        <View style={styles.block}>
          <View style={styles.label}>
            <AppText variant="h3">{t('auth.setup.account.bank')}</AppText>
            <AppText variant="caption" tone="muted">
              {t('auth.setup.account.bankHint')}
            </AppText>
          </View>
          <BankGrid value={value.bank} onChange={(bank) => set({ bank })} />
        </View>
      </Card>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.label}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center' },
  block: { gap: space.lg },
  label: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
