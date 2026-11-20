/**
 * Ganti tema dengan lingkaran yang membesar dari titik ketuk terakhir (gerak Talmo).
 * Browser tanpa View Transitions atau dengan reduced motion: langsung berganti.
 */
let last = { x: 0, y: 0 };
let installed = false;

function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  addEventListener('pointerdown', (e) => (last = { x: e.clientX, y: e.clientY }), { capture: true, passive: true });
  const style = document.createElement('style');
  // Animasi bawaan (crossfade) dimatikan; lingkaran di bawah yang menggantikannya.
  style.textContent = '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}';
  document.head.appendChild(style);
}
// Dipasang saat modul dimuat, supaya ketukan pertama yang mengganti tema sudah tercatat posisinya.
install();

export function withThemeTransition(apply: () => void) {
  install();
  const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => { ready: Promise<void> } };
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply();
    return;
  }
  const { x, y } = last.x || last.y ? last : { x: innerWidth / 2, y: 0 };
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  doc
    // Snapshot baru diambil setelah React merender tema baru (dua frame).
    .startViewTransition(() => {
      apply();
      return new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
    })
    .ready.then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'cubic-bezier(.22, 1, .36, 1)', pseudoElement: '::view-transition-new(root)' },
      ),
    )
    .catch(() => undefined);
}
