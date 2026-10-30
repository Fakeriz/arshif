// Web Share Target: receives a receipt image shared from another app.
// The OS POSTs multipart to /share, the image is stashed in sessionStorage
// through a bridge page, then the app redirects to /?sharedReceipt=1.
// sessionStorage avoids new server infrastructure and works on serverless.

export const dynamic = 'force-dynamic'

const MAX_BYTES = 8 * 1024 * 1024

// Whitelist MIME, file.type dari client TIDAK dipercaya. Hanya tipe gambar known
// yang boleh masuk ke data URL, sehingga mustahil breakout dari string JS inline
// (validasi input ketat di server, bukan sanitasi percobaan).
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(req) {
  let dataUrl = ''
  try {
    const form = await req.formData()
    const file = form.get('receipt')
    const mime = String(file?.type || '').split(';')[0].trim().toLowerCase()
    if (file && typeof file.arrayBuffer === 'function' && ALLOWED_IMAGE_TYPES.has(mime)) {
      const buf = Buffer.from(await file.arrayBuffer())
      if (buf.length > 0 && buf.length <= MAX_BYTES) {
        // mime dari whitelist (tidak bisa mengandung kutip/backslash/<), aman di-embed di string JS.
        dataUrl = `data:${mime};base64,${buf.toString('base64')}`
      }
    }
  } catch {}

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#09090b">
<title>Arshif</title>
</head>
<body style="margin:0;height:100dvh;display:flex;align-items:center;justify-content:center;background:#09090b;color:#fff;font-family:system-ui,sans-serif">
<p>Membuka Arshif&hellip;</p>
<script>
try {
  if (${JSON.stringify(Boolean(dataUrl))}) {
    try { sessionStorage.setItem("arshif_shared_receipt", ${JSON.stringify(dataUrl)}); } catch (e) {}
  }
} catch (e) {}
location.replace("/?sharedReceipt=1");
</script>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
