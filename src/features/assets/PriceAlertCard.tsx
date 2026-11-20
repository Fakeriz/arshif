import { BellRing } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, Input, useToast } from '@/components/ui';
import type { Asset } from '@/data/assets';
import { useI18n } from '@/i18n';
import { isoDateTimeLabel } from '@/lib/dates';
import { toMinor } from '@/lib/assets';
import { formatMoney } from '@/lib/money';
import { useAssets } from '@/state/assets';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const MIN = 0.1;
const MAX = 50;

/** "5" / "0,5" / "2.5" -> angka; di luar 0,1 sampai 50 = null. */
export function parsePct(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return Number.isFinite(n) && n >= MIN && n <= MAX ? Math.round(n * 100) / 100 : null;
}

/**
 * Alert harga satu aset (Live Market v2 Fase 5): beri tahu sekali lewat lonceng saat harga bergerak naik atau turun
 * sebesar ambang dari harga saat alert dipasang. Dicek tiap jam oleh cron planning-reminders. Patokan diisi server.
 */
export function PriceAlertCard({ asset }: { asset: Asset }) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { show } = useToast();
  const { alerts, prices, saveAlert, removeAlert } = useAssets();
  const alert = (alerts ?? []).find((a) => a.assetId === asset.id);
  const [text, setText] = useState(alert ? String(alert.pct).replace('.', lang === 'id' || lang === 'tr' ? ',' : '.') : '5');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asset.priceKey || !prices[asset.priceKey]) return null;

  const pct = parsePct(text);
  const fmtPct = (n: number) => `${String(n).replace('.', lang === 'id' || lang === 'tr' ? ',' : '.')}%`;
  const run = async (fn: () => unknown, done: string) => {
    setBusy(true);
    try {
      await fn();
      show({ tone: 'success', title: done });
    } catch (e) {
      show({ tone: 'error', title: /alert_no_price/.test(String((e as Error)?.message)) ? t('assets.alert.noPrice') : t('assets.alert.failed') });
    } finally {
      setBusy(false);
    }
  };
  const arm = () => {
    setTried(true);
    if (pct === null || busy) return;
    void run(() => saveAlert(asset.id, pct), t('assets.alert.saved'));
  };

  const base = alert ? formatMoney(toMinor(alert.basePrice, alert.currency), alert.currency) + (asset.type === 'gold' ? ` ${t('assets.alert.perOunce')}` : '') : '';
  return (
    <Card>
      <View style={styles.body}>
        <View style={styles.title}>
          <Icon icon={BellRing} color={colors.textSecondary} />
          <AppText variant="h3">{t('assets.alert.title')}</AppText>
        </View>
        {alert && !alert.triggeredAt && (
          <>
            <AppText variant="body">{t('assets.alert.active', { pct: fmtPct(alert.pct), base })}</AppText>
            <AppText variant="caption" tone="secondary">
              {t('assets.alert.hourly')}
            </AppText>
            <Button label={t('assets.alert.remove')} variant="ghost" size="md" disabled={busy} onPress={() => void run(() => removeAlert(alert.id), t('assets.alert.removed'))} />
          </>
        )}
        {alert?.triggeredAt && (
          <>
            <AppText variant="body">{t('assets.alert.triggered', { pct: fmtPct(alert.pct), time: isoDateTimeLabel(alert.triggeredAt, lang) })}</AppText>
            <View style={styles.row}>
              <Button label={t('assets.alert.rearm')} variant="secondary" size="md" disabled={busy} onPress={() => void run(() => saveAlert(asset.id, alert.pct), t('assets.alert.saved'))} />
              <Button label={t('assets.alert.remove')} variant="ghost" size="md" disabled={busy} onPress={() => void run(() => removeAlert(alert.id), t('assets.alert.removed'))} />
            </View>
          </>
        )}
        {!alert && (
          <>
            <AppText variant="caption" tone="secondary">
              {t('assets.alert.intro')}
            </AppText>
            <Input
              label={t('assets.alert.thresholdLabel')}
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              maxLength={6}
              hint={t('assets.alert.thresholdHint')}
              error={tried && pct === null ? t('assets.alert.thresholdError') : undefined}
            />
            <Button label={t('assets.alert.set')} variant="secondary" size="md" fullWidth loading={busy} disabled={busy} onPress={arm} />
          </>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
