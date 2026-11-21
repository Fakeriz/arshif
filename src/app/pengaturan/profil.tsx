import { Camera, ImageUp, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText, Badge, BottomSheet, Button, Card, Dialog, IconTile, Input, ListCard, ListItem, PressableScale, useToast } from '@/components/ui';
import { updateProfile } from '@/data/remote/api';
import { CameraDeniedError, pickAvatar, removeAvatar, saveAvatar } from '@/features/settings/avatar';
import { SettingsScreen } from '@/features/settings/kit';
import { ProfileAvatar } from '@/features/settings/ProfileAvatar';
import { useI18n } from '@/i18n';
import { isoDateLabel } from '@/lib/dates';
import { cleanName, NAME_MAX, profileName } from '@/lib/profile';
import { useStore } from '@/state/AppStore';
import { useSession } from '@/state/session';
import { radius, space } from '@/theme/tokens';

const AVATAR = 96;

/**
 * Profil: foto (kamera/galeri, potong persegi, bucket privat), nama tampilan (dipakai di invoice, laporan, split bill),
 * dan info akun yang hanya dibaca (email masuk, tanggal bergabung). Semua tulisan langsung ke server lalu ke store,
 * supaya gagal simpan terlihat di tempat (toast) dan layar tidak menampilkan nilai yang tidak tersimpan.
 */
export default function ProfilScreen() {
  const { t, lang } = useI18n();
  const { state, userId, applyLocal } = useStore();
  const { session } = useSession();
  const { show } = useToast();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  const name = profileName(state.displayName, state.email);
  const premium = state.plan === 'premium';
  const joined = session?.user.created_at;
  const nameCheck = cleanName(draft);
  const photoFailed = () => show({ tone: 'error', title: t('settings.profile.photoFailed'), message: t('settings.profile.tryAgain') });

  const choose = async (source: 'camera' | 'library') => {
    setPhotoOpen(false);
    if (!userId) return;
    let uri: string | null;
    try {
      uri = await pickAvatar(source);
    } catch (e) {
      if (e instanceof CameraDeniedError) show({ tone: 'warning', title: t('settings.profile.cameraDenied'), message: t('settings.profile.cameraDeniedMessage') });
      else photoFailed();
      return;
    }
    if (!uri) return;
    setPreview(uri);
    setBusy('upload');
    try {
      const path = await saveAvatar(userId, uri, state.avatarPath);
      applyLocal({ type: 'profile/set', patch: { avatarPath: path } });
      show({ tone: 'success', title: t('settings.profile.photoSaved') });
    } catch {
      photoFailed();
    } finally {
      setPreview(null);
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!userId || !state.avatarPath) return;
    setBusy('remove');
    try {
      await removeAvatar(userId, state.avatarPath);
      applyLocal({ type: 'profile/set', patch: { avatarPath: null } });
      show({ tone: 'success', title: t('settings.profile.photoRemoved') });
    } catch {
      photoFailed();
    } finally {
      setConfirmRemove(false);
      setBusy(null);
    }
  };

  const saveName = async () => {
    if (!userId || nameCheck === 'too_long') return;
    setSavingName(true);
    try {
      await updateProfile(userId, { display_name: nameCheck });
      applyLocal({ type: 'profile/set', patch: { displayName: nameCheck } });
      setNameOpen(false);
      show({ tone: 'success', title: t('settings.profile.nameSaved') });
    } catch {
      show({ tone: 'error', title: t('settings.profile.nameFailed'), message: t('settings.profile.tryAgain') });
    } finally {
      setSavingName(false);
    }
  };

  const photoLabel = state.avatarPath ? t('settings.profile.photoChange') : t('settings.profile.photoAdd');

  return (
    <SettingsScreen title={t('settings.profile.title')}>
      {/* Titik fokus layar: identitas. Foto bisa diketuk langsung, tombol di bawahnya untuk yang tidak tahu fotonya bisa diketuk. */}
      <Card>
        <View style={styles.hero}>
          <PressableScale accessibilityRole="button" accessibilityLabel={photoLabel} focusRadius={radius.full} onPress={() => setPhotoOpen(true)} disabled={busy !== null}>
            <View style={busy ? styles.busy : undefined}>
              <ProfileAvatar size={AVATAR} uri={preview} />
            </View>
          </PressableScale>
          <View style={styles.names}>
            <AppText variant="h2" numberOfLines={2} style={styles.center}>
              {name}
            </AppText>
            <AppText variant="caption" tone="secondary" numberOfLines={1}>
              {state.email}
            </AppText>
          </View>
          <Badge label={premium ? t('settings.usage.planPremium') : t('settings.usage.planFree')} tone={premium ? 'accent' : 'neutral'} />
          <Button
            label={busy === 'upload' ? t('settings.profile.uploading') : photoLabel}
            icon={Camera}
            variant="secondary"
            size="sm"
            loading={busy === 'upload'}
            disabled={busy !== null}
            onPress={() => setPhotoOpen(true)}
          />
        </View>
      </Card>

      <ListCard>
        <ListItem
          title={t('settings.profile.name')}
          subtitle={state.displayName?.trim() || t('settings.profile.nameEmpty')}
          chevron
          divider
          onPress={() => {
            setDraft(state.displayName ?? '');
            setNameOpen(true);
          }}
        />
        <ListItem title={t('settings.profile.email')} subtitle={state.email} divider />
        <ListItem title={t('settings.profile.joined')} trailing={joined ? isoDateLabel(joined, lang) : '-'} />
      </ListCard>
      <AppText variant="caption" tone="secondary" style={styles.note}>
        {t('settings.profile.privacy')}
      </AppText>

      <BottomSheet visible={photoOpen} onClose={() => setPhotoOpen(false)} title={t('settings.profile.photoSheet')} subtitle={t('settings.profile.privacy')}>
        <ListCard>
          {/* Ikon aksen = pilihan cara input, merah = aksi berbahaya (aturan IconTile). Kamera di web membuka pemilih berkas yang sama dengan galeri: cukup satu baris. */}
          {Platform.OS !== 'web' && <ListItem title={t('settings.profile.camera')} leading={<IconTile icon={Camera} />} divider onPress={() => void choose('camera')} />}
          <ListItem title={t('settings.profile.library')} leading={<IconTile icon={ImageUp} />} divider={!!state.avatarPath} onPress={() => void choose('library')} />
          {state.avatarPath ? (
            <ListItem
              title={t('settings.profile.remove')}
              leading={<IconTile icon={Trash2} tone="negative" />}
              onPress={() => {
                setPhotoOpen(false);
                setConfirmRemove(true);
              }}
            />
          ) : null}
        </ListCard>
      </BottomSheet>

      <BottomSheet visible={nameOpen} onClose={() => setNameOpen(false)} title={t('settings.profile.name')}>
        <View style={styles.form}>
          <Input
            label={t('settings.profile.name')}
            value={draft}
            onChangeText={setDraft}
            placeholder={state.email.split('@')[0]}
            maxLength={NAME_MAX + 20}
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="done"
            onSubmitEditing={() => void saveName()}
            error={nameCheck === 'too_long' ? t('settings.profile.nameTooLong', { max: NAME_MAX }) : undefined}
            hint={nameCheck === 'too_long' ? undefined : t('settings.profile.nameHint')}
          />
          <Button label={t('common.save')} fullWidth loading={savingName} disabled={savingName || nameCheck === 'too_long'} onPress={() => void saveName()} />
        </View>
      </BottomSheet>

      <Dialog
        visible={confirmRemove}
        tone="danger"
        title={t('settings.profile.removeTitle')}
        message={t('settings.profile.removeMessage')}
        confirmLabel={t('settings.profile.remove')}
        loading={busy === 'remove'}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => void remove()}
      />
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  names: { alignItems: 'center', gap: space.xxs, maxWidth: '100%' },
  center: { textAlign: 'center' },
  busy: { opacity: 0.5 },
  form: { gap: space.lg, paddingBottom: space.lg },
  note: { paddingHorizontal: space.xs },
});
