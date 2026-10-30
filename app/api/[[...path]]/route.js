// app/api/[[...path]]/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FALLBACK_RATES } from '@/lib/rates'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// Model candidate fallback
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
]

const json = (data, status = 200) => NextResponse.json(data, { status })
const err = (message, status = 400) => NextResponse.json({ error: message }, { status })

const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_PDF_BYTES = 9 * 1024 * 1024

const AUDIO_MIME_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'])
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

function base64ByteLength(value) {
  const normalized = String(value || '').replace(/\s/g, '')
  if (!normalized || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return 0
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding)
}

function readBearerToken(request) {
  return (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
}

// Supabase auth and quota helpers.
function getServerSupabase(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  })
}

async function verifyAndConsumeAiAccess(request) {
  const token = readBearerToken(request)

  if (!token) {
    return {
      allowed: false,
      response: json(
        { error: 'Fitur AI eksklusif untuk pengguna Premium atau Admin.', code: 'AI_PREMIUM_REQUIRED' },
        403
      ),
    }
  }


  // Developer/internal test token — hanya dari env server, TIDAK pernah hardcode di source.
  // Pola Belanje: tidak ada bypass auth yang ter-commit; yang mengikat = server.
  const devAdminToken = process.env.ARSHIF_DEV_ADMIN_TOKEN
  if (devAdminToken && token === devAdminToken) {
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
    return {
      allowed: false,
      response: json(
        { error: 'Fitur AI eksklusif untuk pengguna Premium atau Admin.', code: 'AI_PREMIUM_REQUIRED' },
        403
      ),
    }
  }

  // Determine user tier & role
  // Entitlement hanya berasal dari profiles yang dibaca server, bukan metadata client.
  let planTier = 'free'
  let role = 'authenticated'

  try {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan_tier, role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.plan_tier) planTier = profile.plan_tier
    if (profile?.role) role = profile.role
  } catch (e) {
    console.warn('Error reading profiles table:', e?.message)
  }

  const isPremiumOrAdmin = planTier === 'premium' || planTier === 'admin' || role === 'admin'

  if (!isPremiumOrAdmin) {
    return {
      allowed: false,
      response: json(
        { error: 'Fitur AI eksklusif untuk pengguna Premium atau Admin.', code: 'AI_PREMIUM_REQUIRED' },
        403
      ),
    }
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

async function handleAiUsage(request) {
  const token = readBearerToken(request)

  if (!token) {
    return err('Autentikasi token Bearer diperlukan.', 401)
  }

  const devAdminToken = process.env.ARSHIF_DEV_ADMIN_TOKEN
  if (devAdminToken && token === devAdminToken) {
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
  try {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan_tier, role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.plan_tier) planTier = profile.plan_tier
    if (profile?.role) role = profile.role
  } catch (e) {
    console.warn('Profile read in usage:', e?.message)
  }

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

// Request parsing helpers.
function parseNumber(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  let str = String(val).trim().replace(/[^0-9.,-]/g, '')
  if (!str) return 0
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf('.') > str.lastIndexOf(',')) {
      str = str.replace(/,/g, '')
    } else {
      str = str.replace(/\./g, '').replace(',', '.')
    }
  } else if (str.includes(',')) {
    const parts = str.split(',')
    if (parts.length === 2 && parts[1].length === 3) {
      str = str.replace(',', '')
    } else if (parts.length > 2) {
      str = str.replace(/,/g, '')
    } else {
      str = str.replace(',', '.')
    }
  } else if (str.includes('.')) {
    const parts = str.split('.')
    if (parts.length === 2 && parts[1].length === 3) {
      str = str.replace('.', '')
    } else if (parts.length > 2) {
      str = str.replace(/\./g, '')
    }
  }
  const n = parseFloat(str)
  return isNaN(n) ? 0 : Math.round(n * 100) / 100
}

function extractJson(text) {
  if (!text) return null
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {}
    }
    return null
  }
}

function normalizeContents(contentsInput) {
  if (typeof contentsInput === 'string') {
    return [{ role: 'user', parts: [{ text: contentsInput }] }]
  }
  if (!Array.isArray(contentsInput)) return []

  return contentsInput.map((entry) => {
    const role = entry.role === 'assistant' || entry.role === 'model' ? 'model' : 'user'
    const parts = (entry.parts || []).map((part) => {
      if (part.inline_data) {
        return {
          inlineData: {
            mimeType: part.inline_data.mime_type || part.inline_data.mimeType || 'image/jpeg',
            data: part.inline_data.data,
          },
        }
      }
      if (part.inlineData) {
        return {
          inlineData: {
            mimeType: part.inlineData.mimeType || part.inlineData.mime_type || 'image/jpeg',
            data: part.inlineData.data,
          },
        }
      }
      return part
    })
    return { role, parts }
  })
}

// Gemini REST API client.
async function callGemini(contentsInput, generationConfig = {}, systemInstruction = null) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Server is missing GEMINI_API_KEY. Pastikan environment variable GEMINI_API_KEY telah diatur.')

  const contents = normalizeContents(contentsInput)

  const genConfig = {
    temperature: 0.1,
    ...generationConfig,
  }
  if (genConfig.response_mime_type) {
    genConfig.responseMimeType = genConfig.response_mime_type
    delete genConfig.response_mime_type
  }

  const requestBody = {
    contents,
    generationConfig: genConfig,
  }

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: String(systemInstruction) }],
    }
  }

  let attemptErrors = []
  for (const model of CANDIDATE_MODELS) {
    try {
      const endpoint = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        cache: 'no-store',
      })

      const payload = await res.json().catch(() => ({}))
      const parts = payload?.candidates?.[0]?.content?.parts || []
      const text = parts.map((p) => p?.text || '').join('').trim()

      if (res.ok && text) {
        return {
          text,
          model,
        }
      }

      const errMsg = payload?.error?.message || `HTTP ${res.status}`
      attemptErrors.push(`[${model}] status=${res.status}: ${errMsg} (text_len=${text.length})`)

      const isRetryable =
        res.status === 404 ||
        res.status === 429 ||
        res.status === 503 ||
        errMsg.includes('not found') ||
        errMsg.includes('no longer available') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        !text

      if (isRetryable) {
        continue
      }
      throw new Error(errMsg)
    } catch (e) {
      if (!attemptErrors.some((entry) => entry.startsWith(`[${model}]`))) {
        attemptErrors.push(`[${model}] exception: ${e?.message}`)
      }
    }
  }

  throw new Error(`Semua model Gemini gagal: ${attemptErrors.join(' | ')}`)
}

// Voice-to-text transcription.
async function handleTranscribe(request, quota = null) {
  try {
    const ct = request.headers.get('content-type') || ''
    let buffer = null
    let mimeType = 'audio/webm'

    if (ct.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file') || form.get('audio')
      if (!file || typeof file.arrayBuffer !== 'function') return err('file is required', 400)
      mimeType = (file.type || 'audio/webm').split(';')[0].trim().toLowerCase()
      if (!AUDIO_MIME_TYPES.has(mimeType)) return err('Unsupported audio format', 415)
      if (typeof file.size === 'number' && file.size > MAX_AUDIO_BYTES) return err('Audio terlalu besar (maks 10MB)', 413)
      buffer = await file.arrayBuffer()
    } else {
      const body = await request.json().catch(() => ({}))
      const raw = (body?.audioBase64 || body?.file || '').toString()
      if (!raw) return err('audio file is required', 400)
      const match = raw.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        mimeType = match[1].trim().toLowerCase()
        if (!AUDIO_MIME_TYPES.has(mimeType)) return err('Unsupported audio format', 415)
        if (base64ByteLength(match[2]) > MAX_AUDIO_BYTES) return err('Audio terlalu besar (maks 10MB)', 413)
        buffer = Buffer.from(match[2], 'base64')
      } else {
        if (base64ByteLength(raw) > MAX_AUDIO_BYTES) return err('Audio terlalu besar (maks 10MB)', 413)
        buffer = Buffer.from(raw, 'base64')
      }
    }

    if (!buffer || buffer.byteLength === 0) return err('Audio buffer is empty', 400)
    if (buffer.byteLength > MAX_AUDIO_BYTES) return err('Audio terlalu besar (maks 10MB)', 413)
    const base64Audio = Buffer.from(buffer).toString('base64')

    const promptText = `Transkripsikan rekaman suara audio ini secara presisi kata demi kata.
ATURAN MATA UANG PENTING:
- Dengarkan dan tulis kata mata uang apa adanya sesuai ucapan pengguna.
- JANGAN PERNAH mengubah mata uang asing menjadi "Rp" atau "Rupiah".
  Contoh:
  * Jika mendengar "ringgit" atau "RM", tulis "RM" atau "ringgit".
  * Jika mendengar "lira" atau "TL", tulis "TL" atau "lira".
  * Jika mendengar "dollar" atau "$", tulis "dollar" atau "$".
  * Jika mendengar "euro" atau "€", tulis "euro".
  * Jika mendengar "sing dollar" atau "SGD", tulis "SGD".
  * Jika mendengar "riyal", tulis "riyal".
  * Jika mendengar "yen", tulis "yen".
- Kembalikan HANYA teks ucapan kata demi kata tanpa tanda kutip pembuka/penutup.`

    const { text, model } = await callGemini([
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: base64Audio,
            },
          },
          { text: promptText },
        ],
      },
    ])

    return json({
      text: (text || '').trim(),
      model,
      remaining: quota?.remaining,
      total: quota?.total,
      is_unlimited: quota?.is_unlimited,
    })
  } catch (e) {
    console.error('handleTranscribe error:', e)
    return err(e?.message || 'Gagal memproses audio dengan Gemini', 500)
  }
}

// Voice and natural-language parser.
async function handleParse(request, quota = null) {
  try {
    const body = await request.json().catch(() => ({}))
    const text = (body?.text || '').toString().trim()
    if (!text) return err('text is required', 400)

    const homeCurrency = (body?.homeCurrency || 'IDR').toString().toUpperCase().slice(0, 3)
    const categories = Array.isArray(body?.categories) && body.categories.length
      ? body.categories
      : ['salary', 'food', 'groceries', 'transport', 'bills', 'shopping', 'entertainment', 'health', 'travel', 'education', 'business', 'other']
    const accounts = Array.isArray(body?.accounts) ? body.accounts : []

    const accountsListStr = accounts.length > 0
      ? JSON.stringify(accounts.map((a) => (typeof a === 'string' ? { name: a } : { id: a.id, name: a.name, currency: a.currency })))
      : '[]'

    const GLOBAL_CURRENCIES = [
      { regex: /\b(ringgit|rm)\b/i, code: 'MYR' },
      { regex: /\b(rupiah|rp|perak)\b/i, code: 'IDR' },
      { regex: /\b(lira|tl|turki)\b/i, code: 'TRY' },
      { regex: /\b(usd|dollar|dolar|buck|bucks|\$)\b/i, code: 'USD' },
      { regex: /\b(eur|euro|€)\b/i, code: 'EUR' },
      { regex: /\b(sgd|sing\s*dollar|dolar\s*singapura)\b/i, code: 'SGD' },
      { regex: /\b(gbp|pound|sterling|£)\b/i, code: 'GBP' },
      { regex: /\b(jpy|yen|¥)\b/i, code: 'JPY' },
      { regex: /\b(aud|aussie|dolar\s*australia)\b/i, code: 'AUD' },
      { regex: /\b(thb|baht)\b/i, code: 'THB' },
      { regex: /\b(sar|riyal|riyal\s*saudi)\b/i, code: 'SAR' },
      { regex: /\b(aed|dirham)\b/i, code: 'AED' },
      { regex: /\b(cny|yuan|renminbi)\b/i, code: 'CNY' },
      { regex: /\b(krw|won)\b/i, code: 'KRW' },
      { regex: /\b(php|peso)\b/i, code: 'PHP' },
      { regex: /\b(vnd|dong)\b/i, code: 'VND' },
    ]

    const system = `You are Arshif, an international multi-currency financial voice parser.
Extract the transaction details into JSON.

USER WALLETS/ACCOUNTS REFERENCE:
${accountsListStr}

USER HOME CURRENCY:
${homeCurrency}

CURRENCY DETECTION RULES:
1. EXPLICIT CURRENCY SPOKEN:
   - Identify currency words in any language and convert to standard ISO 4217 3-letter code:
     * "ringgit / RM" -> "MYR"
     * "rupiah / rp / ribu / jt" -> "IDR"
     * "lira / tl" -> "TRY"
     * "dollar / buck / USD" -> "USD"
     * "euro" -> "EUR"
     * "sing dollar / SGD" -> "SGD"
     * "pound / sterling" -> "GBP"
     * "yen" -> "JPY"
     * "riyal" -> "SAR"
     * "baht" -> "THB"
     * "dirham" -> "AED"
     * (And all other world ISO currencies: AUD, CAD, CHF, CNY, KRW, etc.)

2. WALLET CONTEXT OVERRIDE:
   - If user specifies an account/wallet (e.g., "pake Ziraat", "via Wise USD", "pake BCA", "pake Maybank", "pake TnG"):
     Match with the user's account and adopt that account's assigned currency!

3. FALLBACK:
   - If no currency or account is mentioned, strictly use the user's home currency: "${homeCurrency}".

4. SAME STORE VS DIFFERENT STORES:
   - Same place: 1 transaction with detailed "items" array [{ name, qty, unit, price }].
   - Different places: split into multiple transaction objects in the "transactions" array.

RULES FOR ITEM UNITS & QUANTITIES:
- Jika pengguna menyebutkan takaran/satuan (misal: "cabai 2 kilo", "bebek 2 ekor", "minyak 1 liter", "telur 1 kg", "rokok 2 bungkus"):
  * qty: 2
  * unit: "kg" (atau "ekor", "liter", "gram", "bungkus", "ikat")
  * name: "Cabai"
- Jika hanya menyebutkan jumlah tanpa satuan (misal: "beli 5 burger", "2 dimsum"):
  * qty: 5
  * unit: null

RULES FOR ITEMS, TOTALS & MERCHANT:
1. MERCHANT/STORE NAME:
   - Jika pengguna tidak menyebutkan nama toko secara spesifik, JANGAN jadikan ucapan belanja seperti "beli sapi..." atau "jajan..." sebagai nama toko[cite: 21].
   - Isi "merchant": null[cite: 22].

2. ITEM PRICE CALCULATION (PENTING!):
   - Jika pengguna mengatakan "beli sapi dua ekor 5.000 ringgit", itu artinya TOTAL harga untuk 2 ekor sapi tersebut adalah 5000 (maka harga satuan per ekor adalah 2500)[cite: 21].
   - "price" pada item HARUS berupa HARGA SATUAN (unit price)[cite: 22]:
     * qty: 2, unit: "ekor", name: "Sapi", price: 2500
   - Jika mengatakan "cabai 2 kilo 100 ringgit":
     * qty: 2, unit: "kg", name: "Cabai", price: 50[cite: 21]
   - Pastikan rumus: akumulasi (qty * price) dari semua item = total transaksi (amount).

TRANSACTION TYPE & CATEGORY INFERENCE RULES:
1. INCOME DETECTION (PEMASUKAN):
   - Jika teks menyebut kata kunci pemasukan seperti: "gaji", "salary", "bonus", "dapat uang", "terima transfer", "cair", "profit", "hasil jualan", "dividen", "freelance":
     * type: "income"
     * category: "salary" (atau "business", "investment", "other")
     * JANGAN PERNAH memberikan kategori "food" untuk gaji/pemasukan!

2. EXPENSE DETECTION (PENGELUARAN):
   - Makanan/Minuman: "makan", "minum", "resto", "kopi", "cafe", "dimsum", "ayam", "bebek", "cabai", "sapi" -> category: "food"
   - Belanja Harian/Dapur: "supermarket", "sayur", "beras", "minyak", "pasar" -> category: "groceries"
   - Transportasi: "bensin", "grab", "gojek", "taksi", "tol", "parkir", "mrt" -> category: "transport"
   - Tagihan: "listrik", "pln", "air", "pdam", "wifi", "internet", "pulsa", "sewa" -> category: "bills"
   - Belanja Barang: "beli baju", "sepatu", "iphone", "laptop", "tokopedia", "shopee" -> category: "shopping"
   - Kesehatan: "obat", "apotek", "dokter", "rs", "klinik" -> category: "health"

3. TRANSFER DETECTION (PINDAH DANA):
   - Jika ada perpindahan antar akun (misal "transfer dari BCA ke Maybank"):
     * type: "transfer"

OUTPUT FORMAT (JSON ONLY):
{
  "transactions": [
    {
      "type": "expense" | "income" | "transfer",
      "amount": number,
      "currency": "ISO 3-letter code (e.g. USD, EUR, TRY, MYR, IDR, SGD)",
      "category": string,
      "payment_method": "cash" | "qr" | "card" | "bank",
      "account_name": string | null,
      "account_id": string | null,
      "merchant": string | null,
      "note": string,
      "items": [
        {
          "name": string,
          "qty": number,
          "unit": string | null,
          "price": number
        }
      ]
    }
  ]
}`

    const { text: raw, model } = await callGemini(
      [{ role: 'user', parts: [{ text }] }],
      { responseMimeType: 'application/json' },
      system
    )

    const parsed = extractJson(raw)
    if (!parsed) return err('Gemini menghasilkan format respon yang tidak valid', 502)

    let rawList = []
    if (Array.isArray(parsed?.transactions) && parsed.transactions.length > 0) {
      rawList = parsed.transactions
    } else if (parsed && typeof parsed === 'object') {
      rawList = [parsed]
    }

    const sanitizedTransactions = rawList.map((tx) => {
      const items = Array.isArray(tx?.items)
        ? tx.items.map((it) => ({
            name: String(it?.name || 'Item').trim(),
            qty: Math.max(0.1, Number(it?.qty) || 1),
            unit: it?.unit ? String(it.unit).trim().toLowerCase() : null,
            price: Math.abs(parseNumber(it?.price) || 0),
          }))
        : []

      const itemsSum = items.reduce((sum, it) => sum + it.price * it.qty, 0)
      const rawAmount = Math.abs(parseNumber(tx?.amount) || 0)
      const amount = rawAmount > 0 ? rawAmount : (itemsSum > 0 ? itemsSum : 0)

      // 1. Akun & Mata Uang Akun
      let accountId = tx?.account_id || null
      let accountName = tx?.account_name || null
      let matchedAccountCurrency = null

      if (accountName && accounts.length > 0) {
        const found = accounts.find((a) => {
          const aName = (typeof a === 'string' ? a : a?.name || '').toLowerCase()
          return aName.includes(accountName.toLowerCase()) || accountName.toLowerCase().includes(aName)
        })
        if (found && typeof found === 'object') {
          accountId = found.id || accountId
          accountName = found.name || accountName
          if (found.currency) {
            matchedAccountCurrency = String(found.currency).toUpperCase().slice(0, 3)
          }
        }
      }

      // Filter nama merchant agar tidak mengambil kata ucapan belanja
      let merchantName = tx?.merchant || null
      if (merchantName && /^(beli|jajan|bayar|pesan|dapat|terima)\b/i.test(merchantName.trim())) {
        merchantName = null
      }

      // 2. Deteksi mata uang yang diucapkan
      let spokenCurrency = null
      for (const cur of GLOBAL_CURRENCIES) {
        if (cur.regex.test(text)) {
          spokenCurrency = cur.code
          break
        }
      }

      const finalCurrency =
        spokenCurrency ||
        matchedAccountCurrency ||
        (tx?.currency ? String(tx.currency).toUpperCase().slice(0, 3) : homeCurrency)

      // 3. Tentukan tipe transaksi secara akurat
      let txType = ['expense', 'income', 'transfer'].includes(tx?.type) ? tx.type : 'expense'
      if (/gaji|salary|bonus|dapat\s*uang|terima\s*(uang|transfer)|income|pendapatan/i.test(text)) {
        txType = 'income'
      }

      // 4. Kategori otomatis presisi
      let detectedCategory = tx?.category || ''
      if (txType === 'income') {
        detectedCategory = /bonus/i.test(text) ? 'bonus' : /bisnis|jualan|omset/i.test(text) ? 'business' : 'salary'
      } else {
        if (/bensin|grab|gojek|tol|parkir|mrt/i.test(text)) detectedCategory = 'transport'
        else if (/listrik|pln|pdam|wifi|internet|pulsa/i.test(text)) detectedCategory = 'bills'
        else if (/supermarket|sayur|sembako|alfa|indo/i.test(text)) detectedCategory = 'groceries'
        else if (!detectedCategory || detectedCategory === 'other') detectedCategory = 'food'
      }

      return {
        type: txType,
        amount,
        currency: finalCurrency,
        category: detectedCategory,
        payment_method: ['cash', 'qr', 'card', 'bank'].includes(tx?.payment_method) ? tx.payment_method : (txType === 'income' ? 'bank' : 'cash'),
        account_name: accountName,
        account_id: accountId,
        merchant: merchantName || (txType === 'income' ? 'Gaji' : null),
        note: tx?.note || (items.length > 0 ? items.map((i) => i.name).join(', ') : text),
        items,
      }
    })

    const primary = sanitizedTransactions[0] || {}

    return json({
      transactions: sanitizedTransactions,
      ...primary,
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0.95,
      transcript: text,
      model,
      remaining: quota?.remaining,
      total: quota?.total,
      is_unlimited: quota?.is_unlimited,
    })
  } catch (e) {
    console.error('handleParse error:', e)
    return err(e?.message || 'Gagal mengekstrak transaksi dengan Gemini', 500)
  }
}

// AI financial coach.
async function handleCoach(request, quota = null) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawMessages = Array.isArray(body?.messages) ? body.messages.filter((m) => m?.role && m?.content) : []
    if (!rawMessages.length) return err('messages are required', 400)

    const ctx = body?.context || {}
    const homeCurrency = ctx?.homeCurrency || 'IDR'

    // Bahasa jawaban mengikuti bahasa pesan terakhir user (fallback: bahasa UI).
    const langNames = { id: 'Bahasa Indonesia', ms: 'Bahasa Melayu', tr: 'Türkçe', en: 'English' }
    const fallbackLang = langNames[body?.language] || 'Bahasa Indonesia'

    const systemInstruction = `Kamu adalah Arshif AI Financial Coach: asisten keuangan pribadi yang praktis, ringkas, dan solutif.
ATURAN BAHASA (wajib dipatuhi): selalu jawab dalam bahasa yang SAMA dengan pesan terakhir dari user. Deteksi bahasanya dari pesan terakhir itu — contoh: user bertanya dalam English, jawab dalam English; user bertanya dalam Bahasa Melayu, jawab dalam Bahasa Melayu. Jika bahasanya tidak bisa dikenali, jawab dalam ${fallbackLang}.
Gunakan poin-poin padat (maksimal 150 kata).
Konteks keuangan user (Mata uang: ${homeCurrency}):
${JSON.stringify(ctx).slice(0, 3000)}`

    const contents = rawMessages.slice(-10).map((m) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }))

    const { text: reply, model } = await callGemini(
      contents,
      { temperature: 0.6, maxOutputTokens: 500 },
      systemInstruction
    )

    return json({
      reply: (reply || '').trim(),
      model,
      remaining: quota?.remaining,
      total: quota?.total,
      is_unlimited: quota?.is_unlimited,
    })
  } catch (e) {
    console.error('handleCoach error:', e)
    return err(e?.message || 'Gagal berkomunikasi dengan AI Coach', 500)
  }
}

// Receipt OCR.
const OCR_PROMPT = `You are Arshif's expert receipt OCR vision engine.
Analyze this receipt or invoice image carefully and extract all transaction details.
Return ONLY a valid JSON object matching this exact schema:
{
  "merchant": string or null,
  "category": "food" | "groceries" | "transport" | "shopping" | "bills" | "entertainment" | "health" | "education" | "travel" | "housing" | "personal" | "business" | "other",
  "receipt_number": string or null,
  "date": "YYYY-MM-DD" or null,
  "time": "HH:mm" or null,
  "currency": "ISO 4217 code (e.g. IDR, MYR, USD, EUR, GBP, SGD, THB, PHP, TRY, JPY, AUD) or null",
  "subtotal": number or null,
  "tax": number or null,
  "total": number,
  "payment_method": "cash" | "qr" | "card" | "bank" or null,
  "items": [
    { "name": string, "qty": number, "price": number }
  ],
  "confidence": number
}
CRITICAL RULES:
1. Extract the transaction time in 24-hour format if printed on the physical receipt (e.g. "15:01" from "03:01:39 PM" or "15:01"). If no time is printed on the receipt, return null.
2. All monetary amounts must be numbers without currency symbols or thousand separators.`

const STATEMENT_PROMPT = `You are a bank statement parser. Read this bank statement PDF carefully (it may be in English, Indonesian, or Malay, and may be a scan/photo) and extract EVERY transaction row.

Return ONLY a valid JSON object matching this exact schema (no markdown, no commentary):
{
  "bank": string or null,
  "currency": "ISO 4217 code (e.g. IDR, MYR, USD, EUR, GBP, SGD, THB, PHP, TRY, JPY, AUD) or null",
  "period_from": "YYYY-MM-DD" or null,
  "period_to": "YYYY-MM-DD" or null,
  "transactions": [
    { "date": "YYYY-MM-DD", "description": string, "amount": number, "balance": number or null }
  ]
}

CRITICAL RULES:
1. "amount" must be a SIGNED number: negative = money OUT (debit, payment, purchase, withdrawal, fee), positive = money IN (credit, salary, deposit, refund). Never 0.
2. If the statement uses separate Debit and Credit columns, merge them: a debit value becomes a negative amount, a credit value becomes a positive amount.
3. "balance" is the running balance AFTER that transaction, only if printed; otherwise null.
4. "date" must be YYYY-MM-DD. If the year is not printed on a row, infer it from the statement period.
5. "description" is the raw narration/merchant text, trimmed. Keep it verbatim, do not summarize.
6. Skip non-transaction rows: headers, subtotals, page footers, brought-forward balances, blank rows.
7. List transactions in the order printed. Extract ALL of them, including all pages.
8. All monetary amounts must be plain numbers without currency symbols or thousand separators.
9. "currency": detect it from the statement itself — bank name, currency symbols, and amount scale. "Rp" means IDR, "RM" means MYR, "€" means EUR, "£" means GBP. Indonesian banks (BCA, Mandiri, BRI, BNI, Jago, SeaBank, CIMB Niaga, Danamon, etc.) use IDR — never return MYR for an Indonesian statement. If genuinely unclear, return null.`

async function handleStatementPdf(request, quota = null) {
  try {
    let base64 = null
    const ct = request.headers.get('content-type') || ''

    if (ct.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file') || form.get('pdf')
      if (!file || typeof file.arrayBuffer !== 'function') return err('PDF file is required', 400)
      const mt = (file.type || '').split(';')[0].trim().toLowerCase()
      if (mt && mt !== 'application/pdf') return err('File harus berformat PDF', 400)
      if (typeof file.size === 'number' && file.size > MAX_PDF_BYTES) return err('PDF terlalu besar (maks 9MB)', 413)
      base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    } else {
      const body = await request.json().catch(() => ({}))
      const raw = (body?.pdfBase64 || body?.file || '').toString()
      const match = raw.match(/^data:([^;]+);base64,(.+)$/)
      if (match && !/pdf/i.test(match[1])) return err('File harus berformat PDF', 400)
      base64 = match ? match[2] : raw
    }

    if (!base64) return err('PDF is required', 400)
    base64 = base64.replace(/\s/g, '')
    // Batas ~9MB biner: cegah penyalahgunaan & biaya AI membengkak
    if (base64ByteLength(base64) > MAX_PDF_BYTES) return err('PDF terlalu besar (maks 9MB)', 413)

    const { text: raw, model } = await callGemini(
      [
        {
          role: 'user',
          parts: [
            { text: STATEMENT_PROMPT },
            { inlineData: { mimeType: 'application/pdf', data: base64 } },
          ],
        },
      ],
      { responseMimeType: 'application/json' }
    )

    const parsed = extractJson(raw)
    const list = Array.isArray(parsed?.transactions) ? parsed.transactions : []
    if (!parsed || !list.length) return err('AI tidak menemukan transaksi di PDF ini', 502)

    const clean = list.slice(0, 500).map((tx) => {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(tx?.date || '').trim()) ? String(tx.date).trim() : null
      const description = String(tx?.description ?? tx?.desc ?? '').trim().slice(0, 200)
      const amount = Number(tx?.amount)
      if (!date || !description || !isFinite(amount) || amount === 0) return null
      const bal = tx?.balance === null || tx?.balance === undefined || tx?.balance === '' ? null : Number(tx.balance)
      return { date, description, amount: Math.round(amount * 100) / 100, balance: isFinite(bal) ? Math.round(bal * 100) / 100 : null }
    }).filter(Boolean)
    if (!clean.length) return err('AI tidak menemukan transaksi di PDF ini', 502)

    const cur = String(parsed?.currency || '').trim().toUpperCase()
    return json({
      ok: true,
      model,
      transactions: clean,
      meta: {
        bank: parsed?.bank ? String(parsed.bank).trim().slice(0, 80) : null,
        currency: /^[A-Z]{3}$/.test(cur) ? cur : null,
        period_from: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed?.period_from || '')) ? parsed.period_from : null,
        period_to: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed?.period_to || '')) ? parsed.period_to : null,
      },
      remaining: quota?.remaining,
      total: quota?.total,
      is_unlimited: quota?.is_unlimited,
    })
  } catch (e) {
    console.error('handleStatementPdf error:', e)
    return err(e?.message || 'Gagal membaca PDF dengan AI', 500)
  }
}

async function handleOcr(request, quota = null) {
  try {
    let base64 = null
    let mimeType = 'image/jpeg'
    const ct = request.headers.get('content-type') || ''

    if (ct.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('image') || form.get('file')
      if (!file || typeof file.arrayBuffer !== 'function') return err('image file is required', 400)
      mimeType = (file.type || 'image/jpeg').split(';')[0].trim().toLowerCase()
      if (!IMAGE_MIME_TYPES.has(mimeType)) return err('Unsupported image format', 415)
      if (typeof file.size === 'number' && file.size > MAX_IMAGE_BYTES) return err('Image terlalu besar (maks 10MB)', 413)
      base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    } else {
      const body = await request.json().catch(() => ({}))
      const raw = (body?.imageBase64 || body?.image || body?.file || '').toString()
      const match = raw.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        mimeType = match[1].trim().toLowerCase()
        if (!IMAGE_MIME_TYPES.has(mimeType)) return err('Unsupported image format', 415)
        base64 = match[2]
      } else {
        base64 = raw
      }
    }

    if (!base64) return err('image is required', 400)
    base64 = base64.replace(/\s/g, '')
    if (base64ByteLength(base64) > MAX_IMAGE_BYTES) return err('Image terlalu besar (maks 10MB)', 413)

    const { text: raw, model } = await callGemini(
      [
        {
          role: 'user',
          parts: [
            { text: OCR_PROMPT },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: base64,
              },
            },
          ],
        },
      ],
      { responseMimeType: 'application/json' }
    )

    const receipt = extractJson(raw)
    if (!receipt) return err('Gemini OCR vision returned invalid response', 502)

    const items = Array.isArray(receipt?.items)
      ? receipt.items.map((it) => ({
          name: String(it?.name || 'Item').trim(),
          qty: Math.max(1, Number(it?.qty) || 1),
          price: parseNumber(it?.price),
        }))
      : []

    const calculatedTotal = items.reduce((sum, item) => sum + item.price * item.qty, 0)
    const rawTotal = receipt?.total !== undefined && receipt?.total !== null ? parseNumber(receipt.total) : calculatedTotal
    const total = rawTotal > 0 ? rawTotal : calculatedTotal

    let validTime = null
    if (receipt?.time && typeof receipt.time === 'string') {
      const tStr = receipt.time.trim()
      const m24 = tStr.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/)
      if (m24) {
        validTime = `${String(m24[1]).padStart(2, '0')}:${m24[2]}`
      } else {
        const m12 = tStr.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?\s*(AM|PM)$/i)
        if (m12) {
          let h = parseInt(m12[1], 10)
          const m = m12[2]
          const ampm = m12[3].toUpperCase()
          if (ampm === 'PM' && h < 12) h += 12
          if (ampm === 'AM' && h === 12) h = 0
          validTime = `${String(h).padStart(2, '0')}:${m}`
        }
      }
    }

    if (!validTime) {
      const now = new Date()
      validTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    }

    const receiptDate = receipt?.date && /^\d{4}-\d{2}-\d{2}$/.test(receipt.date) ? receipt.date : null
    const transactionDate = receiptDate
      ? `${receiptDate}T${validTime}:00`
      : `${new Date().toISOString().split('T')[0]}T${validTime}:00`

    const structuredReceipt = {
      merchant: receipt?.merchant ? String(receipt.merchant).trim() : null,
      category: receipt?.category || 'other',
      receipt_number: receipt?.receipt_number ? String(receipt.receipt_number).trim() : null,
      date: receiptDate,
      time: validTime,
      transaction_date: transactionDate,
      currency: receipt?.currency ? String(receipt.currency).toUpperCase().slice(0, 3) : null,
      subtotal: receipt?.subtotal !== null && receipt?.subtotal !== undefined ? parseNumber(receipt.subtotal) : null,
      tax: receipt?.tax !== null && receipt?.tax !== undefined ? parseNumber(receipt.tax) : null,
      total: total || 0,
      payment_method: ['cash', 'qr', 'card', 'bank'].includes(receipt?.payment_method) ? receipt.payment_method : null,
      items,
      confidence: typeof receipt?.confidence === 'number' ? Math.min(1, Math.max(0, receipt.confidence)) : 0.95,
    }

    return json({
      receipt: structuredReceipt,
      model,
      time: validTime,
      transaction_date: transactionDate,
      remaining: quota?.remaining,
      total: quota?.total,
      is_unlimited: quota?.is_unlimited,
      ...structuredReceipt,
    })
  } catch (e) {
    console.error('handleOcr error:', e)
    return err(e?.message || 'Gagal memindai struk dengan Gemini Vision', 500)
  }
}

// Exchange rates.
let ratesCache = { at: 0, data: null }
async function getRates() {
  const ONE_HOUR = 60 * 60 * 1000
  if (ratesCache.data && Date.now() - ratesCache.at < ONE_HOUR) return ratesCache.data
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (res.ok) {
      const body = await res.json()
      if (body?.result === 'success' && body?.rates?.USD) {
        const data = { base: 'USD', rates: { ...FALLBACK_RATES, ...(body.rates || {}) }, source: 'live', updated: new Date().toISOString() }
        ratesCache = { at: Date.now(), data }
        return data
      }
    }
  } catch (e) {
    console.warn('rates provider failed, using fallback:', e?.message)
  }
  const data = { base: 'USD', rates: FALLBACK_RATES, source: 'fallback', updated: new Date().toISOString() }
  ratesCache = { at: Date.now(), data }
  return data
}

// GET and POST router.
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024
const RECEIPT_CACHE_TTL = 15 * 60 * 1000
const MAX_RECEIPT_CACHE_ENTRIES = 20
const RECEIPT_CACHE = new Map()

async function readBoundedResponse(res, maxBytes) {
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

  if (RECEIPT_CACHE.has(id)) {
    const cached = RECEIPT_CACHE.get(id)
    if (cached?.time && Date.now() - cached.time > RECEIPT_CACHE_TTL) {
      RECEIPT_CACHE.delete(id)
    } else if (cached?.base64) {
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
        RECEIPT_CACHE.delete(id)
      } catch (err) {
        console.warn('Error reading from receipt cache:', err)
        RECEIPT_CACHE.delete(id)
      }
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

export async function GET(request, ctx) {
  let path = ''
  try {
    const urlObj = new URL(request.url)
    path = urlObj.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '')
  } catch {
    const resolved = await ctx?.params
    path = (resolved?.path || []).join('/')
  }

  try {
    if (path === '' || path === 'health') {
      return json({ ok: true, app: 'Arshif', engine: 'Google Gemini', time: new Date().toISOString() })
    }
    if (path === 'rates') return json(await getRates())
    if (path === 'ai/usage') return await handleAiUsage(request)
    if (path === 'backup/gdrive') return json({ ok: true, provider: 'google_drive', scope: 'https://www.googleapis.com/auth/drive.file' })
    if (path === 'drive/thumbnail' || path === 'backup/gdrive/thumbnail') return await handleDriveThumbnail(request)

    return err(`Not found: /api/${path}`, 404)
  } catch (e) {
    console.error('GET /api/' + path, e)
    return err(e?.message || 'Server error', 500)
  }
}

export async function POST(request, ctx) {
  let path = ''
  try {
    const urlObj = new URL(request.url)
    path = urlObj.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '')
  } catch {
    const resolved = await ctx?.params
    path = (resolved?.path || []).join('/')
  }

  try {
    if (path.startsWith('backup/gdrive')) {
      let body = {}
      const ct = request.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        body = await request.json().catch(() => ({}))
      }
      const authToken = readBearerToken(request)
      if (!authToken) return err('Autentikasi Arshif diperlukan.', 401)
      const { data: authData, error: authError } = await getServerSupabase(authToken).auth.getUser(authToken)
      if (authError || !authData?.user) return err('Sesi pengguna tidak valid atau telah berakhir.', 401)

      const token = (request.headers.get('x-google-drive-token') || '').trim()
      if (!token || token === 'local' || token.startsWith('dev-')) return err('Token Google Drive tidak valid.', 401)

      let base64 = ''
      let mimeType = 'image/jpeg'
      const raw = (body?.imageBase64 || body?.image || body?.file || '').toString()
      const match = raw.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        mimeType = match[1].trim()
        base64 = match[2]
      } else {
        base64 = raw
      }

      if (!base64) return err('Image data is required', 400)
      base64 = base64.replace(/\s/g, '')
      if (base64ByteLength(base64) > MAX_IMAGE_BYTES) return err('Image terlalu besar (maks 10MB)', 413)
      if (!IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) return err('Unsupported image format', 415)
      const merchant = String(body?.merchant || 'Receipt').trim().slice(0, 120)
      const date = body?.date || new Date().toISOString().split('T')[0]
      const fileName = body?.name || body?.fileName || `Struk_${merchant.replace(/\s+/g, '_')}_${date}.jpg`

      if (token && token.length > 15 && token !== 'local' && !token.startsWith('dev-')) {
        let folderId = null

        try {
          const query = encodeURIComponent("name='Arshif Receipts' and mimeType='application/vnd.google-apps.folder' and trashed=false")
          const findFolderRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (findFolderRes.ok) {
            const folderData = await findFolderRes.json()
            if (folderData?.files && folderData.files.length > 0) {
              folderId = folderData.files[0].id
            }
          }

          if (!folderId) {
            const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'Arshif Receipts', mimeType: 'application/vnd.google-apps.folder' }),
            })
            if (createFolderRes.ok) {
              const newFolder = await createFolderRes.json()
              folderId = newFolder?.id || null
            }
          }
        } catch (folderErr) {
          console.warn('Google Drive folder resolution error (falling back to root):', folderErr)
        }

        try {
          const metadata = {
            name: fileName,
            mimeType,
            description: 'Arshif Receipt Backup',
            ...(folderId ? { parents: [folderId] } : {}),
          }
          const boundary = '-------314159265358979323846'
          const multipartRequestBody =
            `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
            JSON.stringify(metadata) +
            `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n` +
            base64 +
            `\r\n--${boundary}--`

          const driveRes = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,parents',
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
              body: multipartRequestBody,
            }
          )
          if (driveRes.ok) {
            const driveData = await driveRes.json()
            if (base64) {
              if (RECEIPT_CACHE.size >= MAX_RECEIPT_CACHE_ENTRIES) {
                const oldestId = RECEIPT_CACHE.keys().next().value
                if (oldestId) RECEIPT_CACHE.delete(oldestId)
              }
              RECEIPT_CACHE.set(driveData.id, { base64, mimeType, time: Date.now() })
            }
            return json({
              success: true,
              provider: 'google_drive',
              fileId: driveData.id,
              url: driveData.webViewLink || `https://drive.google.com/file/d/${driveData.id}/view`,
              thumbnailUrl: `https://lh3.googleusercontent.com/d/${driveData.id}=w800`,
              name: fileName,
              folderId: folderId || null,
            })
          }
        } catch (e) {
          console.warn('Drive upload error:', e)
        }
      }

      return err('Google Drive upload failed. Connect Google Drive again and retry.', 502)
    }

    if (path.startsWith('ai/')) {
      const authResult = await verifyAndConsumeAiAccess(request)
      if (!authResult.allowed) {
        return authResult.response
      }
      if (path === 'ai/transcribe') return await handleTranscribe(request, authResult.quota)
      if (path === 'ai/parse') return await handleParse(request, authResult.quota)
      if (path === 'ai/coach') return await handleCoach(request, authResult.quota)
      if (path === 'ai/ocr') return await handleOcr(request, authResult.quota)
      if (path === 'ai/parse-statement') return await handleStatementPdf(request, authResult.quota)
    }

    return err(`Not found: /api/${path}`, 404)
  } catch (e) {
    console.error('POST /api/' + path, e)
    return err(e?.message || 'Server error', 500)
  }
}