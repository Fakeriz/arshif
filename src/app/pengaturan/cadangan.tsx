import * as DocumentPicker from 'expo-document-picker';
import { CloudUpload, FileUp, HardDriveDownload, KeyRound, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Card, Dialog, EmptyState, Group, ListCard, ListItem, MenuGroup, ProgressBar, Tabs, Toggle, useToast } from '@/components/ui';
import { readBytes } from '@/data/remote/upload';
import { DriveError, DriveGate, useDrive, type DriveFile } from '@/features/backup/drive';
import { KeySheet } from '@/features/backup/KeySheet';
import {
  backupDue,
  backupFileName,
  canStoreKey,
  createBackupFile,
  inspectBackup,
  loadSchedule,
  loadStoredKey,
  openBackup,
  restorePayload,
  saveBackupFile,
  saveSchedule,
  storeKey,
  type BackupPayload,
  type BackupSchedule,
  type ReminderDays,
  type RestoreReport,
} from '@/features/backup/service';
import { SettingsScreen } from '@/features/settings/kit';
import { useI18n, type TFunction } from '@/i18n';
import { BackupError, type BackupHeader } from '@/lib/backup/crypto';
import { isoDateLabel } from '@/lib/dates';
import { useStore } from '@/state/AppStore';
import { useAssets } from '@/state/assets';
import { useInvoices } from '@/state/invoices';
import { usePlanning } from '@/state/planning';
import { space } from '@/theme/tokens';

type Progress = { done: number; total: number } | null;
/** File yang sedang dibuka untuk dipulihkan: header dibaca tanpa kunci, payload setelah kunci benar. */
type Pending = { file: Uint8Array; header: BackupHeader; payload?: BackupPayload; keyError?: string };

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;

function backupErrorText(t: TFunction, e: unknown): string {
  if (e instanceof BackupError) return t(e.code === 'not_backup' ? 'settings.backup.errNotBackup' : e.code === 'version' ? 'settings.backup.errVersion' : 'settings.backup.errBadKey');
  if (e instanceof DriveError) return t(e.code === 'cancelled' || e.code === 'auth' ? 'settings.backup.errDriveAuth' : 'settings.backup.errDrive');
  return t('settings.backup.errRestore');
}

/**
 * Pengaturan > Cadangan: satu file terenkripsi AES-256-GCM berisi semua data akun (+ struk bila dipilih), simpan/bagikan
 * atau unggah ke Google Drive, pengingat terjadwal, dan pemulihan (gabung, tidak menghapus apa pun).
 */
export default function CadanganScreen() {
  // Drive lewat gerbang: hook login Google hanya dipanggil bila client ID platform ini ada (tanpa itu expo-auth-session crash).
  return (
    <DriveGate>
      <Cadangan />
    </DriveGate>
  );
}

function Cadangan() {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { userId, reload } = useStore();
  const planning = usePlanning();
  const invoices = useInvoices();
  const assets = useAssets();
  const drive = useDrive();

  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [key, setKey] = useState<Uint8Array | null>(null);
  const [withReceipts, setWithReceipts] = useState(true);
  const [creating, setCreating] = useState<Progress>(null);
  const [created, setCreated] = useState<Uint8Array | null>(null);
  const [keySheet, setKeySheet] = useState<'setup' | 'show' | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [askKey, setAskKey] = useState(false);
  const [restoring, setRestoring] = useState<Progress>(null);
  const [report, setReport] = useState<RestoreReport | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[] | null>(null);
  // "Sekarang" diambil sekali saat layar dibuka: render tetap murni (tanpa Date.now() di badan render).
  const [now] = useState(Date.now);

  useEffect(() => {
    void loadSchedule().then(setSchedule);
    void loadStoredKey().then(setKey);
  }, []);

  const date = (iso: string) => isoDateLabel(iso, lang);

  // ------------------------------------------------------------ buat cadangan
  const create = async (k: Uint8Array) => {
    if (!userId) return;
    setCreating({ done: 0, total: 1 });
    try {
      const bytes = await createBackupFile(userId, k, withReceipts, (done, total) => setCreating({ done, total }));
      const lastAt = new Date().toISOString();
      await saveSchedule({ lastAt });
      setSchedule((s) => (s ? { ...s, lastAt } : s));
      setCreated(bytes);
    } catch {
      show({ tone: 'error', title: t('settings.backup.errCreate') });
    } finally {
      setCreating(null);
    }
  };
  const startCreate = () => (key ? void create(key) : setKeySheet('setup'));

  const uploadToDrive = async () => {
    if (!created || !drive) return;
    try {
      await drive.upload(backupFileName(), created);
      show({ tone: 'success', title: t('settings.backup.uploaded') });
      setCreated(null);
    } catch (e) {
      show({ tone: 'error', title: backupErrorText(t, e) });
    }
  };

  // ------------------------------------------------------------ pulihkan
  const tryOpen = (p: Pending, k: Uint8Array | null) => {
    if (!k) return setAskKey(true);
    try {
      setPending({ ...p, payload: openBackup(k, p.file), keyError: undefined });
      setAskKey(false);
    } catch (e) {
      setPending({ ...p, keyError: backupErrorText(t, e) });
      setAskKey(true);
    }
  };

  const loadFile = (file: Uint8Array) => {
    try {
      const p = { file, header: inspectBackup(file) };
      setPending(p);
      tryOpen(p, key);
    } catch (e) {
      show({ tone: 'error', title: backupErrorText(t, e) });
    }
  };

  const pickFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets[0]) return;
    loadFile(new Uint8Array(await readBytes(r.assets[0].uri)));
  };

  const openDrive = async () => {
    if (!drive) return;
    try {
      setDriveFiles(await drive.list());
    } catch (e) {
      show({ tone: 'error', title: backupErrorText(t, e) });
    }
  };

  const restore = async () => {
    if (!userId || !pending?.payload) return;
    const payload = pending.payload;
    setPending(null);
    setRestoring({ done: 0, total: 1 });
    try {
      const r = await restorePayload(userId, payload, (done, total) => setRestoring({ done, total }));
      setReport(r);
      await Promise.all([reload(), planning.reload(), invoices.reload(), assets.reload()]);
    } catch {
      show({ tone: 'error', title: t('settings.backup.errRestore') });
    } finally {
      setRestoring(null);
    }
  };

  // ------------------------------------------------------------ tampilan
  const due = schedule ? backupDue(schedule, now) : false;
  const days = schedule?.lastAt ? Math.floor((now - Date.parse(schedule.lastAt)) / 86_400_000) : 0;
  const busy = !!creating || !!restoring;

  return (
    <SettingsScreen title={t('settings.backup.title')}>
      <AppText variant="body" tone="secondary" style={styles.note}>
        {t('settings.backup.intro')}
      </AppText>

      {/* Satu titik fokus: kapan terakhir dicadangkan, dan apakah sudah waktunya. */}
      <Card>
        <AppText variant="caption" tone="secondary">
          {t('settings.backup.lastTitle')}
        </AppText>
        <AppText variant="h2">{schedule?.lastAt ? date(schedule.lastAt) : t('settings.backup.never')}</AppText>
        {due && schedule?.lastAt ? (
          <AppText variant="caption" tone="warning" aria-live="polite">
            {t('settings.backup.due', { days })}
          </AppText>
        ) : null}
      </Card>

      <Group label={t('settings.backup.createGroup')}>
        <ListCard>
          <ListItem
            title={t('settings.backup.receipts')}
            subtitle={t('settings.backup.receiptsSub')}
            subtitleLines={2}
            trailing={<Toggle value={withReceipts} onChange={setWithReceipts} disabled={busy} accessibilityLabel={t('settings.backup.receipts')} />}
          />
        </ListCard>
        {creating ? (
          <View style={styles.progress} accessibilityLabel={t('settings.backup.collecting', creating)} aria-busy>
            <AppText variant="caption" tone="secondary">
              {t('settings.backup.collecting', creating)}
            </AppText>
            <ProgressBar value={creating.done / Math.max(1, creating.total)} tone="accent" />
          </View>
        ) : (
          <Button label={t('settings.backup.create')} fullWidth disabled={busy} onPress={startCreate} />
        )}
      </Group>

      <Group label={t('settings.backup.reminder')}>
        <Tabs<string>
          accessibilityLabel={t('settings.backup.reminder')}
          value={String(schedule?.everyDays ?? 30)}
          onChange={(v) => {
            const everyDays = Number(v) as ReminderDays;
            setSchedule((s) => (s ? { ...s, everyDays } : s));
            void saveSchedule({ everyDays });
          }}
          items={[
            { key: '0', label: t('settings.backup.off') },
            { key: '7', label: t('settings.backup.every7') },
            { key: '30', label: t('settings.backup.every30') },
          ]}
        />
        <AppText variant="caption" tone="muted" style={styles.note}>
          {t('settings.backup.reminderSub')}
        </AppText>
      </Group>

      {key ? (
        <MenuGroup
          label={t('settings.backup.keyGroup')}
          entries={[{ key: 'key', icon: KeyRound, title: t('settings.backup.keyShow'), subtitle: t('settings.backup.keyShowSub'), onPress: () => setKeySheet('show') }]}
        />
      ) : (
        <Group label={t('settings.backup.keyGroup')}>
          <AppText variant="caption" tone="muted" style={styles.note}>
            {canStoreKey ? t('settings.backup.keyNone') : t('settings.backup.webKeyNote')}
          </AppText>
        </Group>
      )}

      {restoring ? (
        <View style={styles.progress} accessibilityLabel={t('settings.backup.restoring', restoring)} aria-busy>
          <AppText variant="caption" tone="secondary">
            {t('settings.backup.restoring', restoring)}
          </AppText>
          <ProgressBar value={restoring.done / Math.max(1, restoring.total)} tone="accent" />
        </View>
      ) : (
        <MenuGroup
          label={t('settings.backup.restoreGroup')}
          entries={[
            { key: 'file', icon: FileUp, title: t('settings.backup.fromFile'), subtitle: t('settings.backup.fromFileSub'), onPress: () => void pickFile() },
            {
              key: 'drive',
              icon: HardDriveDownload,
              title: t('settings.backup.fromDrive'),
              subtitle: drive ? t('settings.backup.fromDriveSub') : t('settings.backup.driveUnavailable'),
              disabled: !drive,
              onPress: () => void openDrive(),
            },
          ]}
        />
      )}

      {/* Cadangan pertama: kunci dibuat dan dibuktikan tersimpan dulu. */}
      {keySheet === 'setup' && (
        <KeySheet
          visible
          mode="setup"
          onClose={() => setKeySheet(null)}
          onDone={(k) => {
            setKeySheet(null);
            setKey(k);
            void storeKey(k);
            void create(k);
          }}
        />
      )}
      {keySheet === 'show' && <KeySheet visible mode="show" current={key} onClose={() => setKeySheet(null)} />}

      <BottomSheet visible={!!created} onClose={() => setCreated(null)} title={t('settings.backup.readyTitle')} subtitle={created ? t('settings.backup.readySub', { size: mb(created.length) }) : undefined}>
        <View style={styles.sheet}>
          <Button label={t('settings.backup.save')} icon={Share2} fullWidth onPress={() => created && void saveBackupFile(created)} />
          <Button label={t('settings.backup.drive')} icon={CloudUpload} variant="secondary" fullWidth loading={drive?.busy} disabled={!drive || drive.busy} onPress={() => void uploadToDrive()} />
          {!drive && (
            <AppText variant="caption" tone="muted" align="center">
              {t('settings.backup.driveUnavailable')}
            </AppText>
          )}
        </View>
      </BottomSheet>

      <BottomSheet scrollable visible={driveFiles !== null} onClose={() => setDriveFiles(null)} title={t('settings.backup.driveListTitle')}>
        {driveFiles?.length === 0 ? (
          <EmptyState compact title={t('settings.backup.driveEmpty')} />
        ) : (
          <ListCard>
            {(driveFiles ?? []).map((f, i, list) => (
              <ListItem
                key={f.id}
                title={date(f.createdTime)}
                subtitle={`${f.name} · ${mb(f.size)}`}
                chevron
                divider={i < list.length - 1}
                onPress={async () => {
                  setDriveFiles(null);
                  try {
                    if (drive) loadFile(await drive.download(f.id));
                  } catch (e) {
                    show({ tone: 'error', title: backupErrorText(t, e) });
                  }
                }}
              />
            ))}
          </ListCard>
        )}
      </BottomSheet>

      {pending && askKey && (
        <KeySheet
          visible
          mode="enter"
          subtitle={t('settings.backup.restoreKeySub', { date: date(pending.header.createdAt) })}
          error={pending.keyError}
          onClose={() => (setAskKey(false), setPending(null))}
          onDone={(k) => tryOpen(pending, k)}
        />
      )}

      <Dialog
        visible={!!pending?.payload}
        title={t('settings.backup.restoreConfirmTitle')}
        message={pending ? t('settings.backup.restoreConfirmMessage', { date: date(pending.header.createdAt) }) : ''}
        confirmLabel={t('settings.backup.restoreConfirm')}
        onCancel={() => setPending(null)}
        onConfirm={() => void restore()}
      />

      <Dialog
        visible={!!report}
        tone="info"
        title={t('settings.backup.restoredTitle')}
        message={report ? `${t('settings.backup.restoredMessage', { restored: report.restored, skipped: report.skipped, receipts: report.receipts })}${report.skipped ? `\n\n${t('settings.backup.skippedNote')}` : ''}` : ''}
        confirmLabel={t('common.close')}
        onCancel={() => setReport(null)}
        onConfirm={() => setReport(null)}
      />
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: space.xs },
  progress: { gap: space.sm, paddingHorizontal: space.xs },
  sheet: { gap: space.md },
});
