import { Image } from 'expo-image';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

import type { Asset } from '@/data/assets';
import {
  resolveAssetVisual,
  resolveBalanceRowVisual,
  resolveSymbolVisual,
  type AssetVisualSpec,
  type BalanceRowKind,
  type LogoSource,
} from '@/lib/assetIcons';
import type { SymbolOption } from '@/lib/symbols';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, iconBox, type IconBoxSize, layout, radius } from '@/theme/tokens';

import { Icon } from './Icon';

export type AssetIconProps = {
  asset?: Pick<Asset, 'type' | 'symbol' | 'name' | 'notes'>;
  symbolOption?: SymbolOption;
  kind?: BalanceRowKind;
  size?: IconBoxSize;
  accessibilityLabel?: string;
};

function monogramFontSize(size: IconBoxSize, length: number): number {
  if (length <= 1) return Math.round(size * 0.42);
  if (length === 2) return Math.round(size * 0.36);
  if (length === 3) return Math.round(size * 0.3);
  return Math.round(size * 0.25);
}

function resolveSpec(props: Pick<AssetIconProps, 'asset' | 'symbolOption' | 'kind'>): AssetVisualSpec {
  if (props.symbolOption) return resolveSymbolVisual(props.symbolOption);
  if (props.kind) return resolveBalanceRowVisual(props.kind);
  if (props.asset) return resolveAssetVisual(props.asset);
  return resolveBalanceRowVisual('cash');
}

function RemoteLogo({
  urls,
  size,
  fallback,
}: {
  urls: LogoSource[];
  size: IconBoxSize;
  fallback: ReactNode;
}) {
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const current = urls[idx];
  const showFallback = !current || !loaded;
  const pad = Math.round(size * 0.14);

  return (
    <>
      {showFallback && fallback}
      {current && (
        <View
          style={[
            StyleSheet.absoluteFill,
            current.kind === 'contain' && loaded && { backgroundColor: '#F4F4F2', padding: pad },
            !loaded && styles.hidden,
          ]}
        >
          <Image
            key={current.url}
            source={{ uri: current.url }}
            style={styles.fill}
            contentFit={current.kind === 'badge' ? 'cover' : 'contain'}
            cachePolicy="memory-disk"
            transition={120}
            accessible={false}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setLoaded(false);
              setIdx((i) => i + 1);
            }}
          />
        </View>
      )}
    </>
  );
}

/**
 * Ikon aset multi-sumber dengan fallback progresif (logo remote -> monogram Monokrom / ikon Lucide).
 * Dekoratif secara bawaan agar label aksesibilitas baris daftar tidak terduplikasi.
 */
export function AssetIcon({ asset, symbolOption, kind, size = 40, accessibilityLabel }: AssetIconProps) {
  const { colors } = useTheme();
  const spec = resolveSpec({ asset, symbolOption, kind });
  const urlKey = spec.urls.map((u) => u.url).join('|');
  const decorative = !accessibilityLabel;

  const monoFontSize = spec.monogram ? monogramFontSize(size, spec.monogram.length) : 0;
  const fallback = spec.monogram ? (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgText
        x={size / 2}
        y={Number((size / 2 + monoFontSize * 0.35).toFixed(2))}
        textAnchor="middle"
        fill={colors.text}
        fontFamily={fonts.bold}
        fontSize={monoFontSize}
        letterSpacing={-0.3}
      >
        {spec.monogram}
      </SvgText>
    </Svg>
  ) : (
    <Icon icon={spec.icon} color={colors.text} size={iconBox[size].icon} />
  );

  return (
    <View
      accessible={!decorative}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      aria-hidden={decorative || undefined}
      style={[
        styles.box,
        {
          width: size,
          height: size,
          backgroundColor: colors.fill,
          borderColor: colors.border,
        },
      ]}
    >
      {spec.urls.length > 0 ? <RemoteLogo key={urlKey} urls={spec.urls} size={size} fallback={fallback} /> : fallback}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.hairline,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  hidden: {
    opacity: 0,
  },
});
