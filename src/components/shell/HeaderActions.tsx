import { EllipsisVertical, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { AppText, Icon, PressableScale } from '@/components/ui';
import { useT } from '@/i18n';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, layout, motion, radius, space } from '@/theme/tokens';

/**
 * Aksi layar di kanan atas (edit, hapus, split bill, ...). Aksi utama (Simpan, Bayar, Setor) tetap di badan layar.
 * pinned = tetap tampil sebagai ikon sendiri walau aksi lain masuk menu titik tiga (Edit).
 */
export type HeaderAction = { key: string; label: string; icon: LucideIcon; onPress: () => void; danger?: boolean; disabled?: boolean; pinned?: boolean };

type HeaderButtonProps = { label: string; icon: LucideIcon; onPress: () => void; danger?: boolean; disabled?: boolean; selected?: boolean; badge?: number };

/** Tombol bulat 44 px di baris atas layar, sama dengan tombol kembali. badge = jumlah (mis. filter aktif). */
export function HeaderButton({ label, icon, onPress, danger, disabled, selected, badge }: HeaderButtonProps) {
  const { colors, scheme } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      disabled={disabled}
      focusRadius={radius.full}
      onPress={onPress}
      style={[
        styles.btn,
        { backgroundColor: selected ? colors.accentSoft : colors.surfaceRaised, borderColor: selected ? colors.accent : colors.border, opacity: disabled ? 0.45 : 1 },
        elevation[scheme].card,
      ]}
    >
      <Icon icon={icon} color={danger ? colors.negative : selected ? colors.accentText : colors.text} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.bg }]} aria-hidden>
          <AppText variant="caption" style={[styles.badgeText, { color: colors.onAccent }]}>
            {badge > 9 ? '9+' : String(badge)}
          </AppText>
        </View>
      ) : null}
    </PressableScale>
  );
}

/**
 * Jalankan setelah menu (Modal) selesai menutup. Native: iOS menolak membuka Modal/kamera di atas Modal yang sedang
 * menutup. Web: langsung, karena berbagi/berkas di browser harus di dalam ketukan pengguna.
 */
export function afterSheetClose(fn: () => void): void {
  if (Platform.OS === 'web') fn();
  else {
    const timer = setTimeout(fn, motion.base + 50);
    (timer as unknown as { unref?: () => void })?.unref?.();
  }
}

const MENU_WIDTH = 260;

/**
 * Tombol titik tiga yang membuka menu melayang tepat di bawahnya, rata kanan (gaya menu iOS), bukan sheet bawah.
 * Ketuk di luar menu = tutup. `children` = baris menu atau pengaturan. `trigger` = tombol pemicu lain (mis. pensil di sampul).
 */
export function HeaderMenu({ children, trigger }: { children: (close: () => void) => ReactNode; trigger?: (show: () => void, open: boolean) => ReactNode }) {
  const t = useT();
  const { colors, scheme } = useTheme();
  const { spring, timing } = useMotion();
  const { width: screenW } = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  // Posisi disimpan terpisah dari open: saat menutup, menu memudar di tempatnya (bukan melompat ke pojok atas).
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 96, right: space.lg });
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const p = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      p.value = spring(1);
      return;
    }
    p.value = timing(0, motion.fast);
    const id = setTimeout(() => setMounted(false), motion.fast);
    return () => clearTimeout(id);
  }, [open, p, spring, timing]);

  const measured = useRef<{ top: number; right: number } | null>(null);
  const measure = (then?: (p: { top: number; right: number }) => void) =>
    anchor.current?.measureInWindow?.((x, y, w, h) => {
      measured.current = { top: y + h + space.sm, right: Math.max(space.sm, screenW - (x + w)) };
      then?.(measured.current);
    });
  // Buka langsung di posisi terakhir yang diukur (saat tombol tampil), lalu ukur ulang bila layar sudah digulir.
  const show = () => {
    if (measured.current) setPos(measured.current);
    setOpen(true);
    measure(setPos);
  };
  const close = () => setOpen(false);

  // Tumbuh dari pojok kanan atas, dekat tombol pemicunya.
  const pop = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, p.value)), transform: [{ scale: 0.85 + p.value * 0.15 }] }));

  return (
    <>
      <View ref={anchor} collapsable={false} onLayout={() => measure()}>
        {trigger ? trigger(show, open) : <HeaderButton label={t('common.moreActions')} icon={EllipsisVertical} onPress={show} selected={open} />}
      </View>
      <Modal transparent visible={mounted} onRequestClose={close} animationType="none" statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.menu,
            { top: pos.top, right: pos.right, width: Math.min(MENU_WIDTH, screenW - space.lg * 2), backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            elevation[scheme].floating,
            pop,
          ]}
        >
          {children(close)}
        </Animated.View>
      </Modal>
    </>
  );
}

/** Satu baris menu: label + ikon di kanan (gaya iOS); aksi berbahaya (hapus) berwarna merah. */
export function MenuRow({ action, divider, onPress }: { action: HeaderAction; divider: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityLabel={action.label} accessibilityState={{ disabled: !!action.disabled }} disabled={action.disabled} onPress={onPress} focusRadius={radius.sm} scaleTo={0.985}>
      <View style={[styles.row, divider && { borderBottomWidth: layout.hairline, borderBottomColor: colors.border }, action.disabled && styles.disabled]}>
        <AppText variant="body" tone={action.danger ? 'negative' : 'primary'} style={styles.flex}>
          {action.label}
        </AppText>
        <Icon icon={action.icon} color={action.danger ? colors.negative : colors.text} size={layout.iconSize.md} />
      </View>
    </PressableScale>
  );
}

/**
 * Maksimal 2 aksi: tombol ikon langsung. Lebih dari itu: aksi `pinned` (Edit) tetap ikon sendiri, sisanya masuk satu
 * tombol titik tiga.
 */
export function HeaderActions({ actions }: { actions: HeaderAction[] }) {
  const icon = (a: HeaderAction) => <HeaderButton key={a.key} label={a.label} icon={a.icon} onPress={a.onPress} danger={a.danger} disabled={a.disabled} />;
  if (actions.length <= 2) return <>{actions.map(icon)}</>;
  const pinned = actions.filter((a) => a.pinned);
  const rest = actions.filter((a) => !a.pinned);
  return (
    <>
      {pinned.map(icon)}
      <HeaderMenu>
        {(close) =>
          rest.map((a, i) => (
            <MenuRow
              key={a.key}
              action={a}
              divider={i < rest.length - 1}
              onPress={() => {
                close();
                afterSheetClose(a.onPress);
              }}
            />
          ))
        }
      </HeaderMenu>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, borderRadius: radius.full, borderWidth: layout.hairline, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: '700' },
  menu: { position: 'absolute', borderRadius: radius.lg, borderWidth: layout.hairline, paddingHorizontal: space.md, paddingVertical: space.xs, transformOrigin: 'top right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingVertical: space.sm },
  disabled: { opacity: 0.45 },
  flex: { flex: 1 },
});
