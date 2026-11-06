import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, Tabs } from '@/components/ui';
import { localYmd } from '@/features/capture/clock';
import { InvoiceScreen, StatusBadge } from '@/features/invoice/kit';
import { AddButton } from '@/features/planning/kit';
import { useI18n } from '@/i18n';
import { shortDate } from '@/lib/dates';
import type { InvoiceKind } from '@/lib/invoice';
import { formatMoney } from '@/lib/money';
import { isLimited, QUOTAS } from '@/lib/quota';
import { useStore } from '@/state/AppStore';
import { useInvoices } from '@/state/invoices';
import { space } from '@/theme/tokens';

/** Invoice & penawaran (FR-INV-1). Free: 5 per bulan gabungan; batas tercapai = badge PRO + paywall. */
export default function InvoiceList() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { state } = useStore();
  const { invoices } = useInvoices();
  const [kind, setKind] = useState<InvoiceKind>('invoice');
  const used = state.usage.invoice;
  const limit = QUOTAS[state.plan].invoice;
  const limited = isLimited(state.plan, 'invoice', used);
  const reason = t('inv.limitReason', { free: QUOTAS.free.invoice ?? 0 });
  const list = invoices.filter((i) => i.kind === kind);
  const today = localYmd();
  const create = () => router.push({ pathname: '/invoice/form', params: { jenis: kind } });
  const addLabel = kind === 'invoice' ? t('inv.newInvoice') : t('inv.newQuote');

  return (
    <InvoiceScreen title={t('inv.title')} right={<AddButton label={t('inv.new')} limited={limited} reason={reason} onPress={create} />}>
      <Tabs accessibilityLabel={t('inv.kind')} value={kind} onChange={setKind} items={[{ key: 'invoice', label: t('inv.invoices') }, { key: 'quote', label: t('inv.quotes') }]} />
      {limit !== null && (
        <AppText variant="caption" tone={limited ? 'warning' : 'secondary'}>
          {t('inv.quotaLine', { used: Math.min(used, limit), limit })}
        </AppText>
      )}
      {list.length === 0 ? (
        <EmptyState
          title={kind === 'invoice' ? t('inv.emptyInvoiceTitle') : t('inv.emptyQuoteTitle')}
          message={kind === 'invoice' ? t('inv.emptyInvoiceMessage') : t('inv.emptyQuoteMessage')}
          actionLabel={limited ? undefined : addLabel}
          onAction={limited ? undefined : create}
        />
      ) : (
        list.map((inv) => (
          <Card
            key={inv.id}
            onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: inv.id } })}
            accessibilityLabel={t('inv.rowA11y', { number: inv.number, client: inv.clientName, amount: formatMoney(inv.total, inv.currency) })}
          >
            <View style={styles.row}>
              <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                {inv.clientName}
              </AppText>
              <AppText variant="bodyStrong" numeric>
                {formatMoney(inv.total, inv.currency)}
              </AppText>
            </View>
            <View style={styles.row}>
              <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
                {inv.dueDate
                  ? t(kind === 'invoice' ? 'inv.rowDue' : 'inv.rowValid', { number: inv.number, date: shortDate(inv.dueDate, lang) })
                  : `${inv.number} · ${shortDate(inv.issueDate, lang)}`}
              </AppText>
              <StatusBadge inv={inv} today={today} />
            </View>
          </Card>
        ))
      )}
    </InvoiceScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xxs },
  flex: { flex: 1, minWidth: 0 },
});
