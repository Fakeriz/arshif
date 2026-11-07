import { Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { z } from 'zod';

import { CoachRequest, CoachResult, FUNCTIONS } from '../../../supabase/functions/_shared/contracts';
import { AppText, Badge, Button, Card, Icon, Skeleton, SkeletonText } from '@/components/ui';
import { invokeFn, FnError } from '@/data/remote/functions';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type Input = Omit<z.infer<typeof CoachRequest>, 'lang'>;
type Result = z.infer<typeof CoachResult>;

/**
 * Narasi Coach (FR-COACH-2/4): skor dihitung rumus di klien, AI di server hanya menarasikan
 * ringkasan angka dalam bahasa aplikasi. Server menyimpan hasil per minggu + bahasa.
 */
export function CoachNarration({ input }: { input: Input }) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: Result } | { kind: 'error'; reason: 'narrError' | 'narrRateLimited' | 'narrQuota' }>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify({ ...input, lang });

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    invokeFn(FUNCTIONS.coach, { ...input, lang }, CoachResult)
      .then((data) => alive && setState({ kind: 'ready', data }))
      .catch((e: unknown) => {
        if (!alive) return;
        const code = e instanceof FnError ? e.code : null;
        setState({ kind: 'error', reason: code === 'rate_limited' ? 'narrRateLimited' : code === 'quota' ? 'narrQuota' : 'narrError' });
      });
    return () => {
      alive = false;
    };
    // `key` mewakili isi input + bahasa; objek input baru tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return (
    <Card>
      <View style={styles.head}>
        <Icon icon={Sparkles} color={colors.accentText} />
        <AppText variant="h3" style={styles.flex}>
          {t('coach.score.says')}
        </AppText>
        <Badge label={t('coach.score.aiBadge')} />
      </View>
      {state.kind === 'loading' && (
        <View style={styles.body} accessibilityLabel={t('coach.score.narrLoading')} aria-busy>
          <SkeletonText lines={3} />
          <Skeleton height={44} radius={radius.md} />
        </View>
      )}
      {state.kind === 'error' && (
        <View style={styles.body}>
          <AppText variant="body" tone="secondary">
            {t(`coach.score.${state.reason}`)}
          </AppText>
          <Button label={t('common.retry')} variant="secondary" size="md" onPress={() => setAttempt((n) => n + 1)} />
        </View>
      )}
      {state.kind === 'ready' && (
        <>
          <AppText variant="body" tone="secondary" style={styles.narr}>
            {state.data.narration}
          </AppText>
          {state.data.actions.map((a, i) => (
            <View key={i} style={styles.action}>
              <View style={[styles.num, { backgroundColor: colors.accentSoft }]}>
                <AppText variant="caption" tone="accent" numeric>
                  {i + 1}
                </AppText>
              </View>
              <AppText variant="body" style={styles.flex}>
                {a}
              </AppText>
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  body: { gap: space.md, marginTop: space.md },
  narr: { marginVertical: space.md },
  action: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.xs + 2 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
