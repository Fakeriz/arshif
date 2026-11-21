/**
 * Geometri tumpukan dompet (Akun & kartu). Semua fungsi murni dari posisi `p` (indeks kartu depan, pecahan saat digeser),
 * jadi jari, pegas, dan sela gestur memakai rumus yang sama. Ditandai 'worklet' supaya jalan di thread UI Reanimated.
 *
 * d = mod(j - p, n) ∈ [0, n). d = 0: kartu depan. 0 < d ≤ n-1: menumpuk di belakang, mengintip di atas, makin kecil,
 * gelap, dan miring. n-1 < d < n: kartu yang sedang digeser keluar ke kiri lalu menyelinap ke belakang tumpukan.
 */
export const PEEK = 64; // tinggi strip yang terlihat di daftar tumpukan
export const OPEN_TOP = 28; // ruang di atas kartu depan untuk intipan lapis belakang
export const GAP = 14; // jarak antar-kartu saat digeser ke samping
const DEPTH = 3; // lapis belakang yang masih terlihat
const LIFT = 8; // tinggi intipan tiap lapis
const TILT = 2.2; // derajat kemiringan tiap lapis

export type Pose = { x: number; y: number; scale: number; rotate: number; rotateY: number; opacity: number; shade: number; z: number };

export function clamp(v: number, a: number, b: number): number {
  'worklet';
  return Math.min(b, Math.max(a, v));
}

/** Modulo yang selalu positif: tumpukan berputar, indeks dibungkus ke 0..n-1. */
export function mod(a: number, n: number): number {
  'worklet';
  return ((a % n) + n) % n;
}

/** Jarak melingkar antara posisi `p` dan indeks `j` (0..n/2). */
export function ringDist(j: number, p: number, n: number): number {
  'worklet';
  const d = mod(j - p, n);
  return Math.min(d, n - d);
}

/** Karet: makin jauh ditarik, makin berat. Batas `max`. */
export function rubber(v: number, max: number, k = 1): number {
  'worklet';
  return max * (1 - 1 / (1 + (Math.abs(v) * k) / max)) * Math.sign(v);
}

function layerPose(d: number, h: number): Pose {
  'worklet';
  const k = Math.min(d, DEPTH);
  const scale = 1 - k * 0.05;
  return {
    x: k * 4,
    // Skala menyusut dari tengah; naikkan sebesar susutnya supaya tiap lapis tetap mengintip LIFT px.
    y: OPEN_TOP - k * LIFT - ((1 - scale) * h) / 2,
    scale,
    rotate: -k * TILT,
    rotateY: 0,
    opacity: 1 - clamp(d - DEPTH, 0, 1),
    shade: k * 0.15,
    z: 100 - Math.round(d * 10),
  };
}

export function deckPose(d: number, n: number, unit: number, h: number): Pose {
  'worklet';
  if (d <= n - 1) return layerPose(d, h);
  const s = n - d; // 0 = baru meninggalkan depan, 1 = sudah di lapis paling belakang
  if (s <= 0.5) {
    // Keluar ke kiri mengikuti jari, miring, lalu memudar di tengah jalan.
    return { x: -s * unit, y: OPEN_TOP + s * 14, scale: 1 - s * 0.08, rotate: -s * 12, rotateY: s * 30, opacity: clamp(1 - (s - 0.3) / 0.2, 0, 1), shade: 0, z: 200 - Math.round(s * 10) };
  }
  // Menyelinap masuk ke belakang tumpukan dari kiri.
  const u = (s - 0.5) / 0.5;
  const e = 1 - (1 - u) * (1 - u);
  const back = layerPose(n - 1, h);
  return { ...back, x: -0.4 * unit + (back.x + 0.4 * unit) * e, opacity: back.opacity * u, z: 5 };
}

/** Target lepas geser: proyeksi kecepatan, dibatasi satu kartu dari posisi awal. `v` = kartu per detik. */
export function snapTarget(start: number, current: number, v: number): number {
  'worklet';
  const base = Math.round(start);
  return clamp(Math.round(current + v * 0.18), base - 1, base + 1);
}
