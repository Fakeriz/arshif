import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { Badge, EmptyState, Skeleton } from '@/components/ui';
import type { BadgeTone } from '@/components/ui/Badge';
import { useT } from '@/i18n';
import { isOverdue, type Invoice } from '@/lib/invoice';
import { useInvoices } from '@/state/invoices';
import { radius, space } from '@/theme/tokens';

/** Layar invoice: header + status muat (memuat, gagal, siap). */
export function InvoiceScreen({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  const t = useT();
  const { status, reload } = useInvoices();
  return (
    <Screen onRefresh={status === 'ready' ? () => void reload() : undefined}>
      <ScreenHeader title={title} right={status === 'ready' ? right : undefined} />
      {status === 'error' ? (
        <EmptyState kind="error" title={t('inv.loadErrorTitle')} message={t('inv.loadErrorMessage')} actionLabel={t('common.retry')} onAction={() => void reload()} />
      ) : status !== 'ready' ? (
        <View style={styles.skeleton} accessibilityLabel={t('inv.loading')} aria-busy>
          <Skeleton height={44} radius={radius.md} />
          <Skeleton height={96} radius={radius.lg} />
          <Skeleton height={96} radius={radius.lg} />
        </View>
      ) : (
        children
      )}
    </Screen>
  );
}

/** Status sebagai badge. Lewat jatuh tempo diberi tanda merah karena itu yang perlu ditindaklanjuti. */
export function StatusBadge({ inv, today }: { inv: Invoice; today: string }) {
  const t = useT();
  if (isOverdue(inv, today)) return <Badge label={t('inv.status.overdue')} tone="negative" />;
  const tone: Record<Invoice['status'], BadgeTone> = { draft: 'neutral', sent: 'info', paid: 'positive', accepted: 'positive' };
  return <Badge label={t(`inv.status.${inv.status}`)} tone={tone[inv.status]} />;
}

const styles = StyleSheet.create({ skeleton: { gap: space.lg } });
