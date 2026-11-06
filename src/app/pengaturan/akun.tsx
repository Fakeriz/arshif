import { AccountsCard } from '@/features/settings/AccountsCard';
import { SettingsScreen } from '@/features/settings/kit';
import { useT } from '@/i18n';

export default function AkunScreen() {
  const t = useT();
  return (
    <SettingsScreen title={t('settings.accounts.title')}>
      <AccountsCard />
    </SettingsScreen>
  );
}
