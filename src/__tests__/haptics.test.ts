import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { haptic, loadHapticLevel, useHapticLevel } from '@/theme/motion';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Soft: 'soft' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  AndroidHaptics: {},
}));

describe('intensitas haptic', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Mati: tidak ada getaran; pilihan tersimpan per perangkat', async () => {
    const { result } = await renderHook(() => useHapticLevel());
    await act(() => result.current[1]('off'));
    haptic('tap');
    haptic('selection');
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('arshif.hapticLevel')).toBe('off');
  });

  it('Lembut (iOS): tap memakai impact Soft', async () => {
    const { result } = await renderHook(() => useHapticLevel());
    await act(() => result.current[1]('soft'));
    haptic('tap');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('soft');
  });

  it('Kuat: tap memakai impact Light seperti sebelumnya', async () => {
    const { result } = await renderHook(() => useHapticLevel());
    await act(() => result.current[1]('strong'));
    haptic('tap');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('nilai tersimpan dibaca saat aplikasi mulai', async () => {
    await AsyncStorage.setItem('arshif.hapticLevel', 'off');
    await loadHapticLevel();
    const { result } = await renderHook(() => useHapticLevel());
    expect(result.current[0]).toBe('off');
  });
});
