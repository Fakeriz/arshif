// Kebijakan satu tempat untuk konversi mata uang.
//
// Larangan NYATA (yang membuat uang hilang atau layar mati):
//   1. safeConvert(...) ?? 0  -> baris berkurs asing DIBUANG dari total,
//      sementara layar lain memakai nominal asli: dua layar beda angka.
//   2. convert(...) tanpa penanganan -> MELEMAPAR, mematikan render/route.
//
// safeConvert sendiri BOLEH dipakai bila null-nya ditangani eksplisit
// (mis. badge kurs menampilkan '?'), karena di sana null adalah informasi.
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walk(full, out)
    else if (/\.(js|jsx)$/.test(name)) out.push(full)
  }
  return out
}

const sources = [...walk(path.join(root, 'components')), ...walk(path.join(root, 'lib')), ...walk(path.join(root, 'app'))]
const rel = (f) => path.relative(root, f)

test('tidak ada agregasi yang membuang baris berkurs asing', () => {
  const offenders = sources
    .filter((f) => /safeConvert\([^)]*\)\s*\?\?\s*(0|amount)\b/.test(fs.readFileSync(f, 'utf8')))
    .map(rel)
  assert.deepEqual(offenders, [], `pakai convertOrKeep(...).value: ${offenders.join(', ')}`)
})

test('tidak ada convert() telanjang di jalur nilai komponen', () => {
  // convert() melempar. Pemakaian sah hanya bila dibungkus try/catch pemanggil.
  // dikecualikan: lib/rates.js (pemilik fungsi) dan lib/tax-report.js (di sana
  // `convert` adalah alias fungsi toHome yang di-inject, bukan convert kurs).
  const exempt = new Set([
    path.join('lib', 'rates.js'),
    path.join('lib', 'tax-report.js'),
  ])
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '')
  const offenders = []
  for (const f of sources) {
    if (exempt.has(path.relative(root, f))) continue
    const lines = strip(fs.readFileSync(f, 'utf8')).split('\n')
    lines.forEach((line, i) => {
      if (!/\bconvert\(/.test(line)) return
      if (/convertOrKeep|convertToHome/.test(line)) return
      // Cari 'try' di atas dan 'catch' di bawah dalam blok yang wajar.
      const before = lines.slice(Math.max(0, i - 6), i + 1).join('\n')
      const after = lines.slice(i, i + 45).join('\n')
      const guarded = /\btry\s*\{/.test(before) && /\bcatch\s*[({]/.test(after)
      if (!guarded) offenders.push(`${rel(f)}:${i + 1}`)
    })
  }
  assert.deepEqual(offenders, [], `bungkus atau pakai convertOrKeep: ${offenders.join(', ')}`)
})

test('notifikasi memakai convertOrKeep, bukan convert() yang melempar', () => {
  const raw = fs.readFileSync(path.join(root, 'lib', 'notifications.js'), 'utf8')
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '')
  assert.ok(code.includes('convertOrKeep'), 'notifikasi harus tahan kurs tak dikenal')
  assert.ok(!/\bconvert\(/.test(code), 'convert() melempar dan mematikan lonceng + push cron')
})

test('sheet transaksi tidak memanggil convert() di jalur nilai', () => {
  const raw = fs.readFileSync(path.join(root, 'components', 'arshif', 'AddTransactionSheet.js'), 'utf8')
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '')
  assert.ok(!/\bconvert\(/.test(code), 'sheet transaksi harus tahan kurs tak dikenal')
})

test('evaluator ekspresi mendukung kurung dan tanda unary', async () => {
  const { evaluateExpression } = await import('../lib/ledger.js')
  assert.equal(evaluateExpression('(2+3)*4'), 20)
  assert.equal(evaluateExpression('2*-3'), -6)
  assert.equal(evaluateExpression('5/0'), 0)
})
