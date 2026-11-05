import { Download, Trash2 } from 'lucide-react-native';
import { useState } from 'react';

import { AppText, BottomSheet, Button, Card, Dialog, Icon, ListItem, useToast } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

const DEMO_NOTE = 'Mode demo: belum terhubung ke server, jadi tidak ada data yang benar-benar diproses.';

/** Ekspor data (JSON/CSV) dan hapus akun (FR-SET-3). Eksekusi sungguhan di Fase 2. */
export function DataCard() {
  const { show } = useToast();
  const { colors } = useTheme();
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <Card padding="md">
      <ListItem title="Ekspor data" subtitle="Unduh semua transaksimu sebagai JSON atau CSV" subtitleLines={2} leading={<Icon icon={Download} color={colors.textSecondary} />} chevron divider onPress={() => setExportOpen(true)} />
      <ListItem title="Hapus akun" subtitle="Menghapus akun beserta semua datanya" leading={<Icon icon={Trash2} color={colors.negative} />} chevron onPress={() => setDeleteOpen(true)} />
      <BottomSheet visible={exportOpen} onClose={() => setExportOpen(false)} title="Ekspor data" subtitle="Pilih format berkas">
        <AppText variant="caption" tone="muted">
          {DEMO_NOTE}
        </AppText>
        {(['JSON', 'CSV'] as const).map((f) => (
          <Button
            key={f}
            label={`Ekspor sebagai ${f}`}
            variant="secondary"
            fullWidth
            onPress={() => {
              setExportOpen(false);
              show({ tone: 'info', title: `Ekspor ${f} belum aktif`, message: DEMO_NOTE });
            }}
          />
        ))}
      </BottomSheet>
      <Dialog
        visible={deleteOpen}
        tone="danger"
        title="Hapus akun dan semua data?"
        message="Transaksi, akun, anggaran, dan berkas struk akan dihapus permanen dan tidak bisa dikembalikan. Ekspor datamu dulu bila perlu."
        confirmLabel="Hapus akun"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          show({ tone: 'info', title: 'Penghapusan akun belum aktif', message: DEMO_NOTE });
        }}
      />
    </Card>
  );
}
