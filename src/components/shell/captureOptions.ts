import { FileText, Mic, PenLine, ScanLine, type LucideIcon } from 'lucide-react-native';

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

/** Satu sumber untuk sheet "+ Catat" dan panel aksi cepat di Home. */
export function captureOptions(limits: ReturnType<typeof useLimits>): CaptureOption[] {
  return [
    {
      key: 'scan', title: 'Scan Struk', short: 'Scan Struk', icon: ScanLine, href: '/scan', limited: limits.scan,
      sub: limits.scan ? 'Kuota scan bulan ini habis' : `Foto struk, AI isi semuanya · ${limits.scanLeft} scan tersisa`,
      reason: 'Kuota scan struk Free (20/bulan) sudah habis. Reset tanggal 1, atau upgrade untuk 300 scan/bulan.',
    },
    {
      key: 'voice', title: 'Voice Log', short: 'Voice Log', icon: Mic, href: '/voice', limited: limits.automation,
      sub: limits.automation ? 'Kuota automation bulan ini habis' : 'Ucapkan, langsung tercatat',
      reason: 'Kuota automation Free (30/bulan, termasuk Voice Log) sudah habis. Upgrade untuk tanpa batas.',
    },
    {
      key: 'pdf', title: 'Import Rekening Koran', short: 'Import PDF', icon: FileText, href: '/import', limited: limits.importPdf,
      sub: limits.importPdf ? 'Kuota import bulan ini habis' : `PDF dari bank · ${limits.importLeft} import tersisa bulan ini`,
      reason: 'Import PDF Free (1/bulan) sudah terpakai. Upgrade untuk 10 import/bulan.',
    },
    { key: 'manual', title: 'Catat Manual', short: 'Manual', icon: PenLine, href: '/tambah', limited: false, sub: 'Isi sendiri nominal dan kategori', reason: '' },
  ];
}
