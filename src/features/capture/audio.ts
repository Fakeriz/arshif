import { Platform } from 'react-native';

import { readBytes, toBase64 } from '@/data/remote/upload';

const ALLOWED = ['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg'] as const;
export type AudioMime = (typeof ALLOWED)[number];

/** Jenis audio rekaman: native = m4a (AAC dalam MP4), web = sesuai MediaRecorder peramban (umumnya webm). */
async function mimeOf(uri: string): Promise<AudioMime> {
  if (Platform.OS === 'web') {
    const type = (await (await fetch(uri)).blob()).type.split(';')[0] as AudioMime;
    return ALLOWED.includes(type) ? type : 'audio/webm';
  }
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'webm') return 'audio/webm';
  if (ext === 'mp3') return 'audio/mpeg';
  return 'audio/mp4';
}

export async function readRecording(uri: string): Promise<{ audio: string; mimeType: AudioMime }> {
  const [bytes, mimeType] = await Promise.all([readBytes(uri), mimeOf(uri)]);
  return { audio: toBase64(bytes), mimeType };
}

/** Metering mikrofon (dBFS, -160 sampai 0) → 0–1 untuk tinggi gelombang. -50 dB dianggap senyap. */
export function levelFromMetering(db: number | undefined): number | undefined {
  if (db === undefined || Number.isNaN(db)) return undefined;
  return Math.min(1, Math.max(0, (db + 50) / 50));
}
