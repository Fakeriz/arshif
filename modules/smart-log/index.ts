import { requireOptionalNativeModule, type EventSubscription } from 'expo';

type NativeSmartLog = {
  hasPermission(): boolean;
  openPermissionSettings(): void;
  configure(enabled: boolean, packages: string[]): void;
  drain(): string;
  pendingCount(): number;
  addListener(event: 'onCapture', listener: () => void): EventSubscription;
};

/** null di iOS, web, dan Expo Go: Smart Log butuh development build Android. */
export const SmartLogNative = requireOptionalNativeModule<NativeSmartLog>('ArshifSmartLog');
