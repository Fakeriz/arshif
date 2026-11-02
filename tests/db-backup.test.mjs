import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.BACKUP_RETENTION_DAYS = '7'
const { prune, stamp, TABLES } = await import('../scripts/db-backup-cron.js')

test('stamp menghasilkan nama folder backup-YYYYMMDD-HHMM', () => {
  assert.match(stamp(new Date('2026-11-02T03:04:00Z')), /^\d{8}-\d{4}$/)
})

test('prune hanya menghapus folder backup yang lebih tua dari retensi', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arshif-backup-'))
  const old = path.join(dir, 'backup-20260101-0000')
  const fresh = path.join(dir, 'backup-20261102-0000')
  const other = path.join(dir, 'catatan-lain')
  for (const d of [old, fresh, other]) fs.mkdirSync(d)

  const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000
  fs.utimesSync(old, new Date(tenDaysAgo), new Date(tenDaysAgo))

  const removed = prune(dir)
  assert.equal(removed, 1)
  assert.equal(fs.existsSync(old), false, 'folder lama dihapus')
  assert.equal(fs.existsSync(fresh), true, 'folder baru dipertahankan')
  assert.equal(fs.existsSync(other), true, 'folder non-backup tidak disentuh')

  fs.rmSync(dir, { recursive: true, force: true })
})

test('daftar tabel backup mencakup tabel inti', () => {
  for (const t of ['profiles', 'accounts', 'transactions', 'bills', 'budgets']) {
    assert.ok(TABLES.includes(t), `${t} harus ikut dibackup`)
  }
})
