// Kebijakan satu tempat untuk konversi mata uang: kurs tak dikenal mengembalikan
// nominal asli (convertOrKeep), TIDAK menghilangkan baris dari total
// (safeConvert(...) ?? 0) dan TIDAK melempar (convert()).
//
// Test ini menjaga agar tidak ada layar yang kembali memakai kebijakan lain:
// dua layar boleh beda angka untuk data yang sama, dan itu yang paling sulit
// dilacak user.
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

test('tidak ada lagi safeConvert di luar lib/rates.js', () => {
  const offenders = sources
    .filter((f) => !f.endsWith(path.join('lib', 'rates.js')))
    .filter((f) => fs.readFileSync(f, 'utf8').includes('safeConvert'))
    .map((f) => path.relative(root, f))
  assert.deepEqual(offenders, [], `pindah ke convertOrKeep: ${offenders.join(', ')}`)
})

test('tidak ada agregasi yang membuang baris berkurs asing (?? 0 setelah konversi)', () => {
  // Pola lama: safeConvert(x, a, b, r) ?? 0
  const offenders = sources
    .filter((f) => /safeConvert\([^)]*\)\s*\?\?\s*0/.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(root, f))
  assert.deepEqual(offenders, [], `pakai convertOrKeep(...).value: ${offenders.join(', ')}`)
})

test('notifikasi memakai convertOrKeep, bukan convert() yang melempar', () => {
  const raw = fs.readFileSync(path.join(root, 'lib', 'notifications.js'), 'utf8')
  // Buang komentar dulu: penyebutan convert() di komentar bukan pemakaian.
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '')
  assert.ok(code.includes('convertOrKeep'), 'notifikasi harus tahan kurs tak dikenal')
  assert.ok(!/\bconvert\(/.test(code), 'convert() melempar dan mematikan lonceng + push cron')
})
