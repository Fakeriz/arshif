// app/api/_handlers/http.js
// Helper HTTP bersama untuk semua handler API catch-all:
// response json/err, batas ukuran payload, daftar MIME, dan util base64/bounded-read.
import { NextResponse } from 'next/server'

export const json = (data, status = 200) => NextResponse.json(data, { status })
export const err = (message, status = 400) => NextResponse.json({ error: message }, { status })

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_PDF_BYTES = 9 * 1024 * 1024
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024

export const AUDIO_MIME_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'])
export const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export function base64ByteLength(value) {
  const normalized = String(value || '').replace(/\s/g, '')
  if (!normalized || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return 0
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding)
}

export async function readBoundedResponse(res, maxBytes) {
  const declaredLength = Number(res.headers.get('content-length') || 0)
  if (declaredLength > maxBytes || !res.body) return null
  const chunks = []
  let total = 0
  for await (const chunk of res.body) {
    total += chunk.length
    if (total > maxBytes) return null
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks, total)
}

// Resolusi path di dalam catch-all /api/[[...path]].
// Urutan sama dengan implementasi lama: pathname URL dulu, fallback ctx.params.
export async function resolveApiPath(request, ctx) {
  try {
    const urlObj = new URL(request.url)
    return urlObj.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '')
  } catch {
    const resolved = await ctx?.params
    return (resolved?.path || []).join('/')
  }
}
