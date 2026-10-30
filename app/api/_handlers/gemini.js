// app/api/_handlers/gemini.js
// Client REST Google Gemini: fallback antar model kandidat, normalisasi contents,
// ekstraksi JSON dari output model. Dipakai semua handler AI.
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

export { callGemini, extractJson }
