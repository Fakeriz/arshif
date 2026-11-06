import { useState } from 'react';

import { AppText, Button, Input } from '@/components/ui';
import { FormSheet } from '@/features/planning/kit';
import { currencyName, useT } from '@/i18n';
import { hasDailyRate, type UserRate } from '@/lib/fx';

/** "4350", "4.350,5" tidak diterima; satu pemisah desimal (titik atau koma), tanpa pemisah ribuan. */
export function parseRate(text: string): string | null {
  const s = text.trim().replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,10})?$/.test(s)) return null;
  return Number(s) > 0 ? s : null;
}

/** Basis kurs: mata uang utama bila punya kurs harian, selain itu USD. */
export function rateBase(main: string): string {
  return main !== 'USD' && hasDailyRate(main) ? main : 'USD';
}

/**
 * Isi "Kurs saya" (FR-FX-4): 1 <kode> = X <basis>. Dipakai hanya bila kode itu tidak punya kurs harian.
 */
export function RateSheet({ visible, code, main, initial, onClose, onSave, onDelete }: {
  visible: boolean; code: string | null; main: string; initial?: UserRate; onClose: () => void; onSave: (r: UserRate) => void; onDelete?: () => void;
}) {
  const t = useT();
  const base = initial?.base ?? rateBase(main);
  const [text, setText] = useState(initial?.rate ? String(Number(initial.rate)) : '');
  const [tried, setTried] = useState(false);
  const parsed = parseRate(text);

  const submit = () => {
    setTried(true);
    if (!parsed || !code) return;
    onSave({ code, base, rate: parsed });
    onClose();
  };

  return (
    <FormSheet
      visible={visible && code !== null}
      onClose={onClose}
      title={t('acct.rates.sheetTitle', { code: code ?? '' })}
      subtitle={code ? currencyName(t, code) : undefined}
      submitLabel={t('acct.common.save')}
      saving={false}
      onSubmit={submit}
    >
      <Input
        label={t('acct.rates.inputLabel', { code: code ?? '', base })}
        value={text}
        onChangeText={setText}
        keyboardType="decimal-pad"
        placeholder={t('acct.rates.placeholder')}
        maxLength={24}
        error={tried && !parsed ? t('acct.rates.error') : undefined}
        hint={t('acct.rates.hint', { code: code ?? '', base })}
      />
      <AppText variant="caption" tone="muted">
        {t('acct.rates.rule', { code: code ?? '' })}
      </AppText>
      {onDelete && (
        <Button
          label={t('acct.rates.delete')}
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => {
            onDelete();
            onClose();
          }}
        />
      )}
    </FormSheet>
  );
}
