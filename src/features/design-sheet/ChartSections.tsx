import { useState } from 'react';
import { View } from 'react-native';

import { Card, CashflowChart, DonutChart, HealthGauge, Tabs } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

import { bucketSegments, cashflow } from './sample-data';
import { Section } from './Section';

type ChartState = 'data' | 'empty' | 'loading';

const STATE_TABS: { key: ChartState; label: string }[] = [
  { key: 'data', label: 'Data' },
  { key: 'empty', label: 'Kosong' },
  { key: 'loading', label: 'Loading' },
];

function useChartState() {
  const [state, setState] = useState<ChartState>('data');
  const tabs = <Tabs items={STATE_TABS} value={state} onChange={setState} accessibilityLabel="State contoh" />;
  return { state, tabs };
}

export function DonutSection() {
  const { hues } = useTheme();
  const { state, tabs } = useChartState();
  const segments = bucketSegments(hues);
  return (
    <Section index="Grafik" title="DonutChart interaktif" note="Ketuk segmen atau baris legenda, nilainya muncul di tengah.">
      {tabs}
      <Card padding="xl">
        <DonutChart
          segments={state === 'empty' ? segments.map((s) => ({ ...s, value: 0 })) : segments}
          currency="IDR"
          centerLabel="Terpakai November"
          loading={state === 'loading'}
        />
      </Card>
    </Section>
  );
}

export function GaugeSection() {
  const { state, tabs } = useChartState();
  return (
    <Section index="Grafik" title="Gauge Health Score" note="Skor dihitung rumus deterministik (5 pilar); AI hanya menarasikan.">
      {tabs}
      <Card padding="xl">
        <View style={{ paddingVertical: space.md }}>
          <HealthGauge score={state === 'empty' ? null : 72} delta={6} loading={state === 'loading'} />
        </View>
      </Card>
    </Section>
  );
}

export function CashflowSection() {
  const { state, tabs } = useChartState();
  return (
    <Section index="Grafik" title="Grafik arus kas" note="Pemasukan vs pengeluaran 6 bulan. Ketuk bulan untuk rinciannya.">
      {tabs}
      <Card padding="lg">
        <CashflowChart
          data={state === 'empty' ? cashflow.map((c) => ({ ...c, income: 0, expense: 0 })) : cashflow}
          currency="IDR"
          loading={state === 'loading'}
        />
      </Card>
    </Section>
  );
}
