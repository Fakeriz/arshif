import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { discardPrivate, uploadPrivate } from '@/data/remote/upload';
import { updateAccountCardStyle, updateProfile } from '@/data/remote/api';
import { CARD_RATIO, cardPhotoFile, photoCardStyle } from '@/lib/cardFace';
import { coverFile, presetValue, type CoverPreset } from '@/lib/cover';
import type { Rect, Size } from '@/lib/crop';
import { primeSignedUrl } from '@/lib/signedAvatarUrl';

export type ImageKind = 'avatar' | 'cover';

/** Foto profil persegi 512; sampul 2:1 1200x600 (= rasio kartu profil, cukup tajam untuk ponsel @3x). */
const SHAPE: Record<ImageKind, { aspect: [number, number]; width: number; column: 'avatar_path' | 'cover_path' }> = {
  avatar: { aspect: [1, 1], width: 512, column: 'avatar_path' },
  cover: { aspect: [2, 1], width: 1200, column: 'cover_path' },
};
const MAX_BYTES = 2 * 1024 * 1024;

export class CameraDeniedError extends Error {
  constructor() {
    super('camera_denied');
  }
}

// Foto kamera 12-50 MP diperkecil dulu: crop tetap tajam, memori dan waktu proses jauh lebih kecil.
const WORK_MAX = 2400;

/**
 * Pilih foto dari kamera/galeri. Tanpa crop bawaan sistem (web tidak punya; iOS hanya persegi):
 * crop dilakukan di CropModal. Foto dinormalkan lewat manipulator (orientasi EXIF diterapkan, sisi terpanjang
 * maks 2400 px) supaya ukuran yang dipakai crop sama dengan piksel sebenarnya. Batal = null.
 */
export async function pickImage(source: 'camera' | 'library'): Promise<{ uri: string } & Size | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new CameraDeniedError();
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const r = await (source === 'camera' ? ImagePicker.launchCameraAsync(opts) : ImagePicker.launchImageLibraryAsync(opts));
  const a = r.canceled ? undefined : r.assets[0];
  if (!a) return null;
  const ctx = ImageManipulator.manipulate(a.uri);
  const big = Math.max(a.width, a.height);
  if (big > WORK_MAX) ctx.resize(a.width >= a.height ? { width: WORK_MAX } : { height: WORK_MAX });
  const out = await (await ctx.renderAsync()).saveAsync({ compress: 0.92, format: SaveFormat.JPEG });
  return { uri: out.uri, w: out.width, h: out.height };
}

/** Potong sesuai pilihan di CropModal, kecilkan ke ukuran akhir, JPEG 80%. */
export async function cropImage(uri: string, rect: Rect, kind: ImageKind): Promise<string> {
  const { aspect, width } = SHAPE[kind];
  const ctx = ImageManipulator.manipulate(uri);
  ctx.crop(rect);
  if (rect.width > width) ctx.resize({ width, height: Math.round((width * aspect[1]) / aspect[0]) });
  const out = await (await ctx.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return out.uri;
}

/**
 * Unggah foto lalu tulis path-nya ke profil. Berkas lama dihapus SETELAH profil menunjuk berkas baru;
 * profil gagal disimpan = berkas baru dibuang, yang lama tetap. `oldFile` = path berkas lama (bukan preset). Hasil: path baru.
 */
export async function saveImage(userId: string, kind: ImageKind, uri: string, oldFile: string | null): Promise<string> {
  const path = await uploadPrivate({ bucket: 'avatars', userId, uri, ext: 'jpg', contentType: 'image/jpeg', maxBytes: MAX_BYTES });
  try {
    await updateProfile(userId, { [SHAPE[kind].column]: path });
  } catch (e) {
    await discardPrivate('avatars', path);
    throw e;
  }
  if (oldFile) await discardPrivate('avatars', oldFile);
  return path;
}

/** Pilih preset sampul; foto sampul lama (bila ada) dibuang setelah tersimpan. Hasil: nilai kolom baru. */
export async function setCoverPreset(userId: string, key: CoverPreset, old: string | null): Promise<string> {
  const value = presetValue(key);
  await updateProfile(userId, { cover_path: value });
  const file = coverFile(old);
  if (file) await discardPrivate('avatars', file);
  return value;
}

/** Hapus foto: profil dikosongkan dulu, baru berkasnya (gagal hapus berkas diabaikan, folder dibersihkan saat hapus akun). */
export async function removeAvatar(userId: string, path: string): Promise<void> {
  await updateProfile(userId, { avatar_path: null });
  await discardPrivate('avatars', path);
}

const CARD_EXPORT_W = 1280;

/** Potong gambar kartu ke rasio ISO 1.586:1 (maks lebar 1280 px, JPEG 82%). */
export async function cropCardImage(uri: string, rect: Rect): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.crop(rect);
  if (rect.width > CARD_EXPORT_W) ctx.resize({ width: CARD_EXPORT_W, height: Math.round(CARD_EXPORT_W / CARD_RATIO) });
  const out = await (await ctx.renderAsync()).saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return out.uri;
}

/**
 * Unggah gambar kartu ke bucket avatars lalu simpan `photo:<path>` ke akun.
 * Berkas foto lama (bila ada) dihapus SETELAH baris akun menunjuk berkas baru.
 */
export async function saveAccountCardPhoto(
  userId: string,
  accountId: string,
  uri: string,
  oldCardStyle?: string | null,
): Promise<string> {
  const path = await uploadPrivate({ bucket: 'avatars', userId, uri, ext: 'jpg', contentType: 'image/jpeg', maxBytes: MAX_BYTES });
  const nextStyle = photoCardStyle(path);
  try {
    await updateAccountCardStyle(accountId, nextStyle);
  } catch (e) {
    await discardPrivate('avatars', path);
    throw e;
  }
  primeSignedUrl(path, uri);
  const oldFile = cardPhotoFile(oldCardStyle);
  if (oldFile && oldFile !== path) await discardPrivate('avatars', oldFile);
  return nextStyle;
}

/** Unggah gambar kartu untuk draf akun baru sebelum insertAccount; pemanggil membuangnya bila insert gagal. */
export async function uploadCardPhotoDraft(userId: string, uri: string): Promise<{ path: string; cardStyle: string }> {
  const path = await uploadPrivate({ bucket: 'avatars', userId, uri, ext: 'jpg', contentType: 'image/jpeg', maxBytes: MAX_BYTES });
  primeSignedUrl(path, uri);
  return { path, cardStyle: photoCardStyle(path) };
}
