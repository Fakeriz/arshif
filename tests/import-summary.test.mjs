import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeImport, rowKey, markInFileDuplicates } from '../lib/statement-import.js'

test('ringkasan memisahkan duplikat, tanggal rusak, dan gagal', () => {
  const rows = [
    { dateStr: '2026-01-01', amount: 10, currency: 'IDR', desc: 'A' },
    { dateStr: '2026-01-01', amount: 10, currency: 'IDR', desc: 'A', dupInFile: true },
    { dateStr: '2026-01-02', amount: 20, currency: 'IDR', desc: 'B', dupExisting: true },
    { dateStr: '', amount: 30, currency: 'IDR', desc: 'C', dateMissing: true },
    { dateStr: '2026-01-03', amount: 40, currency: 'IDR', desc: 'D' },
  ]
  const s = summarizeImport(rows, 1, 1)
  assert.equal(s.ok, 1)
  assert.equal(s.failed, 1)
  assert.equal(s.dup, 2)
  assert.equal(s.noDate, 1)
  assert.equal(s.total, 5)
  // 1 ok + 1 failed + 2 dup + 1 noDate = 5, tidak ada sisa tersembunyi
  assert.equal(s.other, 0)
})

test('markInFileDuplicates: kejadian pertama tetap ikut, salinan ditandai', () => {
  const rows = [
    { dateStr: '2026-01-01', amount: 10, currency: 'IDR', desc: 'Kopi' },
    { dateStr: '2026-01-01', amount: 10, currency: 'IDR', desc: 'kopi' },
    { dateStr: '2026-01-01', amount: 10, currency: 'IDR', desc: 'Kopi' },
  ]
  markInFileDuplicates(rows)
  assert.equal(rows[0].dupInFile, false)
  assert.equal(rows[1].dupInFile, true)
  assert.equal(rows[2].dupInFile, true)
})

test('rowKey stabil terhadap perbedaan penulisan deskripsi', () => {
  const a = rowKey({ dateStr: '2026-01-01', amount: 10, currency: 'idr', desc: 'Kopi Kenangan' })
  const b = rowKey({ dateStr: '2026-01-01', amount: 10.0, currency: 'IDR', desc: 'kopi  kenangan' })
  assert.equal(a, b)
})

test('ringkasan kosong tidak melempar error', () => {
  const s = summarizeImport([], 0, 0)
  assert.equal(s.total, 0)
  assert.equal(s.other, 0)
})
