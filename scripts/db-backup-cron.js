#!/usr/bin/env node
// Backup harian Supabase via REST API, dijalankan dari cron server.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(root, 'backups')
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || '7')

const TABLES = [
  'profiles',
  'accounts',
  'transactions',
  'goals',
  'bills',
  'budgets',
  'debts',
  'recurring_transactions',
  'split_bills',
  'transaction_templates',
  'categories',
  'import_batches',
  'subscriptions',
  'ai_quotas',
  'notification_settings',
  'push_subscriptions',
]

function env(name) {
  const v = (process.env[name] || '').trim()
  if (!v) throw new Error(`${name} belum diset`)
  return v
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

async function dumpViaPg(url, outFile) {
  await new Promise((resolve, reject) => {
    execFile('pg_dump', ['--data-only', '--column-inserts', url], { maxBuffer: 256 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`pg_dump gagal: ${stderr || err.message}`))
      fs.writeFileSync(outFile, stdout)
      resolve()
    })
  })
}

async function dumpViaRest(baseUrl, serviceKey, outDir) {
  const counts = {}
  for (const table of TABLES) {
    const rows = []
    let from = 0
    const size = 1000
    for (;;) {
      const res = await fetch(`${baseUrl}/rest/v1/${table}?select=*`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Range: `${from}-${from + size - 1}`,
        },
      })
      if (!res.ok) throw new Error(`baca ${table} gagal: HTTP ${res.status}`)
      const batch = await res.json()
      rows.push(...batch)
      if (batch.length < size) break
      from += size
    }
    fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows))
    counts[table] = rows.length
  }
  return counts
}

function prune(dir) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  let removed = 0
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    if (!fs.statSync(full).isDirectory()) continue
    if (!/^backup-\d{8}-\d{4}$/.test(name)) continue
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.rmSync(full, { recursive: true, force: true })
      removed++
    }
  }
  return removed
}

async function main() {
  const mode = process.argv.includes('--pg') ? 'pg' : 'rest'
  const dir = path.join(BACKUP_DIR, `backup-${stamp()}`)
  fs.mkdirSync(dir, { recursive: true })

  if (mode === 'pg') {
    const url = env('DATABASE_URL')
    await dumpViaPg(url, path.join(dir, 'dump.sql'))
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ mode, at: new Date().toISOString(), tables: ['*'] }, null, 2))
    console.log(`OK pg_dump: ${dir}/dump.sql`)
  } else {
    const baseUrl = (env('NEXT_PUBLIC_SUPABASE_URL') || env('SUPABASE_URL')).replace(/\/$/, '')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
    const counts = await dumpViaRest(baseUrl, serviceKey, dir)
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ mode, at: new Date().toISOString(), counts }, null, 2))
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    console.log(`OK rest: ${TABLES.length} tabel, ${total} baris -> ${dir}`)
  }

  const removed = prune(BACKUP_DIR)
  console.log(`OK rotasi: ${removed} folder lama dihapus (retensi ${RETENTION_DAYS} hari)`)
}

// Dieksekusi hanya saat dijalankan langsung, supaya fungsi di atas bisa diuji.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((e) => {
    console.error(`FAIL backup: ${e.message}`)
    process.exit(1)
  })
}

export { prune, stamp, TABLES }
