import { Plus } from 'lucide-react-native';
import { useState } from 'react';

import { HeaderButton } from '@/components/shell/HeaderActions';
import { AccountsCard } from '@/features/settings/AccountsCard';
import { AddAccountSheet } from '@/features/settings/AddAccountSheet';
import { SettingsScreen } from '@/features/settings/kit';
import { useT } from '@/i18n';

export default function AkunScreen() {
  const t = useT();
  const [adding, setAdding] = useState(false);
  return (
    <SettingsScreen title={t('settings.accounts.title')} right={<HeaderButton label={t('settings.accounts.addTitle')} icon={Plus} onPress={() => setAdding(true)} />}>
      <AccountsCard />
      <AddAccountSheet visible={adding} onClose={() => setAdding(false)} />
    </SettingsScreen>
  );
}
