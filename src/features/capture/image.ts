import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** FR-OCR-1: lebar maksimal 1600 px, JPEG 80%. Struk tetap terbaca dan unggahan jauh lebih kecil. */
export const MAX_RECEIPT_WIDTH = 1600;
export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

/** `width` tidak diketahui (hasil pemindai dokumen): diukur dulu dari gambarnya. */
export async function compressReceipt(uri: string, width?: number): Promise<string> {
  const w = width ?? (await ImageManipulator.manipulate(uri).renderAsync()).width;
  const ctx = ImageManipulator.manipulate(uri);
  if (w > MAX_RECEIPT_WIDTH) ctx.resize({ width: MAX_RECEIPT_WIDTH });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return out.uri;
}
