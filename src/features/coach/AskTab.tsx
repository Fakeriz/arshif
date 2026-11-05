import { usePaywall } from '@/components/shell/Paywall';
import { AppText, Card, EmptyState } from '@/components/ui';
import { View } from 'react-native';

import { space } from '@/theme/tokens';

const EXAMPLES = ['Kenapa pengeluaranku naik bulan ini?', 'Berapa yang bisa kusisihkan untuk liburan?', 'Mana yang lebih dulu dilunasi, laptop atau kartu kredit?'];

/** Tanya Coach hanya untuk Premium (20 pertanyaan/hari). Pengguna Free melihat state batas. */
export function AskTab() {
  const paywall = usePaywall();
  return (
    <View style={{ gap: space.lg }}>
      <EmptyState
        kind="limit"
        title="Tanya Coach khusus Premium"
        message="Tanyakan apa saja soal keuanganmu, 20 pertanyaan per hari. Jawaban memakai ringkasan angkamu, bukan data mentah."
        actionLabel="Lihat Premium"
        onAction={() => paywall('Tanya Coach (20 pertanyaan/hari) hanya ada di Premium.')}
      />
      <Card>
        <AppText variant="caption" tone="secondary">
          Contoh pertanyaan yang bisa diajukan
        </AppText>
        {EXAMPLES.map((q) => (
          <AppText key={q} variant="body" style={{ marginTop: space.sm }}>{`“${q}”`}</AppText>
        ))}
      </Card>
    </View>
  );
}
