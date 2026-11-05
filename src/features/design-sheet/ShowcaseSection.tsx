import { Bell, ChartPie, Eye, EyeOff, FileText, House, ListOrdered, Mic, PenLine, ScanLine, User, Activity } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  BalanceText,
  BankCard,
  Button,
  Card,
  CategoryIcon,
  CurrencyText,
  GlassTabBar,
  GlassView,
  Icon,
  ListItem,
  PressableScale,
  PromoCard,
  QuickActions,
  Tabs,
  useToast,
} from '@/components/ui';
import { convertMinor } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { sampleTransactions } from './sample-data';
import { Section } from './Section';

const NET_WORTH_IDR = 48215400;
/** Kurs contoh untuk Lembar Desain (bukan kurs live). */
const SAMPLE_RATES = { IDR: '1', USD: '0.0000629', MYR: '0.000287' } as const;
type Cur = keyof typeof SAMPLE_RATES;
type Tab = 'home' | 'trx' | 'plan' | 'coach';

export function ShowcaseSection() {
  const { colors } = useTheme();
  const { show } = useToast();
  const [hidden, setHidden] = useState(false);
  const [cur, setCur] = useState<Cur>('USD');
  const [tab, setTab] = useState<Tab>('home');
  const demo = (title: string) => () => show({ tone: 'info', title, message: 'Contoh di Lembar Desain. Layar aslinya dibangun di Fase 1.' });
  const amount = convertMinor(NET_WORTH_IDR, 'IDR', cur, SAMPLE_RATES[cur]);

  return (
    <Section index="Penerapan" title="Satu layar, semua lapisan" note="Pola referensi (kaca, glow aksen, saldo besar, nav pill) dengan isi Arshif. Ganti aksen dan tema di atas untuk melihat semuanya ikut berubah.">
      <View style={styles.header}>
        <IconButton icon={User} label="Profil" onPress={demo('Profil')} />
        <AppText variant="h3">Arshif</AppText>
        <IconButton icon={Bell} label="Notifikasi, 2 belum dibaca" onPress={demo('Notifikasi')} dot />
      </View>

      <View style={styles.balance}>
        <View style={styles.balanceLabel}>
          <AppText variant="caption" tone="secondary">Total kekayaan bersih</AppText>
          <PressableScale onPress={() => setHidden((h) => !h)} accessibilityLabel={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'} focusRadius={radius.full} style={styles.eye}>
            <Icon icon={hidden ? EyeOff : Eye} color={colors.textSecondary} size={layout.iconSize.sm} />
          </PressableScale>
        </View>
        <BalanceText amount={amount} currency={cur} hidden={hidden} />
        <View style={styles.curTabs}>
          <Tabs items={[{ key: 'IDR', label: 'IDR' }, { key: 'USD', label: 'USD' }, { key: 'MYR', label: 'MYR' }]} value={cur} onChange={setCur} accessibilityLabel="Tampilkan dalam mata uang" />
        </View>
        <AppText variant="caption" tone="muted" align="center">4 akun · kurs contoh, bukan kurs live</AppText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        <BankCard bank="bca" accountType="Tabungan" last4="2153" balance={21480000} currency="IDR" hidden={hidden} onPress={demo('Detail akun BCA')} />
        <BankCard bank="jago" accountType="Kantong Utama" last4="8810" balance={14250000} currency="IDR" hidden={hidden} onPress={demo('Detail akun Jago')} />
        <BankCard bank="maybank" accountType="Savings" last4="4402" balance={318640} currency="MYR" hidden={hidden} onPress={demo('Detail akun Maybank')} />
        <BankCard bank="gopay" accountType="E-Wallet" balance={862500} currency="IDR" hidden={hidden} onPress={demo('Detail GoPay')} />
      </ScrollView>

      <QuickActions
        actions={[
          { key: 'scan', label: 'Scan Struk', icon: ScanLine, primary: true, onPress: demo('Scan Struk') },
          { key: 'voice', label: 'Voice Log', icon: Mic, onPress: demo('Voice Log') },
          { key: 'pdf', label: 'Import PDF', icon: FileText, onPress: demo('Import PDF') },
          { key: 'manual', label: 'Manual', icon: PenLine, onPress: demo('Catat manual') },
        ]}
      />

      <PromoCard icon={Mic} title="Ucapkan, langsung tercatat" message="Coba Voice Log: “makan siang 45 ribu pakai GoPay”." onPress={demo('Voice Log')} />

      <Card padding="lg" style={styles.trx}>
        <View style={styles.trxHead}>
          <AppText variant="h3">Transaksi terakhir</AppText>
          <Button label="Lihat semua" variant="ghost" size="sm" onPress={demo('Daftar transaksi')} />
        </View>
        {sampleTransactions.slice(0, 3).map((t, i) => (
          <ListItem
            key={t.id}
            leading={<CategoryIcon category={t.category} />}
            title={t.merchant}
            subtitle={`${t.account} · ${t.time}`}
            trailing={<CurrencyText amount={t.amount} currency={t.currency} kind={t.kind} variant="bodyStrong" />}
            divider={i < 2}
            onPress={demo(t.merchant)}
          />
        ))}
      </Card>

      <GlassTabBar
        floating={false}
        value={tab}
        onChange={setTab}
        onPressAdd={demo('Catat transaksi')}
        items={[
          { key: 'home', label: 'Home', icon: House },
          { key: 'trx', label: 'Transaksi', icon: ListOrdered },
          { key: 'plan', label: 'Planning', icon: ChartPie },
          { key: 'coach', label: 'Coach', icon: Activity },
        ]}
      />
    </Section>
  );
}

function IconButton({ icon, label, onPress, dot }: { icon: typeof User; label: string; onPress: () => void; dot?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} focusRadius={radius.full}>
      <GlassView radius={radius.full} style={styles.iconBtn}>
        <Icon icon={icon} color={colors.text} />
        {dot && <View style={[styles.dot, { backgroundColor: colors.accent }]} />}
      </GlassView>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: radius.full },
  balance: { alignItems: 'center', gap: space.sm },
  balanceLabel: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginVertical: -space.md },
  curTabs: { width: 220 },
  cards: { gap: space.md, paddingRight: space.lg },
  trx: { paddingVertical: space.md },
  trxHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
