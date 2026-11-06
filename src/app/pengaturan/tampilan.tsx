import { AccentPicker, AppText, Card, Tabs } from '@/components/ui';
import { SettingsScreen, SettingsSection } from '@/features/settings/kit';
import { useT } from '@/i18n';
import { HAPTIC_LEVELS, haptic, useHapticLevel } from '@/theme/motion';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';

const MODES: ThemeMode[] = ['system', 'dark', 'light'];

export default function TampilanScreen() {
  const t = useT();
  const { mode, setMode } = useTheme();
  const [hapticLevel, setHapticLevel] = useHapticLevel();
  return (
    <SettingsScreen title={t('settings.appearance')}>
      <SettingsSection label={t('settings.theme')}>
        <Card padding="md">
          <Tabs items={MODES.map((key) => ({ key, label: t(`settings.themeMode.${key}`) }))} value={mode} onChange={setMode} accessibilityLabel={t('settings.theme')} />
        </Card>
      </SettingsSection>
      <SettingsSection label={t('common.accentColor')}>
        <Card padding="md">
          <AccentPicker />
        </Card>
      </SettingsSection>
      <SettingsSection label={t('settings.haptics')}>
        <Card padding="md">
          <Tabs
            items={HAPTIC_LEVELS.map((key) => ({ key, label: t(`settings.hapticLevel.${key}`) }))}
            value={hapticLevel}
            onChange={(level) => {
              setHapticLevel(level);
              // Contoh langsung dari intensitas yang baru dipilih.
              haptic('selection');
            }}
            accessibilityLabel={t('settings.haptics')}
          />
        </Card>
        <AppText variant="caption" tone="muted">
          {t('settings.hapticsSub')}
        </AppText>
      </SettingsSection>
    </SettingsScreen>
  );
}
