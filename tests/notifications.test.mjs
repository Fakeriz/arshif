import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveNotifications } from '../lib/notifications.js'
import { translate } from '../lib/i18n.js'

const fmt = (amt, cur) => `${cur} ${amt}`
const t = (key, vars) => translate('id', key, vars)

test('teks notifikasi tagihan memakai terjemahan, bukan nama kunci', () => {
  const today = new Date()
  const dueDay = today.getDate()
  const { notifications } = deriveNotifications({
    bills: [{ id: 'b1', title: 'Listrik', amount: 100000, currency: 'IDR', due_day: dueDay }],
    home: 'IDR',
    fmt,
    t,
  })
  const bill = notifications.find((n) => n.type === 'bill')
  assert.ok(bill, 'notifikasi tagihan dibuat')
  assert.ok(!/^notif_/.test(bill.title), `judul harus teks, dapat: ${bill.title}`)
  assert.ok(!/^notif_/.test(bill.description), `deskripsi harus teks, dapat: ${bill.description}`)
  assert.ok(bill.description.includes('Listrik'), 'nama tagihan masuk ke deskripsi')
})

test('jatuh tempo dan terlambat punya id berbeda', () => {
  const today = new Date()
  const dueToday = deriveNotifications({
    bills: [{ id: 'b1', title: 'Listrik', amount: 1000, currency: 'IDR', due_day: today.getDate() }],
    home: 'IDR', fmt, t,
  }).notifications.find((n) => n.type === 'bill')

  const overdue = deriveNotifications({
    bills: [{ id: 'b1', title: 'Listrik', amount: 1000, currency: 'IDR', due_day: Math.max(1, today.getDate() - 1) }],
    home: 'IDR', fmt, t,
  }).notifications.find((n) => n.type === 'bill')

  assert.ok(dueToday && overdue)
  assert.notEqual(dueToday.id, overdue.id, 'id harus beda supaya push tidak saling membungkam')
})

test('budget warning dan exceeded punya id berbeda', () => {
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const mk = (amount) => deriveNotifications({
    budgets: [{ id: 'bg1', category: 'cat_food', limit_amount: 100000, currency: 'IDR' }],
    transactions: [{ type: 'expense', category: 'cat_food', amount, currency: 'IDR', date: `${monthKey}-01` }],
    home: 'IDR', fmt, t,
  }).notifications.find((n) => n.type === 'budget')

  const warn = mk(90000)
  const over = mk(150000)
  assert.ok(warn && over)
  assert.notEqual(warn.id, over.id)
})
