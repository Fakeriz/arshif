import { FnError } from '@/data/remote/functions';
import { UploadError } from '@/data/remote/upload';
import { EmptyState } from '@/components/ui';
import { useT, type MsgKey } from '@/i18n';

/**
 * Jenis kegagalan yang dibedakan layar capture. Semua jenis selain `quota` berarti kuota tidak terpotong
 * (server mengembalikan kuota bila pekerjaan AI gagal).
 */
export type CaptureFailure = 'quota' | 'unreadable' | 'encrypted_pdf' | 'too_large' | 'rate_limited' | 'network' | 'session' | 'server' | 'permission' | 'too_short';

export function failureOf(e: unknown): CaptureFailure {
  if (e instanceof UploadError) return e.code;
  if (!(e instanceof FnError)) return 'network';
  switch (e.code) {
    case 'quota':
    case 'unreadable':
    case 'encrypted_pdf':
    case 'too_large':
    case 'rate_limited':
    case 'network':
      return e.code;
    case 'unauthorized':
      return 'session';
    default:
      return 'server';
  }
}

type Flow = 'scan' | 'voice' | 'import';

/** Teks judul/pesan per jenis kegagalan; yang khas per alur memakai kunci alur itu. */
function keys(flow: Flow, f: CaptureFailure): [MsgKey, MsgKey] {
  if (f === 'unreadable') return [`capture.${flow}.failedTitle`, `capture.${flow}.failedMessage`];
  if (f === 'encrypted_pdf') return ['capture.import.encryptedTitle', 'capture.import.encryptedMessage'];
  if (f === 'permission') return flow === 'voice' ? ['capture.voice.permissionTitle', 'capture.voice.permissionMessage'] : ['capture.scan.permissionTitle', 'capture.scan.permissionMessage'];
  if (f === 'too_short') return ['capture.voice.tooShortTitle', 'capture.voice.tooShortMessage'];
  if (f === 'too_large') return ['capture.error.tooLargeTitle', 'capture.error.tooLargeMessage'];
  if (f === 'rate_limited') return ['capture.error.rateLimitedTitle', 'capture.error.rateLimitedMessage'];
  if (f === 'network') return ['capture.error.networkTitle', 'capture.error.networkMessage'];
  if (f === 'session') return ['capture.error.sessionTitle', 'capture.error.sessionMessage'];
  return ['capture.error.serverTitle', 'capture.error.serverMessage'];
}

const MAX: Record<Flow, string> = { scan: '8 MB', voice: '60 s', import: '15 MB' };

/** State gagal untuk alur capture, dengan satu aksi untuk mencoba lagi. `quota` ditangani lewat paywall. */
export function CaptureError({ flow, failure, actionLabel, onAction }: { flow: Flow; failure: CaptureFailure; actionLabel: string; onAction: () => void }) {
  const t = useT();
  const [title, message] = keys(flow, failure);
  return <EmptyState kind="error" title={t(title)} message={t(message, { max: MAX[flow] })} actionLabel={actionLabel} onAction={onAction} />;
}
