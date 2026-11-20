/** Native: tema langsung berganti (gerak lingkaran hanya di web, lihat viewTransition.web.ts). */
export function withThemeTransition(apply: () => void) {
  apply();
}
