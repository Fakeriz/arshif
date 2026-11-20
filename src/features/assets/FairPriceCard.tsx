import { MessageCircleQuestion } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FUNCTIONS, PriceAskResult, type PriceAskResult as Result } from '../../../supabase/functions/_shared/contracts';
import { usePaywall } from '@/components/shell/Paywall';
import { AppText, Badge, Button, Card, Icon, ProBadge } from '@/components/ui';
import type { Asset } from '@/data/assets';
import { FnError, invokeFn } from '@/data/remote/functions';
import { useI18n } from '@/i18n';
import { priceAskInput, toMinor } from '@/lib/assets';
import { formatMoney } from '@/lib/money';
import { remaining } from '@/lib/quota';
import { useStore } from '@/state/AppStore';
import { useAssets } from '@/state/assets';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

type Failure = 'quota' | 'rate_limited' | 'network' | 'other';

/**
 * Tanya harga wajar (Live Market v2 Fase 5). Yang dikirim ke Coach HANYA angka ringkasan dari priceAskInput (kode,
 * pasar, harga live, harga beli, perubahan %). Vonis dihitung server dari kisaran vs harga live, jadi angkanya konsisten.
 * Kuota sama dengan Tanya Coach (Premium 20/hari; Free terkunci).
 */
export function FairPriceCard({ asset }: { asset: Asset }) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { state, refreshUsage } = useStore();
  const { prices } = useAssets();
  const paywall = usePaywall();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const input = priceAskInput(asset, prices, Date.now());
  if (!input) return null;

  const locked = state.plan !== 'premium';
  const left = remaining(state.plan, 'coachAsk', state.usage.coachAsk) ?? 0;
  const money = (n: number) => formatMoney(toMinor(n, input.currency), input.currency);
  const unit = asset.type === 'gold' ? ` ${t('assets.alert.perOunce')}` : '';

  const ask = async () => {
    if (locked) return paywall(t('coach.ask.reason'));
    if (busy || left <= 0) return;
    setBusy(true);
    setFailure(null);
    try {
      setResult(await invokeFn(FUNCTIONS.coachPrice, { lang, asset: input }, PriceAskResult));
    } catch (e) {
      const code = e instanceof FnError ? e.code : 'other';
      setFailure(code === 'quota' || code === 'rate_limited' || code === 'network' ? code : 'other');
    } finally {
      setBusy(false);
      refreshUsage();
    }
  };

  const failureText: Record<Failure, string> = {
    quota: t('coach.ask.outOfQuota'),
    rate_limited: t('coach.ask.errorRate'),
    network: t('assets.fair.errorNetwork'),
    other: t('coach.ask.errorOther'),
  };

  return (
    <Card>
      <View style={styles.body}>
        <View style={styles.title}>
          <Icon icon={MessageCircleQuestion} color={colors.textSecondary} />
          <AppText variant="h3" style={styles.flex}>
            {t('assets.fair.title')}
          </AppText>
          {locked && <ProBadge size="sm" />}
        </View>
        {result ? (
          <View style={styles.result} accessibilityLiveRegion="polite">
            <Badge label={t(`assets.fair.verdict.${result.verdict}`)} />
            <AppText variant="bodyStrong">{t('assets.fair.range', { low: money(result.targetLow), high: money(result.targetHigh), unit })}</AppText>
            <AppText variant="caption" tone="secondary">
              {t('assets.fair.now', { price: money(result.livePrice), unit })}
            </AppText>
            {result.reasons.map((r) => (
              <AppText key={r} variant="body">{`• ${r}`}</AppText>
            ))}
          </View>
        ) : (
          <AppText variant="caption" tone="secondary">
            {t('assets.fair.intro')}
          </AppText>
        )}
        {failure && (
          <AppText variant="caption" tone="negative" accessibilityLiveRegion="polite">
            {failureText[failure]}
          </AppText>
        )}
        <Button
          label={busy ? t('coach.ask.thinking') : result ? t('assets.fair.askAgain') : t('assets.fair.ask')}
          variant="secondary"
          size="md"
          fullWidth
          loading={busy}
          disabled={busy || (!locked && left <= 0)}
          onPress={() => void ask()}
        />
        <AppText variant="caption" tone="muted">
          {locked ? t('coach.ask.reason') : `${t('assets.fair.privacy')} ${t('coach.ask.left', { count: left })}.`}
        </AppText>
        <AppText variant="caption" tone="muted">
          {t('assets.fair.disclaimer')}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  result: { gap: space.sm, alignItems: 'flex-start' },
});
