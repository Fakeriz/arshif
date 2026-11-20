import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect, SvgXml } from 'react-native-svg';

import { getBank } from '@/constants/banks';
import { composite } from '@/lib/contrast';
import { BANK_LOGOS, fitLogo, logoAspect, SCHEME_LOGOS, type FinLogo } from '@/lib/finlogos';
import { fonts, palettes } from '@/theme/tokens';

import { AppText } from './AppText';

export type CardScheme = 'visa' | 'mastercard' | 'jcb' | 'gpn' | 'amex' | 'unionpay' | 'troy';

/** Rasio kartu ISO/IEC 7810 ID-1 (85,60 × 53,98 mm), sama dengan kartu kredit fisik. */
export const CARD_ART_RATIO = 85.6 / 53.98;
/**
 * Pita atas yang tetap terlihat saat kartu bertumpuk (pola Apple Wallet, docs/card-picker-ref/ref-apple-wallet.jpg).
 * Nama bank SELURUHNYA di dalam pita ini supaya terbaca sekilas walau kartu tertutup kartu lain.
 */
export const CARD_ART_PEEK = 0.24;

export type CardArtProps = {
  /** Kunci bank dari constants/banks (warna + nama). */
  bank: string;
  /** Label produk singkat di pojok kanan atas, mis. "Paspor Blue". */
  label?: string;
  scheme?: CardScheme | null;
  /**
   * Produk tanpa kartu fisik (paylater): logo/nama penyedia + "PAYLATER" + tanda "CUSTOM ART".
   * `logo` = logo khusus produk (mis. GoPay Later); tanpa itu dipakai logo penyedia.
   */
  customArt?: { title: string; caption: string; mark: string; logo?: FinLogo };
  width: number;
  /** Tinggi bila bukan rasio ISO (mis. kartu akun di deck Home, rasio BankCard). Ukuran isi tetap relatif lebar. */
  height?: number;
  /** Pola motif 0-3 (dipilih per produk supaya kartu satu bank tidak kembar). */
  variant?: number;
  /** Kartu tingkat atas (Black, Infinite, ...): lapisan gelap, hanya bila tinta kartu terang (kontras tetap aman). */
  premium?: boolean;
  /** Dipakai sebagai latar kartu akun (BankCard): kiri bawah milik saldo, jadi tanda "CUSTOM ART" pindah ke kanan. */
  asBackground?: boolean;
};

/**
 * Artwork kartu Arshif, digambar di kode: warna khas bank (sama dengan BankCard), motif sendiri, dan chip. Logo bank
 * dan jaringan kartu = SVG asli dari `idn-finlogos` (CC BY-NC 4.0, lihat lib/finlogos.ts), latar transparan langsung di
 * atas warna kartu; warnanya disesuaikan kontras (fitLogo), bentuknya tidak diubah. Logo bank adalah elemen paling
 * menonjol, di pita atas (CARD_ART_PEEK). Bank tanpa logo di paket (Malaysia, Turki) dan troy memakai teks.
 */
export function CardArt({ bank, label, scheme, customArt, width, height: fixedHeight, variant = 0, premium, asBackground }: CardArtProps) {
  const b = getBank(bank);
  const height = fixedHeight ?? width / CARD_ART_RATIO;
  // Semua ukuran relatif terhadap lebar supaya kartu kecil (grid) dan besar (pratinjau) sama proporsinya.
  const u = width / 100;
  const ink = b.onColor;
  const dimmed = !!premium && isLightInk(ink);
  // Warna latar yang benar-benar terlihat (kartu premium diberi lapisan gelap): dasar perhitungan kontras logo.
  const bg = dimmed ? composite(`${hexToRgba(palettes.dark.bg, DIM)}`, b.color) : b.color;
  return (
    <View style={[styles.card, { width, height, borderRadius: 7 * u, backgroundColor: b.color }]}>
      {dimmed && <View style={[StyleSheet.absoluteFill, { backgroundColor: palettes.dark.bg, opacity: DIM }]} />}
      <Motif width={width} height={height} ink={ink} variant={variant} />
      {customArt ? (
        <>
          <View style={{ position: 'absolute', left: 6 * u, top: 0, right: 6 * u, gap: 1 * u }}>
            <View style={{ height: height * CARD_ART_PEEK, justifyContent: 'center', alignItems: 'flex-start' }}>
              <BankMark logo={customArt.logo ?? BANK_LOGOS[bank]} name={customArt.title} u={u} band={height * CARD_ART_PEEK} ink={ink} bg={bg} maxWidth={width * 0.62} />
            </View>
            <AppText numberOfLines={1} style={{ color: ink, opacity: 0.8, fontFamily: fonts.semibold, fontSize: 3.2 * u, lineHeight: 4.4 * u, letterSpacing: 1.2 * u }}>
              {customArt.caption}
            </AppText>
          </View>
          <AppText style={{ position: 'absolute', ...(asBackground ? { right: 7 * u } : { left: 7 * u }), bottom: 5 * u, color: ink, opacity: 0.6, fontFamily: fonts.semibold, fontSize: 2.4 * u, lineHeight: 3.2 * u, letterSpacing: 0.8 * u }}>
            {customArt.mark}
          </AppText>
        </>
      ) : (
        <>
          {/* Logo/nama bank = elemen paling menonjol, seluruhnya di pita atas (CARD_ART_PEEK). */}
          <View style={[styles.row, { position: 'absolute', left: 6 * u, right: 6 * u, top: 0, height: height * CARD_ART_PEEK }]}>
            <BankMark logo={BANK_LOGOS[bank]} name={b.name} u={u} band={height * CARD_ART_PEEK} ink={ink} bg={bg} maxWidth={width * 0.5} />
            {label ? (
              <AppText numberOfLines={1} style={{ flexShrink: 1, maxWidth: '48%', color: ink, opacity: 0.85, fontFamily: fonts.semibold, fontSize: 4 * u, lineHeight: 5.4 * u, textAlign: 'right' }}>
                {label}
              </AppText>
            ) : null}
          </View>
          <Chip u={u} ink={ink} />
          {scheme ? (
            <View style={{ position: 'absolute', right: 7 * u, bottom: 6 * u }}>
              <SchemeMark scheme={scheme} u={u} ink={ink} bg={bg} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

/** Tinta putih/terang: lapisan gelap menaikkan kontras. Tinta gelap (mis. Jago kuning) tidak diberi lapisan. */
const isLightInk = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16) > 382;

/**
 * Motif Arshif (4 pola) dari tinta kartu, transparan, semuanya di bawah pita nama bank supaya tidak mengganggu
 * keterbacaan saat bertumpuk. Bentuk sendiri, tidak meniru artwork kartu bank mana pun.
 */
function Motif({ width: w, height: h, ink, variant }: { width: number; height: number; ink: string; variant: number }) {
  const v = ((variant % 4) + 4) % 4;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      {v === 0 && (
        <>
          <Circle cx={w * 0.92} cy={h * 1.05} r={w * 0.55} fill={ink} fillOpacity={0.07} />
          <Circle cx={w * 1.02} cy={h * 0.95} r={w * 0.36} fill={ink} fillOpacity={0.06} />
          <Path d={`M0 ${h * 0.78} Q ${w * 0.45} ${h * 0.52} ${w} ${h * 0.62}`} stroke={ink} strokeOpacity={0.12} strokeWidth={w * 0.012} fill="none" />
        </>
      )}
      {v === 1 && (
        <>
          <Path d={`M${w * 0.45} ${h} L${w * 0.85} ${h * 0.3} L${w} ${h * 0.3} L${w} ${h} Z`} fill={ink} fillOpacity={0.07} />
          <Path d={`M${w * 0.62} ${h} L${w} ${h * 0.42} L${w} ${h} Z`} fill={ink} fillOpacity={0.07} />
        </>
      )}
      {v === 2 && [0.18, 0.3, 0.42, 0.54].map((r) => <Circle key={r} cx={w * 0.08} cy={h * 1.02} r={w * r} stroke={ink} strokeOpacity={0.1} strokeWidth={w * 0.01} fill="none" />)}
      {v === 3 && (
        <>
          {[0.55, 0.68, 0.81].map((y) => (
            <Path key={y} d={`M0 ${h * y} C ${w * 0.3} ${h * (y - 0.14)} ${w * 0.6} ${h * (y + 0.14)} ${w} ${h * (y - 0.04)}`} stroke={ink} strokeOpacity={0.11} strokeWidth={w * 0.009} fill="none" />
          ))}
          <Rect x={w * 0.7} y={h * 0.3} width={w * 0.3} height={h * 0.7} fill={ink} fillOpacity={0.04} />
        </>
      )}
    </Svg>
  );
}

function Chip({ u, ink }: { u: number; ink: string }) {
  return (
    <View style={{ position: 'absolute', left: 7 * u, top: 25 * u, width: 12 * u, height: 9 * u, borderRadius: 1.8 * u, backgroundColor: ink, opacity: 0.32 }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 4.5 * u - 0.5, height: 1, backgroundColor: ink, opacity: 0.6 }} />
    </View>
  );
}

/** Lapisan gelap kartu premium. */
const DIM = 0.55;
const hexToRgba = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;

/**
 * Logo langsung di atas warna kartu, latar transparan (tanpa plat). Warna disesuaikan lewat fitLogo: putih/tinta
 * kartu bila kontras warna aslinya kurang dari 3:1, warna asli bila cukup kontras. Bentuk logo tidak diubah.
 */
function Logo({ logo, label, height, maxWidth, ink, bg, mode }: { logo: FinLogo; label: string; height: number; maxWidth: number; ink: string; bg: string; mode: 'brand' | 'mark' }) {
  const aspect = logoAspect(logo.svg);
  const h = Math.min(height, maxWidth / aspect);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <SvgXml xml={fitLogo(logo.svg, bg, ink, mode)} width={h * aspect} height={h} />
    </View>
  );
}

/** Logo bank bila ada di idn-finlogos, selain itu teks nama bank besar (bank Malaysia/Turki). */
function BankMark({ logo, name, u, band, ink, bg, maxWidth }: { logo?: FinLogo; name: string; u: number; band: number; ink: string; bg: string; maxWidth: number }) {
  if (logo) return <Logo logo={logo} label={name} height={band * 0.62} maxWidth={maxWidth} ink={ink} bg={bg} mode="brand" />;
  return (
    <AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flexShrink: 1, color: ink, fontFamily: fonts.extrabold, fontSize: 9.5 * u, lineHeight: 11.5 * u, letterSpacing: -0.2 * u }}>
      {name}
    </AppText>
  );
}

/** Nama jaringan untuk label aksesibilitas logo dan tanda teks (troy tidak punya logo di idn-finlogos). */
const SCHEME_NAME: Record<CardScheme, string> = { visa: 'Visa', mastercard: 'Mastercard', jcb: 'JCB', gpn: 'GPN', amex: 'American Express', unionpay: 'UnionPay', troy: 'troy' };

/** Logo jaringan kartu dari idn-finlogos; tanpa logo (troy) = teks nama jaringan. */
export function SchemeMark({ scheme, u, ink, bg }: { scheme: CardScheme; u: number; ink: string; bg: string }) {
  const logo = SCHEME_LOGOS[scheme];
  if (logo) return <Logo logo={logo} label={SCHEME_NAME[scheme]} height={9 * u} maxWidth={22 * u} ink={ink} bg={bg} mode="mark" />;
  return (
    <AppText
      style={{
        color: ink,
        fontFamily: fonts.extrabold,
        fontSize: 6.4 * u,
        lineHeight: 8 * u,
      }}
    >
      {SCHEME_NAME[scheme]}
    </AppText>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
});
