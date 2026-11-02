import assert from 'node:assert/strict'
import test from 'node:test'
import { extractDraft, normalizeDraft } from '../lib/coach-draft.js'

test('blok arshif-tx dipisah dari jawaban dan jadi draft bersih', () => {
  const reply = 'Siap, kopi 25 ribu tadi pagi dicatat sebagai makan.\n```arshif-tx\n{"type":"expense","amount":25000,"currency":"IDR","category":"food","note":"Kopi Kenangan","date":"2026-11-02T08:30:00.000Z"}\n```'
  const { reply: text, draft } = extractDraft(reply)
  assert.equal(text, 'Siap, kopi 25 ribu tadi pagi dicatat sebagai makan.')
  assert.equal(draft.type, 'expense')
  assert.equal(draft.amount, 25000)
  assert.equal(draft.currency, 'IDR')
  assert.equal(draft.category, 'food')
  assert.equal(draft.date, '2026-11-02T08:30:00.000Z')
})

test('jawaban tanpa blok tetap utuh tanpa draft', () => {
  const { reply, draft } = extractDraft('Pengeluaran bulan ini 7,4 juta.')
  assert.equal(reply, 'Pengeluaran bulan ini 7,4 juta.')
  assert.equal(draft, null)
})

test('draft tidak valid dibuang: nominal nol, negatif, atau bukan angka', () => {
  assert.equal(normalizeDraft({ type: 'expense', amount: 0 }), null)
  assert.equal(normalizeDraft({ type: 'expense', amount: -5 }), null)
  assert.equal(normalizeDraft({ type: 'expense', amount: 'abc' }), null)
  assert.equal(normalizeDraft(null), null)
  assert.equal(normalizeDraft([1, 2]), null)
})

test('field tidak wajar dibersihkan, bukan diteruskan', () => {
  const d = normalizeDraft({ type: 'hacked', amount: '10.5', currency: 'idrrr', category: ' x '.repeat(10), note: 'y'.repeat(300), date: 'ngawur' })
  assert.equal(d.type, 'expense', 'type di luar daftar jatuh ke expense')
  assert.equal(d.currency, null, 'kode mata uang bukan 3 huruf dibuang')
  assert.ok(d.category.length <= 40)
  assert.ok(d.note.length <= 120)
  assert.equal(d.date, null, 'tanggal rusak dibuang, bukan ditebak')
})

test('nominal dengan koma desimal dibaca', () => {
  const d = normalizeDraft({ type: 'income', amount: '1.5', currency: 'USD' })
  assert.equal(d.amount, 1.5)
})
