import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Skeleton } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { chartArea, radius, space } from '@/theme/tokens';

import { CHART_ERROR_MESSAGE, chartHtml } from './chartHtml';

export const CHART_HEIGHT = 280;

/** Grafik TradingView di web: iframe srcDoc berisi widget embed resmi. Versi native: PriceChart.tsx (WebView). */
export function PriceChart({ symbol, label }: { symbol: string; label: string }) {
  const { colors, scheme } = useTheme();
  const { t, lang } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data === CHART_ERROR_MESSAGE) setState('error');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (state === 'error') {
    return (
      <View style={[styles.box, styles.center, { backgroundColor: colors.surfaceSunken }]}>
        <AppText variant="caption" tone="secondary" align="center">
          {t('assets.chart.error')}
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <iframe
        ref={frame}
        title={label}
        srcDoc={chartHtml(symbol, { scheme, background: colors.surface, grid: colors.border, line: chartArea[scheme].line, fill: chartArea[scheme].fill, text: colors.textMuted }, lang)}
        // allow-popups: tautan atribusi TradingView membuka tab baru; halaman aplikasi tidak bisa dinavigasi dari grafik.
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        onLoad={() => setState((s) => (s === 'loading' ? 'ready' : s))}
        style={{ border: 0, width: '100%', height: CHART_HEIGHT, display: 'block', background: colors.surface }}
      />
      {state === 'loading' && (
        <View style={StyleSheet.absoluteFill}>
          <Skeleton height={CHART_HEIGHT} radius={radius.inset} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: CHART_HEIGHT, borderRadius: radius.inset, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
});
