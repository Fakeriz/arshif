import { EllipsisVertical, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Icon, PressableScale } from '@/components/ui';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, layout, motion, radius, space } from '@/theme/tokens';

/** Aksi layar di kanan atas (edit, hapus, split bill, ...). Aksi utama (Simpan, Bayar, Setor) tetap di badan layar. */
export type HeaderAction = { key: string; label: string; icon: LucideIcon; onPress: () => void; danger?: boolean; disabled?: boolean };

/** Tombol bulat 44 px di baris atas layar, sama dengan tombol kembali. */
export function HeaderButton({ label, icon, onPress, danger, disabled }: { label: string; icon: LucideIcon; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const { colors, scheme } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      focusRadius={radius.full}
      onPress={onPress}
      style={[styles.btn, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, opacity: disabled ? 0.45 : 1 }, elevation[scheme].card]}
    >
      <Icon icon={icon} color={danger ? colors.negative : colors.text} />
    </PressableScale>
  );
}

/**
 * Jalankan setelah sheet (Modal) selesai menutup. Native: iOS menolak membuka Modal/kamera di atas Modal yang sedang
 * menutup. Web: langsung, karena berbagi/berkas di browser harus di dalam ketukan pengguna.
 */
export function afterSheetClose(fn: () => void): void {
  if (Platform.OS === 'web') fn();
  else setTimeout(fn, motion.base + 50);
}

/** Tombol titik tiga yang membuka sheet berisi `children` (baris menu atau pengaturan). */
export function HeaderMenu({ title, children }: { title?: string; children: (close: () => void) => ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <HeaderButton label={t('common.moreActions')} icon={EllipsisVertical} onPress={() => setOpen(true)} />
      <BottomSheet visible={open} onClose={close} title={title ?? t('common.moreActions')}>
        {children(close)}
      </BottomSheet>
    </>
  );
}

/** Satu baris menu: ikon + label; aksi berbahaya (hapus) berwarna merah. */
function MenuRow({ action, divider, onPress }: { action: HeaderAction; divider: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityLabel={action.label} accessibilityState={{ disabled: !!action.disabled }} disabled={action.disabled} onPress={onPress} focusRadius={radius.md} scaleTo={0.985}>
      <View style={[styles.row, divider && { borderBottomWidth: layout.hairline, borderBottomColor: colors.border }, action.disabled && styles.disabled]}>
        <Icon icon={action.icon} color={action.danger ? colors.negative : colors.text} />
        <AppText variant="bodyStrong" tone={action.danger ? 'negative' : 'primary'} style={styles.flex}>
          {action.label}
        </AppText>
      </View>
    </PressableScale>
  );
}

/** Maksimal 2 aksi: tombol ikon langsung. Lebih dari itu: satu tombol titik tiga berisi semua aksi. */
export function HeaderActions({ actions }: { actions: HeaderAction[] }) {
  if (actions.length === 0) return null;
  if (actions.length <= 2) return <>{actions.map((a) => <HeaderButton key={a.key} label={a.label} icon={a.icon} onPress={a.onPress} danger={a.danger} disabled={a.disabled} />)}</>;
  return (
    <HeaderMenu>
      {(close) =>
        actions.map((a, i) => (
          <MenuRow
            key={a.key}
            action={a}
            divider={i < actions.length - 1}
            onPress={() => {
              close();
              afterSheetClose(a.onPress);
            }}
          />
        ))
      }
    </HeaderMenu>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, borderRadius: radius.full, borderWidth: layout.hairline, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingVertical: space.sm },
  disabled: { opacity: 0.45 },
  flex: { flex: 1 },
});
