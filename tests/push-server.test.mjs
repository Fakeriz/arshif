import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizePushResults, isExpiredOrInvalidSubscription } from '../lib/push-server.js'

const subs = [{ endpoint: 'https://a' }, { endpoint: 'https://b' }, { endpoint: 'https://c' }]

test('summarizePushResults menghitung device yang menerima', () => {
  const s = summarizePushResults([
    { status: 'fulfilled', value: {} },
    { status: 'fulfilled', value: {} },
    { status: 'rejected', reason: { statusCode: 500, body: 'boom' } },
  ], subs)
  assert.equal(s.delivered, 2)
  assert.equal(s.expired.length, 0)
  assert.equal(s.retryable.length, 1)
})

test('summarizePushResults memisahkan subscription kedaluwarsa', () => {
  const s = summarizePushResults([
    { status: 'rejected', reason: { statusCode: 410, body: 'Gone' } },
    { status: 'rejected', reason: { statusCode: 429, body: 'rate limited' } },
  ], subs)
  assert.deepEqual(s.expired, ['https://a'])
  assert.equal(s.retryable.length, 1)
  assert.equal(s.delivered, 0, 'tidak ada yang menerima, notifikasi tidak boleh ditandai terkirim')
})

test('isExpiredOrInvalidSubscription mengenali kode yang membatalkan subscription', () => {
  assert.equal(isExpiredOrInvalidSubscription({ statusCode: 410 }), true)
  assert.equal(isExpiredOrInvalidSubscription({ statusCode: 404 }), true)
  assert.equal(isExpiredOrInvalidSubscription({ statusCode: 500 }), false)
  assert.equal(isExpiredOrInvalidSubscription({ statusCode: 429 }), false)
})
