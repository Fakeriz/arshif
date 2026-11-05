import { Mail, Mic, Plus, ScanLine, Search, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AmountInput, Badge, Button, Chip, Input, ProBadge, Tabs } from '@/components/ui';
import { space } from '@/theme/tokens';

import { Row, Section, StateLabel } from './Section';

export function ButtonSection() {
  return (
    <Section index="04 · Tombol" title="Button" note="Tinggi 52 untuk aksi utama. Satu tombol primary per layar.">
      <Button label="Simpan transaksi" icon={Plus} fullWidth />
      <Button label="Scan struk" variant="secondary" icon={ScanLine} fullWidth />
      <Row>
        <Button label="Voice Log" size="md" variant="secondary" icon={Mic} />
        <Button label="Lewati" size="md" variant="ghost" />
        <Button label="Hapus" size="md" variant="danger" icon={Trash2} />
      </Row>
      <StateLabel>Loading · Disabled · Kecil</StateLabel>
      <Row>
        <Button label="Menyimpan…" size="md" loading />
        <Button label="Simpan" size="md" disabled />
        <Button label="Ubah" size="sm" variant="secondary" />
      </Row>
    </Section>
  );
}

export function InputSection() {
  const [email, setEmail] = useState('rani.pratiwi@gmail.com');
  const [amount, setAmount] = useState<number | null>(4500000);
  const [myr, setMyr] = useState<number | null>(null);
  return (
    <Section index="05 · Input" title="Input & AmountInput" note="Nominal tersimpan sebagai integer unit terkecil; pemisah ribuan mengikuti mata uang.">
      <Input label="Email" icon={Mail} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Kata sandi" placeholder="Minimal 8 karakter, huruf + angka" secureTextEntry />
      <Input label="Cari transaksi" icon={Search} placeholder="Merchant, catatan, kategori" />
      <StateLabel>Error · Disabled</StateLabel>
      <Input label="Kata sandi baru" value="arshif" secureTextEntry error="Minimal 8 karakter dan harus ada angka." onChangeText={() => undefined} />
      <Input label="Mata uang utama" value="IDR — Rupiah Indonesia" disabled hint="Bisa diganti di Pengaturan." />
      <View style={{ gap: space.xxl, paddingVertical: space.lg }}>
        <AmountInput value={amount} onChange={setAmount} currency="IDR" onPressCurrency={() => undefined} />
        <AmountInput value={myr} onChange={setMyr} currency="MYR" label="Nominal struk" error={myr === null ? undefined : myr > 500000 ? 'Melebihi limit kartu kredit' : undefined} />
      </View>
    </Section>
  );
}

export function BadgeChipSection() {
  const [filters, setFilters] = useState<string[]>(['expense']);
  const toggle = (k: string) => setFilters((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));
  return (
    <Section index="06 · Badge & Chip" title="Penanda & filter">
      <Row>
        <Badge label="Lunas" tone="positive" />
        <Badge label="Jatuh tempo besok" tone="warning" />
        <Badge label="Terlambat" tone="negative" />
        <Badge label="Struk" tone="info" icon={ScanLine} />
        <Badge label="Kemungkinan duplikat" />
        <Badge label="Disarankan AI" tone="accent" />
        <ProBadge />
        <ProBadge size="sm" />
      </Row>
      <Row>
        {[
          { k: 'expense', l: 'Pengeluaran', c: 128 },
          { k: 'income', l: 'Pemasukan', c: 9 },
          { k: 'transfer', l: 'Transfer' },
          { k: 'receipt', l: 'Dari struk', i: ScanLine },
          { k: 'voice', l: 'Voice Log', i: Mic },
        ].map((x) => (
          <Chip key={x.k} label={x.l} count={x.c} icon={x.i} selected={filters.includes(x.k)} onPress={() => toggle(x.k)} />
        ))}
        <Chip label="Import PDF" disabled />
      </Row>
    </Section>
  );
}

export function TabsSection() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [coach, setCoach] = useState<'score' | 'recap' | 'ask'>('score');
  return (
    <Section index="07 · Tabs" title="Segmented & garis bawah">
      <Tabs
        accessibilityLabel="Periode"
        value={period}
        onChange={setPeriod}
        items={[
          { key: 'week', label: 'Minggu ini' },
          { key: 'month', label: 'Bulan ini' },
          { key: 'year', label: 'Tahun ini' },
        ]}
      />
      <Tabs
        variant="underline"
        accessibilityLabel="Coach"
        value={coach}
        onChange={setCoach}
        items={[
          { key: 'score', label: 'Skor' },
          { key: 'recap', label: 'Recap' },
          { key: 'ask', label: 'Tanya Coach' },
        ]}
      />
    </Section>
  );
}
