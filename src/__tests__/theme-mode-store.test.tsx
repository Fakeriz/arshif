import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';

import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

let api: ReturnType<typeof useTheme>;
function Probe() {
  api = useTheme();
  return null;
}

describe('ThemeProvider menyimpan tema di perangkat', () => {
  it('setMode menyimpan pilihan, dan tema tersimpan dipakai saat dibuka lagi', async () => {
    await render(<ThemeProvider><Probe /></ThemeProvider>);
    await act(async () => api.setMode('light'));
    expect(await AsyncStorage.getItem('arshif.themeMode')).toBe('light');

    await render(<ThemeProvider><Probe /></ThemeProvider>);
    await act(async () => undefined);
    expect(api.mode).toBe('light');
  });
});
