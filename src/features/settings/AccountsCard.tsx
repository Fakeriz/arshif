import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText, BankCard, Button, Icon, ListCard, ListItem, PressableScale } from '@/components/ui';
import { BANK_CARD_RATIO } from '@/components/ui/BankCard';
import type { Transaction } from '@/data/types';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { bankName, useI18n } from '@/i18n';
import { isCreditType } from '@/lib/credit';
import { dayLabel } from '@/lib/dates';
import { sortNewestFirst } from '@/lib/transactions';
import { deckPose, GAP, mod, OPEN_TOP, PEEK, ringDist, rubber, snapTarget } from '@/lib/walletDeck';
import type { AccountWithBalance } from '@/state/AppStore';
import { useStore } from '@/state/AppStore';
import { useCreditUtilization, useLedger } from '@/state/derived';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

// Pegas prototipe "dompet bertumpuk": tegas untuk buka/geser, lebih lembut untuk tutup dan daftar.
const SPRING = { stiffness: 300, damping: 32, mass: 1 };
const SPRING_SOFT = { stiffness: 240, damping: 28, mass: 1 };
const RECENT = 6;
const CLOSE_DISTANCE = 110;

type Mode = 'stack' | 'open';

/**
 * Akun & kartu sebagai dompet bertumpuk. Tumpukan: kartu bank menumpuk, tiap kartu mengintip PEEK px (nama bank).
 * Ketuk kartu: kartu itu maju ke depan, sisanya menumpuk miring di belakang, transaksi terakhirnya muncul di bawah.
 * Geser ke samping memutar tumpukan; tarik ke bawah atau "Semua kartu" menutup. Detail akun (desain kartu, limit,
 * grup, iuran) tetap lewat tombol "Detail akun". Gerak hanya transform + opasitas; instan saat reduced motion.
 */
export function AccountsCard() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { colors } = useTheme();
  const { reduced } = useMotion();
  const { state } = useStore();
  const { accounts, transactions, mainCurrency } = useLedger();
  const utilization = useCreditUtilization();
  const n = accounts.length;
  const credits = accounts.filter((a) => isCreditType(a.type)).length;

  const [width, setWidth] = useState(0);
  const [mode, setMode] = useState<Mode>('stack');
  const [active, setActive] = useState(0);
  const W = width;
  const H = W / BANK_CARD_RATIO;
  const unit = W + GAP;

  // Satu sumber kebenaran posisi horizontal: indeks kartu depan (pecahan saat digeser, tidak dibungkus).
  const pos = useSharedValue(0);
  const dragY = useSharedValue(0);
  const anchor = useSharedValue(0);
  const unitSV = useSharedValue(unit);
  const hSV = useSharedValue(H);
  useEffect(() => {
    unitSV.value = unit;
    hSV.value = H;
  }, [unit, H, unitSV, hSV]);
  useEffect(() => {
    anchor.value = active;
  }, [active, anchor]);

  const run = (sv: SharedValue<number>, to: number, velocity = 0, cfg = SPRING) => {
    cancelAnimation(sv);
    sv.value = reduced ? to : withSpring(to, { ...cfg, velocity });
  };
  const open = (i: number) => {
    cancelAnimation(pos);
    pos.value = i;
    dragY.value = 0;
    setActive(i);
    setMode('open');
  };
  const close = (velocity = 0) => {
    setMode('stack');
    run(dragY, 0, velocity, SPRING_SOFT);
  };
  const goToPos = (target: number, velocity = 0) => {
    setActive(mod(target, n));
    run(pos, target, velocity);
  };
  /** Ke kartu `i` lewat jalur terpendek di lingkaran. */
  const goTo = (i: number) => {
    const cur = Math.round(pos.value);
    let delta = mod(i - cur, n);
    if (delta > n / 2) delta -= n;
    goToPos(cur + delta);
  };

  // Handler gestur dibuat sekali; nilai terbaru dibaca lewat ref yang ditulis di efek (bukan saat render).
  const latest = useRef({ mode, unit, goToPos, close, run });
  useEffect(() => {
    latest.current = { mode, unit, goToPos, close, run };
  });
  const gesture = useRef({ axis: null as 'x' | 'y' | null, start: 0 });
  // Ref hanya dibaca di dalam handler gestur (positif palsu lint, pola sama dengan BottomSheet).
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      // Capture: geser di atas kartu (Pressable) tetap jadi gestur dek. Hanya saat terbuka; tumpukan tertutup = gulir halaman biasa.
      onMoveShouldSetPanResponderCapture: (_, g) =>
        latest.current.mode === 'open' && ((Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy)) || (g.dy > 10 && g.dy > Math.abs(g.dx))),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        // Arah ditentukan di gerakan pertama: saat grant jarak geser masih 0 (terutama di web).
        gesture.current = { axis: null, start: pos.value };
        cancelAnimation(pos);
        cancelAnimation(dragY);
      },
      onPanResponderMove: (_, g) => {
        if (!gesture.current.axis) gesture.current.axis = Math.abs(g.dx) > Math.abs(g.dy) ? 'x' : 'y';
        if (gesture.current.axis === 'x') pos.value = gesture.current.start - g.dx / latest.current.unit;
        else dragY.value = g.dy > 0 ? g.dy * 0.82 : rubber(g.dy, 28);
      },
      onPanResponderRelease: (_, g) => {
        const l = latest.current;
        if (gesture.current.axis === 'x') {
          const v = (-g.vx * 1000) / l.unit; // kartu per detik
          l.goToPos(snapTarget(gesture.current.start, pos.value, v), v);
        } else if (g.dy > CLOSE_DISTANCE || g.vy * 1000 > 650) {
          l.close(g.vy * 1000);
        } else {
          l.run(dragY, 0, g.vy * 1000);
        }
        gesture.current.axis = null;
      },
    }),
  );

  // Web: seret mouse di atas teks kartu memulai seleksi teks, dan sistem gestur RN-web membatalkan geseran saat itu.
  const stageRef = useRef<ComponentRef<typeof View>>(null);
  const hasStage = width > 0 && accounts.length > 0;
  useEffect(() => {
    const el = stageRef.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !el?.addEventListener) return;
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('selectstart', stop);
    return () => el.removeEventListener('selectstart', stop);
  }, [hasStage]);

  // Keyboard (web): panah ganti kartu, Escape menutup.
  useEffect(() => {
    if (Platform.OS !== 'web' || mode !== 'open' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const l = latest.current;
      if (e.key === 'ArrowRight') l.goToPos(Math.round(pos.value) + 1);
      else if (e.key === 'ArrowLeft') l.goToPos(Math.round(pos.value) - 1);
      else if (e.key === 'Escape') l.close();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, pos]);

  const current = accounts[active];
  const currencies = [...new Set(accounts.map((a) => a.currency))];
  const stackH = n ? (n - 1) * PEEK + H : 0;
  // Tinggi panggung berubah seketika (tidak dianimasikan); kartu bergerak lewat transform di dalamnya.
  const stageH = mode === 'open' ? OPEN_TOP + H + space.sm : stackH;
  const footnote = (a: AccountWithBalance) => {
    const u = utilization(a.id);
    if (!u || state.hideBalance) return undefined;
    const pct = Math.round(u.ratio * 100);
    return u.scope === 'group' ? t('acct.limit.cardGroupShort', { pct, name: u.groupName ?? '' }) : t('acct.limit.cardShort', { pct });
  };
  const fade = (ms: number) => (reduced ? undefined : FadeIn.duration(ms));
  const fadeOut = (ms: number) => (reduced ? undefined : FadeOut.duration(ms));

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.head}>
        {mode === 'stack' ? (
          <Animated.View key="h-stack" entering={fade(220)} exiting={fadeOut(120)}>
            <AppText variant="caption" tone="secondary">
              {t('settings.wallet.summary', { count: n, currencies: currencies.join(', ') })}
            </AppText>
          </Animated.View>
        ) : (
          <Animated.View key="h-open" style={styles.headRow} entering={fade(220)} exiting={fadeOut(120)}>
            <PressableScale accessibilityRole="button" accessibilityLabel={t('settings.wallet.allCards')} onPress={() => close()} focusRadius={radius.full} style={styles.back}>
              <Icon icon={ChevronLeft} color={colors.text} />
              <AppText variant="bodyStrong">{t('settings.wallet.allCards')}</AppText>
            </PressableScale>
            <AppText variant="caption" tone="muted" numeric aria-live="polite">
              {t('settings.wallet.position', { index: active + 1, count: n })}
            </AppText>
          </Animated.View>
        )}
      </View>

      {W > 0 && n > 0 ? (
        <View ref={stageRef} style={[styles.stage, { height: stageH }]} {...pan.panHandlers}>
          {accounts.map((a, j) => (
            <StackCard key={a.id} index={j} count={n} mode={mode} active={active} width={W} height={H} pos={pos} dragY={dragY} anchor={anchor} unit={unitSV} h={hSV} reduced={reduced}>
              <BankCard
                bank={a.bank}
                accountType={t(`domain.accountType.${a.type}`)}
                last4={a.last4}
                balance={a.balance}
                currency={a.currency}
                hidden={state.hideBalance}
                cardStyle={a.cardStyle}
                footnote={footnote(a)}
                width={W}
                onPress={mode === 'stack' ? () => open(j) : j !== active ? () => goTo(j) : undefined}
              />
            </StackCard>
          ))}
        </View>
      ) : null}

      {mode === 'open' && current ? (
        <Animated.View entering={reduced ? undefined : FadeInDown.delay(200).springify().stiffness(240).damping(28)} exiting={fadeOut(160)} style={styles.detail}>
          <View style={styles.dots} accessibilityRole="tablist" accessibilityLabel={t('settings.wallet.pick')}>
            {accounts.map((a, j) => (
              <Dot key={a.id} index={j} count={n} pos={pos} selected={j === active} label={`${a.name}, ${bankName(t, a.bank)}`} onSelect={() => goTo(j)} color={colors.text} />
            ))}
          </View>
          <RecentList
            account={current}
            transactions={transactions}
            mainCurrency={mainCurrency}
            lang={lang}
            pos={pos}
            active={active}
            count={n}
            reduced={reduced}
            onDetail={() => router.push({ pathname: '/akun/[id]', params: { id: current.id } })}
            onAll={() => router.push({ pathname: '/transaksi', params: { akun: current.id } })}
            onTx={(id) => router.push({ pathname: '/trx/[id]', params: { id } })}
          />
        </Animated.View>
      ) : null}

      {mode === 'stack' ? (
        <>
          <AppText variant="caption" tone="muted" style={styles.hint}>
            {t('settings.wallet.hint')}
          </AppText>
          {credits >= 2 && (
            <ListCard>
              <ListItem
                title={t('acct.group.title')}
                subtitle={state.limitGroups.length ? t('acct.group.rowCount', { count: state.limitGroups.length }) : t('acct.group.rowSub')}
                subtitleLines={2}
                chevron
                onPress={() => router.push('/akun/grup')}
              />
            </ListCard>
          )}
        </>
      ) : null}
    </View>
  );
}

/* ---------------- satu kartu ---------------- */
type StackCardProps = {
  index: number;
  count: number;
  mode: Mode;
  active: number;
  width: number;
  height: number;
  pos: SharedValue<number>;
  dragY: SharedValue<number>;
  anchor: SharedValue<number>;
  unit: SharedValue<number>;
  h: SharedValue<number>;
  reduced: boolean;
  children: ReactNode;
};

function StackCard({ index: j, count: n, mode, active, width, height, pos, dragY, anchor, unit, h, reduced, children }: StackCardProps) {
  // o: 0 = di daftar tumpukan, 1 = di dek terbuka. Pegas per kartu, jadi bisa bergiliran.
  const o = useSharedValue(0);
  const enter = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (!reduced) enter.value = withDelay(50 + j * 50, withSpring(1, SPRING_SOFT));
  }, [enter, j, reduced]);

  useEffect(() => {
    const dist = mod(j - active, n);
    const delay = mode === 'open' ? dist * 30 : (4 - Math.min(4, dist)) * 12;
    o.value = reduced ? (mode === 'open' ? 1 : 0) : withDelay(delay, withSpring(mode === 'open' ? 1 : 0, SPRING));
    // `active` sengaja bukan dependensi: berganti kartu tidak memicu ulang transisi buka/tutup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, reduced]);

  const d = useDerivedValue(() => mod(j - pos.value, n));
  const style = useAnimatedStyle(() => {
    const p = deckPose(d.value, n, unit.value, h.value);
    const listY = j * PEEK + (1 - enter.value) * (60 + j * 24);
    let y = listY + (p.y + dragY.value - listY) * o.value;
    // Kartu di bawah kartu depan (di daftar) turun dulu sampai lepas, baru naik ke belakang; tanpa ini pergantian
    // urutan tumpuk terlihat sebagai lompatan.
    if (j > anchor.value && o.value > 0 && o.value < 1) {
      const mid = (j * PEEK + p.y) / 2;
      const anchorMid = (anchor.value * PEEK + OPEN_TOP) / 2;
      y += Math.sin(Math.PI * o.value) * Math.max(0, anchorMid + h.value + 28 - mid);
    }
    const pull = 1 - Math.min(0.07, Math.max(0, dragY.value) / 1600);
    const scale = 1 + (p.scale * pull - 1) * o.value;
    // Urutan tumpuk dua fase: fase daftar (o < .5) kartu bawah menutupi kartu depan; fase dek mengikuti urutan dek.
    const zIndex = o.value < 0.5 ? (j > anchor.value ? j + 300 : j) : p.z;
    return {
      zIndex,
      opacity: 1 + (p.opacity - 1) * o.value,
      transform: [{ perspective: 1100 }, { translateX: p.x * o.value }, { translateY: y }, { rotate: `${p.rotate * o.value}deg` }, { rotateY: `${p.rotateY * o.value}deg` }, { scale }],
    };
  });
  // Peredup lapis belakang: hitam transparan di atas kartu, warna bank tetap terlihat.
  const shade = useAnimatedStyle(() => ({ opacity: deckPose(d.value, n, unit.value, h.value).shade * o.value }));

  // Saat terbuka hanya kartu depan yang dibaca pembaca layar; kartu lain dipilih lewat titik halaman.
  const hiddenForA11y = mode === 'open' && j !== active;
  return (
    <Animated.View style={[styles.card, { width, height }, style]} accessibilityElementsHidden={hiddenForA11y} importantForAccessibility={hiddenForA11y ? 'no-hide-descendants' : 'auto'}>
      {children}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade, shade]} />
    </Animated.View>
  );
}

/* ---------------- titik halaman ---------------- */
function Dot({ index: j, count: n, pos, selected, label, onSelect, color }: { index: number; count: number; pos: SharedValue<number>; selected: boolean; label: string; onSelect: () => void; color: string }) {
  // Lebar & opasitas mengikuti posisi langsung, jadi titik ikut bergerak bersama jari.
  const style = useAnimatedStyle(() => {
    const a = Math.max(0, 1 - ringDist(j, pos.value, n));
    return { opacity: 0.28 + a * 0.72, transform: [{ scaleX: (6 + a * 16) / 22 }] };
  });
  return (
    <PressableScale accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={label} onPress={onSelect} hitSlop={10} focusRadius={radius.full} style={styles.dotHit}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />
    </PressableScale>
  );
}

/* ---------------- transaksi terakhir ---------------- */
function RecentList({ account, transactions, mainCurrency, lang, pos, active, count: n, reduced, onDetail, onAll, onTx }: {
  account: AccountWithBalance;
  transactions: Transaction[];
  mainCurrency: string;
  lang: ReturnType<typeof useI18n>['lang'];
  pos: SharedValue<number>;
  active: number;
  count: number;
  reduced: boolean;
  onDetail: () => void;
  onAll: () => void;
  onTx: (id: string) => void;
}) {
  const { t } = useI18n();
  const mine = useMemo(() => transactions.filter((x) => x.accountId === account.id || x.toAccountId === account.id), [transactions, account.id]);
  const recent = useMemo(() => sortNewestFirst(mine).slice(0, RECENT), [mine]);
  const more = mine.length > RECENT;
  // Saat menggeser, daftar memudar sebanding jarak dari kartu aktif; daftar kartu baru masuk bergiliran.
  const activeSV = useSharedValue(active);
  useEffect(() => {
    activeSV.value = active;
  }, [active, activeSV]);
  const fade = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, ringDist(activeSV.value, pos.value, n) * 1.8) }));

  return (
    <Animated.View style={[styles.list, fade]} accessibilityLabel={t('settings.wallet.recentA11y', { name: account.name })}>
      <View style={styles.listHead}>
        <AppText variant="h3" accessibilityRole="header" style={styles.flex} numberOfLines={1}>
          {t('settings.wallet.recent')}
        </AppText>
        <Button label={t('settings.wallet.detail')} variant="secondary" size="sm" onPress={onDetail} />
      </View>
      <Animated.View key={account.id} exiting={reduced ? undefined : FadeOut.duration(120)}>
        <ListCard>
          {recent.length === 0 ? (
            <AppText variant="caption" tone="secondary" style={styles.empty}>
              {t('settings.wallet.empty')}
            </AppText>
          ) : (
            recent.map((x, i) => (
              <Animated.View key={x.id} entering={reduced ? undefined : FadeInDown.delay(40 + i * 40).springify().stiffness(240).damping(28)}>
                {/* Daftar per akun: tanggal menggantikan nama akun di baris (semua baris akun yang sama). */}
                <TransactionRow tx={x} accountName={dayLabel(x.date, lang)} mainCurrency={mainCurrency} divider={i < recent.length - 1 || more} onPress={() => onTx(x.id)} />
              </Animated.View>
            ))
          )}
          {more ? <ListItem title={t('settings.wallet.all', { count: mine.length })} chevron onPress={onAll} /> : null}
        </ListCard>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs, marginBottom: space.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  back: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44, paddingRight: space.md, marginLeft: -space.xs },
  // Web: geser dengan mouse tidak memblok teks kartu (sama dengan prototipe).
  stage: { userSelect: 'none' },
  card: { position: 'absolute', top: 0, left: 0 },
  shade: { borderRadius: radius.lg, backgroundColor: '#000000' },
  detail: { gap: space.md, marginTop: space.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.xxs },
  dotHit: { width: 26, height: 24, alignItems: 'center', justifyContent: 'center' },
  // Lebar dasar 22 lalu di-scaleX (transform, bukan width) supaya gerak tetap di thread UI.
  dot: { width: 22, height: 6, borderRadius: radius.full },
  list: { gap: space.sm },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xs },
  flex: { flex: 1 },
  empty: { paddingVertical: space.lg, textAlign: 'center' },
  hint: { textAlign: 'center', marginTop: space.lg, marginBottom: space.md },
});
