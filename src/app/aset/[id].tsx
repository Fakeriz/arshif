import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Button, Card, CurrencyText, Dialog, EmptyState, TrendBadge, useToast } from '@/components/ui';
import { AssetForm } from '@/features/assets/AssetForm';
import { priceLabel, quantityLabel } from '@/features/assets/view';
import { InfoRow } from '@/features/transactions/InfoRow';
import { useI18n } from '@/i18n';
import { gainOf, toMinor, unitOf, valueAsset } from '@/lib/assets';
import { shortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useAssets } from '@/state/assets';
import { space } from '@/theme/tokens';

/** Detail aset (brief §6). Grafik harga (opsional di brief) belum dibuat: server hanya menyimpan harga terakhir, belum riwayat. */
export default function AssetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { state } = useStore();
  const { assets, prices, removeAsset } = useAssets();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const asset = assets.find((a) => a.id === id);

  if (!asset) {
    return (
      <Screen>
        <ScreenHeader title={t('assets.detail.title')} />
        <EmptyState title={t('plan.common.notFound')} message={t('plan.common.notFoundMessage')} actionLabel={t('plan.common.back')} onAction={() => router.back()} />
      </Screen>
    );
  }

  const v = valueAsset(asset, prices, Date.now());
  const gain = gainOf(asset, v);
  const unit = t(`assets.unit.${unitOf(asset.type)}`);
  const qty = quantityLabel(asset, t, lang);
  const rows: { label: string; value: string }[] = [];
  if (qty) rows.push({ label: t('assets.detail.quantity'), value: qty });
  if (asset.buyPrice !== undefined) rows.push({ label: t('assets.detail.buyPrice'), value: t('assets.detail.perUnit', { price: formatMoney(asset.buyPrice, asset.currency), unit }) });
  if (v.source === 'live' && v.unitPrice !== undefined) {
    rows.push({ label: t('assets.detail.currentPrice'), value: t('assets.detail.perUnit', { price: formatMoney(toMinor(v.unitPrice, v.currency), v.currency), unit }) });
    rows.push({ label: t('assets.detail.priceCurrency'), value: v.currency });
  }
  if (gain) rows.push({ label: t('assets.detail.gain'), value: formatMoney(gain.amount, asset.currency, 'always') });
  if (asset.buyDate) rows.push({ label: t('assets.detail.buyDate'), value: shortDate(asset.buyDate, lang) });
  if (asset.notes) rows.push({ label: t('assets.detail.notes'), value: asset.notes });

  return (
    <Screen>
      <ScreenHeader title={asset.name} />
      <Card>
        <View style={styles.hero}>
          <AppText variant="caption" tone="secondary">
            {t(`assets.type.${asset.type}`)}
            {asset.symbol && asset.type !== 'gold' ? ` · ${asset.symbol}` : ''}
          </AppText>
          {v.value === null ? (
            <AppText variant="h2">{t('assets.priceNone')}</AppText>
          ) : (
            <CurrencyText amount={v.value} currency={v.currency} kind="balance" variant="amountHero" hidden={state.hideBalance} />
          )}
          {gain?.pct != null && !state.hideBalance && <TrendBadge value={gain.pct} suffix={t('assets.detail.vsBuy')} />}
          <AppText variant="caption" tone="muted">
            {priceLabel(v, t, lang)}
          </AppText>
        </View>
      </Card>
      {rows.length > 0 && (
        <Card padding="md">
          {rows.map((r, i) => (
            <InfoRow key={r.label} label={r.label} value={r.value} divider={i < rows.length - 1} />
          ))}
        </Card>
      )}
      <View style={styles.actions}>
        <Button label={t('plan.common.edit')} icon={Pencil} variant="secondary" fullWidth onPress={() => setEdit(true)} />
        <Button label={t('plan.common.delete')} icon={Trash2} variant="danger" fullWidth onPress={() => setConfirm(true)} />
      </View>
      <AssetForm key={edit ? `edit-${asset.id}` : 'closed'} visible={edit} onClose={() => setEdit(false)} asset={asset} />
      <Dialog
        visible={confirm}
        tone="danger"
        title={t('plan.common.deleteTitle', { name: asset.name })}
        message={t('assets.detail.deleteMessage')}
        confirmLabel={t('plan.common.delete')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          removeAsset(asset.id)
            .then(() => {
              show({ tone: 'success', title: t('plan.common.deleted') });
              router.back();
            })
            .catch(() => show({ tone: 'error', title: t('plan.common.deleteFailed') }));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.xs },
  actions: { gap: space.sm, marginTop: space.sm },
});
