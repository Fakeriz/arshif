import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type FlagCountry = 'ID' | 'MY' | 'TR';

/**
 * Bendera sederhana untuk pemilih negara. Warna di sini adalah warna bendera nasional (simbol negara), bukan warna
 * antarmuka, jadi sengaja tidak memakai token tema. Bentuk disederhanakan untuk ukuran ikon (16-20 px), dekoratif:
 * nama negara selalu tampil di sebelahnya, jadi bendera disembunyikan dari pembaca layar.
 */
export function Flag({ country, width = 20 }: { country: FlagCountry; width?: number }) {
  const h = (width * 2) / 3;
  return (
    <Svg width={width} height={h} viewBox="0 0 30 20" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {country === 'ID' && (
        <>
          <Rect width={30} height={10} fill="#CE1126" />
          <Rect y={10} width={30} height={10} fill="#FFFFFF" />
        </>
      )}
      {country === 'TR' && (
        <>
          <Rect width={30} height={20} fill="#E30A17" />
          <Circle cx={11} cy={10} r={5} fill="#FFFFFF" />
          <Circle cx={12.3} cy={10} r={4} fill="#E30A17" />
          <Path d="M16.2 10 l3.4 -1.1 -2.1 2.9 0 -3.6 2.1 2.9z" fill="#FFFFFF" />
        </>
      )}
      {country === 'MY' && (
        <>
          {Array.from({ length: 14 }, (_, i) => (
            <Rect key={i} y={(20 / 14) * i} width={30} height={20 / 14} fill={i % 2 === 0 ? '#CC0001' : '#FFFFFF'} />
          ))}
          <Rect width={15} height={(20 / 14) * 8} fill="#010066" />
          <Circle cx={5.6} cy={5.7} r={3.4} fill="#FFCC00" />
          <Circle cx={6.6} cy={5.7} r={2.8} fill="#010066" />
          <Path d="M10.6 5.7 l1.7 -0.6 -1 1.5 0 -1.8 1 1.5z" fill="#FFCC00" />
        </>
      )}
    </Svg>
  );
}
