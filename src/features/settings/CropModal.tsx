import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Modal, PanResponder, StyleSheet, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AppText, Button, Slider } from '@/components/ui';
import { useT } from '@/i18n';
import { clampOffset, cropRect, displayScale, ZOOM_MAX, type Rect, type Size } from '@/lib/crop';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';

export type CropShape = 'circle' | 'wide';

const MARGIN = 32;

function dist(e: GestureResponderEvent): number {
  const [a, b] = e.nativeEvent.touches;
  return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
}

/**
 * Atur potongan foto: geser (jari/mouse), perbesar (cubit atau slider), lalu "Gunakan".
 * Lingkaran untuk foto profil, 2:1 untuk sampul (sama dengan kartu profil). Area di luar bingkai diredupkan dengan warna latar supaya tetap terlihat
 * apa yang terpotong. PanResponder (bukan gesture-handler) karena berjalan sama di dalam Modal native dan di web.
 */
export function CropModal({ image, shape, onCancel, onConfirm }: { image: { uri: string } & Size; shape: CropShape; onCancel: () => void; onConfirm: (rect: Rect) => void }) {
  const t = useT();
  const { colors } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const areaW = Math.min(screenW, layout.maxContentWidth) - MARGIN;
  const frame: Size = shape === 'circle' ? { w: Math.min(areaW - 48, 320), h: Math.min(areaW - 48, 320) } : { w: areaW, h: Math.round(areaW / 2) };
  const areaH = frame.h + (shape === 'circle' ? 48 : 120);
  const [view, setView] = useState({ zoom: 1, tx: 0, ty: 0 });
  // Handler gestur membaca keadaan lewat ref (bukan closure render lama); ref hanya ditulis di handler/efek.
  const viewRef = useRef(view);
  const geo = useRef({ image, frame });
  useEffect(() => {
    geo.current = { image, frame };
  });
  const start = useRef({ zoom: 1, tx: 0, ty: 0, dist: 0 });

  const set = (zoom: number, tx: number, ty: number) => {
    const z = Math.min(ZOOM_MAX, Math.max(1, zoom));
    const next = { zoom: z, ...clampOffset(geo.current.image, geo.current.frame, z, tx, ty) };
    viewRef.current = next;
    setView(next);
  };

  // Ref hanya dibaca di dalam handler gestur, bukan saat render (positif palsu lint, pola sama dengan BottomSheet).
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => (start.current = { ...viewRef.current, dist: dist(e) }),
      onPanResponderMove: (e, g) => {
        const st = start.current;
        const d = dist(e);
        if (d && !st.dist) start.current = { ...viewRef.current, dist: d }; // jari kedua baru turun
        else if (d && st.dist) set(st.zoom * (d / st.dist), st.tx, st.ty);
        else set(st.zoom, st.tx + g.dx, st.ty + g.dy);
      },
    }),
  );

  const s = displayScale(image, frame, view.zoom);
  const imgStyle = { width: image.w * s, height: image.h * s, left: areaW / 2 - (image.w * s) / 2 + view.tx, top: areaH / 2 - (image.h * s) / 2 + view.ty };
  const fx = (areaW - frame.w) / 2;
  const fy = (areaH - frame.h) / 2;
  const r = frame.w / 2;
  const hole =
    shape === 'circle'
      ? `M${fx},${fy + r} a${r},${r} 0 1,0 ${frame.w},0 a${r},${r} 0 1,0 ${-frame.w},0 Z`
      : `M${fx},${fy} h${frame.w} v${frame.h} h${-frame.w} Z`;

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={styles.head}>
          <AppText variant="h2" accessibilityRole="header">
            {shape === 'circle' ? t('settings.profile.cropPhoto') : t('settings.profile.cropCover')}
          </AppText>
          <AppText variant="caption" tone="secondary" style={styles.center}>
            {t('settings.profile.cropHint')}
          </AppText>
        </View>
        <View
          style={[styles.area, { width: areaW, height: areaH }]}
          accessibilityLabel={t('settings.profile.cropHint')}
          {...pan.panHandlers}
        >
          <Image source={{ uri: image.uri }} style={[styles.img, imgStyle]} contentFit="fill" accessible={false} />
          <Svg width={areaW} height={areaH} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path d={`M0,0 H${areaW} V${areaH} H0 Z ${hole}`} fill={colors.bg} fillOpacity={0.78} fillRule="evenodd" />
            <Path d={hole} fill="none" stroke={colors.text} strokeWidth={1.5} />
          </Svg>
        </View>
        <View style={[styles.controls, { width: areaW }]}>
          <AppText variant="caption" tone="secondary">
            {t('settings.profile.cropZoom')}
          </AppText>
          <Slider value={view.zoom} min={1} max={ZOOM_MAX} step={0.05} onChange={(z) => set(z, view.tx, view.ty)} accessibilityLabel={t('settings.profile.cropZoom')} />
          <View style={styles.buttons}>
            <View style={styles.flex}>
              <Button label={t('common.cancel')} variant="secondary" fullWidth onPress={onCancel} />
            </View>
            <View style={styles.flex}>
              <Button label={t('settings.profile.cropUse')} fullWidth onPress={() => onConfirm(cropRect(image, frame, view.zoom, view.tx, view.ty))} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  head: { alignItems: 'center', gap: space.xs, paddingHorizontal: space.lg },
  area: { overflow: 'hidden', borderRadius: 14 },
  img: { position: 'absolute' },
  controls: { gap: space.sm },
  buttons: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
});
