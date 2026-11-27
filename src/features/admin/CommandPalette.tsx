import {
  Activity,
  ArrowRight,
  Cpu,
  ExternalLink,
  Globe,
  LayoutDashboard,
  Megaphone,
  Monitor,
  Moon,
  Receipt,
  RefreshCw,
  Search,
  Sun,
  TrendingUp,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Badge, Icon, PressableScale } from '@/components/ui';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { elevation, layout, radius, space, type as typeScale } from '@/theme/tokens';

import { searchAdminUsers, type AdminUserRow } from './adminApi';
import { copy } from './copy';
import type { AdminNavigate, AdminSectionKey } from './parts';

export type CommandPaletteProps = {
  visible: boolean;
  onClose: () => void;
  activeSection: AdminSectionKey;
  onNavigate: AdminNavigate;
  onCheckHealth: () => void;
  onSyncFx: () => void;
  onSyncAssets: () => void;
  onChangeTheme: (mode: ThemeMode) => void;
  onOpenApp: () => void;
};

type PaletteItem = {
  id: string;
  group: 'section' | 'action' | 'user';
  title: string;
  subtitle?: string;
  badge?: { label: string; tone: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning' | 'info' };
  shortcut?: string;
  icon: LucideIcon;
  keywords: string;
  run: () => void;
};

const SECTION_META: { key: AdminSectionKey; icon: LucideIcon; shortcut: string; keywords: string }[] = [
  { key: 'dasbor', icon: LayoutDashboard, shortcut: 'Alt+1', keywords: 'dasbor dashboard dau metrik ringkasan' },
  { key: 'pengguna', icon: Users, shortcut: 'Alt+2', keywords: 'pengguna user akun kuota pro grant suspend' },
  { key: 'ai', icon: Cpu, shortcut: 'Alt+3', keywords: 'log ai ocr scan voice import pdf coach latensi' },
  { key: 'pesanan', icon: Receipt, shortcut: 'Alt+4', keywords: 'pesanan order xendit paddle billing pembayaran' },
  { key: 'kurs', icon: Globe, shortcut: 'Alt+5', keywords: 'kurs fx mata uang harga aset sync frankfurter' },
  { key: 'broadcast', icon: Megaphone, shortcut: 'Alt+6', keywords: 'broadcast notifikasi pesan lonceng segmen' },
];

/**
 * Palet perintah cepat (Cmd+K / Ctrl+K).
 * Aksi keyboard berfrekuensi tinggi: langsung muncul tanpa animasi masuk yang melambat,
 * navigasi penuh dengan panah atas/bawah + Enter + Esc.
 */
export function CommandPalette({
  visible,
  onClose,
  activeSection,
  onNavigate,
  onCheckHealth,
  onSyncFx,
  onSyncAssets,
  onChangeTheme,
  onOpenApp,
}: CommandPaletteProps) {
  const { colors, scheme } = useTheme();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const searchSeq = useRef(0);
  const p = copy.palette;

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setActiveIndex(0);
    setUsers([]);
    setSearchingUsers(false);
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (q.length < 2) {
      setUsers([]);
      setSearchingUsers(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearchingUsers(true);
    const id = setTimeout(() => {
      searchAdminUsers(q, 8)
        .then((rows) => {
          if (seq === searchSeq.current) setUsers(rows);
        })
        .catch(() => {
          if (seq === searchSeq.current) setUsers([]);
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearchingUsers(false);
        });
    }, 220);
    return () => clearTimeout(id);
  }, [visible, query]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = (title: string, keywords: string) => !q || title.toLowerCase().includes(q) || keywords.toLowerCase().includes(q);

    const sections: PaletteItem[] = SECTION_META.filter((s) => matches(copy.nav[s.key], s.keywords)).map((s) => ({
      id: `sec:${s.key}`,
      group: 'section',
      title: copy.nav[s.key],
      subtitle: copy.sectionSubtitle[s.key],
      badge: activeSection === s.key ? { label: 'Aktif', tone: 'accent' } : undefined,
      shortcut: s.shortcut,
      icon: s.icon,
      keywords: s.keywords,
      run: () => {
        onNavigate({ bagian: s.key });
        onClose();
      },
    }));

    const rawActions: PaletteItem[] = [
      {
        id: 'act:fx',
        group: 'action',
        title: p.actions.syncFx,
        icon: RefreshCw,
        keywords: 'sinkron kurs fx frankfurter',
        run: () => {
          onClose();
          onSyncFx();
        },
      },
      {
        id: 'act:assets',
        group: 'action',
        title: p.actions.syncAssets,
        icon: TrendingUp,
        keywords: 'sinkron harga aset pasar saham kripto emas',
        run: () => {
          onClose();
          onSyncAssets();
        },
      },
      {
        id: 'act:health',
        group: 'action',
        title: p.actions.checkHealth,
        icon: Activity,
        keywords: 'kesehatan server health db ready status',
        run: () => {
          onClose();
          onCheckHealth();
        },
      },
      {
        id: 'act:theme-light',
        group: 'action',
        title: p.actions.themeLight,
        icon: Sun,
        keywords: 'tema terang light mode',
        run: () => {
          onChangeTheme('light');
          onClose();
        },
      },
      {
        id: 'act:theme-dark',
        group: 'action',
        title: p.actions.themeDark,
        icon: Moon,
        keywords: 'tema gelap dark mode',
        run: () => {
          onChangeTheme('dark');
          onClose();
        },
      },
      {
        id: 'act:theme-system',
        group: 'action',
        title: p.actions.themeSystem,
        icon: Monitor,
        keywords: 'tema sistem auto mode',
        run: () => {
          onChangeTheme('system');
          onClose();
        },
      },
      {
        id: 'act:app',
        group: 'action',
        title: p.actions.openApp,
        icon: ExternalLink,
        keywords: 'buka aplikasi arshif beranda home',
        run: () => {
          onClose();
          onOpenApp();
        },
      },
    ];
    const actions = rawActions.filter((a) => matches(a.title, a.keywords));

    const userItems: PaletteItem[] = users.map((u) => ({
      id: `usr:${u.id}`,
      group: 'user',
      title: u.email,
      subtitle: u.display_name ?? u.id,
      badge: u.suspended_at
        ? { label: copy.users.suspended, tone: 'negative' }
        : u.plan === 'premium'
          ? { label: copy.users.premium, tone: 'accent' }
          : { label: copy.users.free, tone: 'neutral' },
      icon: User,
      keywords: `${u.email} ${u.display_name ?? ''}`,
      run: () => {
        onNavigate({ bagian: 'pengguna', uid: u.id, q: u.email });
        onClose();
      },
    }));

    return [...userItems, ...sections, ...actions];
  }, [query, users, activeSection, onNavigate, onClose, onSyncFx, onSyncAssets, onCheckHealth, onChangeTheme, onOpenApp, p.actions]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, query]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((idx) => (idx + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((idx) => (idx - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        items[activeIndex]?.run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, items, activeIndex, onClose]);

  if (!visible) return null;

  const grouped: { key: PaletteItem['group']; label: string; rows: { item: PaletteItem; index: number }[] }[] = [
    { key: 'user', label: p.usersHeading, rows: [] },
    { key: 'section', label: p.sectionsHeading, rows: [] },
    { key: 'action', label: p.actionsHeading, rows: [] },
  ];
  items.forEach((item, index) => {
    const bucket = grouped.find((g) => g.key === item.group);
    if (bucket) bucket.rows.push({ item, index });
  });

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={p.close} />
        <View
          accessibilityRole="none"
          accessibilityViewIsModal
          aria-modal
          aria-label={`${p.trigger} (${p.shortcut})`}
          style={[
            styles.dialog,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.borderStrong,
            },
            elevation[scheme].floating,
          ]}
        >
          <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
            <Icon icon={Search} color={colors.textMuted} size={18} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder={p.placeholder}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={p.trigger}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, typeScale.input, { color: colors.text }]}
              onSubmitEditing={() => items[activeIndex]?.run()}
            />
            <PressableScale
              onPress={onClose}
              hitSlop={6}
              accessibilityLabel={p.close}
              focusRadius={radius.control}
              scaleTo={0.96}
              style={[styles.closeBtn, { backgroundColor: colors.fill }]}
            >
              <Icon icon={X} color={colors.textSecondary} size={16} />
            </PressableScale>
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {searchingUsers && (
              <View style={styles.stateRow}>
                <AppText variant="caption" tone="secondary">
                  {p.searchingUsers}
                </AppText>
              </View>
            )}
            {items.length === 0 && !searchingUsers ? (
              <View style={styles.stateRow}>
                <AppText variant="body" tone="secondary">
                  {p.empty}
                </AppText>
              </View>
            ) : (
              grouped
                .filter((g) => g.rows.length > 0)
                .map((group) => (
                  <View key={group.key} style={styles.group}>
                    <AppText variant="overline" tone="muted" style={styles.groupLabel}>
                      {group.label}
                    </AppText>
                    {group.rows.map(({ item, index }) => {
                      const active = index === activeIndex;
                      return (
                        <PressableScale
                          key={item.id}
                          onPress={item.run}
                          onHoverIn={() => setActiveIndex(index)}
                          accessibilityLabel={item.title}
                          focusRadius={radius.inset}
                          scaleTo={0.99}
                          style={[
                            styles.row,
                            active && { backgroundColor: colors.accentSoft },
                          ]}
                        >
                          <View style={[styles.rowIcon, { backgroundColor: colors.fill }]}>
                            <Icon icon={item.icon} color={colors.text} size={16} />
                          </View>
                          <View style={styles.rowBody}>
                            <AppText variant="bodyStrong" numberOfLines={1}>
                              {item.title}
                            </AppText>
                            {item.subtitle ? (
                              <AppText variant="caption" tone="secondary" numberOfLines={1}>
                                {item.subtitle}
                              </AppText>
                            ) : null}
                          </View>
                          {item.badge ? <Badge label={item.badge.label} tone={item.badge.tone} /> : null}
                          {item.shortcut ? (
                            <View style={[styles.kbd, { backgroundColor: colors.fill, borderColor: colors.border }]}>
                              <AppText variant="overline" tone="secondary">
                                {item.shortcut}
                              </AppText>
                            </View>
                          ) : (
                            <Icon icon={ArrowRight} color={colors.textMuted} size={14} />
                          )}
                        </PressableScale>
                      );
                    })}
                  </View>
                ))
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <AppText variant="caption" tone="muted">
              {p.hint}
            </AppText>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 72,
    paddingHorizontal: space.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '78%',
    borderRadius: radius.card,
    borderWidth: layout.hairline,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: layout.hairline,
  },
  input: {
    flex: 1,
    minHeight: 36,
    outlineStyle: 'none',
  } as object,
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  group: {
    paddingVertical: space.xs,
    gap: space.xxs,
  },
  groupLabel: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    minHeight: 46,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs + 2,
    borderRadius: radius.inset,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  kbd: {
    paddingHorizontal: space.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: layout.hairline,
  },
  stateRow: {
    padding: space.lg,
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderTopWidth: layout.hairline,
  },
});
