import { useRouter } from 'expo-router';
import { CalendarDays, Camera, Check, Crown, ImagePlus, ImageUp, Pencil, Trash2, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Card, Dialog, Icon, IconTile, Input, ListCard, ListItem, PressableScale, useToast } from '@/components/ui';
import { updateProfile } from '@/data/remote/api';
import { CameraDeniedError, cropImage, pickImage, removeAvatar, saveImage, setCoverPreset, type ImageKind } from '@/features/settings/avatar';
import { CropModal } from '@/features/settings/CropModal';
import { SettingsScreen } from '@/features/settings/kit';
import { ProfileAvatar } from '@/features/settings/ProfileAvatar';
import { coverTextColors, ProfileCover } from '@/features/settings/ProfileCover';
import { useI18n } from '@/i18n';
import { COVER_PRESETS, coverFile, parseCover, type CoverPreset } from '@/lib/cover';
import { isoDateLabel } from '@/lib/dates';
import { cleanName, NAME_MAX, profileName } from '@/lib/profile';
import { useStore } from '@/state/AppStore';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme/ThemeProvider';
import type { Rect, Size } from '@/lib/crop';
import { layout, radius, space } from '@/theme/tokens';

const AVATAR = 96;
const RING = 4;
const PENCIL = 32;

/**
 * Profil: sampul (preset monokrom atau foto 3:1), foto profil (kamera/galeri, persegi), badge PRO di lingkaran foto,
 * nama tampilan (dipakai di invoice, laporan, split bill), dan info akun. Semua tulisan langsung ke server lalu ke
 * store, supaya gagal simpan terlihat di tempat (toast) dan layar tidak menampilkan nilai yang tidak tersimpan.
 */
export default function ProfilScreen() {
  const { t, lang } = useI18n();
  const { colors, scheme } = useTheme();
  const router = useRouter();
  const { state, userId, applyLocal } = useStore();
  const { session } = useSession();
  const { show } = useToast();
  const [sheet, setSheet] = useState<ImageKind | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState<ImageKind | 'remove' | null>(null);
  const [preview, setPreview] = useState<{ kind: ImageKind; uri: string } | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [cropping, setCropping] = useState<({ kind: ImageKind; uri: string } & Size) | null>(null);

  const name = profileName(state.displayName, state.email);
  const premium = state.plan === 'premium';
  const joined = session?.user.created_at;
  const nameCheck = cleanName(draft);
  const cover = parseCover(state.coverPath);
  // Pratinjau foto sampul yang sedang diunggah dihitung sebagai foto (teks terang).
  const ink = coverTextColors(preview?.kind === 'cover' ? 'photo' : state.coverPath, scheme);
  const planLine = premium
    ? state.premiumUntil
      ? t('billing.settings.until', { date: isoDateLabel(state.premiumUntil, lang) })
      : t('settings.usage.planPremium')
    : t('settings.profile.planFree');
  const failed = () => show({ tone: 'error', title: t('settings.profile.photoFailed'), message: t('settings.profile.tryAgain') });
  const photoLabel = state.avatarPath ? t('settings.profile.photoChange') : t('settings.profile.photoAdd');

  const choose = async (kind: ImageKind, source: 'camera' | 'library') => {
    setSheet(null);
    if (!userId) return;
    try {
      const picked = await pickImage(source);
      if (picked) setCropping({ kind, ...picked });
    } catch (e) {
      if (e instanceof CameraDeniedError) show({ tone: 'warning', title: t('settings.profile.cameraDenied'), message: t('settings.profile.cameraDeniedMessage') });
      else failed();
    }
  };

  const upload = async (kind: ImageKind, source: string, rect: Rect) => {
    setCropping(null);
    if (!userId) return;
    setBusy(kind);
    let uri: string;
    try {
      uri = await cropImage(source, rect, kind);
    } catch {
      setBusy(null);
      failed();
      return;
    }
    setPreview({ kind, uri });
    try {
      if (kind === 'avatar') {
        const path = await saveImage(userId, kind, uri, state.avatarPath);
        applyLocal({ type: 'profile/set', patch: { avatarPath: path } });
        show({ tone: 'success', title: t('settings.profile.photoSaved') });
      } else {
        const path = await saveImage(userId, kind, uri, coverFile(state.coverPath));
        applyLocal({ type: 'profile/set', patch: { coverPath: path } });
        show({ tone: 'success', title: t('settings.profile.coverSaved') });
      }
    } catch {
      failed();
    } finally {
      setPreview(null);
      setBusy(null);
    }
  };

  const pickPreset = async (key: CoverPreset) => {
    setSheet(null);
    if (!userId || (cover.kind === 'preset' && cover.key === key)) return;
    setBusy('cover');
    try {
      const value = await setCoverPreset(userId, key, state.coverPath);
      applyLocal({ type: 'profile/set', patch: { coverPath: value } });
      show({ tone: 'success', title: t('settings.profile.coverSaved') });
    } catch {
      failed();
    } finally {
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
      failed();
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

  return (
    <SettingsScreen title={t('settings.profile.title')}>
      {/* Sampul memenuhi kartu identitas (kartu tinta layar ini); warna teks mengikuti sampul supaya tetap 4.5:1. */}
      <Card padding={0} style={styles.heroCard}>
        <View style={[StyleSheet.absoluteFill, busy === 'cover' && styles.busy]}>
          <ProfileCover value={state.coverPath} uri={preview?.kind === 'cover' ? preview.uri : null} scrim />
        </View>
        {/* Kertas di atas sampul apa pun (tinta, batu, foto) tetap terbaca. 36 + hitSlop 4 = target 44. */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('settings.profile.coverChange')}
          focusRadius={radius.full}
          hitSlop={4}
          disabled={busy !== null}
          onPress={() => setSheet('cover')}
          containerStyle={styles.coverBtnWrap}
          style={[styles.coverBtn, { backgroundColor: colors.surface }]}
        >
          <Icon icon={ImagePlus} color={colors.text} size={layout.iconSize.sm} />
        </PressableScale>

        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <PressableScale accessibilityRole="button" accessibilityLabel={photoLabel} focusRadius={radius.full} disabled={busy !== null} onPress={() => setSheet('avatar')}>
              <View style={[styles.ring, { backgroundColor: colors.surface }, busy === 'avatar' && styles.busy]}>
                <ProfileAvatar size={AVATAR} uri={preview?.kind === 'avatar' ? preview.uri : null} />
              </View>
            </PressableScale>
            {/* Pro = ikon mahkota saja di kanan atas lingkaran; pensil (ganti foto) di kanan bawah. Cincin kertas memisahkan dari foto. */}
            {premium ? (
              <View style={[styles.dot, styles.pro, { backgroundColor: colors.accent, borderColor: colors.surface }]} accessible accessibilityLabel={t('settings.profile.proA11y')}>
                <Icon icon={Crown} color={colors.onAccent} size={14} />
              </View>
            ) : null}
            <View pointerEvents="none" style={[styles.dot, styles.pencil, { backgroundColor: colors.accent, borderColor: colors.surface }]} accessible={false}>
              <Icon icon={Pencil} color={colors.onAccent} size={14} />
            </View>
          </View>
          <View style={styles.names}>
            <AppText variant="h2" numberOfLines={2} style={[styles.center, { color: ink.text }]}>
              {name}
            </AppText>
            <AppText variant="caption" numberOfLines={1} style={{ color: ink.muted }}>
              {state.email}
            </AppText>
          </View>
        </View>
      </Card>

      <ListCard>
        <ListItem
          leading={<IconTile icon={UserRound} tone="neutral" />}
          title={t('settings.profile.name')}
          subtitle={state.displayName?.trim() || t('settings.profile.nameEmpty')}
          chevron
          divider
          onPress={() => {
            setDraft(state.displayName ?? '');
            setNameOpen(true);
          }}
        />
        <ListItem leading={<IconTile icon={Crown} tone="neutral" />} title={t('settings.profile.plan')} subtitle={planLine} chevron divider onPress={() => router.push('/pengaturan/paket')} />
        <ListItem leading={<IconTile icon={CalendarDays} tone="neutral" />} title={t('settings.profile.joined')} trailing={joined ? isoDateLabel(joined, lang) : '-'} />
      </ListCard>
      <AppText variant="caption" tone="secondary" style={styles.note}>
        {t('settings.profile.privacy')}
      </AppText>

      <BottomSheet visible={sheet === 'avatar'} onClose={() => setSheet(null)} title={t('settings.profile.photoSheet')} subtitle={t('settings.profile.privacy')}>
        <ListCard>
          {/* Ikon aksen = pilihan cara input, merah = aksi berbahaya (aturan IconTile). Kamera di web membuka pemilih berkas yang sama dengan galeri: cukup satu baris. */}
          {Platform.OS !== 'web' && <ListItem title={t('settings.profile.camera')} leading={<IconTile icon={Camera} />} divider onPress={() => void choose('avatar', 'camera')} />}
          <ListItem title={t('settings.profile.library')} leading={<IconTile icon={ImageUp} />} divider={!!state.avatarPath} onPress={() => void choose('avatar', 'library')} />
          {state.avatarPath ? (
            <ListItem
              title={t('settings.profile.remove')}
              leading={<IconTile icon={Trash2} tone="negative" />}
              onPress={() => {
                setSheet(null);
                setConfirmRemove(true);
              }}
            />
          ) : null}
        </ListCard>
      </BottomSheet>

      <BottomSheet visible={sheet === 'cover'} onClose={() => setSheet(null)} title={t('settings.profile.coverSheet')} subtitle={t('settings.profile.privacy')}>
        <View style={styles.presets} accessibilityRole="radiogroup">
          {COVER_PRESETS.map((key) => {
            const selected = cover.kind === 'preset' && cover.key === key;
            const label = t(`settings.profile.preset.${key}`);
            return (
              <PressableScale
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={label}
                focusRadius={radius.md}
                onPress={() => void pickPreset(key)}
                containerStyle={styles.presetCell}
              >
                <View style={[styles.presetThumb, { borderColor: selected ? colors.text : colors.border }]}>
                  <ProfileCover preset={key} />
                  {selected ? (
                    <View style={[styles.presetCheck, { backgroundColor: colors.surface }]}>
                      <Icon icon={Check} color={colors.text} size={12} />
                    </View>
                  ) : null}
                </View>
                <AppText variant="caption" tone={selected ? 'primary' : 'secondary'} style={styles.center}>
                  {label}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
        <ListCard>
          <ListItem
            title={t('settings.profile.coverUpload')}
            subtitle={cover.kind === 'photo' ? t('settings.profile.coverPhotoActive') : undefined}
            leading={<IconTile icon={ImageUp} />}
            onPress={() => void choose('cover', 'library')}
          />
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

      {cropping ? (
        <CropModal
          image={cropping}
          shape={cropping.kind === 'avatar' ? 'circle' : 'wide'}
          onCancel={() => setCropping(null)}
          onConfirm={(rect) => void upload(cropping.kind, cropping.uri, rect)}
        />
      ) : null}

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
  heroCard: { overflow: 'hidden' },
  coverBtnWrap: { position: 'absolute', top: space.md, right: space.md, zIndex: 1 },
  coverBtn: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xl },
  avatarWrap: { position: 'relative' },
  ring: { padding: RING, borderRadius: radius.full },
  // PRO menempel di garis lingkaran kanan atas, pensil di kanan bawah (cincin kertas memisahkan dari foto).
  dot: { position: 'absolute', width: PENCIL, height: PENCIL, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pro: { right: 2, top: 2 },
  pencil: { right: 2, bottom: 2 },
  names: { alignItems: 'center', gap: space.xxs, maxWidth: '100%' },
  center: { textAlign: 'center' },
  busy: { opacity: 0.5 },
  form: { gap: space.lg, paddingBottom: space.lg },
  note: { paddingHorizontal: space.xs },
  presets: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  presetCell: { flex: 1 },
  presetThumb: { aspectRatio: 3 / 2, borderRadius: radius.md, borderWidth: 2, overflow: 'hidden', marginBottom: space.xs },
  presetCheck: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
