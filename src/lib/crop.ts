/**
 * Matematika crop: gambar W x H ditampilkan "cover" di bingkai F, diperbesar `zoom` (1 = pas menutupi bingkai)
 * dan digeser (tx, ty) piksel layar dari tengah. Geseran selalu dijepit supaya bingkai tidak pernah kosong.
 */
export type Size = { w: number; h: number };
export type Rect = { originX: number; originY: number; width: number; height: number };

export const ZOOM_MAX = 4;

export function displayScale(img: Size, frame: Size, zoom: number): number {
  return Math.max(frame.w / img.w, frame.h / img.h) * zoom;
}

/** Geseran maksimum: separuh kelebihan gambar terhadap bingkai di tiap sumbu. */
export function clampOffset(img: Size, frame: Size, zoom: number, tx: number, ty: number): { tx: number; ty: number } {
  const s = displayScale(img, frame, zoom);
  const mx = Math.max(0, (img.w * s - frame.w) / 2);
  const my = Math.max(0, (img.h * s - frame.h) / 2);
  return { tx: Math.min(mx, Math.max(-mx, tx)), ty: Math.min(my, Math.max(-my, ty)) };
}

/** Potongan di piksel gambar asli untuk keadaan layar sekarang (dibulatkan, selalu di dalam gambar). */
export function cropRect(img: Size, frame: Size, zoom: number, tx: number, ty: number): Rect {
  const s = displayScale(img, frame, zoom);
  const o = clampOffset(img, frame, zoom, tx, ty);
  const width = Math.min(img.w, Math.round(frame.w / s));
  const height = Math.min(img.h, Math.round(frame.h / s));
  const originX = Math.min(img.w - width, Math.max(0, Math.round(img.w / 2 - frame.w / (2 * s) - o.tx / s)));
  const originY = Math.min(img.h - height, Math.max(0, Math.round(img.h / 2 - frame.h / (2 * s) - o.ty / s)));
  return { originX, originY, width, height };
}
