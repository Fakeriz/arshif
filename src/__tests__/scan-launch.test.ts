import { Platform } from 'react-native';

const mockLaunch = jest.fn();
jest.mock('expo-image-picker', () => ({ launchCameraAsync: (...a: unknown[]) => mockLaunch(...a) }));

import { openCapture, takePendingPick } from '@/features/capture/scanLaunch';

describe('openCapture: kamera web dibuka di dalam ketukan', () => {
  const os = Platform.OS;
  afterEach(() => {
    Platform.OS = os;
    mockLaunch.mockReset();
    takePendingPick();
  });

  it('web + Scan: kamera dibuka sebelum pindah layar, fotonya diambil sekali oleh layar Scan', () => {
    Platform.OS = 'web';
    const order: string[] = [];
    mockLaunch.mockImplementation(() => (order.push('camera'), Promise.resolve({ canceled: true, assets: null })));
    openCapture('/scan', () => order.push('go'));
    expect(order).toEqual(['camera', 'go']);
    expect(takePendingPick()).not.toBeNull();
    expect(takePendingPick()).toBeNull();
  });

  it('web + layar lain, atau native: tidak membuka kamera', () => {
    Platform.OS = 'web';
    const go = jest.fn();
    openCapture('/voice', go);
    Platform.OS = 'android';
    openCapture('/scan', go);
    expect(mockLaunch).not.toHaveBeenCalled();
    expect(go).toHaveBeenCalledTimes(2);
    expect(takePendingPick()).toBeNull();
  });
});
