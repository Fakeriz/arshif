import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmountField, AppText, Badge, Card, EmptyState } from '@/components/ui';
import { PlanScreen } from '@/features/planning/kit';
import { useI18n } from '@/i18n';
import { CALENDARS } from '@/i18n/calendar';
import { parseYMD, todayYmd } from '@/lib/dates';
import { convert, hasRate } from '@/lib/fx';
import { formatMoney } from '@/lib/money';
import { compareMethods, monthAfter, type Method, type SimResult } from '@/lib/planning/debts';
import { useStore } from '@/state/AppStore';
import { usePlanning } from '@/state/planning';
import { space } from '@/theme/tokens';

/** Simulator pelunasan (FR-DEBT-3): Snowball vs Avalanche dengan anggaran ekstra per bulan. */
export default function SimulatorScreen() {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const { debts } = usePlanning();
  const main = state.mainCurrency;
  const [extra, setExtra] = useState<number | null>(null);
  const today = todayYmd();

  // Semua utang aktif dihitung dalam mata uang utama (kurs terbaru); yang tanpa kurs dilewati dan diberitahukan.
  const { sim, names, missing } = useMemo(() => {
    const out: { id: string; balance: number; aprBp: number; minPayment: number }[] = [];
    const miss = new Set<string>();
    for (const d of debts) {
      if (d.kind !== 'debt' || d.status !== 'active') continue;
      if (d.currency !== main && !(hasRate(d.currency) && hasRate(main))) {
        miss.add(d.currency);
        continue;
      }
      out.push({ id: d.id, balance: convert(d.balance, d.currency, main), aprBp: d.aprBp, minPayment: convert(d.minPayment, d.currency, main) });
    }
    return { sim: out, names: new Map(debts.map((d) => [d.id, d.counterparty])), missing: [...miss] };
    // ratesDate: kurs baru = konversi berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debts, main, state.ratesDate]);

  const result = useMemo(() => (sim.length ? compareMethods(sim, extra ?? 0) : null), [sim, extra]);
  const dateOf = (months: number) => {
    const { y, m } = parseYMD(monthAfter(today, months));
    return `${CALENDARS[lang].monthsShort[m - 1]} ${y}`;
  };
  const cheapest: Method | null =
    result && result.snowball.feasible && result.avalanche.feasible && result.snowball.totalInterest !== result.avalanche.totalInterest
      ? result.snowball.totalInterest < result.avalanche.totalInterest
        ? 'snowball'
        : 'avalanche'
      : null;

  return (
    <PlanScreen title={t('plan.sim.title')}>
      {!result ? (
        <EmptyState title={t('plan.sim.emptyTitle')} message={t('plan.sim.emptyMessage')} />
      ) : (
        <>
          <AmountField label={t('plan.sim.extra', { currency: main })} value={extra} onChange={setExtra} currency={main} hint={t('plan.sim.extraHint', { currency: main })} />
          {missing.length > 0 && (
            <AppText variant="caption" tone="warning">
              {t('plan.sim.noRate', { codes: missing.join(', ') })}
            </AppText>
          )}
          <AppText variant="caption" tone="secondary">
            {result.baseline.feasible
              ? t('plan.sim.baseline', { date: dateOf(result.baseline.months), amount: formatMoney(result.baseline.totalInterest, main) })
              : t('plan.sim.baselineNever')}
          </AppText>
          {(['avalanche', 'snowball'] as const).map((m) => (
            <MethodCard key={m} method={m} r={result[m]} cheapest={cheapest === m} currency={main} names={names} dateOf={dateOf} />
          ))}
          {result.snowball.feasible && !cheapest && (
            <AppText variant="caption" tone="secondary">
              {t('plan.sim.same')}
            </AppText>
          )}
        </>
      )}
    </PlanScreen>
  );
}

function MethodCard({ method, r, cheapest, currency, names, dateOf }: {
  method: Method; r: SimResult & { interestSaved: number; monthsSaved: number }; cheapest: boolean; currency: string; names: Map<string, string>; dateOf: (m: number) => string;
}) {
  const { t } = useI18n();
  return (
    <Card>
      <View style={styles.head}>
        <AppText variant="h3" style={styles.flex}>
          {t(`plan.sim.${method}`)}
        </AppText>
        {cheapest && <Badge label={t('plan.sim.cheapest')} tone="positive" />}
      </View>
      <AppText variant="caption" tone="secondary">
        {t(method === 'snowball' ? 'plan.sim.snowballHow' : 'plan.sim.avalancheHow')}
      </AppText>
      {!r.feasible ? (
        <AppText variant="body" tone="warning" style={styles.gap}>
          {t('plan.sim.infeasible')}
        </AppText>
      ) : (
        <>
          <View style={styles.stats}>
            <Stat label={t('plan.sim.payoffDate')} value={dateOf(r.months)} sub={t('plan.sim.months', { months: r.months })} />
            <Stat label={t('plan.sim.totalInterest')} value={formatMoney(r.totalInterest, currency)} />
          </View>
          {r.interestSaved > 0 && (
            <AppText variant="body" tone="positive">
              {`${t('plan.sim.saved')}: ${formatMoney(r.interestSaved, currency)}`}
            </AppText>
          )}
          {r.interestSaved > 0 && (
            <AppText variant="caption" tone="secondary">
              {t('plan.sim.savedVsMin', { months: r.monthsSaved })}
            </AppText>
          )}
          <AppText variant="caption" tone="secondary" style={styles.gap}>
            {t('plan.sim.order')}
          </AppText>
          {r.order.map((o, i) => (
            <AppText key={o.id} variant="body">
              {`${i + 1}. ${t('plan.sim.orderItem', { name: names.get(o.id) ?? '', month: o.month })}`}
            </AppText>
          ))}
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong" numeric>
        {value}
      </AppText>
      {sub ? (
        <AppText variant="caption" tone="muted">
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xxs },
  flex: { flex: 1 },
  stats: { flexDirection: 'row', gap: space.lg, marginVertical: space.md },
  stat: { flex: 1, gap: space.xxs },
  gap: { marginTop: space.md },
});
