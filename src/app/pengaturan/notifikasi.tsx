import { Card, ListItem, Toggle } from '@/components/ui';
import { SettingsScreen } from '@/features/settings/kit';
import { useT } from '@/i18n';
import { useStore } from '@/state/AppStore';
import type { NotifPrefs } from '@/state/reducer';

const NOTIFS: (keyof NotifPrefs)[] = ['bill_due', 'budget_alert', 'weekly_recap', 'quota_warning'];

export default function NotifikasiScreen() {
  const t = useT();
  const { state, dispatch } = useStore();
  return (
    <SettingsScreen title={t('settings.notifications')}>
      <Card padding="md">
        {NOTIFS.map((key, i) => (
          <ListItem
            key={key}
            title={t(`settings.notif.${key}.title`)}
            subtitle={t(`settings.notif.${key}.sub`)}
            subtitleLines={2}
            divider={i < NOTIFS.length - 1}
            trailing={<Toggle value={state.notifPrefs[key]} onChange={(value) => dispatch({ type: 'prefs/notif', key, value })} accessibilityLabel={t(`settings.notif.${key}.title`)} />}
          />
        ))}
      </Card>
    </SettingsScreen>
  );
}
