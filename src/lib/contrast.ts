/** Rasio kontras WCAG 2.x. Mendukung #RRGGBB dan rgba() (dikomposit ke latar opaque). */

type RGB = { r: number; g: number; b: number };
type RGBA = RGB & { a: number };

export function parseColor(color: string): RGBA {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(color);
  if (rgba) {
    return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] };
  }
  throw new Error(`Format warna tidak didukung: ${color}`);
}

function toHex({ r, g, b }: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Komposit warna (boleh translusen) di atas latar opaque → #RRGGBB. */
export function composite(top: string, bottom: string): string {
  const t = parseColor(top);
  const b = parseColor(bottom);
  if (b.a !== 1) throw new Error('Latar komposit harus opaque');
  return toHex({
    r: t.r * t.a + b.r * (1 - t.a),
    g: t.g * t.a + b.g * (1 - t.a),
    b: t.b * t.a + b.b * (1 - t.a),
  });
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function luminance(color: string): number {
  const { r, g, b, a } = parseColor(color);
  if (a !== 1) throw new Error(`Komposit dulu warna translusen: ${color}`);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Rona (0–360°) untuk membedakan dua warna semantik. */
export function hue(color: string): number {
  const { r, g, b } = parseColor(color);
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  if (d === 0) return 0;
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
