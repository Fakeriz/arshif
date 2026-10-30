import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchAlert, SMART_ALERT_RULE_COUNT } from '../lib/smart-alerts.js'

test('rule engine memuat 32 regex dari riset Belanje', () => {
  assert.equal(SMART_ALERT_RULE_COUNT, 32)
})

// Contoh verifikasi dari BELANJE_AI_HANDOFF.md section 5
test('DuitNow QR expense terdeteksi rule 1', () => {
  assert.deepEqual(matchAlert('RM50.00 DuitNow QR Pay to MCD 123 on 23/10/26'), {
    type: 'expense',
    amount: 50,
    currency: 'MYR',
    merchant: 'MCD 123',
    direction: 'outgoing',
    ruleId: 1,
    smart_source_key: 'smart-alert:1',
  })
})

test('FPX transfer keluar terdeteksi rule 3', () => {
  const r = matchAlert('RM200.00 FPX to ANZAR BIN ALIMUDDIN on 22/10/26')
  assert.equal(r.ruleId, 3)
  assert.equal(r.amount, 200)
  assert.equal(r.merchant, 'ANZAR BIN ALIMUDDIN')
  assert.equal(r.direction, 'outgoing')
})

test('belanja kartu kredit terdeteksi rule 5', () => {
  const r = matchAlert('RM88.80 spent at 7-ELEVEN KJ using your credit card ending 4321')
  assert.equal(r.ruleId, 5)
  assert.equal(r.amount, 88.8)
  assert.equal(r.merchant, '7-ELEVEN KJ')
  assert.equal(r.type, 'expense')
})

test('pembayaran generic terdeteksi rule 7', () => {
  const r = matchAlert('RM45.00 paid to TESCO LOBANG on 23/10/26')
  assert.equal(r.ruleId, 7)
  assert.equal(r.merchant, 'TESCO LOBANG')
})

test('transfer masuk dari orang lain menghasilkan income', () => {
  const r = matchAlert('KAMARIAH BINTI HUSSI has successfully transferred RM 1,200.00 to you')
  assert.equal(r.ruleId, 2)
  assert.equal(r.type, 'income')
  assert.equal(r.direction, 'incoming')
  assert.equal(r.amount, 1200)
  assert.equal(r.currency, 'MYR')
})

test('Payment of ... successful payment terdeteksi rule 16', () => {
  const r = matchAlert('Payment of RM12.50 to GRAB successful payment')
  assert.equal(r.ruleId, 16)
  assert.equal(r.merchant, 'GRAB')
  assert.equal(r.amount, 12.5)
})

test('kata kerja received pada rule 10 dibaca sebagai income', () => {
  const r = matchAlert('rm150 has been received')
  assert.equal(r.ruleId, 10)
  assert.equal(r.type, 'income')
  assert.equal(r.direction, 'incoming')
})

// Rule 12 asli (cashback) tidak pernah bisa match: regex-nya menuntut "your\b"
// langsung diikuti kata kunci tanpa spasi. Artefak decompile, dibiarkan apa
// adanya. Direction cashback masih bisa tercapai lewat rule 13 (percent off).
test('percent off menghasilkan direction cashback', () => {
  const r = matchAlert('Enjoy 10% off with your card this weekend')
  assert.equal(r.ruleId, 13)
  assert.equal(r.direction, 'cashback')
  assert.equal(r.type, 'income')
})

test('teks tidak dikenal mengembalikan null', () => {
  assert.equal(matchAlert('Selamat pagi, ini bukan notifikasi bank'), null)
})

test('input kosong atau bukan string mengembalikan null', () => {
  assert.equal(matchAlert(''), null)
  assert.equal(matchAlert(null), null)
  assert.equal(matchAlert(undefined), null)
  assert.equal(matchAlert(123), null)
})

test('smart_source_key selalu mengikuti rule yang match', () => {
  for (const text of [
    'RM50.00 DuitNow QR Pay to MCD 123 on 23/10/26',
    'RM200.00 FPX to ANZAR BIN ALIMUDDIN on 22/10/26',
    'Payment of RM12.50 to GRAB successful payment',
  ]) {
    const r = matchAlert(text)
    assert.equal(r.smart_source_key, 'smart-alert:' + r.ruleId)
  }
})
