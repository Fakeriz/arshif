import { Download, Trash2 } from 'lucide-react-native';
import { useState } from 'react';

import { AppText, BottomSheet, Button, Card, Dialog, Icon, ListItem, useToast } from '@/components/ui';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

/** Ekspor data (JSON/CSV) dan hapus akun (FR-SET-3). Eksekusi sungguhan di Fase 2. */
export function DataCard() {
  const { show } = useToast();
  const { colors } = useTheme();
  const t = useT();
  const demoNote = t('settings.data.demoNote');
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <Card padding="md">
      <ListItem title={t('settings.data.exportTitle')} subtitle={t('settings.data.exportSub')} subtitleLines={2} leading={<Icon icon={Download} color={colors.textSecondary} />} chevron divider onPress={() => setExportOpen(true)} />
      <ListItem title={t('settings.data.deleteTitle')} subtitle={t('settings.data.deleteSub')} subtitleLines={2} leading={<Icon icon={Trash2} color={colors.negative} />} chevron onPress={() => setDeleteOpen(true)} />
      <BottomSheet visible={exportOpen} onClose={() => setExportOpen(false)} title={t('settings.data.exportTitle')} subtitle={t('settings.data.exportPick')}>
        <AppText variant="caption" tone="muted">
          {demoNote}
        </AppText>
        {(['JSON', 'CSV'] as const).map((f) => (
          <Button
            key={f}
            label={t('settings.data.exportAs', { format: f })}
            variant="secondary"
            fullWidth
            onPress={() => {
              setExportOpen(false);
              show({ tone: 'info', title: t('settings.data.exportInactive', { format: f }), message: demoNote });
            }}
          />
        ))}
      </BottomSheet>
      <Dialog
        visible={deleteOpen}
        tone="danger"
        title={t('settings.data.deleteDialogTitle')}
        message={t('settings.data.deleteDialogMessage')}
        confirmLabel={t('settings.data.deleteTitle')}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          show({ tone: 'info', title: t('settings.data.deleteInactive'), message: demoNote });
        }}
      />
    </Card>
  );
}
