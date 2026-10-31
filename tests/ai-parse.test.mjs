import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GLOBAL_CURRENCIES,
  detectSpokenCurrency,
  sanitizeCurrency,
  sanitizeMerchant,
  stripActionPrefix,
} from '../lib/ai-parse-sanitize.js'

test('semua entry GLOBAL_CURRENCIES punya kode ISO 3 huruf', () => {
  for (const cur of GLOBAL_CURRENCIES) {
    assert.equal(cur.code, cur.code.toUpperCase())
    assert.equal(cur.code.length, 3)
    assert.ok(cur.regex instanceof RegExp)
  }
})

test('detectSpokenCurrency mengenali kata currency di teks', () => {
  assert.equal(detectSpokenCurrency('beli hdmi 20 ringgit'), 'MYR')
  assert.equal(detectSpokenCurrency('beli hdmi 20 ribu'), 'IDR')
  assert.equal(detectSpokenCurrency('beli hdmi 20 rb'), 'IDR')
  assert.equal(detectSpokenCurrency('kopi 5 lira'), 'TRY')
  assert.equal(detectSpokenCurrency('beli hdmi 20.000'), null)
  assert.equal(detectSpokenCurrency('beli charger di Alfamart'), null)
  assert.equal(detectSpokenCurrency(''), null)
  assert.equal(detectSpokenCurrency(null), null)
})

test('BUG 1: teks tanpa kata currency jatuh ke homeCurrency walau Gemini menebak MYR', () => {
  // Dulu output "MYR" dari Gemini dipakai apa adanya, walau teks aslinya bahasa Indonesia.
  assert.equal(sanitizeCurrency({
    text: 'beli hdmi 20.000',
    txCurrency: 'MYR',
    homeCurrency: 'IDR',
  }), 'IDR')
})

test('BUG 1: "20 ribu" dikenali sebagai IDR walau Gemini menebak MYR', () => {
  assert.equal(sanitizeCurrency({
    text: 'beli hdmi 20 ribu',
    txCurrency: 'MYR',
    homeCurrency: 'IDR',
  }), 'IDR')
})

test('currency eksplisit di teks tetap dihormati', () => {
  assert.equal(sanitizeCurrency({
    text: 'beli hdmi 20 ringgit',
    txCurrency: 'MYR',
    homeCurrency: 'IDR',
  }), 'MYR')
  assert.equal(sanitizeCurrency({
    text: 'kopi 15 lira',
    txCurrency: 'TRY',
    homeCurrency: 'IDR',
  }), 'TRY')
})

test('mata uang akun dipakai kalau teks tidak menyebut currency', () => {
  assert.equal(sanitizeCurrency({
    text: 'beli kopi pake Ziraat 50',
    txCurrency: 'MYR',
    accountCurrency: 'TRY',
    homeCurrency: 'IDR',
  }), 'TRY')
})

test('tanpa bukti sama sekali, fallback homeCurrency', () => {
  assert.equal(sanitizeCurrency({
    text: 'beli hdmi 20.000',
    txCurrency: null,
    homeCurrency: 'IDR',
  }), 'IDR')
})

test('BUG 2: nama produk dan kata generik jadi merchant null', () => {
  const items = [{ name: 'HDMI', qty: 1, unit: null, price: 20000 }]
  assert.equal(sanitizeMerchant('HDMI', items), null)
  assert.equal(sanitizeMerchant('hdmi', []), null)
  assert.equal(sanitizeMerchant('Beli HDMI', items), null)
  assert.equal(sanitizeMerchant('charger', []), null)
  assert.equal(sanitizeMerchant('Kabel Data', []), null)
  assert.equal(sanitizeMerchant('Toko', []), null)
  assert.equal(sanitizeMerchant('warung', []), null)
  assert.equal(sanitizeMerchant('beli hdmi 20.000', []), null)
  assert.equal(sanitizeMerchant('Kabel HDMI', [{ name: 'Kabel HDMI', qty: 1, price: 25000 }]), null)
  assert.equal(sanitizeMerchant(null, []), null)
  assert.equal(sanitizeMerchant('', []), null)
})

test('nama toko yang benar tetap disimpan', () => {
  assert.equal(sanitizeMerchant('Alfamart', [{ name: 'Charger' }]), 'Alfamart')
  assert.equal(sanitizeMerchant('di Alfamart', []), 'Alfamart')
  assert.equal(sanitizeMerchant('Indomaret', []), 'Indomaret')
  assert.equal(sanitizeMerchant('Kopi Kenangan', [{ name: 'Kopi' }]), 'Kopi Kenangan')
  assert.equal(sanitizeMerchant('7-Eleven', []), '7-Eleven')
  assert.equal(sanitizeMerchant('99 Speedmart', []), '99 Speedmart')
})

test('BUG 3: awalan beli/jajan/bayar dibuang dari judul dan note', () => {
  assert.equal(stripActionPrefix('Beli HDMI'), 'HDMI')
  assert.equal(stripActionPrefix('  jajan bakso  '), 'bakso')
  assert.equal(stripActionPrefix('bayar listrik'), 'listrik')
  assert.equal(stripActionPrefix('Alfamart'), 'Alfamart')
  assert.equal(stripActionPrefix('beli'), '')
  assert.equal(stripActionPrefix(null), '')
  assert.equal(stripActionPrefix(undefined), '')
})

test('skenario lengkap beli hdmi 20.000: IDR dan merchant null', () => {
  const text = 'beli hdmi 20.000'
  const items = [{ name: 'HDMI', qty: 1, unit: null, price: 20000 }]
  const currency = sanitizeCurrency({ text, txCurrency: 'MYR', homeCurrency: 'IDR' })
  const merchant = sanitizeMerchant('HDMI', items)
  const note = stripActionPrefix('beli hdmi')
  assert.equal(currency, 'IDR')
  assert.equal(merchant, null)
  assert.equal(note, 'hdmi')
})

test('skenario beli charger di Alfamart 50 ribu: merchant Alfamart, IDR', () => {
  const text = 'beli charger di Alfamart 50 ribu'
  const items = [{ name: 'Charger', qty: 1, unit: null, price: 50000 }]
  assert.equal(sanitizeCurrency({ text, txCurrency: 'IDR', homeCurrency: 'IDR' }), 'IDR')
  assert.equal(sanitizeMerchant('Alfamart', items), 'Alfamart')
})
