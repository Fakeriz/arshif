/**
 * Tawaran Pro sekali, tepat setelah setup selesai (bukan di layar Masuk): pengguna baru melihat aplikasinya dulu,
 * baru ditawari. Hanya di memori: muat ulang aplikasi tidak menawarkan lagi.
 */
let pending = false;

export function queueProOffer(): void {
  pending = true;
}

/** true sekali saja setelah queueProOffer. */
export function takeProOffer(): boolean {
  const v = pending;
  pending = false;
  return v;
}
