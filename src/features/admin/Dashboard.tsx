import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Skeleton } from '@/components/ui';
import { adminDashboard, type AdminDashboard } from '@/data/remote/api';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { copy } from './copy';
import { date, num } from './format';
import { DataState, Panel, Refreshing, Rows, Stat, useLoad } from './parts';

const c = copy.dashboard;
const AI_ORDER = ['scan', 'voice', 'import', 'coach'];

/** FR-ADM-1. Angka utama = pengguna aktif hari ini; sisanya mendukung. Semua dari server, tanpa angka contoh. */
export function DashboardSection() {
  const load = useLoad(adminDashboard, []);
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  return (
    <DataState
      load={load}
      loadingLabel={c.loading}
      errorTitle={c.error}
      skeleton={
        <View style={styles.gap}>
          <Skeleton height={180} radius={radius.lg} />
          <Skeleton height={140} radius={radius.lg} />
        </View>
      }
    >
      {(d) => (
        <View style={styles.gap}>
          <View style={styles.head}>
            <AppText variant="caption" tone="secondary" style={styles.flex}>
              {c.today(date(`${d.today}T12:00:00`))}
            </AppText>
            <Refreshing on={load.loading} />
          </View>
          <View style={[styles.grid, wide && styles.gridWide]}>
            <View style={wide ? styles.colMain : undefined}>
              <Panel>
                <Stat lead label={c.dau} value={num(d.dau)} note={c.dauHint} />
                <ActiveDays rows={d.dau_7} />
              </Panel>
            </View>
            <View style={[styles.gap, wide && styles.colSide]}>
              <Panel>
                <Stat label={c.totalUsers} value={num(d.total_users)} note={c.newToday(d.new_today)} />
              </Panel>
              <Panel>
                <Stat label={c.premium} value={num(d.premium_users)} note={premiumNote(d)} />
              </Panel>
            </View>
          </View>
          <View style={[styles.grid, wide && styles.gridWide]}>
            <View style={wide ? styles.colHalf : undefined}>
              <AiToday d={d} />
            </View>
            <View style={wide ? styles.colHalf : undefined}>
              <Revenue d={d} />
            </View>
          </View>
        </View>
      )}
    </DataState>
  );
}

function premiumNote(d: AdminDashboard): string {
  const parts = Object.entries(d.premium_by_source).map(([k, n]) => `${num(n)} ${c.premiumSources[k] ?? k}`);
  if (d.suspended_users > 0) parts.push(c.suspended(d.suspended_users));
  return parts.join(' · ');
}

/** Batang horizontal 7 hari: menjawab "berapa yang aktif tiap hari minggu ini". */
function ActiveDays({ rows }: { rows: AdminDashboard['dau_7'] }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.users));
  return (
    <View style={styles.days} accessibilityLabel={c.dau7}>
      <AppText variant="caption" tone="secondary">
        {c.dau7}
      </AppText>
      {rows.map((r) => (
        <View key={r.day} style={styles.dayRow} accessibilityLabel={`${date(`${r.day}T12:00:00`)}: ${r.users}`}>
          <AppText variant="caption" tone="secondary" style={styles.dayLabel} numeric>
            {date(`${r.day}T12:00:00`).replace(/ \d{4}$/, '')}
          </AppText>
          <View style={[styles.track, { backgroundColor: colors.track }]}>
            {r.users > 0 && <View style={[styles.bar, { width: `${(r.users / max) * 100}%`, backgroundColor: colors.accent }]} />}
          </View>
          <AppText variant="caption" numeric style={styles.dayValue}>
            {num(r.users)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function AiToday({ d }: { d: AdminDashboard }) {
  const kinds = AI_ORDER.filter((k) => d.ai_today[k]).concat(Object.keys(d.ai_today).filter((k) => !AI_ORDER.includes(k)));
  return (
    <Panel title={c.aiToday}>
      {kinds.length === 0 ? (
        <AppText variant="body" tone="secondary">
          {c.aiNone}
        </AppText>
      ) : (
        <Rows>
          {kinds.map((k) => (
            <View key={k} style={styles.line}>
              <AppText variant="body" style={styles.flex}>
                {copy.ai.kind[k] ?? k}
              </AppText>
              {d.ai_today[k].failed > 0 && (
                <AppText variant="caption" tone="negative">
                  {c.aiFailed(d.ai_today[k].failed)}
                </AppText>
              )}
              <AppText variant="bodyStrong" numeric>
                {num(d.ai_today[k].total)}
              </AppText>
            </View>
          ))}
        </Rows>
      )}
    </Panel>
  );
}

function Revenue({ d }: { d: AdminDashboard }) {
  const entries = Object.entries(d.revenue_month);
  return (
    <Panel title={c.revenue}>
      {entries.length === 0 ? (
        <AppText variant="body" tone="secondary">
          {c.revenueEmpty}
        </AppText>
      ) : (
        <View style={styles.gapSm}>
          {entries.map(([cur, amount]) => (
            <AppText key={cur} variant="h2" numeric>
              {formatMoney(Number(amount), cur)}
            </AppText>
          ))}
          <AppText variant="caption" tone="secondary">
            {c.revenueWeb(d.paid_orders_month)}
          </AppText>
        </View>
      )}
      <AppText variant="caption" tone="muted">
        {c.revenueStore}
      </AppText>
    </Panel>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.lg },
  gapSm: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  grid: { gap: space.lg },
  gridWide: { flexDirection: 'row', alignItems: 'flex-start' },
  colMain: { flex: 3, minWidth: 0 },
  colSide: { flex: 2, minWidth: 0 },
  colHalf: { flex: 1, minWidth: 0 },
  days: { gap: space.xs, marginTop: space.sm },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dayLabel: { width: 56 },
  dayValue: { width: 32, textAlign: 'right' },
  track: { flex: 1, height: 8, borderRadius: radius.full, overflow: 'hidden' },
  bar: { height: 8, borderRadius: radius.full },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
