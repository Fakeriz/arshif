import { Bell, Info, MoreHorizontal, Search, Share2 } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Accordion,
  AppText,
  AvatarStack,
  Badge,
  Button,
  Calendar,
  Card,
  ChatBubble,
  Checkbox,
  Composer,
  Countdown,
  GoalRing,
  Icon,
  Input,
  MiniBars,
  OtpInput,
  PopIn,
  RadioList,
  RollingNumber,
  Select,
  Slider,
  SpeedDial,
  StarRating,
  StepList,
  Stepper,
  Toggle,
  Tooltip,
  TypingDots,
  UploadProgress,
  VoicePlayer,
  dateKey,
} from '@/components/ui';
import { formatCompact, formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { Row, Section, StateLabel } from './Section';

/** Baris label + kontrol di kanan, seperti baris Pengaturan. */
function Line({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.line}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        {hint && (
          <AppText variant="caption" tone="secondary">
            {hint}
          </AppText>
        )}
      </View>
      {children}
    </View>
  );
}

export function MotionChoiceSection() {
  const [remind, setRemind] = useState(true);
  const [autoSave, setAutoSave] = useState(false);
  const [accounts, setAccounts] = useState<string[]>(['Ringgit', 'Tunai']);
  const [currency, setCurrency] = useState<'IDR' | 'MYR' | 'TRY'>('MYR');
  const [group, setGroup] = useState<'category' | 'account' | 'currency' | 'date'>('currency');
  const [stars, setStars] = useState(4);
  const [steps, setSteps] = useState(1);

  return (
    <Section index="Gerak · Pilihan" title="Centang, radio & pilihan" note="Isi tumbuh dari tengah, centang meletup, sorotan memudar masuk. Semuanya hanya transform + opasitas.">
      <Card>
        <Line title="Ingatkan tagihan" hint="Tiap malam sampai lunas">
          <Toggle value={remind} onChange={setRemind} accessibilityLabel="Ingatkan tagihan" />
        </Line>
        <Line title="Sisihkan otomatis" hint="10% dari tiap pemasukan">
          <Toggle value={autoSave} onChange={setAutoSave} accessibilityLabel="Sisihkan otomatis" />
        </Line>
      </Card>
      <StateLabel>Akun dihitung</StateLabel>
      <Card padding="sm">
        {['Tabungan', 'Ringgit', 'Lira', 'Tunai'].map((name) => (
          <View key={name} style={styles.checkRow}>
            <AppText variant="bodyStrong" style={styles.flex}>
              {name}
            </AppText>
            <Checkbox checked={accounts.includes(name)} accessibilityLabel={name} onChange={(on) => setAccounts((a) => (on ? [...a, name] : a.filter((x) => x !== name)))} />
          </View>
        ))}
      </Card>
      <StateLabel>Tampilkan saldo dalam</StateLabel>
      <RadioList
        accessibilityLabel="Tampilkan saldo dalam"
        value={currency}
        onChange={setCurrency}
        items={[
          { key: 'IDR', label: 'Rupiah', hint: 'IDR, mata uang utama' },
          { key: 'MYR', label: 'Ringgit', hint: 'MYR, kurs hari ini' },
          { key: 'TRY', label: 'Lira', hint: 'TRY, kurs hari ini' },
        ]}
      />
      <Select
        label="Kelompokkan transaksi"
        value={group}
        onChange={setGroup}
        items={[
          { key: 'category', label: 'Kategori' },
          { key: 'account', label: 'Akun' },
          { key: 'currency', label: 'Mata uang' },
          { key: 'date', label: 'Tanggal' },
        ]}
      />
      <Card>
        <View style={styles.center}>
          <AppText variant="h3">Ringkasan minggu ini membantu?</AppText>
          <StarRating value={stars} onChange={setStars} accessibilityLabel="Nilai ringkasan minggu ini" />
        </View>
      </Card>
      <Card>
        <StepList steps={['Foto struk', 'Cek jumlah', 'Simpan']} done={steps} onChange={setSteps} />
      </Card>
    </Section>
  );
}

const MONTHS = [
  { label: 'Jun', value: 1240000 },
  { label: 'Jul', value: 1860000 },
  { label: 'Agu', value: 980000 },
  { label: 'Sep', value: 760000 },
  { label: 'Okt', value: 1420000 },
  { label: 'Nov', value: 640000 },
];

export function MotionNumberSection() {
  const [budget, setBudget] = useState(1500000);
  const [members, setMembers] = useState(4);
  const [save, setSave] = useState(10);
  const [month, setMonth] = useState(1);
  const [paid, setPaid] = useState(2);
  const [left, setLeft] = useState(47 * 60 + 12);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  return (
    <Section index="Gerak · Angka" title="Angka yang bergulir" note="Hanya digit yang berubah yang bergerak, searah perubahan: naik dari bawah, turun dari atas.">
      <Card>
        <View style={styles.center}>
          <AppText variant="caption" tone="secondary">
            Anggaran makan
          </AppText>
          <Stepper size="lg" value={budget} onChange={setBudget} step={150000} max={9900000} format={(n) => formatMoney(n, 'IDR')} accessibilityLabel="Anggaran makan" />
          <AppText variant="caption" tone="muted" numeric>
            Sekitar {formatMoney(Math.round(budget / 30), 'IDR')} per hari
          </AppText>
        </View>
      </Card>
      <Row>
        <Card style={styles.half}>
          <View style={styles.center}>
            <AppText variant="h3">Anggota</AppText>
            <Stepper value={members} onChange={setMembers} min={1} max={9} accessibilityLabel="Anggota dompet bersama" />
          </View>
        </Card>
        <Card style={styles.half}>
          <View style={styles.center}>
            <GoalRing value={paid / 4} label="Tagihan lunas" size={88}>
              <RollingNumber value={`${paid}/4`} variant="h2" />
            </GoalRing>
            <Button label="Lunasi satu" size="sm" variant="secondary" onPress={() => setPaid((p) => (p >= 4 ? 0 : p + 1))} />
          </View>
        </Card>
      </Row>
      <Card>
        <View style={styles.gap}>
          <View style={styles.between}>
            <AppText variant="bodyStrong">Sisihkan ke tabungan</AppText>
            <AppText variant="bodyStrong" numeric>
              {save}%
            </AppText>
          </View>
          <Slider value={save} onChange={setSave} max={30} accessibilityLabel="Sisihkan ke tabungan, persen" />
        </View>
      </Card>
      <Card>
        <View style={styles.gap}>
          <AppText variant="caption" tone="secondary">
            Makan · {MONTHS[month].label}
          </AppText>
          <RollingNumber value={formatCompact(MONTHS[month].value, 'IDR')} variant="h1" />
          <MiniBars accessibilityLabel="Belanja makan per bulan" data={MONTHS.map((m) => ({ ...m, valueLabel: formatCompact(m.value, 'IDR') }))} selected={month} onSelect={setMonth} />
        </View>
      </Card>
      <Card>
        <View style={styles.center}>
          <AppText variant="caption" tone="secondary">
            Kurs terkunci selama
          </AppText>
          <Countdown seconds={left} />
          <Row>
            <Button label={running ? 'Jeda' : 'Mulai'} size="sm" onPress={() => setRunning((r) => !r)} />
            <Button label="Ulang" size="sm" variant="secondary" onPress={() => setLeft(47 * 60 + 12)} />
          </Row>
        </View>
      </Card>
    </Section>
  );
}

const TRANSACTIONS = ['Kopi Kenangan', 'Kopi susu gula aren', 'Roti & kopi pagi', 'Bensin Pertamax', 'Belanja mingguan', 'Pulsa 50 ribu'];

export function MotionInputSection() {
  const [code, setCode] = useState('4817');
  const [name, setName] = useState('Makan siang di Kedai Ibu');
  const [query, setQuery] = useState('kopi');
  const [draft, setDraft] = useState('');
  const [chat, setChat] = useState<{ from: 'me' | 'assistant'; text: string }[]>([{ from: 'assistant', text: 'Mau catat apa hari ini?' }]);
  const [typing, setTyping] = useState(false);
  const [date, setDate] = useState<Date | null>(new Date(2026, 10, 26));

  const hits = query.trim() ? TRANSACTIONS.filter((x) => x.toLowerCase().includes(query.trim().toLowerCase())).length : 0;
  const send = (text: string) => {
    setChat((c) => [...c.slice(-3), { from: 'me', text }]);
    setDraft('');
    setTyping(true);
  };
  useEffect(() => {
    if (!typing) return;
    const id = setTimeout(() => {
      setTyping(false);
      setChat((c) => [...c.slice(-3), { from: 'assistant', text: 'Tercatat. Kategorinya kutebak Makan, ubah kalau keliru.' }]);
    }, 1400);
    return () => clearTimeout(id);
  }, [typing]);

  return (
    <Section index="Gerak · Input" title="Kode, kolom & kalender" note="Digit meletup saat masuk, lencana muncul saat ada isi, lingkaran pilihan kalender meluncur ke tanggal baru.">
      <OtpInput label="Kode 6 digit" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} error={code === '000000' ? 'Kode salah. Periksa email lalu coba lagi.' : undefined} />
      <Input label="Nama transaksi" value={name} onChangeText={setName} valid={name.trim().length >= 3} />
      <Input
        label="Cari transaksi"
        icon={Search}
        value={query}
        onChangeText={setQuery}
        placeholder="Merchant, catatan, kategori"
        trailing={
          <PopIn visible={query.trim().length >= 2} from={0.4}>
            <Badge label={`${hits} hasil`} tone={hits > 0 ? 'accent' : 'neutral'} />
          </PopIn>
        }
      />
      <Card>
        <View style={styles.chat}>
          {chat.map((m, i) => (
            <ChatBubble key={`${chat.length}-${i}-${m.text}`} from={m.from} text={m.text} />
          ))}
          {typing && <TypingDots />}
        </View>
        <Composer value={draft} onChangeText={setDraft} onSend={send} placeholder="Tulis transaksi, mis. kopi 25 ribu" disabled={typing} />
      </Card>
      <Card>
        <Calendar value={date} onChange={setDate} today={new Date(2026, 10, 10)} marked={[dateKey(new Date(2026, 10, 12)), dateKey(new Date(2026, 10, 26)), dateKey(new Date(2026, 11, 3))]} />
      </Card>
    </Section>
  );
}

const FAQ = [
  { key: 'scan', title: 'Bagaimana struk dibaca?', body: 'Foto struknya, lalu jumlah, toko, dan kategori terisi sendiri. Kamu tinggal cek dan simpan.' },
  { key: 'pdf', title: 'Bisa impor rekening koran?', body: 'Bisa. Unggah PDF dari bank, transaksinya dicocokkan otomatis dengan yang sudah tercatat.' },
  { key: 'fx', title: 'Kurs dihitung dari mana?', body: 'Dari kurs tengah harian untuk IDR, MYR, TRY, dan USD. Kurs milikmu sendiri bisa diatur di Kurs Saya.' },
] as const;

export function MotionFeedbackSection() {
  const { colors } = useTheme();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle');
  const [upload, setUpload] = useState(1);
  const [faq, setFaq] = useState<(typeof FAQ)[number]['key'] | null>('scan');
  const [dial, setDial] = useState(true);
  const [alerts, setAlerts] = useState(3);
  const [people, setPeople] = useState(['Maya', 'Lutfi', 'Sari']);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0.35);

  useEffect(() => {
    if (phase === 'idle') return;
    const id = setTimeout(() => setPhase(phase === 'loading' ? 'done' : 'idle'), phase === 'loading' ? 1200 : 1600);
    return () => clearTimeout(id);
  }, [phase]);
  useEffect(() => {
    if (upload >= 1) return;
    const id = setTimeout(() => setUpload((p) => Math.min(1, p + 0.07)), 110);
    return () => clearTimeout(id);
  }, [upload]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPos((p) => (p + 0.01 >= 1 ? 0 : p + 0.01)), 140);
    return () => clearInterval(id);
  }, [playing]);

  const pool = ['Maya', 'Lutfi', 'Sari', 'Jonas', 'Putri', 'Dimas'];
  return (
    <Section index="Gerak · Umpan balik" title="Status, unggah & aksi" note="Setiap aksi dijawab: ikon berganti dengan letupan, aksi muncul bergiliran, isi lipatan masuk dengan geser.">
      <Button label={phase === 'idle' ? 'Simpan Rp 84.000' : phase === 'loading' ? 'Menyimpan…' : 'Tersimpan'} loading={phase === 'loading'} done={phase === 'done'} onPress={() => setPhase('loading')} fullWidth />
      <Card onPress={() => setUpload(0)} accessibilityLabel="Ulangi unggah struk">
        <UploadProgress fileName="struk-kedai-ibu.jpg" progress={upload} />
      </Card>
      <Card>
        <VoicePlayer title="Catatan suara" subtitle="“Kopi dua puluh lima ribu, tunai”" playing={playing} onToggle={() => setPlaying((p) => !p)} progress={pos} durationSec={14} />
      </Card>
      <Row>
        <Card style={styles.half}>
          <View style={styles.center}>
            <AvatarStack names={people} onAdd={() => setPeople((p) => (p.length >= pool.length ? pool.slice(0, 2) : pool.slice(0, p.length + 1)))} addLabel="Tambah anggota" />
            <AppText variant="h3">Dompet bersama</AppText>
            <AppText variant="caption" tone="secondary" numeric>
              {people.length} anggota
            </AppText>
          </View>
        </Card>
        <Card style={styles.half}>
          <View style={[styles.center, styles.tooltipBox]}>
            <AppText variant="caption" tone="secondary">
              Total Rp 84.000
            </AppText>
            <Tooltip text="Termasuk kurs dan biaya admin" accessibilityLabel="Info nominal">
              <View style={[styles.info, { backgroundColor: colors.track }]}>
                <Icon icon={Info} color={colors.text} size={18} />
              </View>
            </Tooltip>
          </View>
        </Card>
      </Row>
      <SpeedDial
        open={dial}
        onToggle={() => setDial((o) => !o)}
        actions={[
          { key: 'share', label: 'Bagikan ringkasan', icon: Share2, onPress: () => undefined },
          { key: 'alerts', label: 'Pengingat', icon: Bell, badge: alerts, onPress: () => setAlerts((a) => (a === 0 ? 3 : 0)) },
          { key: 'more', label: 'Lainnya', icon: MoreHorizontal, onPress: () => undefined },
        ]}
      />
      <Card padding="lg">
        <Accordion items={[...FAQ]} value={faq} onChange={setFaq} />
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.sm },
  center: { alignItems: 'center', gap: space.sm },
  gap: { gap: space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  half: { flex: 1, minWidth: 150 },
  chat: { gap: space.sm, marginBottom: space.md, minHeight: 150, justifyContent: 'flex-end' },
  tooltipBox: { paddingTop: space.x4 },
  info: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
