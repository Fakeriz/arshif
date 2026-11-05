import { FileText, Mic, PenLine, ScanLine, type LucideIcon } from 'lucide-react-native';

import type { TFunction } from '@/i18n';
import { QUOTAS } from '@/lib/quota';
import type { useLimits } from '@/state/limits';

export type CaptureKey = 'scan' | 'voice' | 'pdf' | 'manual';

export type CaptureOption = {
  key: CaptureKey;
  title: string;
  short: string;
  sub: string;
  icon: LucideIcon;
  href: '/scan' | '/voice' | '/import' | '/tambah';
  limited: boolean;
  /** Alasan spesifik untuk sheet Premium bila kuota habis. */
  reason: string;
};

const { free, premium } = QUOTAS;

/** Satu sumber untuk sheet "+ Catat" dan panel aksi cepat di Home. */
export function captureOptions(limits: ReturnType<typeof useLimits>, t: TFunction): CaptureOption[] {
  return [
    {
      key: 'scan', title: t('shell.capture.scan.title'), short: t('shell.capture.scan.short'), icon: ScanLine, href: '/scan', limited: limits.scan,
      sub: limits.scan ? t('shell.capture.scan.subLimited') : t('shell.capture.scan.sub', { count: limits.scanLeft ?? 0 }),
      reason: t('shell.capture.scan.reason', { free: free.scan ?? 0, premium: premium.scan ?? 0 }),
    },
    {
      key: 'voice', title: t('shell.capture.voice.title'), short: t('shell.capture.voice.short'), icon: Mic, href: '/voice', limited: limits.automation,
      sub: limits.automation ? t('shell.capture.voice.subLimited') : t('shell.capture.voice.sub'),
      reason: t('shell.capture.voice.reason', { free: free.automation ?? 0 }),
    },
    {
      key: 'pdf', title: t('shell.capture.pdf.title'), short: t('shell.capture.pdf.short'), icon: FileText, href: '/import', limited: limits.importPdf,
      sub: limits.importPdf ? t('shell.capture.pdf.subLimited') : t('shell.capture.pdf.sub', { count: limits.importLeft ?? 0 }),
      reason: t('shell.capture.pdf.reason', { free: free.importPdf ?? 0, premium: premium.importPdf ?? 0 }),
    },
    { key: 'manual', title: t('shell.capture.manual.title'), short: t('shell.capture.manual.short'), icon: PenLine, href: '/tambah', limited: false, sub: t('shell.capture.manual.sub'), reason: '' },
  ];
}
