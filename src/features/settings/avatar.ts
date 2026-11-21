import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { discardPrivate, uploadPrivate } from '@/data/remote/upload';
import { updateProfile } from '@/data/remote/api';

export const AVATAR_SIZE = 512;
const MAX_BYTES = 2 * 1024 * 1024;

export class CameraDeniedError extends Error {
  constructor() {
    super('camera_denied');
  }
}

/**
 * Pilih foto dari kamera/galeri, lalu potong persegi di tengah dan kecilkan ke 512 px JPEG.
 * Native sudah menawarkan potong persegi (allowsEditing); web tidak, jadi potong tengah selalu dilakukan di sini.
 * Batal = null.
 */
export async function pickAvatar(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new CameraDeniedError();
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const r = await (source === 'camera' ? ImagePicker.launchCameraAsync(opts) : ImagePicker.launchImageLibraryAsync(opts));
  const a = r.canceled ? undefined : r.assets[0];
  if (!a) return null;
  const side = Math.min(a.width, a.height);
  const ctx = ImageManipulator.manipulate(a.uri);
  ctx.crop({ originX: Math.floor((a.width - side) / 2), originY: Math.floor((a.height - side) / 2), width: side, height: side });
  if (side > AVATAR_SIZE) ctx.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  const out = await (await ctx.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return out.uri;
}

/**
 * Unggah foto baru lalu tulis path-nya ke profil. Foto lama dihapus SETELAH profil menunjuk foto baru;
 * profil gagal disimpan = berkas baru dibuang, foto lama tetap. Mengembalikan path baru.
 */
export async function saveAvatar(userId: string, uri: string, oldPath: string | null): Promise<string> {
  const path = await uploadPrivate({ bucket: 'avatars', userId, uri, ext: 'jpg', contentType: 'image/jpeg', maxBytes: MAX_BYTES });
  try {
    await updateProfile(userId, { avatar_path: path });
  } catch (e) {
    await discardPrivate('avatars', path);
    throw e;
  }
  if (oldPath) await discardPrivate('avatars', oldPath);
  return path;
}

/** Hapus foto: profil dikosongkan dulu, baru berkasnya (gagal hapus berkas diabaikan, folder dibersihkan saat hapus akun). */
export async function removeAvatar(userId: string, path: string): Promise<void> {
  await updateProfile(userId, { avatar_path: null });
  await discardPrivate('avatars', path);
}
