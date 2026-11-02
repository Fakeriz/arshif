// Mock Supabase REST untuk verifikasi db-backup-cron.js tanpa kredensial prod.
// Melayani /rest/v1/<tabel> dengan paginasi Range (default 1000/permintaan),
// dan sengaja mengembalikan 2500 baris untuk satu tabel agar jalur multi-halaman
// benar-benar dijalankan. Hanya untuk uji: TIDAK pernah diarahkan ke prod.
import http from 'node:http'

const PORT = Number(process.env.MOCK_PORT || 9999)
const BIG_TABLE = process.env.MOCK_BIG_TABLE || 'transactions'
const BIG_ROWS = Number(process.env.MOCK_BIG_ROWS || 2500)
const DEFAULT_ROWS = Number(process.env.MOCK_ROWS || 7)

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const m = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/i)
  if (!m) { res.writeHead(404).end('not found'); return }
  const table = m[1]
  const range = req.headers.range || '0-999'
  const [from, to] = range.split('-').map(Number)
  const total = table === BIG_TABLE ? BIG_ROWS : DEFAULT_ROWS
  const rows = []
  for (let i = from; i <= Math.min(to, total - 1); i++) {
    rows.push({ id: `${table}-${i}`, n: i })
  }
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Range': `${from}-${Math.min(to, total - 1)}/${total}`,
  })
  res.end(JSON.stringify(rows))
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock supabase siap di http://127.0.0.1:${PORT} (${BIG_TABLE} = ${BIG_ROWS} baris)`)
})
