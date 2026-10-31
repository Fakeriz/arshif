// Verifikasi keys i18n via import module asli — node scripts/verify-i18n.mjs
// Regex \bt\('...' ketat supaya tidak salah tangkap openSheet('scan') / createElement('a') dsb.
import { TRANSLATIONS } from '../lib/i18n.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

const files = fs.readdirSync('components/arshif').map(f => 'components/arshif/' + f).filter(f => f.endsWith('.js'))
  .concat(['components/goals/LoanModal.jsx', 'components/goals/NewSavingsGoalModal.jsx', 'components/goals/SetBudgetModal.jsx', 'components/goals/PostpaidPlanModal.jsx'])
const allKeys = new Set()
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(/\bt\('([a-z_0-9]+)'\)/g)) allKeys.add(m[1])
}
let bad = 0
for (const lang of Object.keys(TRANSLATIONS)) {
  for (const k of allKeys) {
    if (TRANSLATIONS[lang]?.[k] === undefined) { console.log('MISSING', lang, k); bad++ }
  }
}
console.log(bad === 0 ? 'OK: ' + allKeys.size + ' keys x ' + Object.keys(TRANSLATIONS).length + ' bahasa lengkap' : bad + ' missing')
process.exit(bad === 0 ? 0 : 1)
