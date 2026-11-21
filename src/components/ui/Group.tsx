import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, iconBox, layout, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Card } from './Card';
import { Icon } from './Icon';
import { ListItem, ListItemSkeleton } from './ListItem';

/**
 * Satu aturan grup untuk semua layar (pola Pengaturan): label kecil di luar kartu, aksi kanan opsional,
 * lalu isi grup 8px di bawahnya. Antar grup berjarak gap kolom Screen.
 *
 * Tiga varian baris di dalam ListCard, dipilih menurut isinya (bukan selera):
 * - tanpa ikon: pengaturan/properti objek yang sedang dibuka (Money, Notifikasi, detail akun); ikon hanya mengulang judul.
 * - ikon polos (MenuGroup): menu navigasi ke layar/aksi lain (Pengaturan, Alat, Data).
 * - ikon dalam kotak (IconTile): memilih cara/sumber input (+ Catat, Scan struk) atau entitas beridentitas (kategori).
 */
export function Group({ label, labelA11y, right, children }: { label?: string; labelA11y?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.group}>
      {label || right ? (
        <View style={styles.head}>
          {label ? (
            <AppText variant="caption" tone="muted" accessibilityRole="header" accessibilityLabel={labelA11y} style={styles.label}>
              {label}
            </AppText>
          ) : (
            <View />
          )}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Ikon dalam kotak 40 px untuk pilihan cara/sumber input. muted = terkunci (kuota habis). */
export function IconTile({ icon, muted }: { icon: LucideIcon; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: muted ? colors.track : colors.accentSoft }]}>
      <Icon icon={icon} color={muted ? colors.textSecondary : colors.accentText} size={iconBox[40].icon} />
    </View>
  );
}

/** Kartu daftar: tanpa padding atas-bawah (baris ListItem membawa ruangnya sendiri), sisi 14px. */
export function ListCard({ children }: { children: ReactNode }) {
  return (
    <Card padding={0}>
      <View style={styles.rows}>{children}</View>
    </Card>
  );
}

export type MenuEntry = {
  key: string;
  icon: LucideIcon;
  title: string;
  /** Keadaan sekarang (mis. "IDR · Tgl 25", "3/4 aktif"), supaya tidak perlu membuka menu hanya untuk mengecek. */
  subtitle: string;
  tone?: 'negative';
  /** Mis. badge "2 terlambat" atau PRO. */
  trailing?: ReactNode;
  /** Bawaan true; entri terkunci memakai badge PRO tanpa chevron. */
  chevron?: boolean;
  /** Bawaan "judul, keadaan"; isi bila trailing membawa info (mis. badge terlambat). */
  accessibilityLabel?: string;
  onPress: () => void;
};

/** Grup menu: label + kartu daftar berisi baris seragam (ikon polos, judul, keadaan, chevron). */
export function MenuGroup({ label, right, entries, loading }: { label?: string; right?: ReactNode; entries: MenuEntry[]; loading?: boolean }) {
  const { colors } = useTheme();
  return (
    <Group label={label} right={right}>
      <ListCard>
        {entries.map((e, i) =>
          loading ? (
            <ListItemSkeleton key={e.key} divider={i < entries.length - 1} />
          ) : (
            <ListItem
              key={e.key}
              leading={<Icon icon={e.icon} color={e.tone === 'negative' ? colors.negative : colors.textMuted} size={layout.iconSize.md - 2} />}
              title={e.title}
              subtitle={e.subtitle}
              subtitleLines={2}
              trailing={e.trailing}
              chevron={e.chevron ?? true}
              divider={i < entries.length - 1}
              onPress={e.onPress}
              accessibilityLabel={e.accessibilityLabel ?? `${e.title}, ${e.subtitle}`}
            />
          ),
        )}
      </ListCard>
    </Group>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: 20 },
  label: { paddingHorizontal: space.xs, fontFamily: fonts.semibold },
  // Sama dengan padding atas-bawah baris ListItem (14): jarak isi ke tepi kartu rata di keempat sisi.
  rows: { paddingHorizontal: 14 },
  tile: { width: 40, height: 40, borderRadius: iconBox[40].radius, alignItems: 'center', justifyContent: 'center' },
});
