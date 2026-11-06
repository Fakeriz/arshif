import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Card, Icon, ListItem } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export type MenuEntry = {
  key: string;
  icon: LucideIcon;
  title: string;
  /** Keadaan sekarang (mis. "IDR · Tgl 25", "3/4 aktif"), supaya tidak perlu membuka menu hanya untuk mengecek. */
  subtitle: string;
  tone?: 'accent' | 'negative';
  onPress: () => void;
};

/** Satu grup menu Pengaturan: label kategori + kartu berisi baris seragam (ikon, judul, keadaan sekarang, chevron). */
export function MenuGroup({ label, entries }: { label: string; entries: MenuEntry[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <AppText variant="caption" tone="secondary" accessibilityRole="header" style={styles.label}>
        {label}
      </AppText>
      <Card padding="md">
        {entries.map((e, i) => (
          <ListItem
            key={e.key}
            leading={
              <View style={[styles.tile, { backgroundColor: e.tone === 'negative' ? colors.negativeSoft : colors.accentSoft }]}>
                <Icon icon={e.icon} color={e.tone === 'negative' ? colors.negative : colors.accentText} />
              </View>
            }
            title={e.title}
            subtitle={e.subtitle}
            subtitleLines={2}
            chevron
            divider={i < entries.length - 1}
            onPress={e.onPress}
            accessibilityLabel={`${e.title}, ${e.subtitle}`}
          />
        ))}
      </Card>
    </View>
  );
}

/** Kerangka layar turunan Pengaturan: header kembali + judul, konten dengan jarak yang sama. */
export function SettingsScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Screen>
      <ScreenHeader title={title} />
      {children}
    </Screen>
  );
}

/** Kartu pengaturan dengan judul kecil di atas (dipakai di layar turunan). */
export function SettingsSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      {label ? (
        <AppText variant="caption" tone="secondary" accessibilityRole="header" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  label: { paddingHorizontal: space.xs },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
