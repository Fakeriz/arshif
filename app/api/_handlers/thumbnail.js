// app/api/_handlers/thumbnail.js
// GET /api/drive/thumbnail dan /api/backup/gdrive/thumbnail:
// proxy thumbnail Google Drive dengan cache in-memory + placeholder SVG.
import { NextResponse } from 'next/server'
import { readBearerToken, getServerSupabase } from '@/lib/api-auth'
import { MAX_THUMBNAIL_BYTES, readBoundedResponse } from './http'
import { receiptCacheGet, receiptCacheDelete } from './receipt-cache'

async function handleDriveThumbnail(request) {
  const authToken = readBearerToken(request)
  if (!authToken) return new NextResponse('Unauthorized', { status: 401 })
  const { data: authData, error: authError } = await getServerSupabase(authToken).auth.getUser(authToken)
  if (authError || !authData?.user) return new NextResponse('Unauthorized', { status: 401 })

  const urlObj = new URL(request.url)
  const id = urlObj.searchParams.get('id') || urlObj.searchParams.get('fileId') || ''
  const size = Math.min(1600, Math.max(80, Number.parseInt(urlObj.searchParams.get('sz') || '800', 10) || 800))
  const merchant = urlObj.searchParams.get('merchant') || 'Google Drive Struk'

  if (!/^[a-zA-Z0-9_-]{1,256}$/.test(id)) return new NextResponse('Invalid id', { status: 400 })

  const cached = receiptCacheGet(id)
  if (cached?.base64) {
    try {
      const buf = Buffer.from(cached.base64, 'base64')
      if (buf.length <= MAX_THUMBNAIL_BYTES) {
        return new NextResponse(buf, {
          status: 200,
          headers: {
            'Content-Type': cached.mimeType || 'image/jpeg',
            'Cache-Control': 'private, max-age=300',
          },
        })
      }
      receiptCacheDelete(id)
    } catch (e) {
      console.warn('Error reading from receipt cache:', e)
      receiptCacheDelete(id)
    }
  }

  if (!id.startsWith('1gDrive_')) {
    const candidates = [
      `https://lh3.googleusercontent.com/d/${id}=w${size}`,
      `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`,
      `https://drive.google.com/uc?export=view&id=${id}`,
    ]

    for (const targetUrl of candidates) {
      try {
        const res = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Arshif receipt thumbnail proxy',
          },
          redirect: 'error',
        })
        const ct = res.headers.get('content-type') || ''
        if (res.ok && (ct.startsWith('image/') || ct === 'application/octet-stream')) {
          const buf = await readBoundedResponse(res, MAX_THUMBNAIL_BYTES)
          if (!buf) continue
          return new NextResponse(buf, {
            status: 200,
            headers: {
              'Content-Type': ct.startsWith('image/') ? ct : 'image/jpeg',
              'Cache-Control': 'private, max-age=300',
            },
          })
        }
      } catch {}
    }
  }

  const cleanMerchant = merchant.slice(0, 22).replace(/[<>&]/g, '')
  const cleanId = id.slice(0, 16).replace(/[<>&]/g, '')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420" fill="none">
    <rect width="600" height="420" fill="#0C0C0E" rx="20"/>
    <rect x="150" y="30" width="300" height="360" rx="16" fill="#18181B" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <rect x="150" y="30" width="300" height="44" rx="16" fill="#27272A"/>
    <path d="M150 60H450V74H150V60Z" fill="#27272A"/>
    <circle cx="280" cy="52" r="5" fill="#4285F4"/>
    <circle cx="295" cy="52" r="5" fill="#EA4335"/>
    <circle cx="310" cy="52" r="5" fill="#FBBC05"/>
    <circle cx="325" cy="52" r="5" fill="#34A853"/>
    <text x="300" y="115" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, sans-serif" font-weight="800" font-size="16">${cleanMerchant}</text>
    <text x="300" y="135" text-anchor="middle" fill="#A1A1AA" font-family="system-ui, sans-serif" font-weight="600" font-size="11" letter-spacing="1">GOOGLE DRIVE BACKUP</text>
    <line x1="180" y1="155" x2="420" y2="155" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4 4" stroke-width="1.5"/>
    <rect x="180" y="175" width="140" height="8" rx="4" fill="rgba(255,255,255,0.2)"/>
    <rect x="380" y="175" width="40" height="8" rx="4" fill="rgba(255,255,255,0.2)"/>
    <rect x="180" y="195" width="100" height="8" rx="4" fill="rgba(255,255,255,0.15)"/>
    <rect x="380" y="195" width="40" height="8" rx="4" fill="rgba(255,255,255,0.15)"/>
    <rect x="180" y="215" width="160" height="8" rx="4" fill="rgba(255,255,255,0.15)"/>
    <rect x="380" y="215" width="40" height="8" rx="4" fill="rgba(255,255,255,0.15)"/>
    <line x1="180" y1="240" x2="420" y2="240" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4 4" stroke-width="1.5"/>
    <rect x="220" y="260" width="160" height="28" rx="8" fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.3)" stroke-width="1"/>
    <text x="300" y="278" text-anchor="middle" fill="#34D399" font-family="system-ui, sans-serif" font-weight="700" font-size="11">TERSIMPAN DI DRIVE</text>
    <text x="300" y="312" text-anchor="middle" fill="#71717A" font-family="monospace" font-size="10">ID: ${cleanId}</text>
  </svg>`

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

export { handleDriveThumbnail }
