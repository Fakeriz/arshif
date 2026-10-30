// app/api/[[...path]]/route.js
// Catch-all dispatcher tipis. Semua logika ada di app/api/_handlers/:
//   ./http        — helper response & batas payload
//   ./gemini      — client REST Gemini
//   ./quota       — auth + kuota AI, GET ai/usage
//   ./ai          — transcribe, parse, coach, ocr, parse-statement
//   ./rates       — GET rates
//   ./drive       — POST backup/gdrive
//   ./thumbnail   — GET drive/thumbnail & backup/gdrive/thumbnail
// Kontrak URL tidak berubah.
import { json, err, resolveApiPath } from '../_handlers/http'
import { handleAiUsage, verifyAndConsumeAiAccess } from '../_handlers/quota'
import { handleRates } from '../_handlers/rates'
import { handleDriveBackup } from '../_handlers/drive'
import { handleDriveThumbnail } from '../_handlers/thumbnail'
import { handleTranscribe, handleParse, handleCoach, handleOcr, handleStatementPdf } from '../_handlers/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, ctx) {
  const path = await resolveApiPath(request, ctx)

  try {
    if (path === '' || path === 'health') {
      return json({ ok: true, app: 'Arshif', engine: 'Google Gemini', time: new Date().toISOString() })
    }
    if (path === 'rates') return await handleRates()
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
  const path = await resolveApiPath(request, ctx)

  try {
    if (path.startsWith('backup/gdrive')) {
      return await handleDriveBackup(request)
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
