import { Check, Copy, Download, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, Badge, Button, Card, EmptyState, Icon, PressableScale, Skeleton } from '@/components/ui';
import { InkCard, useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { copyText } from './adminApi';
import { copy } from './copy';
import { ago } from './format';

type Fetcher<T> = { (): Promise<T> };

export type AdminSectionKey = 'dasbor' | 'pengguna' | 'ai' | 'pesanan' | 'kurs' | 'broadcast';
export type AdminNavTarget = {
  bagian: AdminSectionKey;
  uid?: string;
  q?: string;
  email?: string;
};
export type AdminNavigate = (next: AdminNavTarget) => void;

export type Load<T> = {
  data: T | null;
  error: boolean;
  loading: boolean;
  reload: () => void;
  updatedAt: number | null;
};

/**
 * Muat data admin. Data lama tetap tampil saat memuat ulang (tidak berkedip ke skeleton);
 * jawaban yang datang setelah permintaan baru dibuang.
 */
export function useLoad<T>(fn: Fetcher<T>, deps: unknown[]): Load<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const reload = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    setError(false);
    run()
      .then((d) => {
        if (id !== seq.current) return;
        setData(d);
        setUpdatedAt(Date.now());
      })
      .catch(() => {
        if (id !== seq.current) return;
        setError(true);
      })
      .finally(() => {
        if (id !== seq.current) return;
        setLoading(false);
      });
  }, [run]);
  useEffect(reload, [reload]);
  return { data, error, loading, reload, updatedAt };
}

/**
 * Tiga keadaan data (muat, gagal, kosong) dengan teks penyebab dan langkah berikutnya.
 * `skeleton` = bentuk konten saat muat pertama, supaya tata letak tidak melompat.
 */
export function DataState<T>({
  load,
  loadingLabel,
  errorTitle,
  isEmpty,
  empty,
  skeleton,
  children,
}: {
  load: Load<T>;
  loadingLabel: string;
  errorTitle: string;
  isEmpty?: (d: T) => boolean;
  empty?: ReactNode;
  skeleton?: ReactNode;
  children: (d: T) => ReactNode;
}) {
  if (load.error && load.data === null) {
    return <EmptyState kind="error" compact title={errorTitle} message={copy.gate.errorMessage} actionLabel={copy.retry} onAction={load.reload} />;
  }
  if (load.data === null) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel={loadingLabel} style={styles.loading}>
        {skeleton ?? <Skeleton height={160} radius={radius.lg} />}
        <AppText variant="caption" tone="secondary">
          {loadingLabel}
        </AppText>
      </View>
    );
  }
  if (isEmpty?.(load.data)) return <>{empty}</>;
  return <>{children(load.data)}</>;
}

/** Penanda kecil "memuat ulang" di samping judul, saat data lama masih tampil. */
export function Refreshing({ on }: { on: boolean }) {
  const { colors } = useTheme();
  if (!on) return null;
  return <ActivityIndicator size="small" color={colors.textSecondary} accessibilityLabel={copy.refresh} />;
}

/** Angka + label. `lead` = angka utama layar (lebih besar). */
export function Stat({ label, value, note, lead }: { label: string; value: string; note?: string; lead?: boolean }) {
  return (
    <View style={styles.stat}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant={lead ? 'display' : 'h2'} numeric>
        {value}
      </AppText>
      {note ? (
        <AppText variant="caption" tone="secondary">
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

/** Satu kartu tinta fokus per bagian layar (docs/design.md 2.4). ThemeContext di dalamnya otomatis terbalik kontras-aman. */
export function HeroInkPanel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <InkCard style={[styles.heroInk, { borderColor: colors.borderStrong }, style]}>
      <View style={styles.heroInner}>{children}</View>
    </InkCard>
  );
}

/** Kotak cekung monokrom untuk ringkasan sekunder atau detail pratinjau. Jangan taruh teks semantik mentah di dalamnya; pakai Badge atau teks primary/secondary. */
export function InsetBox({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[styles.inset, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }, style]}>{children}</View>;
}

/** Kartu KPI sekunder berbasis kertas Monokrom. */
export function MetricCard({
  label,
  value,
  badge,
  note,
  onPress,
  accessibilityLabel,
  footer,
}: {
  label: string;
  value: string;
  badge?: { label: string; tone?: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning' | 'info' };
  note?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  footer?: ReactNode;
}) {
  return (
    <Card padding="lg" onPress={onPress} accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}>
      <View style={styles.metricCard}>
        <View style={styles.panelHead}>
          <AppText variant="caption" tone="secondary" style={styles.flex}>
            {label}
          </AppText>
          {badge ? <Badge label={badge.label} tone={badge.tone ?? 'neutral'} /> : null}
        </View>
        <AppText variant="amountHero" numeric>
          {value}
        </AppText>
        {note ? (
          <AppText variant="caption" tone="secondary">
            {note}
          </AppText>
        ) : null}
        {footer}
      </View>
    </Card>
  );
}

export type ProportionSegment = {
  key: string;
  value: number;
  color: string;
};

/** Batang proporsi horizontal multi-segmen untuk sebaran sumber Pro, rasio AI, atau mata uang. */
export function ProportionBar({ segments, height = 8, accessibilityLabel }: { segments: ProportionSegment[]; height?: number; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const positive = segments.filter((s) => s.value > 0);
  const total = positive.reduce((sum, s) => sum + s.value, 0);
  return (
    <View accessibilityRole="none" accessibilityLabel={accessibilityLabel} style={[styles.propTrack, { height, backgroundColor: colors.track }]}>
      {total > 0 &&
        positive.map((seg) => {
          const weight = seg.value;
          return <View key={seg.key} style={{ flex: weight, height, backgroundColor: seg.color }} />;
        })}
    </View>
  );
}

/** Tombol salin ringkas dengan umpan balik "Disalin" selama 1,8 detik. */
export function CopyChip({ value, label, accessibilityLabel }: { value: string; label?: string; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <PressableScale
      onPress={() => void handleCopy()}
      hitSlop={6}
      accessibilityLabel={accessibilityLabel ?? label ?? copy.copy}
      focusRadius={radius.control}
      scaleTo={0.97}
      style={[styles.copyChip, { backgroundColor: colors.fill, borderColor: colors.border }]}
    >
      <Icon icon={copied ? Check : Copy} color={copied ? colors.positive : colors.textSecondary} size={13} />
      <AppText variant="overline" tone={copied ? 'positive' : 'secondary'}>
        {copied ? copy.copied : (label ?? copy.copy)}
      </AppText>
    </PressableScale>
  );
}

/** Bilah utilitas atas bagian: filter kiri + stempel waktu pembaruan + muat ulang + ekspor CSV. */
export function SectionToolbar({
  left,
  updatedAt,
  loading,
  onReload,
  onExportCsv,
  exportDisabled,
}: {
  left?: ReactNode;
  updatedAt?: number | null;
  loading?: boolean;
  onReload?: () => void;
  onExportCsv?: () => void;
  exportDisabled?: boolean;
}) {
  return (
    <View style={styles.toolbar}>
      <View style={styles.toolbarLeft}>{left}</View>
      <View style={styles.toolbarRight}>
        {updatedAt ? (
          <AppText variant="caption" tone="muted" numeric>
            {copy.updatedAt(ago(new Date(updatedAt).toISOString()))}
          </AppText>
        ) : null}
        {onExportCsv ? (
          <Button label={copy.exportCsv} icon={Download} variant="secondary" size="sm" disabled={exportDisabled} onPress={onExportCsv} />
        ) : null}
        {onReload ? (
          <Button label={copy.refresh} icon={RefreshCw} variant="ghost" size="sm" loading={loading} onPress={onReload} />
        ) : null}
      </View>
    </View>
  );
}

export function Panel({ title, right, children, padding = 'lg' }: { title?: string; right?: ReactNode; children: ReactNode; padding?: 'md' | 'lg' }) {
  return (
    <Card padding={padding}>
      <View style={styles.panel}>
        {title ? (
          <View style={styles.panelHead}>
            <AppText variant="h3" accessibilityRole="header" style={styles.flex}>
              {title}
            </AppText>
            {right}
          </View>
        ) : null}
        {children}
      </View>
    </Card>
  );
}

/** Baris berurutan dengan garis pemisah tipis (daftar di dalam panel). */
export function Rows({ children }: { children: ReactNode[] }) {
  const { colors } = useTheme();
  return (
    <View>
      {children.map((c, i) => (
        <View key={i} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
          {c}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { gap: space.sm },
  stat: { gap: space.xxs, minWidth: 0 },
  heroInk: {
    borderRadius: radius.card,
    padding: space.xl,
    borderWidth: layout.hairline,
  },
  heroInner: { gap: space.md },
  inset: {
    borderRadius: radius.inset,
    padding: space.md,
    borderWidth: layout.hairline,
    gap: space.xs,
  },
  metricCard: { gap: space.xs, minWidth: 0 },
  propTrack: {
    flexDirection: 'row',
    borderRadius: radius.full,
    overflow: 'hidden',
    width: '100%',
    gap: 2,
  },
  copyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 32,
    paddingHorizontal: space.sm + 2,
    borderRadius: radius.control,
    borderWidth: layout.hairline,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  toolbarLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    flex: 1,
    minWidth: 0,
  },
  toolbarRight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  panel: { gap: space.md },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 28 },
  flex: { flex: 1, minWidth: 0 },
  row: { paddingVertical: space.md, gap: space.xxs },
});
