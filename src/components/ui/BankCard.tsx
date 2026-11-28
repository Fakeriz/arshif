import { Image } from 'expo-image';
import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import { getBank } from '@/constants/banks';
import type { AccountType } from '@/data/types';
import { bankName, useT } from '@/i18n';
import {
  CARD_RATIO,
  cardGradient,
  hasChip,
  hasContactless,
  maskedNumber,
  parseCardStyle,
  resolveCardColors,
  showsChipOnFace,
  type ParsedCardStyle,
  type Pattern,
} from '@/lib/cardFace';
import { formatMoney } from '@/lib/money';
import { useSignedUrl } from '@/lib/signedAvatarUrl';
import { fonts } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export type BankCardProps = {
  bank: string;
  /** Label jenis akun, mis. "Tabungan", "Kartu Kredit", "E-Money". */
  accountType: string;
  /** Jenis akun: menentukan chip, simbol nirsentuh, motif bawaan, dan teks tunai. Bawaan tabungan. */
  type?: AccountType;
  last4?: string;
  holder?: string;
  expiry?: string;
  /** Minor units. */
  balance: number;
  currency: string;
  hidden?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
  /** Lebar kartu; tinggi mengikuti rasio kartu ISO. Bawaan 280 (pratinjau pemilih bank). */
  width?: number;
  /** Keterangan singkat, mis. utilisasi limit kartu kredit/grup. */
  footnote?: string;
  /** Motif / finish material / foto kartu kustom (`photo:<path>`). Kosong = motif bawaan jenis akun. */
  cardStyle?: string;
  /** Pratinjau lokal gambar kartu kustom sebelum / selama proses unggah. */
  previewUri?: string | null;
};

export const BANK_CARD_RATIO = CARD_RATIO;

// Precomputed geometric data for complex motifs (keeps render fast and deterministic).
const GUILLOCHE_ANGLES = Array.from({ length: 24 }, (_, i) => Number((i * (180 / 24)).toFixed(2)));
const GUILLOCHE_ROSE = (() => {
  const pts: string[] = [];
  for (let deg = 0; deg <= 360; deg += 3) {
    const rad = (deg * Math.PI) / 180;
    const r = 34 + 13 * Math.cos(8 * rad);
    const x = 256 + r * Math.cos(rad);
    const y = 146 + r * Math.sin(rad);
    pts.push(`${deg === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `${pts.join(' ')} Z`;
})();

const KAWUNG_TILES = (() => {
  const out: { x: number; y: number; op: number }[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 128 + col * 32;
      const y = 76 + row * 32;
      const dist = Math.hypot((x - 288) / 190, (y - 172) / 120);
      const op = Number(Math.max(0.05, Math.min(0.24, (1.15 - dist) * 0.24)).toFixed(3));
      if (op > 0.055) out.push({ x, y, op });
    }
  }
  return out;
})();

const SONGKET_COORDS: [number, number, number][] = [
  [176, 108, 0.09],
  [228, 108, 0.13],
  [280, 108, 0.16],
  [150, 142, 0.09],
  [202, 142, 0.13],
  [254, 142, 0.16],
  [306, 142, 0.18],
  [124, 176, 0.08],
  [176, 176, 0.13],
  [228, 176, 0.16],
  [280, 176, 0.18],
];

function star8Points(cx: number, cy: number, rOuter: number, rInner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (i * Math.PI) / 8;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const IZNIK_STARS: { pts: string; op: number }[] = [
  [260, 148, 34, 20, 0.22],
  [260, 148, 56, 40, 0.18],
  [184, 148, 34, 20, 0.14],
  [260, 72, 34, 20, 0.1],
  [222, 110, 22, 13, 0.16],
  [298, 110, 22, 13, 0.16],
  [222, 186, 22, 13, 0.18],
  [298, 186, 22, 13, 0.18],
  [146, 186, 22, 13, 0.1],
].map(([x, y, ro, ri, op]) => ({ pts: star8Points(x, y, ro, ri), op }));

const HALFTONE_DOTS = (() => {
  const dots: { cx: number; cy: number; r: number; op: number }[] = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 17; col++) {
      const cx = 104 + col * 13;
      const cy = 76 + row * 13;
      const dist = Math.hypot((cx - 310) / 215, (cy - 196) / 140);
      const r = Math.max(0.4, (1.22 - dist) * 2.45);
      if (r > 0.45) {
        const op = Number(Math.min(0.32, Math.max(0.06, (1.18 - dist) * 0.28)).toFixed(3));
        dots.push({ cx, cy, r: Number(r.toFixed(2)), op });
      }
    }
  }
  return dots;
})();

const TITANIUM_LINES = Array.from({ length: 48 }, (_, i) => {
  const y = Number((4 + i * 4.1).toFixed(1));
  const op = Number((0.025 + ((i * 7) % 10) * 0.005).toFixed(3));
  const light = i % 2 === 0;
  return { y, op, light };
});

/** Motif vektor di atas warna bank atau finish material. Zona intip atas (y < 60) dijaga rendah kontras agar teks terbaca. */
function PatternLayer({ pattern, color, bg, w, h }: { pattern: Pattern; color: string; bg: string; w: number; h: number }) {
  const common = { width: w, height: h, viewBox: '0 0 320 202', style: StyleSheet.absoluteFill } as const;
  switch (pattern) {
    case 'rings':
      return (
        <Svg {...common} preserveAspectRatio="xMaxYMax slice" opacity={0.16}>
          {[40, 70, 100, 130, 160, 190].map((r) => (
            <Circle key={r} cx={300} cy={210} r={r} fill="none" stroke={color} strokeWidth={1} />
          ))}
        </Svg>
      );
    case 'arcs':
      return (
        <Svg {...common} preserveAspectRatio="xMaxYMax slice" opacity={0.16}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Path key={i} d={`M ${-20 + i * 30} 220 Q ${150 + i * 18} ${40 - i * 6} 340 ${60 + i * 22}`} fill="none" stroke={color} strokeWidth={1} />
          ))}
        </Svg>
      );
    case 'waves':
      return (
        <Svg {...common} preserveAspectRatio="none" opacity={0.16}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Path
              key={i}
              d={`M -10 ${110 + i * 14} C 70 ${80 + i * 14}, 140 ${150 + i * 14}, 220 ${112 + i * 14} S 330 ${96 + i * 14}, 340 ${110 + i * 14}`}
              fill="none"
              stroke={color}
              strokeWidth={1}
            />
          ))}
        </Svg>
      );
    case 'grid':
      return (
        <Svg {...common} preserveAspectRatio="xMaxYMax slice" opacity={0.2}>
          {Array.from({ length: 9 }, (_, r) =>
            Array.from({ length: 14 }, (_, c) => <Circle key={`${r}-${c}`} cx={150 + c * 13} cy={80 + r * 13} r={1.6 - (c + r) * 0.04} fill={color} />),
          )}
        </Svg>
      );
    case 'paper':
      // Serat kertas: garis miring rapat.
      return (
        <Svg {...common} preserveAspectRatio="xMidYMid slice" opacity={0.1}>
          {Array.from({ length: 60 }, (_, i) => (
            <Line key={i} x1={i * 9 - 100} y1={0} x2={i * 9 - 7} y2={202} stroke={color} strokeWidth={2} />
          ))}
        </Svg>
      );
    case 'circuit':
      return (
        <Svg {...common} preserveAspectRatio="xMidYMid slice">
          <G fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
            <Rect x={10} y={10} width={300} height={182} rx={11} strokeWidth={0.95} opacity={0.13} />
            <Rect x={16} y={16} width={288} height={170} rx={9} strokeWidth={0.8} opacity={0.1} />
            <Path d="M58 98 H118 L138 118 H222 L242 98 H274" strokeWidth={1.2} opacity={0.24} />
            <Path d="M58 106 H108 L134 132 H204 L224 152 H286" strokeWidth={1.1} opacity={0.2} />
            <Path d="M164 118 L182 100 H230" strokeWidth={0.95} opacity={0.19} />
            <Path d="M138 118 V158 L156 176 H244" strokeWidth={0.95} opacity={0.18} />
            <Path d="M222 118 V138 L236 152" strokeWidth={0.9} opacity={0.18} />
            <Path d="M254 128 H288" strokeWidth={0.95} opacity={0.18} />
            <Circle cx={118} cy={98} r={2.4} fill={bg} stroke={color} strokeWidth={1.2} opacity={0.35} />
            <Circle cx={164} cy={118} r={2.4} fill={bg} stroke={color} strokeWidth={1.2} opacity={0.35} />
            <Circle cx={222} cy={118} r={2.4} fill={bg} stroke={color} strokeWidth={1.2} opacity={0.35} />
            <Circle cx={274} cy={98} r={2.6} fill={bg} stroke={color} strokeWidth={1.2} opacity={0.38} />
            <Circle cx={230} cy={100} r={2.2} fill={bg} stroke={color} strokeWidth={1.1} opacity={0.32} />
            <Circle cx={244} cy={176} r={2.4} fill={bg} stroke={color} strokeWidth={1.1} opacity={0.32} />
            <Rect x={252} y={122} width={16} height={12} rx={2} strokeWidth={0.9} opacity={0.22} />
          </G>
        </Svg>
      );
    case 'guilloche':
      return (
        <Svg {...common} preserveAspectRatio="xMidYMid slice">
          <Rect x={8} y={8} width={304} height={186} rx={10} fill="none" stroke={color} strokeWidth={0.6} opacity={0.1} />
          <G fill="none" stroke={color}>
            <G strokeWidth={0.65} opacity={0.15}>
              {GUILLOCHE_ANGLES.map((ang) => (
                <Ellipse key={ang} cx={256} cy={146} rx={78} ry={24} transform={`rotate(${ang} 256 146)`} />
              ))}
            </G>
            <Path d={GUILLOCHE_ROSE} strokeWidth={0.85} opacity={0.24} />
            <Circle cx={256} cy={146} r={19} strokeWidth={0.7} opacity={0.22} />
            <Circle cx={256} cy={146} r={68} strokeWidth={0.55} strokeDasharray="2 3" opacity={0.18} />
          </G>
        </Svg>
      );
    case 'kawung':
      return (
        <Svg {...common} preserveAspectRatio="xMidYMid slice">
          {KAWUNG_TILES.map((tile) => (
            <G key={`${tile.x}-${tile.y}`} transform={`translate(${tile.x} ${tile.y})`} opacity={tile.op}>
              <G fill="none" stroke={color} strokeWidth={0.9}>
                <Path d="M16 0 C22 6 22 10 16 16 C10 10 10 6 16 0 Z" />
                <Path d="M16 16 C22 22 22 26 16 32 C10 26 10 22 16 16 Z" />
                <Path d="M0 16 C6 10 10 10 16 16 C10 22 6 22 0 16 Z" />
                <Path d="M16 16 C22 10 26 10 32 16 C26 22 22 22 16 16 Z" />
              </G>
              <Circle cx={16} cy={8} r={1.1} fill={color} />
              <Circle cx={16} cy={24} r={1.1} fill={color} />
              <Circle cx={8} cy={16} r={1.1} fill={color} />
              <Circle cx={24} cy={16} r={1.1} fill={color} />
              <Circle cx={16} cy={16} r={1.5} fill="none" stroke={color} strokeWidth={0.7} />
            </G>
          ))}
          <Path d="M0 186 Q160 174 320 156" fill="none" stroke={color} strokeWidth={0.8} opacity={0.2} />
        </Svg>
      );
    case 'songket':
      return (
        <Svg {...common} preserveAspectRatio="xMidYMid slice">
          {SONGKET_COORDS.map(([cx, cy, op]) => (
            <G key={`${cx}-${cy}`} transform={`translate(${cx} ${cy})`} opacity={op}>
              <Polygon points="0,-14 16,0 0,14 -16,0" fill="none" stroke={color} strokeWidth={0.9} />
              <Polygon points="0,-8 9,0 0,8 -9,0" fill="none" stroke={color} strokeWidth={0.75} />
              <Line x1={0} y1={-12} x2={0} y2={12} stroke={color} strokeWidth={0.65} />
              <Line x1={-14} y1={0} x2={14} y2={0} stroke={color} strokeWidth={0.65} />
              <Line x1={-6} y1={-6} x2={6} y2={6} stroke={color} strokeWidth={0.6} />
              <Line x1={6} y1={-6} x2={-6} y2={6} stroke={color} strokeWidth={0.6} />
              <Circle cx={0} cy={0} r={2.1} fill={color} />
            </G>
          ))}
          <Path d="M90 194 L320 194" stroke={color} strokeWidth={1.1} strokeDasharray="6 4" opacity={0.16} />
        </Svg>
      );
    case 'iznik':
      return (
        <Svg {...common} preserveAspectRatio="xMidYMid slice">
          <G fill="none" stroke={color} strokeWidth={1}>
            {IZNIK_STARS.map((s, idx) => (
              <Polygon key={idx} points={s.pts} opacity={s.op} />
            ))}
            <Rect x={242} y={130} width={36} height={36} opacity={0.18} />
            <Rect x={242} y={130} width={36} height={36} transform="rotate(45 260 148)" opacity={0.18} />
            <Circle cx={260} cy={148} r={10} opacity={0.22} />
          </G>
        </Svg>
      );
    case 'metro':
      return (
        <Svg {...common} preserveAspectRatio="xMidYMid slice">
          <G fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M-8 148 H118 L162 104 H256 L284 76 H328" strokeWidth={2.5} opacity={0.22} />
            <Path d="M74 208 L138 144 H228 L272 100 H328" strokeWidth={2.2} opacity={0.18} />
            <Path d="M196 208 V126 L218 104 V68" strokeWidth={2} opacity={0.16} />
            <Path d="M150 208 L184 174 H284 L312 146" strokeWidth={1.8} opacity={0.18} />
          </G>
          <G>
            <Circle cx={118} cy={148} r={3.6} fill={bg} stroke={color} strokeWidth={1.6} opacity={0.36} />
            <Circle cx={162} cy={104} r={3.6} fill={bg} stroke={color} strokeWidth={1.6} opacity={0.36} />
            <Circle cx={218} cy={104} r={5} fill={bg} stroke={color} strokeWidth={1.8} opacity={0.44} />
            <Circle cx={218} cy={104} r={2} fill={color} opacity={0.44} />
            <Circle cx={228} cy={144} r={4.4} fill={bg} stroke={color} strokeWidth={1.6} opacity={0.4} />
            <Circle cx={272} cy={100} r={3.6} fill={bg} stroke={color} strokeWidth={1.5} opacity={0.36} />
            <Circle cx={196} cy={144} r={3.4} fill={bg} stroke={color} strokeWidth={1.4} opacity={0.34} />
            <Circle cx={284} cy={174} r={3.4} fill={bg} stroke={color} strokeWidth={1.4} opacity={0.36} />
          </G>
        </Svg>
      );
    case 'topography':
      return (
        <Svg {...common} preserveAspectRatio="xMidYMid slice">
          <G fill="none" stroke={color} strokeLinecap="round" opacity={0.2}>
            <Path d="M-12 162 C44 132, 86 172, 146 146 C206 120, 238 78, 332 94" strokeWidth={1} />
            <Path d="M-12 178 C52 148, 94 186, 158 158 C218 132, 248 94, 332 108" strokeWidth={0.95} />
            <Path d="M16 206 C76 170, 118 196, 178 168 C236 142, 264 110, 332 124" strokeWidth={0.95} />
            <Path d="M168 118 C186 92, 238 82, 268 102 C298 122, 286 164, 248 172 C208 180, 152 146, 168 118 Z" strokeWidth={1} />
            <Path d="M192 124 C204 106, 238 100, 256 114 C274 128, 266 152, 242 158 C216 164, 182 142, 192 124 Z" strokeWidth={0.95} />
            <Path d="M214 130 C222 120, 240 116, 248 126 C256 136, 248 146, 236 148 C222 150, 208 140, 214 130 Z" strokeWidth={0.9} />
            <Path d="M-10 144 C40 118, 92 146, 142 126 C188 108, 224 62, 330 76" strokeWidth={0.8} opacity={0.7} />
          </G>
          {/* Penanda kompas & kisi koordinat geometris (tanpa teks SVG). */}
          <G fill="none" stroke={color} strokeWidth={0.85} opacity={0.28}>
            <Circle cx={232} cy={134} r={4} />
            <Line x1={232} y1={126} x2={232} y2={142} />
            <Line x1={224} y1={134} x2={240} y2={134} />
          </G>
        </Svg>
      );
    case 'halftone':
      return (
        <Svg {...common} preserveAspectRatio="xMidYMid slice">
          <G stroke={color} strokeWidth={0.65} opacity={0.13}>
            <Line x1={18} y1={68} x2={302} y2={68} />
            <Line x1={18} y1={126} x2={302} y2={126} />
            <Line x1={160} y1={68} x2={160} y2={188} strokeDasharray="2 4" />
          </G>
          <G>
            {HALFTONE_DOTS.map((d) => (
              <Circle key={`${d.cx}-${d.cy}`} cx={d.cx} cy={d.cy} r={d.r} fill={color} opacity={d.op} />
            ))}
          </G>
        </Svg>
      );
  }
}

/** Tekstur sikat logam horizontal + kilau diagonal khusus finish Titanium. */
function TitaniumSheen({ w, h, id }: { w: number; h: number; id: string }) {
  return (
    <Svg width={w} height={h} viewBox="0 0 320 202" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.85">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.38" stopColor="#FFFFFF" stopOpacity={0.06} />
          <Stop offset="0.52" stopColor="#FFFFFF" stopOpacity={0.3} />
          <Stop offset="0.66" stopColor="#FFFFFF" stopOpacity={0.06} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <G>
        {TITANIUM_LINES.map((l) => (
          <Line key={l.y} x1={0} y1={l.y} x2={320} y2={l.y} stroke={l.light ? '#FFFFFF' : '#141413'} strokeWidth={0.75} opacity={l.op} />
        ))}
      </G>
      <Polygon points="90,0 206,0 132,202 18,202" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Scrim kontras otomatis di atas foto kartu kustom agar teks strip atas >= 4.5:1 walau foto terang. */
function PhotoScrim({ w, h, id, bottom }: { w: number; h: number; id: string; bottom: boolean }) {
  return (
    <Svg width={w} height={h} viewBox="0 0 320 202" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0A0A0A" stopOpacity={0.68} />
          <Stop offset="0.58" stopColor="#0A0A0A" stopOpacity={0.32} />
          <Stop offset="1" stopColor="#0A0A0A" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0A0A0A" stopOpacity={0} />
          <Stop offset="1" stopColor="#0A0A0A" stopOpacity={0.58} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={320} height={106} fill={`url(#${id}t)`} />
      {bottom ? <Rect x={0} y={132} width={320} height={70} fill={`url(#${id}b)`} /> : null}
    </Svg>
  );
}

function Chip({ w, id, tone }: { w: number; id: string; tone: 'gold' | 'silver' }) {
  const silver = tone === 'silver';
  return (
    <Svg width={w} height={(w * 34) / 44} viewBox="0 0 44 34">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={silver ? '#ECEEF2' : '#f3dca2'} />
          <Stop offset="0.5" stopColor={silver ? '#A7AFB9' : '#c9a65a'} />
          <Stop offset="1" stopColor={silver ? '#DCE1E7' : '#e8cf8f'} />
        </LinearGradient>
      </Defs>
      <Rect x={0.5} y={0.5} width={43} height={33} rx={6} fill={`url(#${id})`} stroke={silver ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.25)'} />
      <Path
        d="M0.5 12h13M0.5 22h13M30.5 12h13M30.5 22h13M13.5 0.5v33M30.5 0.5v33M13.5 17h17"
        stroke={silver ? 'rgba(28,32,38,0.42)' : 'rgba(80,55,10,0.45)'}
        fill="none"
      />
    </Svg>
  );
}

function Contactless({ w, color }: { w: number; color: string }) {
  return (
    <Svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" opacity={0.85}>
      <Path d="M8.5 9a4.5 4.5 0 010 6M12 6.5a8 8 0 010 11M15.5 4a11.5 11.5 0 010 16" />
    </Svg>
  );
}

/**
 * Kartu akun gaya "dompet bertumpuk": gradasi dari warna bank atau finish material (menjauhi warna teks supaya
 * kontras tetap >= 4.5:1), motif vektor atau foto pribadi 1.586:1 dengan scrim, strip atas = nama bank + jenis | saldo
 * (mata uang sudah tampil di saldo), chip untuk kartu bank/Flazz, nirsentuh untuk selain tunai, nomor/nama/masa berlaku
 * hanya bila diisi. Nama bank sebagai teks, bukan logo resmi.
 */
export function BankCard({
  bank,
  accountType,
  type = 'tabungan',
  last4,
  holder,
  expiry,
  balance,
  currency,
  hidden,
  onPress,
  accessibilityHint,
  width,
  footnote,
  cardStyle,
  previewUri,
}: BankCardProps) {
  const t = useT();
  const b = getBank(bank);
  const name = bankName(t, bank);
  const amount = hidden ? '••••••' : formatMoney(balance, currency);
  const a11y = `${t(last4 ? 'common.bankCardA11yLast4' : 'common.bankCardA11y', { bank: name, type: accountType, last4: last4 ?? '', amount: hidden ? t('common.balanceHidden') : amount })}${footnote ? `, ${footnote}` : ''}`;
  const w = width ?? 280;
  const h = w / CARD_RATIO;

  const parsed = parseCardStyle(type, cardStyle);
  const isPhoto = Boolean(previewUri) || parsed.kind === 'photo';
  const effectiveParsed: ParsedCardStyle = isPhoto ? { kind: 'photo', path: parsed.kind === 'photo' ? parsed.path : '' } : parsed;
  const remote = useSignedUrl(parsed.kind === 'photo' ? parsed.path : null);
  const [failed, setFailed] = useState<string | null>(null);
  const photoSrc = previewUri ?? remote;

  const { color: baseColor, onColor: fg, chipTone } = resolveCardColors(b.color, b.onColor, effectiveParsed);
  const [g0, g1, g2] = cardGradient(baseColor, fg);
  // Id gradasi unik per kartu: di web id SVG berlaku untuk seluruh dokumen.
  const gid = `bc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const px = (pct: number) => (w * pct) / 100;
  const ink = { color: fg };
  const small = { fontFamily: fonts.medium, fontSize: px(3.1), lineHeight: px(4.1) };
  const showChip = showsChipOnFace(type, bank, effectiveParsed);
  const hasBottomContent = type === 'cash' || Boolean(last4) || Boolean(holder) || Boolean(expiry);

  const face = (
    <View style={[styles.shadow, { width: w, height: h, borderRadius: px(5) }]}>
      <View style={[styles.clip, { borderRadius: px(5) }]}>
        {isPhoto ? (
          <>
            <View style={[StyleSheet.absoluteFill, styles.photoFallback]} />
            {photoSrc && failed !== photoSrc ? (
              <Image
                source={{ uri: photoSrc }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                accessible={false}
                onError={() => setFailed(photoSrc)}
                transition={150}
              />
            ) : null}
            <PhotoScrim w={w} h={h} id={`${gid}s`} bottom={hasBottomContent} />
          </>
        ) : (
          <>
            <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={g0} />
                  <Stop offset="0.55" stopColor={g1} />
                  <Stop offset="1" stopColor={g2} />
                </LinearGradient>
              </Defs>
              <Rect width={w} height={h} fill={`url(#${gid})`} />
            </Svg>
            {effectiveParsed.kind === 'art' && effectiveParsed.finish === 'titanium' ? <TitaniumSheen w={w} h={h} id={`${gid}ti`} /> : null}
            {effectiveParsed.kind === 'art' ? <PatternLayer pattern={effectiveParsed.pattern} color={fg} bg={baseColor} w={w} h={h} /> : null}
          </>
        )}

        {/* Strip atas: inilah yang terlihat saat kartu bertumpuk. */}
        <View style={[styles.top, { paddingTop: px(5), paddingHorizontal: px(5.6), gap: px(4) }]}>
          <View style={styles.col}>
            <AppText numberOfLines={1} style={[ink, { fontFamily: fonts.extrabold, fontSize: px(5.6), lineHeight: px(6.5), letterSpacing: -px(0.17) }]}>
              {name}
            </AppText>
            <AppText numberOfLines={1} style={[ink, small]}>
              {accountType}
            </AppText>
          </View>
          <View style={[styles.col, styles.right]}>
            <AppText numberOfLines={1} style={[ink, small]}>
              {footnote ?? t('common.balance')}
            </AppText>
            <AppText numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[ink, { fontFamily: fonts.bold, fontSize: px(4.8), lineHeight: px(5.8), letterSpacing: -px(0.1) }]}>
              {amount}
            </AppText>
          </View>
        </View>

        <View style={[styles.mid, { left: px(5.6), right: px(5.6) }]}>
          {showChip ? <Chip w={px(12.5)} id={`${gid}c`} tone={chipTone} /> : <View />}
          {hasContactless(type) ? <Contactless w={px(6.6)} color={fg} /> : null}
        </View>

        <View style={[styles.bottom, { left: px(5.6), right: px(5.6), bottom: px(5), gap: px(1.4) }]}>
          {type === 'cash' ? (
            <AppText numberOfLines={1} style={[ink, { fontFamily: fonts.medium, fontSize: px(4), lineHeight: px(5.2) }]}>
              {t('common.cashInWallet')}
            </AppText>
          ) : last4 ? (
            <AppText numeric numberOfLines={1} style={[ink, { fontFamily: fonts.semibold, fontSize: px(4.6), lineHeight: px(5.8), letterSpacing: px(0.55) }]}>
              {hasChip(type) ? maskedNumber(last4) : `•••• ${last4}`}
            </AppText>
          ) : null}
          {holder || expiry ? (
            <View style={styles.meta}>
              <AppText numberOfLines={1} style={[ink, small, styles.flex, { letterSpacing: px(0.25) }]}>
                {holder ?? ''}
              </AppText>
              {expiry ? (
                <AppText numeric style={[ink, small, { fontFamily: fonts.semibold, letterSpacing: px(0.25) }]}>
                  {expiry}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );

  // Tanpa onPress (mis. pratinjau) kartu adalah gambar statis, bukan tombol nonaktif yang pudar.
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11y}>
        {face}
      </View>
    );
  }
  return (
    <PressableScale onPress={onPress} accessibilityLabel={a11y} accessibilityHint={accessibilityHint} focusRadius={px(5)} scaleTo={0.985}>
      {face}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Bayangan kartu seperti contoh (0 12px 28px -8px): penanda kartu fisik yang bisa ditumpuk.
  shadow: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  clip: { flex: 1, overflow: 'hidden' },
  photoFallback: { backgroundColor: '#181A1F' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  col: { flexShrink: 1, minWidth: 0 },
  right: { alignItems: 'flex-end' },
  mid: { position: 'absolute', top: '41%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottom: { position: 'absolute' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  flex: { flex: 1 },
});
