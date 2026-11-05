import { usePaywall } from '@/components/shell/Paywall';
import { AppText, Card, EmptyState, ProBadge } from '@/components/ui';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { space } from '@/theme/tokens';

const EXAMPLES = ['coach.ask.example1', 'coach.ask.example2', 'coach.ask.example3'] as const;

/** Tanya Coach hanya untuk Premium (20 pertanyaan/hari). Pengguna Free melihat state batas. */
export function AskTab() {
  const paywall = usePaywall();
  const t = useT();
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ alignItems: 'center' }}>
        <ProBadge />
      </View>
      <EmptyState
        kind="limit"
        title={t('coach.ask.title')}
        message={t('coach.ask.message')}
        actionLabel={t('coach.ask.cta')}
        onAction={() => paywall(t('coach.ask.reason'))}
      />
      <Card>
        <AppText variant="caption" tone="secondary">
          {t('coach.ask.examplesTitle')}
        </AppText>
        {EXAMPLES.map((q) => (
          <AppText key={q} variant="body" style={{ marginTop: space.sm }}>{`“${t(q)}”`}</AppText>
        ))}
      </Card>
    </View>
  );
}
