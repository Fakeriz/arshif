/**
 * Logo bank, e-wallet, paylater, dan jaringan kartu dari paket npm `idn-finlogos` (github.com/hafidznoor/idn-finlogos).
 *
 * LISENSI: aset SVG berlisensi CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/), kurasi oleh
 * Hafidz Noor Fauzi; kode pembungkus paket berlisensi MIT. Setiap logo adalah merek dagang milik pemiliknya masing-masing.
 * NOTICE paket: pemakaian aset di produk komersial butuh izin pemilik merek. Atribusi tampil di layar
 * "Pilih Tampilan Kartu" dan di docs/third-party-logos.md.
 * Perubahan pada aset (dicatat sesuai CC BY): bentuk tidak diubah; bila kontras kurang, warna diganti satu warna
 * (fitLogo di bawah). Latar SVG sudah transparan (putih hanya di clipPath, tidak digambar).
 *
 * Import per logo (bukan komponen berisi semua ikon) supaya bundle hanya memuat logo yang dipakai.
 * Slug diperiksa terhadap dist/manifest.json paket versi 2.5.0 (lihat __tests__/finlogos.test.ts).
 * Hanya logo Indonesia: bank Malaysia dan Turki tidak punya logo di sini dan memakai teks nama bank.
 */
import akulaku from 'idn-finlogos/icons/akulaku';
import akulakuPaylater from 'idn-finlogos/icons/akulaku-paylater';
import americanExpress from 'idn-finlogos/icons/american-express';
import bca from 'idn-finlogos/icons/bca';
import bluBca from 'idn-finlogos/icons/blu-bca';
import bni from 'idn-finlogos/icons/bni';
import bri from 'idn-finlogos/icons/bri';
import bsi from 'idn-finlogos/icons/bsi';
import cimbNiaga from 'idn-finlogos/icons/cimb-niaga';
import dana from 'idn-finlogos/icons/dana';
import gopay from 'idn-finlogos/icons/gopay';
import gopaylater from 'idn-finlogos/icons/gopaylater';
import gpn from 'idn-finlogos/icons/gpn';
import indodana from 'idn-finlogos/icons/indodana';
import jago from 'idn-finlogos/icons/jago';
import jcb from 'idn-finlogos/icons/jcb';
import jenius from 'idn-finlogos/icons/jenius';
import kredivo from 'idn-finlogos/icons/kredivo';
import mandiri from 'idn-finlogos/icons/mandiri';
import mastercard from 'idn-finlogos/icons/mastercard';
import ovo from 'idn-finlogos/icons/ovo';
import permata from 'idn-finlogos/icons/permata';
import seabank from 'idn-finlogos/icons/seabank';
import shopeePay from 'idn-finlogos/icons/shopee-pay';
import unionPay from 'idn-finlogos/icons/union-pay';
import visa from 'idn-finlogos/icons/visa';

import type { CardScheme } from '@/components/ui/CardArt';
import { contrastRatio, luminance } from '@/lib/contrast';

export type FinLogo = { slug: string; svg: string };

/** Teks lisensi aset logo (atribusi CC BY-NC 4.0 yang ditautkan dari layar Pilih Tampilan Kartu). */
export const LOGO_LICENSE_URL = 'https://creativecommons.org/licenses/by-nc/4.0/';

/** Kunci bank Arshif (constants/banks) -> logo. Kunci yang tidak ada di sini memakai teks nama bank. */
export const BANK_LOGOS: Readonly<Record<string, FinLogo>> = {
  bca: { slug: 'bca', svg: bca },
  mandiri: { slug: 'mandiri', svg: mandiri },
  bri: { slug: 'bri', svg: bri },
  bni: { slug: 'bni', svg: bni },
  bsi: { slug: 'bsi', svg: bsi },
  cimbniaga: { slug: 'cimb-niaga', svg: cimbNiaga },
  permata: { slug: 'permata', svg: permata },
  jago: { slug: 'jago', svg: jago },
  jenius: { slug: 'jenius', svg: jenius },
  blu: { slug: 'blu-bca', svg: bluBca },
  seabank: { slug: 'seabank', svg: seabank },
  gopay: { slug: 'gopay', svg: gopay },
  ovo: { slug: 'ovo', svg: ovo },
  dana: { slug: 'dana', svg: dana },
  shopeepay: { slug: 'shopee-pay', svg: shopeePay },
  akulaku: { slug: 'akulaku', svg: akulaku },
  kredivo: { slug: 'kredivo', svg: kredivo },
  indodana: { slug: 'indodana', svg: indodana },
};

/** Logo khusus produk paylater bila ada di katalog (selain itu logo penyedianya). */
export const PAYLATER_LOGOS: Readonly<Record<string, FinLogo>> = {
  gopay: { slug: 'gopaylater', svg: gopaylater },
  akulaku: { slug: 'akulaku-paylater', svg: akulakuPaylater },
};

/** Jaringan kartu -> logo. `troy` (Turki) tidak ada di paket: tanda teks. */
export const SCHEME_LOGOS: Readonly<Partial<Record<CardScheme, FinLogo>>> = {
  visa: { slug: 'visa', svg: visa },
  mastercard: { slug: 'mastercard', svg: mastercard },
  jcb: { slug: 'jcb', svg: jcb },
  gpn: { slug: 'gpn', svg: gpn },
  amex: { slug: 'american-express', svg: americanExpress },
  unionpay: { slug: 'union-pay', svg: unionPay },
};

/** Rasio lebar/tinggi dari viewBox SVG (untuk ukuran logo di kartu). */
export function logoAspect(svg: string): number {
  const m = /viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*"/.exec(svg);
  return m ? Number(m[1]) / Number(m[2]) : 1;
}

/** Kontras minimum grafis (WCAG 1.4.11). */
export const LOGO_MIN_CONTRAST = 3;
/** Putih / hampir putih (#fff, #fefefe, #fdfdfd): bagian "potongan" di dalam logo, bukan warna merek. */
/** #abc -> #aabbcc (contrast.ts hanya menerima 6 digit). */
const norm = (c: string) => (c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c);
const isWhite = (c: string) => luminance(norm(c)) > 0.9;
const COLOR_ATTR = /(fill|stroke|stop-color)="(#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3}))"/g;
/** clipPath tidak digambar (isinya selalu putih penuh): jangan ikut dihitung atau diwarnai. */
const splitClips = (svg: string) => svg.split(/(<clipPath[\s\S]*?<\/clipPath>)/);

/** Warna yang benar-benar tergambar di logo, tanpa putih dan tanpa isi clipPath. */
export function visibleColors(svg: string): string[] {
  const out = new Set<string>();
  splitClips(svg).forEach((part, i) => {
    if (i % 2 === 1) return;
    for (const m of part.matchAll(COLOR_ATTR)) if (!isWhite(m[2])) out.add(norm(m[2]));
  });
  return [...out];
}

/**
 * Versi satu warna tanpa mengubah bentuk: warna merek -> `ink`, bagian putih -> `bg` (warna kartu, supaya potongan
 * seperti huruf putih di kotak biru BRI tetap terbaca dan tidak menggumpal). Gradien ikut lewat stop-color.
 */
export function monoSvg(svg: string, ink: string, bg: string): string {
  return splitClips(svg)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(COLOR_ATTR, (_m, attr: string, c: string) => `${attr}="${isWhite(c) ? bg : ink}"`)))
    .join('');
}

const cache = new Map<string, string>();

/**
 * Logo untuk dipasang langsung di atas warna kartu (tanpa plat).
 * - `brand` (logo bank/penyedia): satu warna bila ADA warna logo dengan kontras < 3:1 terhadap kartu. Logo bank
 *   harus jelas; di kartu gelap jadi putih (tinta kartu), di kartu terang yang kontrasnya cukup tetap warna asli.
 * - `mark` (jaringan kartu): warna asli dipertahankan. Hanya logo SATU warna yang gagal kontras (Visa, Amex di kartu
 *   biru) dijadikan tinta kartu. Logo multi-warna dengan bentuk bertumpuk (Mastercard, JCB, GPN, UnionPay) tidak
 *   diubah: versi satu warna membuat bentuknya menyatu jadi gumpalan, jadi warnanya dibiarkan apa adanya.
 * `ink` = warna teks kartu (onColor bank), dijamin >= 4.5:1 terhadap kartu oleh tes banks.test.ts.
 */
export function fitLogo(svg: string, bg: string, ink: string, mode: 'brand' | 'mark'): string {
  const key = `${mode}|${bg}|${ink}|${svg.length}|${svg.slice(0, 64)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const colors = visibleColors(svg);
  const low = colors.filter((c) => contrastRatio(c, bg) < LOGO_MIN_CONTRAST);
  const mono = colors.length > 0 && (mode === 'brand' ? low.length > 0 : colors.length === 1 && low.length === 1);
  const out = mono ? monoSvg(svg, ink, bg) : svg;
  cache.set(key, out);
  return out;
}
