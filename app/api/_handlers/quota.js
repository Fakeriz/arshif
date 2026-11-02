// Auth + kuota AI (verify & consume), dan endpoint GET ai/usage.
// Helper auth diimpor dari lib/api-auth.js (sumber tunggal, tidak diduplikasi).
import { readBearerToken, getServerSupabase } from '@/lib/api-auth'
import { safeSecretEqual } from '@/lib/secret-compare'
import { json, err } from './http'

// Token dev hanya untuk pengembangan lokal. Di production nilainya diabaikan
// sepenuhnya, bukan cuma diberi peringatan di log.
const DEV_ADMIN_TOKEN = process.env.NODE_ENV === 'production' ? null : process.env.ARSHIF_DEV_ADMIN_TOKEN

function isDevAdminToken(token) {
  if (!DEV_ADMIN_TOKEN) return false
  return safeSecretEqual(token, DEV_ADMIN_TOKEN)
}

const AI_PREMIUM_REQUIRED = {
  error: 'Fitur AI eksklusif untuk pengguna Premium atau Admin.',
  code: 'AI_PREMIUM_REQUIRED',
}

const SESSION_INVALID = {
  error: 'Sesi pengguna tidak valid atau telah berakhir.',
  code: 'SESSION_INVALID',
}

// Access check + konsumsi kuota via RPC. Fail closed kalau service kuota down.
async function verifyAndConsumeAiAccess(request) {
  const token = readBearerToken(request)

  if (!token) {
    return { allowed: false, response: json(SESSION_INVALID, 401) }
  }

  // Developer/internal test token, hanya dari env server, dan hanya di luar production.
  if (isDevAdminToken(token)) {
    return {
      allowed: true,
      user: { id: 'admin-dev', email: process.env.ARSHIF_DEV_ADMIN_EMAIL || 'dev-admin@localhost' },
      quota: { remaining: 999, total: 999, is_unlimited: true },
    }
  }

  const supabaseClient = getServerSupabase(token)
  const { data: authData, error: authError } = await supabaseClient.auth.getUser(token)
  const user = authData?.user

  if (authError || !user) {
    return { allowed: false, response: json(SESSION_INVALID, 401) }
  }

  // Entitlement hanya berasal dari profiles yang dibaca server, bukan metadata client.
  let planTier = 'free'
  let role = 'authenticated'

  const { data: profile, error: profileErr } = await supabaseClient
    .from('profiles')
    .select('plan_tier, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr) {
    console.error('Gagal membaca profiles untuk entitlement:', profileErr.message)
    return {
      allowed: false,
      response: json(
        { error: 'Status langganan tidak dapat diperiksa. Coba lagi nanti.', code: 'AI_ENTITLEMENT_UNAVAILABLE' },
        503
      ),
    }
  }

  if (profile?.plan_tier) planTier = profile.plan_tier
  if (profile?.role) role = profile.role

  const isPremiumOrAdmin = planTier === 'premium' || planTier === 'admin' || role === 'admin'

  if (!isPremiumOrAdmin) {
    return { allowed: false, response: json(AI_PREMIUM_REQUIRED, 403) }
  }

  // Check & consume quota via RPC. Fail closed if the quota service is unavailable.
  try {
    const { data: rpcRes, error: rpcErr } = await supabaseClient.rpc('check_and_consume_ai_quota')
    if (rpcErr || !rpcRes || typeof rpcRes !== 'object') {
      console.error('AI quota check failed:', rpcErr?.message || 'invalid RPC response')
      return {
        allowed: false,
        response: json(
          { error: 'Kuota AI sedang tidak tersedia. Coba lagi nanti.', code: 'AI_QUOTA_UNAVAILABLE' },
          503
        ),
      }
    }
    if (rpcRes.allowed === false || rpcRes.remaining === 0) {
      return {
        allowed: false,
        response: json(
          {
            error: 'Kuota AI harian Anda telah habis. Reset setiap pukul 00:00 UTC atau upgrade ke Premium.',
            code: 'AI_QUOTA_EXCEEDED',
          },
          429
        ),
      }
    }
    const isUnlimited = rpcRes.is_unlimited === true
    const quota = {
      remaining: rpcRes.remaining ?? 0,
      total: rpcRes.total ?? 0,
      is_unlimited: isUnlimited,
    }
    if (isUnlimited) {
      quota.remaining = quota.remaining || 999
      quota.total = quota.total || 999
    }
    return { allowed: true, user, quota }
  } catch (e) {
    console.error('AI quota check failed:', e?.message)
    return {
      allowed: false,
      response: json(
        { error: 'Kuota AI sedang tidak tersedia. Coba lagi nanti.', code: 'AI_QUOTA_UNAVAILABLE' },
        503
      ),
    }
  }
}

// GET /api/ai/usage, status kuota tanpa mengkonsumsi.
async function handleAiUsage(request) {
  const token = readBearerToken(request)

  if (!token) {
    return err('Autentikasi token Bearer diperlukan.', 401)
  }

  if (isDevAdminToken(token)) {
    return json({ remaining: 999, total: 999, is_unlimited: true }, 200)
  }

  const supabaseClient = getServerSupabase(token)
  const { data: authData, error: authError } = await supabaseClient.auth.getUser(token)
  const user = authData?.user

  if (authError || !user) {
    return err('Sesi pengguna tidak valid atau telah berakhir.', 401)
  }

  // Entitlement hanya berasal dari profiles server-side.
  let planTier = 'free'
  let role = 'authenticated'
  const { data: profile, error: profileErr } = await supabaseClient
    .from('profiles')
    .select('plan_tier, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr) {
    console.error('Gagal membaca profiles di usage:', profileErr.message)
    return err('Status langganan tidak dapat diperiksa. Coba lagi nanti.', 503)
  }

  if (profile?.plan_tier) planTier = profile.plan_tier
  if (profile?.role) role = profile.role

  const isPremiumOrAdmin = planTier === 'premium' || planTier === 'admin' || role === 'admin'

  let usage = {
    remaining: isPremiumOrAdmin ? 999 : 0,
    total: isPremiumOrAdmin ? 999 : 5,
    is_unlimited: isPremiumOrAdmin,
  }

  try {
    const { data: rpcRes, error: rpcErr } = await supabaseClient.rpc('get_ai_quota_status')
    if (!rpcErr && rpcRes) {
      usage = {
        remaining: rpcRes.remaining ?? usage.remaining,
        total: rpcRes.total ?? usage.total,
        is_unlimited: rpcRes.is_unlimited ?? usage.is_unlimited,
      }
    }
  } catch (e) {
    console.warn('RPC get_ai_quota_status fallback:', e?.message)
  }

  return json(usage, 200)
}

export { verifyAndConsumeAiAccess, handleAiUsage }
