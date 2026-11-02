// Konteks coach dikirim dalam TOON (Token-Oriented Object Notation) supaya
// hemat token di setiap chat. JSON tetap dipakai server sebagai fallback bila
// encoding gagal atau client lama belum mengirim contextToon.
import { encode } from '@toon-format/toon'

export function encodeCoachContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return null
  try {
    const text = encode(ctx)
    return typeof text === 'string' && text.trim() ? text : null
  } catch {
    return null
  }
}
