import { useRouter } from 'expo-router';
import { CalendarDays, Camera, Check, Crown, ImagePlus, ImageUp, Pencil, Trash2, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Card, Dialog, Icon, IconTile, Input, ListCard, ListItem, PressableScale, useToast } from '@/components/ui';
import { updateProfile } from '@/data/remote/api';
import { CameraDeniedError, cropImage, pickImage, removeAvatar, saveImage, setCoverPreset, type ImageKind } from '@/features/settings/avatar';
import { afterSheetClose, HeaderMenu, MenuRow, type HeaderAction } from '@/components/shell/HeaderActions';
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
import { radius, space } from '@/theme/tokens';

// Kartu identitas 2:1 = rasio file sampul (crop 2:1), jadi yang dipotong pengguna sama dengan yang tampil.
// Isi (16 + 90 + 8 + 46 + 16 = 176) muat di kartu 2:1 selebar 358 (ponsel 390); layar lebih sempit = kartu memanjang.
const AVATAR = 84;
const RING = 3;
const DOT = 26;
const EDIT_BTN = 30;

/**
 * Profil: sampul penuh kartu 2:1 (preset monokrom atau foto), foto profil (kamera/galeri, crop lingkaran), ikon Pro di lingkaran foto,
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
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState<ImageKind | 'remove' | null>(null);
  const [preview, setPreview] = useState<{ kind: ImageKind; uri: string } | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [cardW, setCardW] = useState(0);
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

  const choose = async (kind: ImageKind, source: 'camera' | 'library') => {
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
      <View onLayout={(e) => setCardW(e.nativeEvent.layout.width)}>
      <Card padding={0} style={[styles.heroCard, cardW ? { minHeight: cardW / 2 } : null]}>
        <View style={[StyleSheet.absoluteFill, busy === 'cover' && styles.busy]}>
          <ProfileCover value={state.coverPath} uri={preview?.kind === 'cover' ? preview.uri : null} scrim />
        </View>
        {/* Satu pintu ubah foto profil + sampul: pensil kaca di pojok sampul membuka menu aksi melayang (pola menu titik tiga). */}
        <View style={styles.editWrap}>
          <HeaderMenu
            trigger={(show, open) => (
              // 30 + hitSlop 7 = target sentuh 44. Kaca transparan: warna teks sampul 20% + garis 35%, terbaca di sampul apa pun.
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('settings.profile.editA11y')}
                accessibilityState={{ expanded: open, busy: busy !== null }}
                focusRadius={radius.full}
                hitSlop={7}
                disabled={busy !== null}
                onPress={show}
                style={[styles.editBtn, { backgroundColor: `${ink.text}${open ? '4D' : '33'}`, borderColor: `${ink.text}59` }]}
              >
                <Icon icon={Pencil} color={ink.text} size={14} />
              </PressableScale>
            )}
          >
            {(close) => {
              const run = (fn: () => void) => () => {
                close();
                afterSheetClose(fn);
              };
              const rows: HeaderAction[] = [
                { key: 'lib', label: t('settings.profile.avatarLibrary'), icon: ImageUp, onPress: () => void choose('avatar', 'library') },
                // Kamera di web membuka pemilih berkas yang sama dengan galeri: cukup satu baris.
                ...(Platform.OS !== 'web' ? [{ key: 'cam', label: t('settings.profile.avatarCamera'), icon: Camera, onPress: () => void choose('avatar', 'camera') }] : []),
                ...(state.avatarPath ? [{ key: 'del', label: t('settings.profile.remove'), icon: Trash2, danger: true, onPress: () => setConfirmRemove(true) }] : []),
              ];
              return (
                <>
                  {rows.map((a, i) => (
                    <MenuRow key={a.key} action={a} divider={i < rows.length - 1} onPress={run(a.onPress)} />
                  ))}
                  <View style={[styles.menuSection, { borderTopColor: colors.border }]}>
                    <AppText variant="caption" tone="secondary">
                      {t('settings.profile.coverSection')}
                    </AppText>
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
                            focusRadius={radius.sm}
                            onPress={run(() => void pickPreset(key))}
                            containerStyle={styles.presetCell}
                          >
                            <View style={[styles.presetThumb, { borderColor: selected ? colors.text : colors.border }]}>
                              <ProfileCover preset={key} />
                              {selected ? (
                                <View style={[styles.presetCheck, { backgroundColor: colors.surface }]}>
                                  <Icon icon={Check} color={colors.text} size={10} />
                                </View>
                              ) : null}
                            </View>
                          </PressableScale>
                        );
                      })}
                    </View>
                  </View>
                  <MenuRow action={{ key: 'cover', label: t('settings.profile.coverUpload'), icon: ImagePlus, onPress: () => void choose('cover', 'library') }} divider={false} onPress={run(() => void choose('cover', 'library'))} />
                </>
              );
            }}
          </HeaderMenu>
        </View>

        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <View style={[styles.ring, { backgroundColor: colors.surface }, busy === 'avatar' && styles.busy]}>
              <ProfileAvatar size={AVATAR} uri={preview?.kind === 'avatar' ? preview.uri : null} />
            </View>
            {/* Pro = ikon mahkota saja di kanan atas lingkaran; cincin kertas memisahkan dari foto. */}
            {premium ? (
              <View style={[styles.dot, styles.pro, { backgroundColor: colors.accent, borderColor: colors.surface }]} accessible accessibilityLabel={t('settings.profile.proA11y')}>
                <Icon icon={Crown} color={colors.onAccent} size={12} />
              </View>
            ) : null}
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
      </View>

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
  heroCard: { overflow: 'hidden', justifyContent: 'center' },
  editWrap: { position: 'absolute', top: space.md, right: space.md, zIndex: 1 },
  editBtn: { width: EDIT_BTN, height: EDIT_BTN, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.lg },
  avatarWrap: { position: 'relative' },
  ring: { padding: RING, borderRadius: radius.full },
  // PRO menempel di garis lingkaran kanan atas, pensil di kanan bawah (cincin kertas memisahkan dari foto).
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pro: { right: 2, top: 2 },
  names: { alignItems: 'center', gap: space.xxs, maxWidth: '100%' },
  center: { textAlign: 'center' },
  busy: { opacity: 0.5 },
  form: { gap: space.lg, paddingBottom: space.lg },
  note: { paddingHorizontal: space.xs },
  menuSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm, gap: space.sm },
  presets: { flexDirection: 'row', gap: space.sm },
  presetCell: { flex: 1 },
  // Thumbnail 2:1 = rasio sampul sebenarnya.
  presetThumb: { aspectRatio: 2, borderRadius: radius.sm, borderWidth: 2, overflow: 'hidden' },
  presetCheck: { position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
