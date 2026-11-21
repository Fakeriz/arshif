import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { getBank } from '@/constants/banks';
import type { AccountType } from '@/data/types';
import { bankName, useT } from '@/i18n';
import { CARD_RATIO, cardGradient, hasChip, hasContactless, maskedNumber, patternFor, type Pattern } from '@/lib/cardFace';
import { formatMoney } from '@/lib/money';
import { fonts } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export type BankCardProps = {
  bank: string;
  /** Label jenis akun, mis. "Tabungan", "Kartu Kredit". */
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
  /** Motif pilihan pengguna (lib/cardFace PATTERNS). Kosong/tidak dikenal = motif bawaan jenis akun. */
  cardStyle?: string;
};

export const BANK_CARD_RATIO = CARD_RATIO;

/** Motif garis tipis (seperti contoh, opasitas 16%). Kanvas 320x200 di-"slice" ke ukuran kartu. */
function PatternLayer({ pattern, color, w, h }: { pattern: Pattern; color: string; w: number; h: number }) {
  const common = { width: w, height: h, viewBox: '0 0 320 200', style: StyleSheet.absoluteFill } as const;
  switch (pattern) {
    case 'rings':
      return (
        <Svg {...common} preserveAspectRatio="xMaxYMax slice" opacity={0.16}>
          {[40, 70, 100, 130, 160, 190].map((r) => <Circle key={r} cx={300} cy={210} r={r} fill="none" stroke={color} strokeWidth={1} />)}
        </Svg>
      );
    case 'arcs':
      return (
        <Svg {...common} preserveAspectRatio="xMaxYMax slice" opacity={0.16}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <Path key={i} d={`M ${-20 + i * 30} 220 Q ${150 + i * 18} ${40 - i * 6} 340 ${60 + i * 22}`} fill="none" stroke={color} strokeWidth={1} />)}
        </Svg>
      );
    case 'waves':
      return (
        <Svg {...common} preserveAspectRatio="none" opacity={0.16}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Path key={i} d={`M -10 ${110 + i * 14} C 70 ${80 + i * 14}, 140 ${150 + i * 14}, 220 ${112 + i * 14} S 330 ${96 + i * 14}, 340 ${110 + i * 14}`} fill="none" stroke={color} strokeWidth={1} />
          ))}
        </Svg>
      );
    case 'grid':
      return (
        <Svg {...common} preserveAspectRatio="xMaxYMax slice" opacity={0.2}>
          {Array.from({ length: 9 }, (_, r) => Array.from({ length: 14 }, (_, c) => <Circle key={`${r}-${c}`} cx={150 + c * 13} cy={80 + r * 13} r={1.6 - (c + r) * 0.04} fill={color} />))}
        </Svg>
      );
    case 'paper':
      // Serat kertas: garis miring rapat (pengganti repeating-linear-gradient di contoh).
      return (
        <Svg {...common} preserveAspectRatio="xMidYMid slice" opacity={0.1}>
          {Array.from({ length: 60 }, (_, i) => <Line key={i} x1={i * 9 - 100} y1={0} x2={i * 9 - 7} y2={200} stroke={color} strokeWidth={2} />)}
        </Svg>
      );
  }
}

function Chip({ w, id }: { w: number; id: string }) {
  return (
    <Svg width={w} height={(w * 34) / 44} viewBox="0 0 44 34">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#f3dca2" />
          <Stop offset="0.5" stopColor="#c9a65a" />
          <Stop offset="1" stopColor="#e8cf8f" />
        </LinearGradient>
      </Defs>
      <Rect x={0.5} y={0.5} width={43} height={33} rx={6} fill={`url(#${id})`} stroke="rgba(0,0,0,0.25)" />
      <Path d="M0.5 12h13M0.5 22h13M30.5 12h13M30.5 22h13M13.5 0.5v33M30.5 0.5v33M13.5 17h17" stroke="rgba(80,55,10,0.45)" fill="none" />
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
 * Kartu akun gaya "dompet bertumpuk": gradasi dari warna bank (menjauhi warna teks supaya kontras tetap >= 4.5:1),
 * satu motif, strip atas = nama bank + jenis · mata uang | saldo (yang terlihat saat kartu bertumpuk), chip untuk kartu
 * bank, nirsentuh untuk selain tunai, nomor/nama/masa berlaku hanya bila diisi. Ukuran teks mengikuti lebar kartu
 * (persen lebar, seperti container query di contoh). Nama bank sebagai teks, bukan logo resmi.
 * Label kecil memakai warna teks penuh (bukan redup 60% seperti contoh): redup gagal 4.5:1 di banyak warna bank.
 */
export function BankCard({ bank, accountType, type = 'tabungan', last4, holder, expiry, balance, currency, hidden, onPress, accessibilityHint, width, footnote, cardStyle }: BankCardProps) {
  const t = useT();
  const b = getBank(bank);
  const name = bankName(t, bank);
  const amount = hidden ? '••••••' : formatMoney(balance, currency);
  const a11y = `${t(last4 ? 'common.bankCardA11yLast4' : 'common.bankCardA11y', { bank: name, type: accountType, last4: last4 ?? '', amount: hidden ? t('common.balanceHidden') : amount })}${footnote ? `, ${footnote}` : ''}`;
  const w = width ?? 280;
  const h = w / CARD_RATIO;
  const fg = b.onColor;
  const [g0, g1, g2] = cardGradient(b.color, fg);
  // Id gradasi unik per kartu: di web id SVG berlaku untuk seluruh dokumen.
  const gid = `bc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const px = (pct: number) => (w * pct) / 100;
  const ink = { color: fg };
  const small = { fontFamily: fonts.medium, fontSize: px(3.1), lineHeight: px(4.1) };

  const face = (
    <View style={[styles.shadow, { width: w, height: h, borderRadius: px(5) }]}>
      <View style={[styles.clip, { borderRadius: px(5) }]}>
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
        <PatternLayer pattern={patternFor(type, cardStyle)} color={fg} w={w} h={h} />

        {/* Strip atas: inilah yang terlihat saat kartu bertumpuk. */}
        <View style={[styles.top, { paddingTop: px(5), paddingHorizontal: px(5.6), gap: px(4) }]}>
          <View style={styles.col}>
            <AppText numberOfLines={1} style={[ink, { fontFamily: fonts.extrabold, fontSize: px(5.6), lineHeight: px(6.5), letterSpacing: -px(0.17) }]}>
              {name}
            </AppText>
            <AppText numberOfLines={1} style={[ink, small]}>
              {`${accountType} · ${currency}`}
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
          {hasChip(type) ? <Chip w={px(12.5)} id={`${gid}c`} /> : <View />}
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
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  col: { flexShrink: 1, minWidth: 0 },
  right: { alignItems: 'flex-end' },
  mid: { position: 'absolute', top: '41%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottom: { position: 'absolute' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  flex: { flex: 1 },
});
