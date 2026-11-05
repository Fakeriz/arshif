import { StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { Screen } from '@/components/shell/Screen';
import { AppText, Button } from '@/components/ui';
import { initialDraft, stepErrors, type SetupDraft } from '@/features/setup/draft';
import { SetupProgress } from '@/features/setup/SetupProgress';
import { StepAccount } from '@/features/setup/StepAccount';
import { StepBudget } from '@/features/setup/StepBudget';
import { StepCurrency } from '@/features/setup/StepCurrency';
import { useFinishSetup } from '@/features/setup/useFinishSetup';
import { useT } from '@/i18n';
import { space } from '@/theme/tokens';

const STEPS = ['currency', 'account', 'budget'] as const;

/** Setup 3 langkah setelah daftar (FR-AUTH-2): mata uang utama → akun pertama → gaya anggaran. */
export default function SetupScreen() {
  const t = useT();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<SetupDraft>(initialDraft);
  const [tried, setTried] = useState(false);
  const { finish, saving, failed } = useFinishSetup();
  const errors = stepErrors(step, draft) as Record<string, boolean>;
  const blocked = Object.values(errors).some(Boolean);
  const last = step === STEPS.length - 1;
  const key = STEPS[step];

  const next = () => {
    setTried(true);
    if (blocked) return;
    setTried(false);
    if (last) void finish(draft);
    else setStep(step + 1);
  };

  const patch = (p: Partial<SetupDraft>) => setDraft((d) => ({ ...d, ...p }));
  const shown = tried ? errors : {};

  return (
    <Screen>
      <SetupProgress step={step} total={STEPS.length} />
      <View style={styles.head}>
        <AppText variant="h2" accessibilityRole="header">
          {t(`auth.setup.${key}.title`)}
        </AppText>
        <AppText variant="body" tone="secondary">
          {t(`auth.setup.${key}.lead`)}
        </AppText>
      </View>

      {key === 'currency' && (
        <StepCurrency
          value={draft.mainCurrency}
          onChange={(code) => patch({ mainCurrency: code, account: { ...draft.account, currency: code } })}
        />
      )}
      {key === 'account' && (
        <StepAccount value={draft.account} mainCurrency={draft.mainCurrency} nameError={!!shown.name} onChange={(account) => patch({ account })} />
      )}
      {key === 'budget' && <StepBudget value={draft} errors={shown} onChange={patch} />}

      {failed && (
        <AppText variant="caption" tone="negative" accessibilityLiveRegion="assertive">
          {t('auth.setup.errorSave')}
        </AppText>
      )}
      <View style={styles.actions}>
        <Button label={last ? t('auth.setup.finish') : t('auth.setup.next')} onPress={next} loading={saving} disabled={saving} fullWidth accessibilityHint={saving ? t('auth.setup.saving') : undefined} />
        {step > 0 && <Button label={t('auth.setup.back')} variant="ghost" onPress={() => setStep(step - 1)} disabled={saving} fullWidth />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.sm },
  actions: { gap: space.sm },
});
