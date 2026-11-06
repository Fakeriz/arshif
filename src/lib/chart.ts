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

/**
 * Titik grafik garis: nilai pertama di kiri, terakhir di kanan, dengan ruang `pad` di atas dan bawah.
 * Nilai yang sama semua digambar di tengah (garis datar).
 */
export function linePoints(values: number[], width: number, height: number, pad = 8): { x: number; y: number }[] {
  if (values.length === 0 || width <= 0 || height <= 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const inner = Math.max(0, height - pad * 2);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: values.length > 1 ? i * step : width / 2,
    y: span === 0 ? height / 2 : pad + inner - ((v - min) / span) * inner,
  }));
}

/**
 * Path garis halus (Catmull-Rom → Bézier kubik) lewat semua titik. Kontrol dijepit ke rentang y
 * tetangga agar kurva tidak melewati puncak/lembah data (tanpa "overshoot").
 */
export function smoothPath(points: Point[], tension = 0.5): string {
  if (points.length === 0) return '';
  const f = (n: number) => n.toFixed(2);
  if (points.length === 1) return `M ${f(points[0].x)} ${f(points[0].y)}`;
  const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  let d = `M ${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const k = tension / 3;
    const c1 = { x: p1.x + (p2.x - p0.x) * k, y: clamp(p1.y + (p2.y - p0.y) * k, p1.y, p2.y) };
    const c2 = { x: p2.x - (p3.x - p1.x) * k, y: clamp(p2.y - (p3.y - p1.y) * k, p1.y, p2.y) };
    d += ` C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

/** Tutup path garis ke dasar grafik untuk isian area di bawahnya. */
export function areaUnder(line: string, points: Point[], baseY: number): string {
  if (points.length === 0) return '';
  const last = points[points.length - 1];
  return `${line} L ${last.x.toFixed(2)} ${baseY.toFixed(2)} L ${points[0].x.toFixed(2)} ${baseY.toFixed(2)} Z`;
}

/** Perubahan relatif dari `prev` ke `curr` (0.124 = naik 12,4%). Tanpa pembanding (prev 0) → null. */
export function pctChange(prev: number, curr: number): number | null {
  if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev === 0) return null;
  return (curr - prev) / Math.abs(prev);
}

/** Lingkaran progres: panjang garis terisi untuk rasio 0–1 (dijepit) pada jari-jari r. */
export function ringDash(ratio: number, r: number): { circumference: number; filled: number } {
  const circumference = 2 * Math.PI * r;
  const clamped = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : 0;
  return { circumference, filled: circumference * clamped };
}

/** Panjang garis lewat titik-titik (batas bawah panjang kurva halus); untuk animasi "menggambar" garis. */
export function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return len;
}
