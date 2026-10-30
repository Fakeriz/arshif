// tests/money-parse.test.mjs
// Test untuk lib/money-parse.js — SATU implementasi parsing uang.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMoney, parseMoneyOrZero } from '../lib/money-parse.js'

test('parseMoney handles plain numbers and numeric strings', () => {
  assert.equal(parseMoney(36), 36)
  assert.equal(parseMoney('36'), 36)
  assert.equal(parseMoney(36.5), 36.5)
})

test('parseMoney handles Indonesian thousand+decimal format', () => {
  assert.equal(parseMoney('1.234,56'), 1234.56)
  assert.equal(parseMoney('10.000'), 10000)      // ID: sepuluh ribu
  assert.equal(parseMoney('12,5'), 12.5)          // koma = desimal
})

test('parseMoney handles English format', () => {
  assert.equal(parseMoney('1,234.56'), 1234.56)
  assert.equal(parseMoney('1,234,567'), 1234567)
})

test('parseMoney handles negative and accounting format', () => {
  assert.equal(parseMoney('(1,234.56)'), -1234.56)
  assert.equal(parseMoney('500-'), -500)
  assert.equal(parseMoney('-250'), -250)
})

test('parseMoney returns null for non-numeric input', () => {
  assert.equal(parseMoney(''), null)
  assert.equal(parseMoney('   '), null)
  assert.equal(parseMoney('abc'), null)
  assert.equal(parseMoney(null), null)
  assert.equal(parseMoney(undefined), null)
  assert.equal(parseMoney('-'), null)
})

test('parseMoney rounds to 2 decimals', () => {
  assert.equal(parseMoney('3.14159'), 3.14)
  assert.equal(parseMoney('2.67'), 2.67)
  // Catatan: '2.675' di-parse sebagai 2675 (ID ribuan — grup tepat 3 digit).
  // Ini ambiguitas format ID vs EN; kontrak app: locale ID menang.
})

test('parseMoneyOrZero never returns null', () => {
  assert.equal(parseMoneyOrZero('garbage'), 0)
  assert.equal(parseMoneyOrZero('1.234,56'), 1234.56)
  assert.equal(parseMoneyOrZero(undefined), 0)
})

test('parseMoney strips currency symbols and spaces', () => {
  assert.equal(parseMoney('Rp 12.500'), 12500)
  assert.equal(parseMoney('$ 49.99'), 49.99)
})
