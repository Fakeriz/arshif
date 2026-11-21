import { useRouter } from 'expo-router';
import { Camera, FileText, Images, Layers, type LucideIcon } from 'lucide-react-native';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { BottomSheet, IconTile, ListItem } from '@/components/ui';
import { MAX_MULTI, SCAN_SOURCES, startScanFromSheet, type ScanSource } from '@/features/capture/scanLaunch';
import { useT } from '@/i18n';
import { useLimits } from '@/state/limits';

const ScanSourceContext = createContext<(() => void) | null>(null);

/** Buka sheet pilihan sumber struk (foto, galeri, beberapa struk, PDF) dari layar mana pun. Kuota dicek pemanggil. */
export function useScanSource(): () => void {
  const open = useContext(ScanSourceContext);
  if (!open) throw new Error('useScanSource harus dipakai di dalam <ScanSourceProvider>');
  return open;
}

const ICONS: Record<ScanSource, LucideIcon> = { camera: Camera, gallery: Images, multi: Layers, pdf: FileText };

export function ScanSourceProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const router = useRouter();
  const t = useT();
  // Beberapa struk = beberapa kuota: jangan pilih lebih banyak dari sisa kuota.
  const left = useLimits().scanLeft;
  const limit = Math.max(1, Math.min(MAX_MULTI, left ?? MAX_MULTI));

  return (
    <ScanSourceContext.Provider value={open}>
      {children}
      <BottomSheet visible={visible} onClose={() => setVisible(false)} title={t('capture.source.title')} subtitle={t('capture.source.subtitle')}>
        {SCAN_SOURCES.map((s, i) => (
          <ListItem
            key={s}
            leading={<IconTile icon={ICONS[s]} />}
            title={t(`capture.source.${s}`)}
            subtitle={s === 'multi' ? t('capture.source.multiSub', { count: limit }) : t(`capture.source.${s}Sub`)}
            subtitleLines={2}
            chevron
            divider={i < SCAN_SOURCES.length - 1}
            onPress={() => {
              setVisible(false);
              startScanFromSheet(s, (h) => router.push(h), limit);
            }}
          />
        ))}
      </BottomSheet>
    </ScanSourceContext.Provider>
  );
}
