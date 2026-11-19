import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, BankCard, Button, Card } from '@/components/ui';
import { CARD_ART_PEEK, CARD_ART_RATIO } from '@/components/ui/CardArt';
import { CardStylePicker, ProductArt, productLabel } from '@/features/accounts/CardStylePicker';
import { useT } from '@/i18n';
import { cardProduct, countryCounts } from '@/lib/cardCatalog';
import { CARD_PRODUCTS } from '@/data/cardProducts';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';

/**
 * Pratinjau dev "Pilih Tampilan Kartu" (seperti /design, disembunyikan di rilis). Jalan masuk sebenarnya ada di dalam
 * aplikasi: detail akun (baris "Tampilan kartu") dan form tambah akun; pilihan disimpan per akun (accounts.card_style).
 * Halaman ini tidak menyimpan apa pun dan dipakai untuk screenshot: `?picker=1` membuka pemilih langsung,
 * `?current=<id produk>` mengisi kartu yang sedang dipakai (bar bawah + tombol Atur).
 */
export default function CardPickerPreviewRoute() {
  if (!__DEV__ && process.env.EXPO_PUBLIC_DESIGN_SHEET !== '1') return <Redirect href="/" />;
  return <Preview />;
}

/** Satu kartu contoh per bank (yang pertama di katalog) untuk demo tumpukan. */
function stackSample() {
  const seen = new Set<string>();
  return CARD_PRODUCTS.filter((p) => !p.customArt && !seen.has(p.bank) && seen.add(p.bank)).slice(0, 6);
}

function Preview() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { picker, current: initial } = useLocalSearchParams<{ picker?: string; current?: string }>();
  const [open, setOpen] = useState(picker === '1');
  const [chosen, setChosen] = useState<string | null>(cardProduct(initial)?.id ?? null);
  const width = 340;
  const peek = (width / CARD_ART_RATIO) * CARD_ART_PEEK;
  const stack = stackSample();
  const counts = countryCounts();
  const current = cardProduct(chosen);

  if (open) {
    return (
      <CardStylePicker
        bank="bca"
        currentId={chosen}
        onClose={() => (picker === '1' ? router.replace('/design-kartu') : setOpen(false))}
        onApply={(id) => {
          setChosen(id);
          setOpen(false);
        }}
      />
    );
  }
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <AppText variant="h1">{t('acct.cardStyle.title')}</AppText>
          <AppText variant="body" tone="secondary">
            {`Pratinjau. Katalog: ${counts.all} kartu (ID ${counts.ID}, MY ${counts.MY}, TR ${counts.TR}), semua dari halaman resmi bank. Belum disimpan ke akun.`}
          </AppText>
          <Card>
            <View style={styles.gap}>
              <AppText variant="h3">Tumpukan (nama bank di pita atas)</AppText>
              <View style={{ height: peek * (stack.length - 1) + width / CARD_ART_RATIO }}>
                {stack.map((p, i) => (
                  <View key={p.id} style={{ position: 'absolute', top: i * peek, left: 0 }}>
                    <ProductArt product={p} width={width} />
                  </View>
                ))}
              </View>
            </View>
          </Card>
          <Card>
            <View style={styles.gap}>
              <AppText variant="h3">Kartu contoh</AppText>
              {/* Sama dengan kartu akun di deck Beranda dan detail akun (BankCard + cardStyle). */}
              <BankCard bank="bca" accountType="Tabungan" last4="1234" balance={1_250_000} currency="IDR" width={width} cardStyle={chosen ?? undefined} />
              <AppText variant="caption" tone="secondary">
                {current ? productLabel(current, t) : t('acct.cardStyle.defaultArt')}
              </AppText>
              <Button label={t('acct.cardStyle.title')} onPress={() => setOpen(true)} fullWidth />
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: layout.screenGutter, alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxContentWidth, gap: space.lg },
  gap: { gap: space.md },
});
