import { requireOptionalNativeModule } from 'expo';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * HTML -> PDF lewat expo-print, lalu lembar bagikan sistem (FR-INV-2, FR-TAX-3).
 * Dev build sebelum Fase 6 tidak punya modul native ExpoPrint: dicek dulu supaya tidak crash.
 */

export class PdfUnavailableError extends Error {
  constructor() {
    super('pdf_unavailable');
  }
}

export function pdfSupported(): boolean {
  if (Platform.OS === 'web') return typeof document !== 'undefined';
  return requireOptionalNativeModule('ExpoPrint') !== null;
}

/** Nama berkas aman: huruf, angka, strip. */
export const pdfName = (base: string): string => `${base.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'arshif'}.pdf`;

/**
 * Native: buat PDF di cache dengan nama yang terbaca, lalu buka lembar bagikan.
 * Web: buka dialog cetak browser untuk HTML itu saja (simpan sebagai PDF dari sana).
 */
export async function sharePdf(html: string, fileBase: string): Promise<void> {
  if (Platform.OS === 'web') {
    printOnWeb(html);
    return;
  }
  if (!pdfSupported()) throw new PdfUnavailableError();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Print = require('expo-print') as typeof import('expo-print');
  const { uri } = await Print.printToFileAsync({ html });
  const name = pdfName(fileBase);
  const target = new File(Paths.cache, name);
  if (target.exists) target.delete();
  new File(uri).move(target);
  try {
    await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name });
  } finally {
    try {
      if (target.exists) target.delete();
    } catch {
      /* abaikan gagal hapus cache */
    }
  }
}

function printOnWeb(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.srcdoc = html;
  const cleanup = () => frame.remove();
  frame.onload = () => {
    const win = frame.contentWindow;
    win?.addEventListener('afterprint', cleanup, { once: true });
    win?.focus();
    win?.print();
    const timer = setTimeout(cleanup, 60_000);
    (timer as unknown as { unref?: () => void })?.unref?.();
  };
  document.body.appendChild(frame);
}
