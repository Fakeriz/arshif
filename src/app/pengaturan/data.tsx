import { DataCard } from '@/features/settings/DataCard';
import { SettingsScreen } from '@/features/settings/kit';
import { useT } from '@/i18n';

export default function DataScreen() {
  const t = useT();
  return (
    <SettingsScreen title={t('settings.menu.data')}>
      <DataCard />
    </SettingsScreen>
  );
}
