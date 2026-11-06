import { SendHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { AppText, Button, Card, Chip, EmptyState, GlassView, Icon, Input, PressableScale, ProBadge, SkeletonText } from '@/components/ui';
import { FnError, invokeFn } from '@/data/remote/functions';
import { useI18n } from '@/i18n';
import { buildAskContext } from '@/lib/coachAsk';
import { todayYmd } from '@/lib/dates';
import { remaining } from '@/lib/quota';
import { weeklyRecap } from '@/lib/recap';
import { useStore } from '@/state/AppStore';
import { useBudget, useHealth, useLedger } from '@/state/derived';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AskResult, FUNCTIONS } from '../../../supabase/functions/_shared/contracts';

const EXAMPLES = ['coach.ask.example1', 'coach.ask.example2', 'coach.ask.example3'] as const;
/** Giliran yang dikirim ulang ke AI sebagai konteks percakapan. */
const HISTORY_TURNS = 6;

type Turn = { role: 'user' | 'coach'; text: string };
type Failure = 'quota' | 'rate_limited' | 'network' | 'other';

/** Tanya Coach (FR-COACH-3): Premium 20 pertanyaan/hari. Pengguna Free melihat state batas. */
export function AskTab() {
  const { state } = useStore();
  return state.plan === 'premium' ? <AskChat /> : <AskLocked />;
}

function AskLocked() {
  const paywall = usePaywall();
  const { t } = useI18n();
  return (
    <View style={styles.wrap}>
      <View style={styles.center}>
        <ProBadge />
      </View>
      <EmptyState kind="limit" title={t('coach.ask.title')} message={t('coach.ask.message')} actionLabel={t('coach.ask.cta')} onAction={() => paywall(t('coach.ask.reason'))} />
      <Card>
        <AppText variant="caption" tone="secondary">
          {t('coach.ask.examplesTitle')}
        </AppText>
        {EXAMPLES.map((q) => (
          <AppText key={q} variant="body" style={styles.example}>{`“${t(q)}”`}</AppText>
        ))}
      </Card>
    </View>
  );
}

/**
 * Chat Tanya Coach. AI hanya menerima ringkasan angka (FR-COACH-4: tanpa nama toko, catatan, atau transaksi
 * satu per satu). Percakapan hanya ada selama layar terbuka; server tidak menyimpannya.
 */
function AskChat() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { state, refreshUsage } = useStore();
  const ledger = useLedger();
  const budget = useBudget();
  const health = useHealth();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ kind: Failure; question: string } | null>(null);
  const left = remaining(state.plan, 'coachAsk', state.usage.coachAsk) ?? 0;
  const out = left <= 0 || failure?.kind === 'quota';

  const ask = async (raw: string) => {
    const question = raw.trim();
    if (question.length < 2 || pending || out) return;
    setFailure(null);
    setPending(question);
    setDraft('');
    try {
      const recap = weeklyRecap(ledger.transactions, todayYmd(), ledger.mainCurrency, 'this');
      const context = buildAskContext({
        currency: ledger.mainCurrency, income: budget.income, netWorth: ledger.netWorth, period: budget.period, total: budget.total,
        flexSpent: budget.flexSpent, flexLimit: budget.flexLimit, safePerDay: budget.safePerDay, pace: budget.flexPace,
        limits: budget.limits, spent: budget.spent, byCategory: budget.byCategory, categoryLimits: budget.categoryLimits,
        week: recap, score: health.score, pillars: health.pillars,
      });
      const res = await invokeFn(FUNCTIONS.coachAsk, { lang, question, history: turns.slice(-HISTORY_TURNS), context }, AskResult);
      setTurns((list) => [...list, { role: 'user', text: question }, { role: 'coach', text: res.answer }]);
    } catch (e) {
      const code = e instanceof FnError ? e.code : 'other';
      setFailure({ kind: code === 'quota' || code === 'rate_limited' || code === 'network' ? code : 'other', question });
      if (code !== 'quota') setDraft(question);
    } finally {
      setPending(null);
      refreshUsage();
    }
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" tone="secondary" align="center">
        {t('coach.ask.privacy')}
      </AppText>
      <AppText variant="caption" tone={out ? 'warning' : 'muted'} align="center" aria-live="polite">
        {out ? t('coach.ask.outOfQuota') : t('coach.ask.left', { count: left })}
      </AppText>

      {turns.length === 0 && !pending && (
        <Card>
          <AppText variant="bodyStrong">{t('coach.ask.startTitle')}</AppText>
          <AppText variant="caption" tone="secondary" style={styles.example}>
            {t('coach.ask.startSub')}
          </AppText>
          <View style={styles.chips}>
            {EXAMPLES.map((q) => (
              <Chip key={q} label={t(q)} onPress={() => void ask(t(q))} disabled={out} />
            ))}
          </View>
        </Card>
      )}

      {turns.map((turn, i) => (
        <Bubble key={i} turn={turn} />
      ))}
      {pending && (
        <>
          <Bubble turn={{ role: 'user', text: pending }} />
          <GlassView radius={radius.lg} style={[styles.bubble, styles.coach]} accessibilityLabel={t('coach.ask.thinking')}>
            <View aria-busy>
              <SkeletonText lines={2} />
            </View>
          </GlassView>
        </>
      )}

      {failure && failure.kind !== 'quota' && (
        <Card>
          <AppText variant="body" tone="secondary">
            {t(failure.kind === 'rate_limited' ? 'coach.ask.errorRate' : failure.kind === 'network' ? 'coach.ask.errorNetwork' : 'coach.ask.errorOther')}
          </AppText>
          <Button label={t('common.retry')} variant="secondary" size="md" onPress={() => void ask(failure.question)} />
        </Card>
      )}

      <View style={styles.inputRow}>
        <View style={styles.flex}>
          <Input
            label={t('coach.ask.inputLabel')}
            placeholder={t('coach.ask.placeholder')}
            value={draft}
            onChangeText={setDraft}
            maxLength={300}
            returnKeyType="send"
            onSubmitEditing={() => void ask(draft)}
            disabled={out || !!pending}
          />
        </View>
        <PressableScale
          accessibilityLabel={t('coach.ask.send')}
          disabled={out || !!pending || draft.trim().length < 2}
          aria-disabled={out || !!pending || draft.trim().length < 2}
          onPress={() => void ask(draft)}
          focusRadius={radius.full}
          style={[styles.send, { backgroundColor: draft.trim().length >= 2 && !out && !pending ? colors.accent : colors.track }]}
        >
          <Icon icon={SendHorizontal} color={draft.trim().length >= 2 && !out && !pending ? colors.onAccent : colors.textMuted} />
        </PressableScale>
      </View>
      <AppText variant="caption" tone="muted" align="center">
        {t('coach.ask.disclaimer')}
      </AppText>
    </View>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  if (turn.role === 'user') {
    return (
      <View style={[styles.bubble, styles.user, { backgroundColor: colors.accentSoft }]} accessibilityLabel={t('coach.ask.youSaid', { text: turn.text })}>
        <AppText variant="body">{turn.text}</AppText>
      </View>
    );
  }
  return (
    <GlassView radius={radius.lg} style={[styles.bubble, styles.coach]} accessibilityLabel={t('coach.ask.coachSaid', { text: turn.text })}>
      <AppText variant="caption" tone="accent">
        {t('coach.ask.coachName')}
      </AppText>
      <AppText variant="body">{turn.text}</AppText>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  center: { alignItems: 'center' },
  example: { marginTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  bubble: { padding: space.md, gap: space.xs, maxWidth: '88%' },
  user: { alignSelf: 'flex-end', borderRadius: radius.lg, borderBottomRightRadius: radius.sm },
  coach: { alignSelf: 'flex-start', borderBottomLeftRadius: radius.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  flex: { flex: 1 },
  send: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: space.xxs },
});
