import { Download, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { z } from 'zod';

import { FUNCTIONS } from '../../../supabase/functions/_shared/contracts';
import { AppText, BottomSheet, Button, Dialog, MenuGroup, useToast } from '@/components/ui';
import { invokeFn } from '@/data/remote/functions';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/state/AppStore';

import { buildExport, saveExport, type ExportFormat } from './exportData';

const Deleted = z.object({ deleted: z.literal(true) });

/** Ekspor data (JSON/CSV) dan hapus akun beserta semua data + berkas (FR-SET-3). */
export function DataCard() {
  const { show } = useToast();
  const { state } = useStore();
  const t = useT();
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const doExport = async (format: ExportFormat) => {
    setExportOpen(false);
    try {
      await saveExport(format, buildExport(format, state.accounts, state.transactions));
      show({ tone: 'success', title: t('settings.data.exportDone', { format }) });
    } catch {
      show({ tone: 'error', title: t('settings.data.exportFailed') });
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await invokeFn(FUNCTIONS.deleteAccount, { confirm: 'DELETE' }, Deleted);
      // Pengguna sudah terhapus di server; buang sesi lokal → kembali ke layar masuk.
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      setDeleting(false);
      setDeleteOpen(false);
      show({ tone: 'error', title: t('settings.data.deleteFailed'), message: t('settings.data.deleteFailedMessage') });
    }
  };

  return (
    <>
      {/* Ikon polos (MenuGroup): dua aksi data, sama dengan menu Pengaturan. */}
      <MenuGroup
        entries={[
          { key: 'export', icon: Download, title: t('settings.data.exportTitle'), subtitle: t('settings.data.exportSub'), onPress: () => setExportOpen(true) },
          { key: 'delete', icon: Trash2, tone: 'negative', title: t('settings.data.deleteTitle'), subtitle: t('settings.data.deleteSub'), onPress: () => setDeleteOpen(true) },
        ]}
      />
      <BottomSheet visible={exportOpen} onClose={() => setExportOpen(false)} title={t('settings.data.exportTitle')} subtitle={t('settings.data.exportPick')}>
        <AppText variant="caption" tone="muted">
          {t('settings.data.exportNote', { count: state.transactions.length })}
        </AppText>
        {(['JSON', 'CSV'] as const).map((f) => (
          <Button key={f} label={t('settings.data.exportAs', { format: f })} variant="secondary" fullWidth onPress={() => void doExport(f)} />
        ))}
      </BottomSheet>
      <Dialog
        visible={deleteOpen}
        tone="danger"
        title={t('settings.data.deleteDialogTitle')}
        message={t('settings.data.deleteDialogMessage')}
        confirmLabel={deleting ? t('settings.data.deleting') : t('settings.data.deleteTitle')}
        onCancel={() => !deleting && setDeleteOpen(false)}
        onConfirm={() => !deleting && void doDelete()}
      />
    </>
  );
}
