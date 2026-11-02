// Inisialisasi Sentry sisi server (route handler + server component).
// DSN opsional: tanpa SENTRY_DSN aplikasi tetap jalan, hanya tidak melaporkan
// error server. Client-side init ada di app/providers.js.

export async function register() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.05),
      sendDefaultPii: false,
    })
  } catch {
    // Modul Sentry tidak tersedia atau gagal init: jangan gagalkan boot.
  }
}

// Dipanggil Next untuk error yang lolos dari semua batas error.
export async function onRequestError(...args) {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  try {
    const Sentry = await import('@sentry/nextjs')
    if (typeof Sentry.captureRequestError === 'function') {
      return Sentry.captureRequestError(...args)
    }
  } catch {}
}
