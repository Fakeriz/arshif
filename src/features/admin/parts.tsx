import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, Skeleton } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { copy } from './copy';

type Fetcher<T> = { (): Promise<T> };

export type Load<T> = { data: T | null; error: boolean; loading: boolean; reload: () => void };

/**
 * Muat data admin. Data lama tetap tampil saat memuat ulang (tidak berkedip ke skeleton);
 * jawaban yang datang setelah permintaan baru dibuang.
 */
export function useLoad<T>(fn: Fetcher<T>, deps: unknown[]): Load<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const reload = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    setError(false);
    run()
      .then((d) => id === seq.current && setData(d))
      .catch(() => id === seq.current && setError(true))
      .finally(() => id === seq.current && setLoading(false));
  }, [run]);
  useEffect(reload, [reload]);
  return { data, error, loading, reload };
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
  panel: { gap: space.md },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 },
  flex: { flex: 1, minWidth: 0 },
  row: { paddingVertical: space.md, gap: space.xxs },
});
