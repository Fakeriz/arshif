import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Badge, Card, EmptyState, ListItem, Skeleton } from '@/components/ui';
import { RateSheet } from '@/features/fx/RateSheet';
import { currencyName, useT } from '@/i18n';
import { hasDailyRate, type UserRate } from '@/lib/fx';
import { CURRENCIES } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useMissingRates } from '@/state/derived';
import { useLoadState } from '@/state/loadState';
import { useRetry } from '@/state/useRetry';
import { radius, space } from '@/theme/tokens';

/** Angka kurs untuk dibaca: tanpa nol di belakang koma. */
function rateLabel(rate: string): string {
  const [w, f = ''] = rate.split('.');
  const frac = f.replace(/0+$/, '');
  return frac ? `${w}.${frac}` : w!;
}

/**
 * "Kurs saya" (FR-FX-4). Kurs sendiri hanya dipakai untuk mata uang tanpa kurs harian; mata uang yang punya
 * kurs harian selalu memakai kurs harian (belanja: kurs harinya, saldo: kurs hari ini).
 */
export default function MyRates() {
  const t = useT();
  const load = useLoadState();
  const retry = useRetry();
  const { state, dispatch } = useStore();
  const missing = useMissingRates();
  const [editing, setEditing] = useState<string | null>(null);
  const saved = state.userRates;
  // Mata uang yang bisa diberi kurs sendiri: yang tidak punya kurs harian dan belum disimpan.
  const candidates = Object.keys(CURRENCIES).filter((c) => !hasDailyRate(c) && !saved.some((r) => r.code === c) && !missing.includes(c));
  const current = saved.find((r) => r.code === editing);

  let body;
  if (load === 'error') {
    body = <EmptyState kind="error" title={t('acct.common.loadErrorTitle')} message={t('acct.common.loadErrorMessage')} actionLabel={t('common.retry')} onAction={retry} />;
  } else if (load === 'loading') {
    body = (
      <View style={styles.list} accessibilityLabel={t('acct.common.loading')} aria-busy>
        <Skeleton height={120} radius={radius.lg} />
        <Skeleton height={120} radius={radius.lg} />
      </View>
    );
  } else {
    body = (
      <View style={styles.list}>
        {missing.length > 0 && (
          <Card padding="md">
            <AppText variant="h3" style={styles.title}>
              {t('acct.rates.needTitle')}
            </AppText>
            {missing.map((code, i) => (
              <ListItem
                key={code}
                title={`${code} · ${currencyName(t, code)}`}
                subtitle={t('acct.rates.needSub')}
                trailing={<Badge label={t('acct.rates.needBadge')} tone="warning" />}
                chevron
                divider={i < missing.length - 1}
                onPress={() => setEditing(code)}
              />
            ))}
          </Card>
        )}
        <Card padding="md">
          <AppText variant="h3" style={styles.title}>
            {t('acct.rates.savedTitle')}
          </AppText>
          {saved.length === 0 ? (
            <AppText variant="caption" tone="muted" style={styles.title}>
              {t('acct.rates.savedEmpty')}
            </AppText>
          ) : (
            saved.map((r: UserRate, i) => (
              <ListItem
                key={r.code}
                title={`${r.code} · ${currencyName(t, r.code)}`}
                subtitle={hasDailyRate(r.code) ? t('acct.rates.unusedDaily') : t('acct.rates.savedSub', { code: r.code, rate: rateLabel(r.rate), base: r.base })}
                subtitleLines={2}
                chevron
                divider={i < saved.length - 1}
                onPress={() => setEditing(r.code)}
              />
            ))
          )}
        </Card>
        {candidates.length > 0 && (
          <Card padding="md">
            <AppText variant="h3" style={styles.title}>
              {t('acct.rates.addTitle')}
            </AppText>
            {candidates.map((code, i) => (
              <ListItem key={code} title={`${code} · ${currencyName(t, code)}`} subtitle={t('acct.rates.addSub')} chevron divider={i < candidates.length - 1} onPress={() => setEditing(code)} />
            ))}
          </Card>
        )}
      </View>
    );
  }

  return (
    <Screen glow={false}>
      <ScreenHeader title={t('acct.rates.title')} />
      <AppText variant="caption" tone="secondary">
        {t('acct.rates.explain')}
      </AppText>
      {body}
      <RateSheet
        key={editing ?? 'none'}
        visible={editing !== null}
        code={editing}
        main={state.mainCurrency}
        initial={current}
        onClose={() => setEditing(null)}
        onSave={(rate) => dispatch({ type: 'userRate/save', rate })}
        onDelete={current ? () => dispatch({ type: 'userRate/delete', code: current.code }) : undefined}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  title: { paddingHorizontal: space.xs, paddingTop: space.xs },
});
