import { Search } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Input, ListItem } from '@/components/ui';
import { searchSymbolsRemote } from '@/data/remote/symbols';
import { useT } from '@/i18n';
import { SYMBOL_RE } from '@/lib/assets';
import { IDX_CODE_RE, searchCrypto, searchIdx, type SymbolMarket, type SymbolOption } from '@/lib/symbols';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

export type PickerType = 'stock_id' | 'stock_us' | 'crypto';
const MARKET: Record<PickerType, SymbolMarket> = { stock_id: 'IDX', stock_us: 'US', crypto: 'CRYPTO' };
const DEBOUNCE_MS = 350;

type Status = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Pemilih kode aset: ketik nama atau kode, pilih dari hasil. IDX dan kripto dicari di daftar lokal (instan, offline);
 * US lewat server. IDX yang tidak ada di snapshot (IPO baru) dicek ke server bila kuerinya berbentuk kode 4 huruf.
 * Server tidak bisa dihubungi: kode yang diketik boleh dipakai bila lolos SYMBOL_RE (perilaku lama), dengan label jelas.
 */
export function SymbolPicker({ type, value, onPick, onClear, showError }: {
  type: PickerType;
  value: SymbolOption | null;
  onPick: (o: SymbolOption) => void;
  onClear: () => void;
  showError: boolean;
}) {
  const t = useT();
  const { colors } = useTheme();
  const market = MARKET[type];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolOption[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const id = ++seq.current;
    if (!q) {
      setResults([]);
      setStatus('idle');
      return;
    }
    const local = type === 'crypto' ? searchCrypto(q) : type === 'stock_id' ? searchIdx(q) : [];
    const needServer = type === 'stock_us' || (type === 'stock_id' && local.length === 0 && IDX_CODE_RE.test(q.toUpperCase()));
    setResults(local);
    if (!needServer) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    const timer = setTimeout(() => {
      searchSymbolsRemote(market as 'IDX' | 'US', q)
        .then((hits) => id === seq.current && (setResults(hits), setStatus('ready')))
        .catch(() => id === seq.current && setStatus('error'));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, type, market, attempt]);

  const marketLabel = t(`assets.market.${market}`);

  if (value) {
    return (
      <View style={styles.field}>
        <AppText variant="bodyStrong">{t('assets.form.symbol')}</AppText>
        <View style={[styles.panel, styles.selected, { backgroundColor: colors.surfaceSunken }]}>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={2}>
              {value.name}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {`${value.code} · ${marketLabel}`}
            </AppText>
          </View>
          <Button label={t('assets.picker.change')} variant="ghost" size="sm" onPress={onClear} accessibilityHint={t('assets.picker.changeHint')} />
        </View>
      </View>
    );
  }

  const q = query.trim();
  const typed = q.toUpperCase().replace(/\s/g, '');
  const canUseTyped = status === 'error' && type !== 'crypto' && SYMBOL_RE.test(typed);
  let message: string | null = null;
  if (status === 'loading') message = t('assets.picker.searching');
  else if (status === 'error') message = t('assets.picker.error');
  else if (status === 'ready' && results.length === 0) message = type === 'crypto' ? t('assets.picker.cryptoUnsupported') : t('assets.picker.empty', { query: q, market: marketLabel });

  // Error formulir: tidak ada kode terpilih. Kueri yang tidak dikenal disebut apa adanya, bukan diam.
  const fieldError = !showError ? undefined : q ? (type === 'crypto' && results.length === 0 ? t('assets.picker.cryptoUnsupported') : t('assets.picker.notPicked', { query: q })) : t('assets.picker.required');

  return (
    <View style={styles.field}>
      <Input
        label={t('assets.form.symbol')}
        icon={Search}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={40}
        placeholder={t(`assets.picker.placeholder.${type}`)}
        hint={fieldError ? undefined : t(`assets.form.symbolHint.${type}`)}
        error={fieldError}
        returnKeyType="search"
      />
      {message && (
        <AppText variant="caption" tone={status === 'error' ? 'negative' : 'secondary'} accessibilityLiveRegion="polite">
          {message}
        </AppText>
      )}
      {status === 'error' && (
        <View style={styles.row}>
          <Button label={t('common.retry')} variant="secondary" size="sm" onPress={() => setAttempt((n) => n + 1)} />
          {canUseTyped && (
            <Button label={t('assets.picker.useTyped', { code: typed })} variant="ghost" size="sm" onPress={() => onPick({ code: typed, name: typed, market })} />
          )}
        </View>
      )}
      {results.length > 0 && (
        <View style={[styles.panel, { backgroundColor: colors.surfaceSunken }]}>
          {results.map((o, i) => (
            <ListItem
              key={o.code}
              title={o.name}
              subtitle={`${o.code} · ${marketLabel}`}
              subtitleLines={1}
              onPress={() => {
                onPick(o);
                setQuery('');
              }}
              accessibilityLabel={t('assets.picker.optionA11y', { name: o.name, code: o.code, market: marketLabel })}
              divider={i < results.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  panel: { borderRadius: radius.inset, paddingHorizontal: layout.insetPadding },
  selected: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: layout.insetPadding },
  flex: { flex: 1, gap: space.xxs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
