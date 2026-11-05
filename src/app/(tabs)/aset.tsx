import { ChartCandlestick } from 'lucide-react-native';

import { Screen } from '@/components/shell/Screen';
import { TabHeader } from '@/components/shell/TabHeader';
import { Card, EmptyState } from '@/components/ui';
import { useT } from '@/i18n';

// TODO(Fase 3): portofolio saham dan aset lain. Sampai itu tab ini hanya memberi tahu bahwa fiturnya belum ada.
export default function AsetScreen() {
  const t = useT();
  return (
    <Screen tabs>
      <TabHeader title={t('shell.assets.title')} subtitle={t('shell.assets.subtitle')} />
      <Card>
        <EmptyState icon={ChartCandlestick} title={t('shell.assets.soonTitle')} message={t('shell.assets.soonMessage')} />
      </Card>
    </Screen>
  );
}
