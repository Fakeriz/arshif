import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { discardPrivate, uploadPrivate } from '@/data/remote/upload';
import { updateProfile } from '@/data/remote/api';
import { coverFile, presetValue, type CoverPreset } from '@/lib/cover';

export type ImageKind = 'avatar' | 'cover';

/** Foto profil persegi 512; sampul 3:1 1200x400 (cukup tajam untuk lebar layar ponsel @3x). */
const SHAPE: Record<ImageKind, { aspect: [number, number]; width: number; column: 'avatar_path' | 'cover_path' }> = {
  avatar: { aspect: [1, 1], width: 512, column: 'avatar_path' },
  cover: { aspect: [3, 1], width: 1200, column: 'cover_path' },
};
const MAX_BYTES = 2 * 1024 * 1024;

export class CameraDeniedError extends Error {
  constructor() {
    super('camera_denied');
  }
}

/** Potongan tengah terbesar dengan rasio w:h di dalam gambar W x H. */
export function centerCrop(W: number, H: number, [w, h]: [number, number]) {
  const r = w / h;
  const width = W / H > r ? Math.round(H * r) : W;
  const height = W / H > r ? H : Math.round(W / r);
  return { originX: Math.floor((W - width) / 2), originY: Math.floor((H - height) / 2), width, height };
}

/**
 * Pilih foto dari kamera/galeri, potong tengah sesuai bentuknya, kecilkan, simpan JPEG 80%.
 * Native sudah menawarkan potong (allowsEditing); web tidak, jadi potong tengah selalu dilakukan di sini. Batal = null.
 */
export async function pickImage(source: 'camera' | 'library', kind: ImageKind): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new CameraDeniedError();
  }
  const { aspect, width } = SHAPE[kind];
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect, quality: 1 };
  const r = await (source === 'camera' ? ImagePicker.launchCameraAsync(opts) : ImagePicker.launchImageLibraryAsync(opts));
  const a = r.canceled ? undefined : r.assets[0];
  if (!a) return null;
  const crop = centerCrop(a.width, a.height, aspect);
  const ctx = ImageManipulator.manipulate(a.uri);
  ctx.crop(crop);
  if (crop.width > width) ctx.resize({ width, height: Math.round((width * aspect[1]) / aspect[0]) });
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
