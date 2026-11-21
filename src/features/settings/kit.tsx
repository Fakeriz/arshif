import type { ReactNode } from 'react';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { Group } from '@/components/ui';

/** Kerangka layar turunan Pengaturan: header kembali + judul, konten dengan jarak yang sama. */
export function SettingsScreen({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Screen>
      <ScreenHeader title={title} right={right} />
      {children}
    </Screen>
  );
}

/** Kartu pengaturan dengan label grup di atas (dipakai di layar turunan). */
export function SettingsSection({ label, children }: { label?: string; children: ReactNode }) {
  return <Group label={label}>{children}</Group>;
}
