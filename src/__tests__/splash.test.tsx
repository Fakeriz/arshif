import { act, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import {
  ArshifSplash,
  SPLASH_MICRO_BEAT_MS,
  SPLASH_MIN_HOLD_MS,
  SPLASH_REDUCED_FADE_MS,
  SPLASH_REDUCED_HOLD_MS,
  SPLASH_SLOW_BOOT_MS,
  SPLASH_UNRAVEL_MS,
  SPLASH_VEIL_FADE_MS,
} from '@/components/shell/ArshifSplash';
import { ThemeProvider } from '@/theme/ThemeProvider';

const wrap = (ui: ReactElement, mode: 'dark' | 'light' = 'dark') =>
  render(<ThemeProvider initialMode={mode}>{ui}</ThemeProvider>);

const hostTypes = (node: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(node)) node.forEach((n) => hostTypes(n, out));
  else if (node && typeof node === 'object' && 'type' in node) {
    out.add(String(node.type));
    hostTypes((node as { children?: unknown }).children, out);
  }
  return out;
};

describe('ArshifSplash', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('menahan selama booting, beralih pointerEvents="none" saat keluar, lalu memanggil onFinish', async () => {
    const onReady = jest.fn();
    const onFinish = jest.fn();
    const r = await wrap(<ArshifSplash booting onReady={onReady} onFinish={onFinish} />);

    expect(screen.getByTestId('arshif-splash').props.pointerEvents).toBe('auto');

    await act(async () => {
      jest.advanceTimersByTime(SPLASH_MIN_HOLD_MS + 100);
    });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByTestId('arshif-splash').props.pointerEvents).toBe('auto');

    await r.rerender(
      <ThemeProvider initialMode="dark">
        <ArshifSplash booting={false} onReady={onReady} onFinish={onFinish} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('arshif-splash').props.pointerEvents).toBe('none');
    expect(onFinish).not.toHaveBeenCalled();

    const totalExit = SPLASH_UNRAVEL_MS + SPLASH_MICRO_BEAT_MS + SPLASH_VEIL_FADE_MS;
    await act(async () => {
      jest.advanceTimersByTime(totalExit - 10);
    });
    expect(onFinish).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(20);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('menampilkan keterangan muat hanya jika booting lebih dari 800 ms', async () => {
    const onFinish = jest.fn();
    await wrap(<ArshifSplash booting onFinish={onFinish} />);

    expect(screen.queryByText('Memuat datamu')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(SPLASH_SLOW_BOOT_MS - 50);
    });
    expect(screen.queryByText('Memuat datamu')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(60);
    });
    expect(screen.getByText('Memuat datamu')).toBeTruthy();
  });

  it('mode reduced motion langsung pudar singkat tanpa menunggu durasi unravel penuh', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const onFinish = jest.fn();
    await wrap(<ArshifSplash booting={false} onFinish={onFinish} />);

    await act(async () => {
      jest.advanceTimersByTime(SPLASH_REDUCED_HOLD_MS);
    });
    expect(screen.getByTestId('arshif-splash').props.pointerEvents).toBe('none');
    expect(onFinish).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(SPLASH_REDUCED_FADE_MS);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('mendukung tema gelap sesuai token Monokrom dan tanpa RNSVGRadialGradient', async () => {
    const dark = await wrap(<ArshifSplash booting={false} onFinish={jest.fn()} />, 'dark');
    expect(StyleSheet.flatten(screen.getByTestId('arshif-splash').props.style).backgroundColor).toBe('#0D0D0D');
    expect(hostTypes(dark.toJSON()).has('RNSVGRadialGradient')).toBe(false);
  });

  it('mendukung tema terang sesuai token Monokrom dan tanpa RNSVGRadialGradient', async () => {
    const light = await wrap(<ArshifSplash booting={false} onFinish={jest.fn()} />, 'light');
    expect(StyleSheet.flatten(screen.getByTestId('arshif-splash').props.style).backgroundColor).toBe('#E5E5E2');
    expect(hostTypes(light.toJSON()).has('RNSVGRadialGradient')).toBe(false);
  });
});
