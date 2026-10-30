// app/api/_handlers/drive.js
// POST /api/backup/gdrive, verifikasi user Arshif, unggah struk multipart
// ke folder "Arshif Receipts" di Google Drive user, lalu isi cache thumbnail.
import { readBearerToken, getServerSupabase } from '@/lib/api-auth'
import { json, err, MAX_IMAGE_BYTES, IMAGE_MIME_TYPES, base64ByteLength } from './http'
import { receiptCacheSet } from './receipt-cache'

async function handleDriveBackup(request) {
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
          receiptCacheSet(driveData.id, { base64, mimeType })
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

export { handleDriveBackup }
