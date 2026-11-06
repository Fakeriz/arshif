import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmountField, AppText, Card, Chip, Tabs, Toggle } from '@/components/ui';
import { ChoiceRow } from '@/features/planning/kit';
import { GatedBody, TaxDisclaimer, ToolScreen, useFeatureGate } from '@/features/tools/kit';
import { TaxResultCard } from '@/features/tools/TaxResultCard';
import { useI18n, useT } from '@/i18n';
import { defaultTaxCountry, estimateId, estimateMy, estimateTr, ptkpCode, type PtkpStatus, type TaxCountry } from '@/lib/tax';
import { useStore } from '@/state/AppStore';
import { space } from '@/theme/tokens';

/** Estimasi pajak penghasilan (FR-TAX-2, Premium): PPh 21 TER, PCB/MTD, Gelir Vergisi. */
export default function TaxEstimator() {
  const t = useT();
  const gate = useFeatureGate('taxFull');
  return (
    <ToolScreen title={t('tools.tax.title')}>
      <GatedBody gate={gate} reason={t('tools.tax.reason')} lockedTitle={t('tools.tax.lockedTitle')}>
        <Estimator />
      </GatedBody>
    </ToolScreen>
  );
}

function Estimator() {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const [country, setCountry] = useState<TaxCountry>(() => defaultTaxCountry(state.mainCurrency, lang));
  return (
    <>
      <Tabs
        accessibilityLabel={t('tools.tax.country')}
        value={country}
        onChange={setCountry}
        items={[{ key: 'ID', label: t('tools.tax.countryId') }, { key: 'MY', label: t('tools.tax.countryMy') }, { key: 'TR', label: t('tools.tax.countryTr') }]}
      />
      {country === 'ID' ? <IdForm /> : country === 'MY' ? <MyForm /> : <TrForm />}
    </>
  );
}

function Prompt() {
  const t = useT();
  return (
    <>
      <AppText variant="body" tone="secondary">
        {t('tools.tax.fillIn')}
      </AppText>
      <TaxDisclaimer />
    </>
  );
}

function IdForm() {
  const t = useT();
  const [gross, setGross] = useState<number | null>(null);
  const [pension, setPension] = useState<number | null>(null);
  const [married, setMarried] = useState(false);
  const [dependents, setDependents] = useState<PtkpStatus['dependents']>(0);
  const status: PtkpStatus = { married, dependents };
  return (
    <>
      <Card padding="lg">
        <View style={styles.form}>
          <AmountField label={t('tools.tax.id.gross')} value={gross} onChange={setGross} currency="IDR" hint={t('tools.tax.id.grossHint')} />
          <ChoiceRow label={t('tools.tax.id.marital')} value={married ? 'k' : 'tk'} onChange={(k) => setMarried(k === 'k')} options={[{ key: 'tk', label: t('tools.tax.id.single') }, { key: 'k', label: t('tools.tax.id.married') }]} />
          <View style={styles.choice}>
            <AppText variant="caption" tone="secondary">
              {t('tools.tax.id.dependents')}
            </AppText>
            <View style={styles.chips}>
              {([0, 1, 2, 3] as const).map((n) => (
                <Chip key={n} label={String(n)} selected={dependents === n} onPress={() => setDependents(n)} />
              ))}
            </View>
            <AppText variant="caption" tone="muted">
              {t('tools.tax.id.status', { code: ptkpCode(status) })}
            </AppText>
          </View>
          <AmountField label={t('tools.tax.id.pension')} value={pension} onChange={setPension} currency="IDR" hint={t('tools.tax.id.pensionHint')} />
        </View>
      </Card>
      {gross ? (
        <>
          <TaxResultCard result={estimateId({ ...status, monthlyGross: gross, monthlyPension: pension ?? 0 })} />
          <TaxDisclaimer />
        </>
      ) : (
        <Prompt />
      )}
    </>
  );
}

function MyForm() {
  const t = useT();
  const [gross, setGross] = useState<number | null>(null);
  const [spouse, setSpouse] = useState(false);
  const [children, setChildren] = useState(0);
  const [epf, setEpf] = useState(true);
  return (
    <>
      <Card padding="lg">
        <View style={styles.form}>
          <AmountField label={t('tools.tax.my.gross')} value={gross} onChange={setGross} currency="MYR" />
          <ToggleRow label={t('tools.tax.my.epf')} hint={t('tools.tax.my.epfHint')} value={epf} onChange={setEpf} />
          <ToggleRow label={t('tools.tax.my.spouse')} hint={t('tools.tax.my.spouseHint')} value={spouse} onChange={setSpouse} />
          <View style={styles.choice}>
            <AppText variant="caption" tone="secondary">
              {t('tools.tax.my.children')}
            </AppText>
            <View style={styles.chips}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} label={n === 5 ? '5+' : String(n)} selected={children === n} onPress={() => setChildren(n)} />
              ))}
            </View>
          </View>
        </View>
      </Card>
      {gross ? (
        <>
          <TaxResultCard result={estimateMy({ monthlyGross: gross, spouseRelief: spouse, children, epf })} />
          <TaxDisclaimer />
        </>
      ) : (
        <Prompt />
      )}
    </>
  );
}

function TrForm() {
  const t = useT();
  const [gross, setGross] = useState<number | null>(null);
  return (
    <>
      <Card padding="lg">
        <AmountField label={t('tools.tax.tr.gross')} value={gross} onChange={setGross} currency="TRY" hint={t('tools.tax.tr.grossHint')} />
      </Card>
      {gross ? (
        <>
          <TaxResultCard result={estimateTr({ monthlyGross: gross })} />
          <TaxDisclaimer />
        </>
      ) : (
        <Prompt />
      )}
    </>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <View style={styles.flex}>
        <AppText variant="body">{label}</AppText>
        <AppText variant="caption" tone="secondary">
          {hint}
        </AppText>
      </View>
      <Toggle value={value} onChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  choice: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
});
