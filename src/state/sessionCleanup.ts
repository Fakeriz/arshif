import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { saveWebToken } from '@/features/backup/driveToken';
import { clearAllHandoffs } from '@/features/capture/handoff';

/** Clears user-scoped caches, backup keys, Drive tokens, and in-memory AI handoffs on sign-out or account switch. */
export async function clearUserLocalData(userId?: string | null): Promise<void> {
  saveWebToken(null);
  clearAllHandoffs();
  const keys = ['arshif.drive.history', 'arshif.backup.lastAt', 'arshif.backup.everyDays', 'arshif.smartlog.held'];
  if (userId) keys.push(`arshif.smartlog.held.${userId}`);
  const secureCleanup =
    Platform.OS !== 'web' && typeof SecureStore.deleteItemAsync === 'function'
      ? SecureStore.deleteItemAsync('arshif.backup.key').catch(() => undefined)
      : Promise.resolve();
  await Promise.all([AsyncStorage.multiRemove(keys).catch(() => undefined), secureCleanup]);
}
