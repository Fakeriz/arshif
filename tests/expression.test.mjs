import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateExpression } from '../lib/ledger.js'

// Kasus dari checklist money-math-audit: tanda unary adalah TANDA, bukan
// operand. Versi lama mendorong placeholder 0 sehingga presedensi rusak.
test('tanda unary tidak merusak presedensi', () => {
  assert.equal(evaluateExpression('2*-3'), -6)
  assert.equal(evaluateExpression('-5+2'), -3)
  assert.equal(evaluateExpression('10/-2'), -5)
  assert.equal(evaluateExpression('--3'), 3)
  assert.equal(evaluateExpression('3--2'), 5)
})

test('presedensi dan grup tetap benar', () => {
  assert.equal(evaluateExpression('2+3*4'), 14)
  assert.equal(evaluateExpression('(2+3)*4'), 20)
  assert.equal(evaluateExpression('10/4'), 2.5)
  assert.equal(evaluateExpression('1.500+2.500'), 4000)
})

test('pembagian nol menghasilkan 0, bukan Infinity/NaN', () => {
  assert.equal(evaluateExpression('5/0'), 0)
  assert.equal(evaluateExpression('0/0'), 0)
})

test('input kosong atau bukan angka tidak melempar', () => {
  assert.equal(evaluateExpression(''), 0)
  assert.equal(evaluateExpression(null), 0)
  assert.equal(evaluateExpression('abc'), 0)
})

test('simbol tampilan dikenali', () => {
  assert.equal(evaluateExpression('2×3'), 6)
  assert.equal(evaluateExpression('10÷4'), 2.5)
  assert.equal(evaluateExpression('5−2'), 3)
})
