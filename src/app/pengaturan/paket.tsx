import { SettingsScreen } from '@/features/settings/kit';
import { UsageCard } from '@/features/settings/UsageCard';
import { useT } from '@/i18n';
import { useStore } from '@/state/AppStore';

export default function PaketScreen() {
  const t = useT();
  const { state } = useStore();
  return (
    <SettingsScreen title={t('settings.menu.plan')}>
      <UsageCard plan={state.plan} usage={state.usage} accountCount={state.accounts.length} />
    </SettingsScreen>
  );
}
