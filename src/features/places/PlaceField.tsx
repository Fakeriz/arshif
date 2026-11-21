import { LocateFixed, MapPin, Search, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Card, EmptyState, Icon, IconTile, Input, ListCard, ListItem, ListItemSkeleton, PressableScale, Skeleton } from '@/components/ui';
import type { TxPlace } from '@/data/types';
import { useI18n, type MsgKey } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { currentPosition, nearbyPlaces, openInMaps, placeErrorKey, placeMapImage, searchPlaces, type LatLng } from './api';

/** Dari mana tebakan otomatis berasal; ditampilkan supaya pengguna tahu harus mengecek. */
export type PlaceGuess = { query: string; from: 'scan' | 'voice' } | { gps: true };

type Props = {
  value: TxPlace | null;
  onChange: (p: TxPlace | null) => void;
  /** Tebak sekali saat dibuka bila belum ada lokasi. GPS hanya dipakai bila izin sudah diberikan (tanpa dialog). */
  guess?: PlaceGuess;
};

/** Kolom Lokasi: peta kecil + nama tempat, atau tombol tambah. Ketuk untuk cari/ganti. */
export function PlaceField({ value, onChange, guess }: Props) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const [sheet, setSheet] = useState(false);
  const [guessed, setGuessed] = useState<MsgKey | null>(null);
  const [guessing, setGuessing] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || value || !guess) return;
    started.current = true;
    setGuessing(true);
    void (async () => {
      try {
        const pos = await currentPosition(false);
        const near = pos && pos !== 'denied' ? pos : null;
        const found = 'query' in guess ? await searchPlaces(guess.query, lang, near) : near ? await nearbyPlaces(near, lang) : [];
        if (found[0]) {
          onChange(found[0]);
          setGuessed('query' in guess ? (guess.from === 'scan' ? 'tx.place.guessScan' : 'tx.place.guessVoice') : 'tx.place.guessGps');
        }
      } catch {
        // Tebakan gagal = kolom tetap kosong; pengguna masih bisa mencari sendiri.
      } finally {
        setGuessing(false);
      }
    })();
  }, [guess, lang, onChange, value]);

  return (
    <View style={styles.field}>
      <AppText variant="caption" tone="secondary">
        {t('tx.place.label')}
      </AppText>
      {guessing ? (
        <Skeleton height={64} radius={radius.lg} />
      ) : value ? (
        <Card padding={0}>
          <PlaceMap place={value} />
          <View style={styles.row}>
            <Icon icon={MapPin} color={colors.textMuted} size={layout.iconSize.md - 2} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {value.name}
              </AppText>
              {value.address ? (
                <AppText variant="caption" tone="muted" numberOfLines={2}>
                  {value.address}
                </AppText>
              ) : null}
            </View>
            <Button label={t('tx.place.change')} variant="ghost" size="sm" onPress={() => setSheet(true)} />
            <PressableScale accessibilityLabel={t('tx.place.remove')} focusRadius={radius.full} onPress={() => (onChange(null), setGuessed(null))} style={styles.remove}>
              <Icon icon={X} color={colors.textSecondary} size={18} />
            </PressableScale>
          </View>
        </Card>
      ) : (
        <Button label={t('tx.place.add')} icon={MapPin} variant="secondary" onPress={() => setSheet(true)} />
      )}
      {value && guessed ? (
        <AppText variant="caption" tone="warning">
          {t(guessed)}
        </AppText>
      ) : null}
      <PlaceSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        onPick={(p) => {
          onChange(p);
          setGuessed(null);
          setSheet(false);
        }}
      />
    </View>
  );
}

/** Peta statis dengan pin; ketuk untuk membuka di Google Maps. Gagal dimuat = tidak ditampilkan. */
export function PlaceMap({ place }: { place: TxPlace }) {
  const { t } = useI18n();
  const { scheme } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setUri(null);
    setFailed(false);
    placeMapImage(place, scheme === 'dark')
      .then((u) => live && setUri(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [place, scheme]);
  if (failed) return null;
  return (
    <PressableScale accessibilityLabel={t('tx.place.openMaps', { name: place.name })} onPress={() => openInMaps(place)} scaleTo={0.99} focusRadius={radius.lg}>
      {uri ? (
        <Image source={{ uri }} style={styles.map} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.map}>
          <Skeleton height={150} radius={0} />
        </View>
      )}
    </PressableScale>
  );
}

const DEBOUNCE_MS = 400;
type Lookup = { (): Promise<TxPlace[]> };

/** Sheet cari lokasi: ketik nama tempat, atau pakai posisi sekarang (izin diminta di sini). */
function PlaceSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (p: TxPlace) => void }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TxPlace[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MsgKey | null>(null);
  const near = useRef<LatLng | null>(null);
  const seq = useRef(0);

  const run = (work: Lookup) => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    work()
      .then((r) => id === seq.current && setResults(r))
      .catch((e) => id === seq.current && setError(placeErrorKey(e)))
      .finally(() => id === seq.current && setLoading(false));
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const h = setTimeout(() => run(() => searchPlaces(q, lang, near.current)), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [query, lang]);

  const useMine = () =>
    run(async () => {
      const pos = await currentPosition(true);
      if (pos === 'denied') throw new Error('denied');
      if (!pos) throw new Error('gps');
      near.current = pos;
      return nearbyPlaces(pos, lang);
    });

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('tx.place.sheetTitle')} scrollable>
      <View style={styles.sheet}>
        <Input label={t('tx.place.searchLabel')} icon={Search} placeholder={t('tx.place.searchPlaceholder')} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />
        <ListCard>
          <ListItem
            leading={<IconTile icon={LocateFixed} tone="neutral" />}
            title={t('tx.place.useMine')}
            subtitle={t('tx.place.useMineSub')}
            onPress={useMine}
          />
        </ListCard>
        {error ? (
          <AppText variant="caption" tone="negative" aria-live="polite">
            {t(error)}
          </AppText>
        ) : null}
        {loading ? (
          <ListCard>
            <ListItemSkeleton divider />
            <ListItemSkeleton />
          </ListCard>
        ) : results && results.length === 0 ? (
          <EmptyState compact title={t('tx.place.noResultsTitle')} message={t('tx.place.noResultsMessage')} />
        ) : results ? (
          <ListCard>
            {results.map((p, i) => (
              <ListItem
                key={p.placeId ?? `${p.lat},${p.lng},${i}`}
                leading={<IconTile icon={MapPin} tone="neutral" />}
                title={p.name}
                subtitle={p.address}
                subtitleLines={2}
                divider={i < results.length - 1}
                onPress={() => onPick(p)}
              />
            ))}
          </ListCard>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingLeft: space.xl, paddingRight: space.md },
  flex: { flex: 1, minWidth: 0, gap: space.xxs },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  // Rasio sama dengan gambar dari server (320x150) supaya tidak terpotong.
  map: { width: '100%', aspectRatio: 320 / 150, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden' },
  sheet: { gap: space.lg },
});
