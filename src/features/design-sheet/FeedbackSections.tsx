import { FileText, Mic, PenLine, ScanLine } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  BottomSheet,
  Button,
  Card,
  Dialog,
  EmptyState,
  Icon,
  ListItem,
  useToast,
} from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { Row, Section } from './Section';

export function StateSection() {
  return (
    <Section index="14 · State" title="Kosong, error, limit, offline" note="Setiap layar Fase 1 memakai empat state ini — tidak ada layar kosong tanpa penjelasan.">
      <Card>
        <EmptyState title="Belum ada transaksi" message="Foto struk atau ucapkan pengeluaranmu — tercatat dalam 10 detik." actionLabel="Catat sekarang" onAction={() => undefined} compact />
      </Card>
      <Card>
        <EmptyState kind="error" title="Gagal memuat transaksi" message="Periksa koneksi lalu coba lagi. Datamu aman." actionLabel="Coba lagi" onAction={() => undefined} compact />
      </Card>
      <Card>
        <EmptyState kind="limit" title="Kuota scan bulan ini habis" message="Kamu sudah memakai 20 dari 20 scan struk. Kuota reset 1 Desember, atau upgrade untuk 300 scan/bulan." actionLabel="Lihat Premium" onAction={() => undefined} compact />
      </Card>
      <Card>
        <EmptyState kind="offline" title="Kamu sedang offline" message="Kurs memakai data terakhir (5 Nov, 14.00)." compact />
      </Card>
    </Section>
  );
}

const CAPTURE = [
  { key: 'scan', icon: ScanLine, title: 'Scan Struk', sub: 'Foto struk, AI isi semuanya · 14/20 tersisa' },
  { key: 'voice', icon: Mic, title: 'Voice Log', sub: '“Makan siang 45 ribu pakai GoPay”' },
  { key: 'pdf', icon: FileText, title: 'Import Rekening Koran', sub: 'PDF dari bank · 1/1 tersisa bulan ini' },
  { key: 'manual', icon: PenLine, title: 'Catat Manual', sub: 'Isi sendiri nominal & kategori' },
];

export function OverlaySection() {
  const { colors } = useTheme();
  const { show } = useToast();
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);

  return (
    <Section index="15 · Overlay" title="BottomSheet, Dialog, Toast">
      <Row>
        <Button label="Buka “+ Catat”" size="md" onPress={() => setSheet(true)} />
        <Button label="Dialog hapus" size="md" variant="secondary" onPress={() => setDialog(true)} />
      </Row>
      <Row>
        <Button label="Toast sukses" size="sm" variant="secondary" onPress={() => show({ tone: 'success', title: 'Transaksi tersimpan', message: 'Indomaret · Rp 87.500 masuk ke Belanja Harian.' })} />
        <Button label="Toast error" size="sm" variant="secondary" onPress={() => show({ tone: 'error', title: 'Struk tidak terbaca', message: 'Kuota tidak terpotong. Coba foto ulang dengan cahaya cukup.' })} />
        <Button label="Toast peringatan" size="sm" variant="secondary" onPress={() => show({ tone: 'warning', title: 'Anggaran Nongkrong 82%', message: 'Sisa Rp 162.000 untuk 25 hari.' })} />
      </Row>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Catat transaksi" subtitle="Pilih cara tercepat untukmu">
        {CAPTURE.map((c, i) => (
          <ListItem
            key={c.key}
            leading={
              <View style={[styles.captureIcon, { backgroundColor: colors.accentSoft }]}>
                <Icon icon={c.icon} color={colors.accentText} />
              </View>
            }
            title={c.title}
            subtitle={c.sub}
            chevron
            divider={i < CAPTURE.length - 1}
            onPress={() => setSheet(false)}
          />
        ))}
      </BottomSheet>

      <Dialog
        visible={dialog}
        tone="danger"
        title="Hapus transaksi ini?"
        message="Kopi Kenangan · Rp 28.000. Saldo GoPay akan dikembalikan. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus"
        onConfirm={() => {
          setDialog(false);
          show({ tone: 'success', title: 'Transaksi dihapus' });
        }}
        onCancel={() => setDialog(false)}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  captureIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
