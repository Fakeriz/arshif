import { CircleCheck, CircleX, Clock, ExternalLink, RotateCcw } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Badge, Button, Card, EmptyState, Icon, Skeleton } from '@/components/ui';
import { loadOrder, type Order, type OrderStatus } from '@/data/remote/api';
import { useI18n } from '@/i18n';
import { isoDateLabel, isoDateTimeLabel } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { openPaddleCheckout } from '@/lib/paddle';
import { supabase } from '@/lib/supabase';
import { useSyncPlan } from '@/state/billing';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const POLL_MS = 5000;
const TONE: Record<OrderStatus, 'warning' | 'positive' | 'neutral' | 'negative' | 'info'> = {
  pending: 'warning', paid: 'positive', expired: 'neutral', failed: 'negative', refunded: 'info',
};

/**
 * Status pesanan web (pending/paid/expired/failed/refunded). Diperbarui sendiri: Realtime pada baris
 * pesanan + polling 5 detik sebagai cadangan, sampai status final dan Premium sudah diberikan.
 */
export default function OrderStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const syncPlan = useSyncPlan();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const synced = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const o = await loadOrder(id);
      setOrder(o);
      setError(false);
      setCheckedAt(new Date().toISOString());
    } catch {
      setError(true);
    }
  }, [id]);

  const settled = !!order && (order.status === 'expired' || order.status === 'failed' || order.status === 'refunded' || (order.status === 'paid' && !!order.grantedUntil));

  useEffect(() => {
    void refresh();
    const channel = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, refresh]);

  useEffect(() => {
    if (settled) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [settled, refresh]);

  // Lunas + Premium sudah diberikan: perbarui paket di layar lalu ke halaman sukses.
  useEffect(() => {
    if (order?.status !== 'paid' || !order.grantedUntil || synced.current) return;
    synced.current = true;
    syncPlan()
      .then((r) => {
        if (r.plan === 'premium') router.replace('/premium/sukses');
      })
      .catch(() => undefined);
  }, [order, syncPlan, router]);

  if (error && order === undefined) {
    return (
      <Screen>
        <ScreenHeader title={t('billing.order.title')} />
        <EmptyState kind="error" title={t('billing.order.loadError')} actionLabel={t('common.retry')} onAction={refresh} />
      </Screen>
    );
  }
  if (order === undefined) {
    return (
      <Screen>
        <ScreenHeader title={t('billing.order.title')} />
        <View accessibilityLabel={t('common.loading')} aria-busy style={styles.skeleton}>
          <Skeleton height={160} radius={radius.lg} />
          <Skeleton height={180} radius={radius.lg} />
        </View>
      </Screen>
    );
  }
  if (order === null) {
    return (
      <Screen>
        <ScreenHeader title={t('billing.order.title')} />
        <EmptyState title={t('billing.order.notFound')} actionLabel={t('billing.order.toHome')} onAction={() => router.replace('/')} />
      </Screen>
    );
  }

  const provider = order.provider === 'paddle' ? 'Paddle' : 'Xendit';
  const icon = order.status === 'paid' ? CircleCheck : order.status === 'pending' ? Clock : order.status === 'refunded' ? RotateCcw : CircleX;
  const message =
    order.status === 'pending'
      ? t('billing.order.pendingMessage', { provider })
      : order.status === 'paid'
        ? order.grantedUntil
          ? t('billing.order.paidMessage', { date: isoDateLabel(order.grantedUntil, lang) })
          : t('billing.order.granting')
        : t(`billing.order.${order.status}Message`);
  const fields: [string, string][] = [
    [t('billing.order.fields.plan'), t(`billing.period.${order.period}`)],
    [t('billing.order.fields.amount'), formatMoney(order.amount, order.currency)],
    ...(order.method ? [[t('billing.order.fields.method'), t(`billing.premium.methods.${order.method as 'qris'}`)] as [string, string]] : []),
    ...(order.status === 'pending' ? [[t('billing.order.fields.payBefore'), isoDateTimeLabel(order.expiresAt, lang)] as [string, string]] : []),
    [t('billing.order.fields.order'), order.id.slice(0, 8).toUpperCase()],
  ];

  return (
    <Screen>
      <ScreenHeader title={t('billing.order.title')} />
      <Card>
        <View style={styles.statusRow} accessibilityLiveRegion="polite">
          <Icon icon={icon} color={order.status === 'paid' ? colors.positive : order.status === 'failed' ? colors.negative : colors.textSecondary} size={28} />
          <Badge label={t(`billing.order.status.${order.status}`)} tone={TONE[order.status]} />
        </View>
        <AppText variant="body" style={styles.message}>
          {message}
        </AppText>
        {checkedAt && (
          <AppText variant="caption" tone="muted">
            {t('billing.order.checkedAt', { time: isoDateTimeLabel(checkedAt, lang) })}
          </AppText>
        )}
      </Card>

      <Card padding="md">
        {fields.map(([label, value], i) => (
          <View key={label} style={[styles.field, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <AppText variant="body" tone="secondary">
              {label}
            </AppText>
            <AppText variant="bodyStrong" numeric>
              {value}
            </AppText>
          </View>
        ))}
      </Card>

      {order.status === 'pending' && order.checkoutUrl && (
        <Button
          label={t('billing.order.openCheckout')}
          icon={ExternalLink}
          variant="secondary"
          fullWidth
          onPress={() => (Platform.OS === 'web' ? window.location.assign(order.checkoutUrl!) : void WebBrowser.openBrowserAsync(order.checkoutUrl!))}
        />
      )}
      {order.status === 'pending' && order.provider === 'paddle' && order.providerRef && Platform.OS === 'web' && (
        <Button
          label={t('billing.order.openCheckout')}
          icon={ExternalLink}
          variant="secondary"
          fullWidth
          onPress={() => void openPaddleCheckout(order.providerRef!, window.location.href).catch(() => undefined)}
        />
      )}
      {(order.status === 'expired' || order.status === 'failed') && (
        <Button label={t('billing.order.tryAgain')} fullWidth onPress={() => router.replace('/premium')} />
      )}
      <Button label={t('billing.order.toHome')} variant="ghost" fullWidth onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: { gap: space.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  message: { marginTop: space.md, marginBottom: space.sm },
  field: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.xs },
});
