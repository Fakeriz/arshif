import assert from 'node:assert/strict'
import test from 'node:test'
import { extractDraft, normalizeDraft, parseWallets, resolveDraft } from '../lib/coach-draft.js'

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

test('tanggal: terima YYYY-MM-DD dan ISO, tolak "today" dan format ambigu', () => {
  assert.equal(normalizeDraft({ amount: 10, date: '2026-11-02' }).date, '2026-11-02')
  assert.equal(normalizeDraft({ amount: 10, date: '2026-11-02T08:30:00' }).date, '2026-11-02T08:30:00')
  assert.equal(normalizeDraft({ amount: 10, date: '2026-11-02T08:30:00.000Z' }).date, '2026-11-02T08:30:00.000Z')
  assert.equal(normalizeDraft({ amount: 10, date: 'today' }).date, null, 'today -> null biar form isi hari ini')
  assert.equal(normalizeDraft({ amount: 10, date: '02/11/2026' }).date, null, 'format ambigu ditolak')
  assert.equal(normalizeDraft({ amount: 10, date: '2026-13-40' }).date, null, 'tanggal tak valid ditolak')
})

test('resolve: category tak dikenal jadi null, bukan food', () => {
  const d = resolveDraft(normalizeDraft({ amount: 100, category: 'jajan' }), { categories: ['food', 'transport'] })
  assert.equal(d.category, null)
  const ok = resolveDraft(normalizeDraft({ amount: 100, category: 'Food' }), { categories: ['food', 'transport'] })
  assert.equal(ok.category, 'food')
})

test('resolve: currency null/rusak jatuh ke home currency', () => {
  const d = resolveDraft(normalizeDraft({ amount: 100, category: 'food' }), { categories: ['food'], homeCurrency: 'MYR' })
  assert.equal(d.currency, 'MYR')
  const broken = resolveDraft({ ...d, currency: null }, { categories: ['food'], homeCurrency: 'MYR' })
  assert.equal(broken.currency, 'MYR')
  const weird = resolveDraft({ ...d, currency: 'XX' }, { categories: ['food'], homeCurrency: 'xx' })
  assert.equal(weird.currency, 'IDR')
})

test('resolve: account_name cocok ke akun terdekat dua arah, selain itu null', () => {
  const wallets = parseWallets(['BCA Utama (IDR)', { name: 'GoPay', currency: 'idr' }], 'IDR')
  assert.deepEqual(wallets, [{ name: 'BCA Utama', currency: 'IDR' }, { name: 'GoPay', currency: 'IDR' }])
  const byShort = resolveDraft(
    normalizeDraft({ amount: 100, account_name: 'bca' }),
    { categories: ['food'], accounts: wallets, homeCurrency: 'IDR' },
  )
  assert.equal(byShort.account_name, 'BCA Utama')
  const byLong = resolveDraft(
    normalizeDraft({ amount: 100, account_name: 'bayar pakai GoPay saya' }),
    { categories: ['food'], accounts: wallets, homeCurrency: 'IDR' },
  )
  assert.equal(byLong.account_name, 'GoPay')
  const missing = resolveDraft(
    normalizeDraft({ amount: 100, account_name: 'Wise USD' }),
    { categories: ['food'], accounts: wallets, homeCurrency: 'IDR' },
  )
  assert.equal(missing.account_name, null)
})

test('multi-blok: hanya blok pertama yang valid dipakai, semua blok dibuang dari teks', () => {
  const reply = 'Catat dua ya.\n```arshif-tx\nnot json\n```\nLanjut.\n```arshif-tx\n{"type":"expense","amount":30000,"currency":"IDR","category":"transport"}\n```\n```arshif-tx\n{"type":"expense","amount":50000,"currency":"IDR","category":"food"}\n```\nSelesai.'
  const { reply: text, draft } = extractDraft(reply)
  assert.equal(draft.amount, 30000, 'blok pertama yang valid dipakai')
  assert.equal(draft.category, 'transport')
  assert.ok(!text.includes('arshif-tx'), 'semua blok dibuang dari teks')
  assert.ok(!text.includes('30000') && !text.includes('50000'), 'isi JSON tidak bocor ke teks')
})

test('multi-blok semuanya rusak: draft null tapi teks bersih', () => {
  const reply = 'Halo.\n```arshif-tx\n{"amount":0}\n```\n```arshif-tx\nbukan json\n```'
  const { reply: text, draft } = extractDraft(reply)
  assert.equal(draft, null)
  assert.equal(text, 'Halo.')
})
