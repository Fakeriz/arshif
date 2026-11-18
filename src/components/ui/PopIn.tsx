import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useEnter, usePresence } from '@/theme/motion';

import { Icon } from './Icon';

type PopInProps = { visible: boolean; children: ReactNode; style?: StyleProp<ViewStyle>; from?: number };

/** Anak tetap terpasang; muncul/hilang dengan skala + opasitas. Saat tersembunyi tidak bisa disentuh atau dibaca. */
export function PopIn({ visible, children, style, from }: PopInProps) {
  const anim = usePresence(visible, from);
  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} aria-hidden={!visible} style={[style, anim]}>
      {children}
    </Animated.View>
  );
}

/** Anak "meletup" sekali saat dipasang. Pakai untuk elemen yang dirender bersyarat. */
export function PopOnMount({ children, style, delay }: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const anim = useEnter({ scale: 0.4, delay });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Centang yang meletup saat `visible`. Murni dekoratif: status dibaca dari kontrol induknya. */
export function AnimatedCheck({ visible, color, size = 16 }: { visible: boolean; color: string; size?: number }) {
  return (
    <PopIn visible={visible} from={0.3}>
      <Icon icon={Check} color={color} size={size} />
    </PopIn>
  );
}
