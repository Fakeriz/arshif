import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { motion, type as typeScale, type TypeVariant } from '@/theme/tokens';

import { AppText, type TextTone } from './AppText';

export type RollingNumberProps = {
  /** Teks yang sudah diformat, mis. "Rp 1.500.000" atau "47:12". */
  value: string;
  variant?: TypeVariant;
  tone?: TextTone;
  /** 1 = angka naik (masuk dari bawah), -1 = turun (masuk dari atas). */
  direction?: 1 | -1;
  accessibilityLabel?: string;
};

/**
 * Angka yang tiap karakternya bergulir saat berubah. Hanya karakter yang berubah yang bergerak,
 * jadi "Rp 1.500.000" → "Rp 1.650.000" cuma menggulirkan dua digit. Pembaca layar membaca nilai utuh.
 */
export function RollingNumber({ value, variant = 'amountHero', tone = 'primary', direction = 1, accessibilityLabel }: RollingNumberProps) {
  const chars = value.split('');
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? value} style={styles.row}>
      {chars.map((ch, i) => (
        // Kunci dihitung dari kanan: satuan tetap di slot yang sama walau panjang teks berubah.
        <RollSlot key={chars.length - i} ch={ch} variant={variant} tone={tone} direction={direction} />
      ))}
    </View>
  );
}

type SlotProps = { ch: string; variant: TypeVariant; tone: TextTone; direction: 1 | -1 };

function RollSlot({ ch, ...rest }: SlotProps) {
  const seen = useRef<{ cur: string; prev: string | null }>({ cur: ch, prev: null });
  if (seen.current.cur !== ch) seen.current = { cur: ch, prev: seen.current.cur };
  // Kunci = karakter: pasangan baru dipasang dengan nilai awal 0, jadi tidak ada kedipan satu frame.
  return <RollPair key={ch} cur={ch} prev={seen.current.prev} {...rest} />;
}

function RollPair({ cur, prev, variant, tone, direction }: Omit<SlotProps, 'ch'> & { cur: string; prev: string | null }) {
  const { timing } = useMotion();
  const t = useSharedValue(prev === null ? 1 : 0);
  const travel = typeScale[variant].lineHeight * 0.6 * direction;

  useEffect(() => {
    t.value = timing(1, motion.base);
    // Hanya saat pasangan ini dipasang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const incoming = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * travel }] }));
  const outgoing = useAnimatedStyle(() => ({ opacity: 1 - t.value, transform: [{ translateY: -t.value * travel }] }));

  return (
    <View aria-hidden>
      <Animated.View style={incoming}>
        <AppText variant={variant} tone={tone} numeric>
          {cur === ' ' ? ' ' : cur}
        </AppText>
      </Animated.View>
      {prev !== null && (
        <Animated.View style={[styles.out, outgoing]}>
          <AppText variant={variant} tone={tone} numeric>
            {prev === ' ' ? ' ' : prev}
          </AppText>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  out: { ...StyleSheet.absoluteFill, alignItems: 'center' },
});
