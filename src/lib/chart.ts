/** Geometri grafik murni (tanpa React) agar bisa dites. */

export type Point = { x: number; y: number };

export function polar(cx: number, cy: number, r: number, angleDeg: number): Point {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Path sektor cincin (annular sector) terisi — dipakai donat agar area sentuh andal.
 * Sudut 0° = arah jam 12, searah jarum jam.
 */
export function annularSector(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = Math.min(endDeg - startDeg, 359.999);
  const end = startDeg + sweep;
  const large = sweep > 180 ? 1 : 0;
  const o1 = polar(cx, cy, rOuter, startDeg);
  const o2 = polar(cx, cy, rOuter, end);
  const i1 = polar(cx, cy, rInner, end);
  const i2 = polar(cx, cy, rInner, startDeg);
  const f = (n: number) => n.toFixed(3);
  return [
    `M ${f(o1.x)} ${f(o1.y)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${f(o2.x)} ${f(o2.y)}`,
    `L ${f(i1.x)} ${f(i1.y)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${f(i2.x)} ${f(i2.y)}`,
    'Z',
  ].join(' ');
}

export type Slice = { start: number; end: number; share: number };

/** Bagi 360° sesuai nilai; celah antar-segmen dalam derajat. Nilai ≤ 0 diabaikan (share 0). */
export function donutSlices(values: number[], gapDeg = 2): Slice[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return values.map(() => ({ start: 0, end: 0, share: 0 }));
  const active = values.filter((v) => v > 0).length;
  const gap = active > 1 ? gapDeg : 0;
  let cursor = 0;
  return values.map((v) => {
    const share = Math.max(0, v) / total;
    const sweep = share * 360;
    const slice = share > 0
      ? { start: cursor + gap / 2, end: cursor + Math.max(sweep - gap / 2, gap / 2 + 0.5), share }
      : { start: cursor, end: cursor, share: 0 };
    cursor += sweep;
    return slice;
  });
}

/** Path busur (stroke) setengah lingkaran untuk gauge: dari 180° kiri ke kanan. */
export function semicircleArc(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
}

/** Label: `domain.healthBand.<key>`. */
export type HealthBand = { min: number; key: 'excellent' | 'good' | 'fair' | 'attention'; tone: 'negative' | 'warning' | 'positive' | 'accent' };

export const HEALTH_BANDS: HealthBand[] = [
  { min: 85, key: 'excellent', tone: 'accent' },
  { min: 70, key: 'good', tone: 'positive' },
  { min: 40, key: 'fair', tone: 'warning' },
  { min: 0, key: 'attention', tone: 'negative' },
];

export function healthBand(score: number): HealthBand {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return HEALTH_BANDS.find((b) => s >= b.min)!;
}

/** Batas atas sumbu Y yang "rapi" (1, 2, 2.5, 5 × 10^n) di atas nilai maksimum. */
export function niceCeil(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const steps = [1, 2, 2.5, 5, 10];
  const step = steps.find((s) => s * exp >= max)!;
  return step * exp;
}
