import { Check, ChevronDown, Crop, Globe, Search, X } from 'lucide-react-native';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import { AppText, Button, Icon, PressableScale } from '@/components/ui';
import { CardArt } from '@/components/ui/CardArt';
import { ProductArt, productLabel } from '@/components/ui/ProductArt';
import { Flag } from '@/components/ui/Flag';
import { getBank } from '@/constants/banks';
import { bankName, useT } from '@/i18n';
import {
  cardProduct,
  countryCounts,
  groupCatalog,
  kindsIn,
  type CardKind,
  type CardProduct,
  type PickerCountry,
  PICKER_COUNTRIES,
} from '@/lib/cardCatalog';
import { LOGO_LICENSE_URL } from '@/lib/finlogos';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, layout, radius, space } from '@/theme/tokens';

const GRID_GAP = space.md;
const BUTTON = 48;

export { artVariant, ProductArt, productLabel } from '@/components/ui/ProductArt';

/**
 * "Pilih Tampilan Kartu": pilih artwork untuk kartu akun. Struktur mengikuti referensi (docs/card-picker-ref):
 * header X / judul / centang, cari + negara, tab jenis, grid per bank, bar bawah kartu saat ini + Atur.
 * Centang nonaktif sampai ada pilihan baru; X menutup tanpa perubahan.
 */
export function CardStylePicker({ bank, currentId, onApply, onClose }: {
  /** Bank akun: dipakai untuk tampilan bawaan bila belum ada pilihan, dan negara awal. */
  bank: string;
  currentId: string | null;
  onApply: (productId: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const current = cardProduct(currentId);
  const home = getBank(bank).country;
  const [country, setCountry] = useState<PickerCountry | 'all'>(current ? (getBank(current.bank).country as PickerCountry) : home === 'ANY' ? 'all' : home);
  const kinds = kindsIn(country);
  const [kindPref, setKind] = useState<CardKind>(current?.kind ?? 'credit');
  const kind = kinds.includes(kindPref) ? kindPref : (kinds[0] ?? 'credit');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const groupY = useRef(new Map<string, number>());

  const counts = useMemo(() => countryCounts(), []);
  const groups = groupCatalog({ country, kind, query });
  const cardWidth = gridWidth > 0 ? (gridWidth - GRID_GAP) / 2 : 0;
  const canApply = selected !== null && selected !== currentId;
  const countryLabel = (c: PickerCountry | 'all') => (c === 'all' ? t('acct.cardStyle.allCountries') : t(`settings.accounts.country.${c}`));

  // Atur: tampilkan lagi kartu yang sedang dipakai di daftar (negara, jenis, dan grupnya).
  const reveal = () => {
    if (!current) return;
    setQuery('');
    setCountry(getBank(current.bank).country as PickerCountry);
    setKind(current.kind);
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: groupY.current.get(current.bank) ?? 0, animated: true }));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surfaceRaised, paddingTop: insets.top + space.md }]}>
      <View style={styles.header}>
        <PressableScale accessibilityLabel={t('acct.cardStyle.close')} onPress={onClose} focusRadius={radius.control} style={[styles.round, { backgroundColor: colors.surfaceSunken }]}>
          <Icon icon={X} color={colors.text} />
        </PressableScale>
        <AppText variant="h3" accessibilityRole="header" style={styles.title}>
          {t('acct.cardStyle.title')}
        </AppText>
        <PressableScale
          accessibilityLabel={t('acct.cardStyle.apply')}
          aria-disabled={!canApply}
          disabled={!canApply}
          onPress={() => selected && onApply(selected)}
          focusRadius={radius.control}
          style={[styles.round, { backgroundColor: canApply ? colors.accent : colors.surfaceSunken }]}
        >
          <Icon icon={Check} color={canApply ? colors.onAccent : colors.textMuted} />
        </PressableScale>
      </View>

      <View style={styles.filters}>
        <View style={[styles.search, { backgroundColor: colors.surfaceSunken }]}>
          <View style={styles.noShrink}>
            <Icon icon={Search} color={colors.textMuted} size={layout.iconSize.sm + 2} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('acct.cardStyle.search')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('acct.cardStyle.search')}
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
        <PressableScale
          accessibilityLabel={t('acct.cardStyle.countryA11y', { country: countryLabel(country) })}
          onPress={() => setCountryOpen(true)}
          focusRadius={radius.control}
          style={[styles.countryPill, { backgroundColor: colors.surfaceSunken }]}
        >
          <View style={styles.noShrink}>{country === 'all' ? <Icon icon={Globe} color={colors.text} size={layout.iconSize.sm + 2} /> : <Flag country={country} />}</View>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
            {countryLabel(country)}
          </AppText>
          <Icon icon={ChevronDown} color={colors.textSecondary} size={layout.iconSize.sm} />
        </PressableScale>
      </View>

      {kinds.length > 0 && (
        <View style={styles.tabs} accessibilityRole="tablist">
          {kinds.map((k) => {
            const on = k === kind;
            return (
              <PressableScale
                key={k}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(`acct.cardStyle.kind.${k}`)}
                onPress={() => setKind(k)}
                focusRadius={radius.control}
                style={[styles.tab, { backgroundColor: on ? colors.accent : colors.surfaceSunken }]}
              >
                <AppText variant="button" style={{ color: on ? colors.onAccent : colors.text }}>
                  {t(`acct.cardStyle.kind.${k}`)}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      )}

      <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={[styles.list, { paddingBottom: 120 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View testID="card-grid" onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}>
          {groups.length === 0 ? (
            <AppText variant="body" tone="secondary" align="center" style={styles.empty}>
              {query.trim() ? t('acct.cardStyle.emptySearch', { query: query.trim() }) : t('acct.cardStyle.emptyKind')}
            </AppText>
          ) : (
            groups.map((g) => (
              <View key={g.bank} style={styles.group} onLayout={(e) => groupY.current.set(g.bank, e.nativeEvent.layout.y)}>
                <View style={styles.groupHead}>
                  <AppText variant="bodyStrong">{bankName(t, g.bank)}</AppText>
                  <AppText variant="body" tone="muted" numeric>
                    {String(g.products.length)}
                  </AppText>
                </View>
                {cardWidth > 0 && (
                  <View style={styles.grid}>
                    {g.products.map((p) => {
                      const on = selected === p.id || (selected === null && currentId === p.id);
                      const label = productLabel(p, t);
                      return (
                        <PressableScale
                          key={p.id}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={t('acct.cardStyle.optionA11y', { bank: bankName(t, p.bank), product: label })}
                          onPress={() => setSelected(p.id)}
                          focusRadius={radius.lg}
                          scaleTo={0.97}
                          style={{ width: cardWidth, gap: space.sm }}
                        >
                          <View style={[styles.ring, { borderColor: on ? colors.accent : 'transparent' }]}>
                            <ProductArt product={p} width={cardWidth - 6} />
                            {on && (
                              <View style={[styles.tick, { backgroundColor: colors.accent }]}>
                                <Icon icon={Check} color={colors.onAccent} size={layout.iconSize.sm - 2} />
                              </View>
                            )}
                          </View>
                          <AppText variant="body" numberOfLines={2}>
                            {label}
                          </AppText>
                        </PressableScale>
                      );
                    })}
                  </View>
                )}
              </View>
            ))
          )}
          {/* Atribusi wajib CC BY-NC 4.0 untuk logo idn-finlogos (lib/finlogos.ts). */}
          <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(LOGO_LICENSE_URL).catch(() => undefined)} style={styles.credit}>
            <AppText variant="caption" tone="muted" align="center">
              {t('acct.cardStyle.logoCredit')}
            </AppText>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.bottom, { bottom: insets.bottom + space.md, backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
        {current ? <ProductArt product={current} width={64} /> : <CardArt bank={bank} width={64} />}
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {current ? productLabel(current, t) : t('acct.cardStyle.defaultArt')}
          </AppText>
          <View style={styles.issuer}>
            {getBank(current?.bank ?? bank).country !== 'ANY' && <Flag country={getBank(current?.bank ?? bank).country as PickerCountry} width={16} />}
            <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.shrink}>
              {bankName(t, current?.bank ?? bank)}
            </AppText>
          </View>
        </View>
        {current && <Button label={t('acct.cardStyle.adjust')} icon={Crop} variant="secondary" size="sm" onPress={reveal} accessibilityHint={t('acct.cardStyle.adjustHint')} />}
      </View>

      <Modal visible={countryOpen} transparent animationType="fade" onRequestClose={() => setCountryOpen(false)}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={() => setCountryOpen(false)} accessibilityLabel={t('acct.cardStyle.close')} />
        <View style={[styles.menu, { top: insets.top + space.md + BUTTON + space.lg, backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong }]} accessibilityRole="menu">
          {(['all', ...PICKER_COUNTRIES] as const).map((c, i) => {
            const on = c === country;
            return (
              <Pressable
                key={c}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${countryLabel(c)}, ${c === 'all' ? counts.all : counts[c]}`}
                onPress={() => {
                  setCountry(c);
                  setCountryOpen(false);
                }}
                style={[styles.menuRow, i < 2 && { borderBottomWidth: layout.hairline, borderBottomColor: colors.border }]}
              >
                <View style={styles.menuTick}>{on && <Icon icon={Check} color={colors.text} size={layout.iconSize.sm} />}</View>
                {c === 'all' ? <Icon icon={Globe} color={colors.text} size={layout.iconSize.md} /> : <Flag country={c} width={22} />}
                <AppText variant="body" style={styles.flex}>
                  {countryLabel(c)}
                </AppText>
                <AppText variant="body" tone="muted" numeric>
                  {String(c === 'all' ? counts.all : counts[c])}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  noShrink: { flexShrink: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: layout.screenGutter },
  round: { width: BUTTON, height: BUTTON, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center' },
  filters: { flexDirection: 'row', gap: space.md, paddingHorizontal: layout.screenGutter, marginTop: space.lg },
  search: { flex: 1, minWidth: 0, minHeight: BUTTON, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, paddingVertical: space.md, outlineStyle: 'none' } as object,
  countryPill: { flexShrink: 0, minHeight: BUTTON, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  tabs: { flexDirection: 'row', gap: space.sm, paddingHorizontal: layout.screenGutter, marginTop: space.lg },
  tab: { minHeight: 44, borderRadius: radius.control, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: layout.screenGutter, paddingTop: space.lg },
  group: { gap: space.md, marginBottom: space.xxl },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  ring: { borderWidth: 2, borderRadius: radius.inset, padding: 1 },
  tick: { position: 'absolute', top: space.sm, right: space.sm, width: 22, height: 22, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: space.x4 },
  credit: { paddingVertical: space.md },
  bottom: {
    position: 'absolute',
    left: layout.screenGutter,
    right: layout.screenGutter,
    borderRadius: radius.sheet,
    borderWidth: layout.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
  },
  issuer: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  menu: { position: 'absolute', right: layout.screenGutter, width: 280, borderRadius: radius.card, borderWidth: layout.hairline, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.lg },
  menuTick: { width: layout.iconSize.sm },
});

/**
 * Picker sebagai modal layar penuh, dibuka dari detail akun dan dari form tambah akun (bukan deep link).
 * Menutup = tanpa perubahan; centang = `onApply(id)` lalu modal ditutup pemanggil.
 */
export function CardStyleModal({ visible, bank, currentId, onApply, onClose }: {
  visible: boolean;
  bank: string;
  currentId: string | null;
  onApply: (productId: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {visible && <CardStylePicker bank={bank} currentId={currentId} onApply={onApply} onClose={onClose} />}
    </Modal>
  );
}
