import { useState } from 'react';

import { AmountField, AppText, Input, useToast } from '@/components/ui';
import type { Asset, AssetType } from '@/data/assets';
import type { AssetInput } from '@/data/remote/assets';
import { ChoiceRow, DateField, FormSheet, isYmd, useSaveError } from '@/features/planning/kit';
import { CurrencyField } from '@/features/planning/forms';
import { useI18n } from '@/i18n';
import { ASSET_TYPES, GOLD_SYMBOL, isLiveType, parseQuantity, SYMBOL_RE, unitOf } from '@/lib/assets';
import { useStore } from '@/state/AppStore';
import { useAssets } from '@/state/assets';

/** Mata uang harga beli bawaan: saham Indo dalam Rupiah, saham US dan kripto dalam dolar. */
function defaultCurrency(type: AssetType, main: string): string {
  if (type === 'stock_id') return 'IDR';
  if (type === 'stock_us' || type === 'crypto') return 'USD';
  return main;
}

const defaultSymbol = (type: AssetType): string => (type === 'gold' ? GOLD_SYMBOL : type === 'crypto' ? 'BTC' : '');

export function AssetForm({ visible, onClose, asset }: { visible: boolean; onClose: () => void; asset?: Asset }) {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { state } = useStore();
  const { addAsset, editAsset } = useAssets();
  const saveError = useSaveError();
  const [type, setType] = useState<AssetType>(asset?.type ?? 'stock_id');
  const [symbol, setSymbol] = useState(asset?.symbol ?? defaultSymbol(asset?.type ?? 'stock_id'));
  const [name, setName] = useState(asset?.name ?? '');
  // Teks awal tanpa pemisah ribuan supaya bisa langsung diubah dan di-parse ulang.
  const [qtyText, setQtyText] = useState(asset?.quantity !== undefined ? asset.quantity.toFixed(10).replace(/\.?0+$/, '').replace('.', lang === 'id' || lang === 'tr' ? ',' : '.') : '');
  const [currency, setCurrency] = useState(asset?.currency ?? defaultCurrency('stock_id', state.mainCurrency));
  const [buyPrice, setBuyPrice] = useState<number | null>(asset?.buyPrice ?? null);
  const [buyDate, setBuyDate] = useState(asset?.buyDate ?? '');
  const [value, setValue] = useState<number | null>(asset?.valueOverride ?? null);
  const [notes, setNotes] = useState(asset?.notes ?? '');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const live = isLiveType(type);
  const unit = t(`assets.unit.${unitOf(type)}`);
  const quantity = qtyText.trim() === '' ? null : parseQuantity(qtyText);
  const qtyBad = live ? quantity === null : qtyText.trim() !== '' && quantity === null;
  const symbolBad = live && type !== 'gold' && !SYMBOL_RE.test(symbol);
  const valueBad = !live && (value === null || value < 0);
  const dateBad = buyDate !== '' && !isYmd(buyDate);

  const pickType = (next: AssetType) => {
    setType(next);
    setSymbol(defaultSymbol(next));
    setCurrency(defaultCurrency(next, state.mainCurrency));
    setBuyPrice(null);
  };

  const submit = async () => {
    setTried(true);
    if (!name.trim() || qtyBad || symbolBad || valueBad || dateBad || saving) return;
    setSaving(true);
    const input: AssetInput = {
      symbol: live ? (type === 'gold' ? GOLD_SYMBOL : symbol) : undefined,
      name: name.trim(),
      quantity: quantity ?? undefined,
      buyPrice: live ? (buyPrice ?? undefined) : undefined,
      currency,
      buyDate: live && buyDate ? buyDate : undefined,
      valueOverride: value ?? undefined,
      notes: notes.trim() || undefined,
    };
    try {
      if (asset) await editAsset(asset.id, input);
      else await addAsset(type, input);
      show({ tone: 'success', title: t('plan.common.saved') });
      onClose();
    } catch (e) {
      saveError(e, t('assets.limitReason'), onClose);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title={asset ? t('assets.form.editTitle') : t('assets.form.createTitle')}
      subtitle={live ? t('assets.form.liveNote') : undefined}
      submitLabel={t('plan.common.save')}
      saving={saving}
      onSubmit={() => void submit()}
    >
      {asset ? (
        <AppText variant="bodyStrong">{t(`assets.type.${type}`)}</AppText>
      ) : (
        <ChoiceRow label={t('assets.form.type')} options={ASSET_TYPES.map((k) => ({ key: k, label: t(`assets.type.${k}`) }))} value={type} onChange={pickType} />
      )}
      {live && type !== 'gold' && (
        <Input
          label={t('assets.form.symbol')}
          value={symbol}
          onChangeText={(s) => setSymbol(s.toUpperCase().replace(/\s/g, ''))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={15}
          hint={t(`assets.form.symbolHint.${type as 'stock_id' | 'stock_us' | 'crypto'}`)}
          error={tried && symbolBad ? t('assets.form.symbolError') : undefined}
        />
      )}
      <Input
        label={t('assets.form.name')}
        value={name}
        onChangeText={setName}
        maxLength={80}
        placeholder={t(`assets.form.namePlaceholder.${type}`)}
        error={tried && !name.trim() ? t('assets.form.nameError') : undefined}
      />
      <Input
        label={live ? t('assets.form.quantity', { unit }) : t('assets.form.quantityOptional', { unit })}
        value={qtyText}
        onChangeText={setQtyText}
        keyboardType="decimal-pad"
        maxLength={24}
        hint={type === 'stock_id' ? t('assets.form.lotHint') : type === 'gold' ? t('assets.form.goldHint') : undefined}
        error={tried && qtyBad ? t('assets.form.quantityError') : undefined}
      />
      <CurrencyField value={currency} onChange={setCurrency} />
      {live && <AmountField label={t('assets.form.buyPrice', { unit })} value={buyPrice} onChange={setBuyPrice} currency={currency} />}
      {live && <DateField label={t('assets.form.buyDate')} value={buyDate} onChange={setBuyDate} error={tried && dateBad} optional />}
      <AmountField
        label={live ? t('assets.form.override') : t('assets.form.value')}
        value={value}
        onChange={setValue}
        currency={currency}
        hint={live ? t('assets.form.overrideHint') : undefined}
        error={tried && valueBad ? t('assets.form.valueError') : undefined}
      />
      <Input label={t('assets.form.notes')} value={notes} onChangeText={setNotes} maxLength={200} />
    </FormSheet>
  );
}
