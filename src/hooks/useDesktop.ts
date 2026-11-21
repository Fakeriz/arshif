import { Platform, useWindowDimensions } from 'react-native';

/** Lebar minimum layout desktop (nav atas + grid kartu). Di bawah ini web tetap memakai layout ponsel. */
export const DESKTOP_MIN = 1024;

/** Web di layar lebar: nav pill atas ala Talmo menggantikan tab bar bawah. Native selalu layout ponsel. */
export function useDesktop() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN;
}
