// lib/push-server.js
// Utility server-side untuk web-push VAPID configuration & error diagnosis.
import webpush from 'web-push'
import crypto from 'crypto'

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  process.env.VAPID_PUBLIC_KEY ||
  // Hardcoded fallback: env var rawan typo/lupa di-set di Vercel -> push mati total.
  'BOPOh8jEAeteafKKdG89PcqIdLyNf7DQqX6Otk8jIj5naAHJ7ropjg5tzzc10xPSZVPfDNCS61Hwhd-G_n8__2M'

export function b64urlDecode(s) {
  if (!s || typeof s !== 'string') return Buffer.alloc(0)
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64')
}

export function cleanKey(key) {
  if (!key || typeof key !== 'string') return ''
  return key
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '')
    .trim()
}

export function validateKeypair(privB64) {
  try {
    const privClean = cleanKey(privB64)
    if (!privClean) return 'VAPID_PRIVATE_KEY belum diset di server'
    const privKey = b64urlDecode(privClean)
    if (privKey.length !== 32) {
      return `private key panjangnya ${privKey.length} byte, harus 32 byte (pastikan base64url tanpa spasi/kutip)`
    }
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.setPrivateKey(privKey)
    const derived = ecdh.getPublicKey()
    const expected = b64urlDecode(VAPID_PUBLIC_KEY)
    if (!derived.equals(expected)) {
      return 'VAPID private key TIDAK cocok dengan VAPID public key di aplikasi'
    }
    return null
  } catch (e) {
    return 'VAPID private key tidak valid: ' + e.message
  }
}

/**
 * Resolves a compliant VAPID subject claim (RFC 8292).
 * Apple APNs validates DNS for the subject URI domain; placeholder domains
 * like arshif.app or localhost trigger HTTP 403 {"reason":"BadJwtToken"}.
 */
export function resolveVapidSubject(userEmail) {
  let sub = cleanKey(process.env.VAPID_SUBJECT)

  const isInvalidDomain =
    !sub ||
    sub.includes('arshif.app') ||
    sub.includes('localhost') ||
    sub.includes('example.com') ||
    sub.includes('dummy')

  if (isInvalidDomain) {
    if (userEmail && typeof userEmail === 'string' && userEmail.includes('@')) {
      return `mailto:${userEmail.trim().toLowerCase()}`
    }
    // Subject VAPID hanya dari env server, tidak ada email/PII hardcode di source
    // (kredensial & identitas di-load runtime, bukan di-commit).
    const envSubject = cleanKey(process.env.VAPID_SUBJECT_EMAIL)
    if (envSubject && envSubject.includes('@')) {
      return `mailto:${envSubject.trim().toLowerCase()}`
    }
    throw new Error(
      'VAPID_SUBJECT_EMAIL belum dikonfigurasi. Set env server dengan email ber-domain valid (mis. mailto:you@yourdomain.com).'
    )
  }

  // Ensure RFC 8292 required URI prefix (mailto: or https://)
  if (!sub.startsWith('mailto:') && !sub.startsWith('https://')) {
    if (sub.includes('@')) {
      sub = `mailto:${sub}`
    } else {
      sub = `https://${sub}`
    }
  }

  return sub
}

export function initWebPush(userEmail, explicitPriv) {
  const priv = cleanKey(explicitPriv || process.env.VAPID_PRIVATE_KEY)
  if (!priv) throw new Error('VAPID_PRIVATE_KEY belum dikonfigurasi di server')

  const keyErr = validateKeypair(priv)
  if (keyErr) throw new Error(keyErr)

  const subject = resolveVapidSubject(userEmail)

  webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, priv)

  return { subject, publicKey: VAPID_PUBLIC_KEY, privateKey: priv }
}

/**
 * Returns true if the error indicates the push subscription is expired, revoked, or broken
 * and should be removed from the database.
 */
export function isExpiredOrInvalidSubscription(err) {
  const code = err?.statusCode
  const body = String(err?.body || '')
  if (code === 410 || code === 404 || code === 401) return true
  if (code === 400 && (body.includes('BadDeviceToken') || body.includes('DeviceTokenNotForTopic'))) {
    return true
  }
  return false
}

export function formatPushError(err) {
  const code = err?.statusCode
  const body = String(err?.body || err?.message || err || '')

  if (code === 403 && body.includes('BadJwtToken')) {
    return '403: {"reason":"BadJwtToken"} (Apple/FCM menolak domain VAPID Subject. Pastikan email VAPID Subject menggunakan domain aktif).'
  }
  if (code === 401 || (code === 403 && body.includes('UnauthorizedRegistration'))) {
    return `${code}: Token registrasi tidak cocok dengan kunci aplikasi. Coba matikan dan nyalakan ulang notifikasi di aplikasi.`
  }
  if (code === 410 || (code === 400 && body.includes('BadDeviceToken'))) {
    return `${code}: Token perangkat sudah kadaluarsa dan telah dihapus. Silakan subscribe ulang.`
  }

  return err?.body ? `${code}: ${err.body}` : err?.message || String(err)
}
