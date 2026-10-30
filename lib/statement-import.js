// Pure logic (no React/Supabase) for bank statement import.
// Runs client-side because statements are sensitive; only final rows are sent.

import { CATEGORIES } from './categories.js'

// Parse CSV/XLS/XLSX files with the xlsx package.
export async function parseStatementFile(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets?.[wb.SheetNames?.[0]]
  if (!ws) throw new Error('empty')
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
  // Cari baris header: baris pertama dengan >= 2 sel non-kosong (lewati judul laporan bank)
  let hi = -1
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const row = aoa[i] || []
    const nonEmpty = row.filter((c) => String(c ?? '').trim() !== '').length
    if (nonEmpty >= 2) { hi = i; break }
  }
  if (hi < 0) throw new Error('empty')
  const headers = (aoa[hi] || []).map((h) => String(h ?? '').trim())
  let body = (aoa.slice(hi + 1) || []).filter((r) =>
    (r || []).some((c) => String(c ?? '').trim() !== '')
  )
  // File tanpa baris header: baris "header" yang terdeteksi ternyata berisi
  // data (tanggal/nominal). Perlakukan sebagai data; kolom jadi generik.
  if (rowLooksLikeData(aoa[hi])) {
    body = [aoa[hi], ...body]
    return { fileName: file?.name || 'statement', headers: [], rows: body }
  }
  if (!body.length) throw new Error('empty')
  return { fileName: file?.name || 'statement', headers, rows: body }
}

// Heuristik: apakah baris ini sebenarnya data, bukan header?
function rowLooksLikeData(cells) {
  const nonEmpty = (cells || []).map((c) => String(c ?? '').trim()).filter(Boolean)
  if (nonEmpty.length < 2) return false
  let dateLike = 0, amtLike = 0
  for (const c of nonEmpty) {
    if (normalizeDate(c) !== null) dateLike++
    else if (parseAmount(c) !== null) amtLike++
  }
  const ratio = (dateLike + amtLike) / nonEmpty.length
  return ratio > 0.5 && (dateLike >= 1 || amtLike >= 2)
}

// Detect column roles across EN, MS, ID, and TR headers.
const ROLE_KEYWORDS = {
  date: ['date', 'tanggal', 'tarikh', 'tarih', 'datum'],
  desc: ['desc', 'narrat', 'keterangan', 'catatan', 'perihal', 'detail', 'rincian', 'uraian', 'aciklama', 'açıklama', 'memo'],
  amount: ['amount', 'jumlah', 'nominal', 'value', 'tutar', 'miktar', 'nilai'],
  debit: ['debit', 'pengeluaran', 'keluar', 'withdrawal'],
  credit: ['credit', 'kredit', 'pemasukan', 'masuk', 'deposit'],
  balance: ['balance', 'baki', 'saldo', 'bakiye'],
  type: ['type', 'tipe', 'jenis', 'tür', 'tur'],
  currency: ['currency', 'curr', 'mata uang', 'mata wang', 'para birimi'],
}

const normH = (s) => String(s ?? '').trim().toLowerCase()

// Kata kunci tipe transaksi untuk fallback berbasis isi (tanpa inferensi tanda)
const TYPE_WORD = /(income|credit|kredit|masuk|pemasukan|pendapatan|gelir|expense|debit|keluar|pengeluaran|perbelanjaan|gider|belanja|transfer|pindah|kirim|havale)/i

function findCol(headers, keys, used) {
  for (let i = 0; i < headers.length; i++) {
    if (used.has(i)) continue
    const h = normH(headers[i])
    if (!h) continue
    if (keys.some((k) => h.includes(k))) { used.add(i); return i }
  }
  return -1
}

export function detectMapping(headers, sampleRows = []) {
  const used = new Set()
  const mapping = {
    date: findCol(headers, ROLE_KEYWORDS.date, used),
    desc: findCol(headers, ROLE_KEYWORDS.desc, used),
    amount: findCol(headers, ROLE_KEYWORDS.amount, used),
    debit: findCol(headers, ROLE_KEYWORDS.debit, used),
    credit: findCol(headers, ROLE_KEYWORDS.credit, used),
    balance: findCol(headers, ROLE_KEYWORDS.balance, used),
    type: findCol(headers, ROLE_KEYWORDS.type, used),
    currency: findCol(headers, ROLE_KEYWORDS.currency, used),
  }
  // Prioritas: pasangan debit/kredit > kolom tipe > satu kolom bertanda
  let dirMode = 'signed'
  if (mapping.debit >= 0 && mapping.credit >= 0) dirMode = 'split'
  else if (mapping.type >= 0) dirMode = 'type_col'

  // Infer column roles when headers are missing or unknown: date/desc/type/currency
  // by sample shape, then amount columns by tier (strong >= 2 samples, weak 1).
  const rows8 = (sampleRows || []).slice(0, 8)
  const nCols = Math.max(headers.length, ...rows8.map((r) => (r || []).length), 0)
  const colSamples = (i) => rows8.map((r) => String(r?.[i] ?? '').trim()).filter(Boolean)
  const hitRatio = (i, fn, min = 0.6, minN = 2) => {
    const s = colSamples(i)
    return s.length >= minN && s.filter(fn).length / s.length >= min
  }
  const isDateCol = (i) => hitRatio(i, (c) => normalizeDate(c) !== null)
  const isAmt = (c) => parseAmount(c) !== null
  const isAmtCol = (i) => hitRatio(i, isAmt)
  const claim = (i, role) => {
    if (i >= 0 && i < nCols && !used.has(i)) { used.add(i); mapping[role] = i; return true }
    return false
  }
  const firstFree = (pred) => {
    for (let i = 0; i < nCols; i++) if (!used.has(i) && pred(i)) return i
    return -1
  }

  if (mapping.date < 0) claim(firstFree(isDateCol), 'date')
  if (mapping.desc < 0) {
    // Kolom paling "tekstual": rata-rata panjang sel terbesar, bukan tanggal/nominal
    let best = -1, bestLen = 0
    for (let i = 0; i < nCols; i++) {
      if (used.has(i) || isDateCol(i) || isAmtCol(i)) continue
      const s = colSamples(i)
      if (s.length < 2) continue
      const avg = s.reduce((a, c) => a + c.length, 0) / s.length
      if (avg > bestLen) { bestLen = avg; best = i }
    }
    claim(best, 'desc')
  }
  if (mapping.type < 0) claim(firstFree((i) => hitRatio(i, (c) => TYPE_WORD.test(c), 0.5)), 'type')
  if (mapping.currency < 0) claim(firstFree((i) => hitRatio(i, (c) => /^[A-Z]{3}$/.test(c), 0.8)), 'currency')

  // Kolom nominal yang belum dipakai, urut index.
  // Tier 1: >= 2 sampel (kuat). Tier 2: 1 sampel — hanya sebagai kandidat
  // sekunder (mis. kolom kredit yang jarang terisi), tidak menggeser tier 1.
  const amtCols = []
  const amtColsWeak = []
  for (let i = 0; i < nCols; i++) {
    if (used.has(i)) continue
    if (hitRatio(i, isAmt, 0.6, 2)) amtCols.push(i)
    else if (hitRatio(i, isAmt, 0.6, 1)) amtColsWeak.push(i)
  }
  if (amtCols.length < 2) for (const i of amtColsWeak) if (!amtCols.includes(i)) amtCols.push(i)
  const negShare = (i) => {
    const s = colSamples(i).map(parseAmount).filter((n) => n !== null && n !== 0)
    return s.length ? s.filter((n) => n < 0).length / s.length : 0
  }
  // Dua kolom nominal: (amount + running balance) vs (debit / credit)?
  // Kalau keduanya terisi di baris yang sama → amount + balance.
  // Kalau saling eksklusif → debit / credit.
  const amtOverlap = (a, b) => {
    let both = 0, either = 0
    for (const r of rows8) {
      const va = parseAmount(String(r?.[a] ?? '').trim())
      const vb = parseAmount(String(r?.[b] ?? '').trim())
      if (va !== null && vb !== null) both++
      if (va !== null || vb !== null) either++
    }
    return either ? both / either : 0
  }

  if (dirMode === 'signed' && mapping.amount < 0 && amtCols.length) {
    if (amtCols.length >= 2 && amtOverlap(amtCols[0], amtCols[1]) < 0.5) {
      // Debit/kredit terpisah: kolom dengan porsi negatif terbesar = debit;
      // seri → kolom pertama (konvensi umum: Debit sebelum Credit)
      const [a, b] = amtCols
      const debitCol = negShare(a) >= negShare(b) ? a : b
      claim(debitCol, 'debit')
      claim(debitCol === a ? b : a, 'credit')
      dirMode = 'split'
    } else claim(amtCols[0], 'amount')
  }
  if (dirMode === 'split') {
    if (mapping.debit < 0) claim(amtCols.find((i) => !used.has(i)) ?? -1, 'debit')
    if (mapping.credit < 0) claim(amtCols.find((i) => !used.has(i)) ?? -1, 'credit')
  }
  if (dirMode === 'type_col' && mapping.amount < 0) claim(amtCols.find((i) => !used.has(i)) ?? -1, 'amount')
  // Sisa kolom nominal yang belum dipakai → kemungkinan running balance
  if (mapping.balance < 0) claim(amtCols.find((i) => !used.has(i)) ?? -1, 'balance')

  return { mapping, dirMode }
}

// Normalize imported values.
export function parseAmount(v) {
  if (typeof v === 'number' && isFinite(v)) return v
  let s = String(v ?? '').trim()
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim() } // (1,234.56) = negatif
  s = s.replace(/[^\d.,-]/g, '')
  if (!s || s === '-' || s === '.' || s === ',') return null
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // pemisah terakhir = desimal → "1.234,56" (ID) atau "1,234.56" (EN)
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (hasComma) {
    const pcs = s.split(',')
    if (pcs.length > 2) s = pcs.join('')                 // 1,234,567
    else if (/^-?\d{1,3},\d{3}$/.test(s)) s = pcs.join('') // 1,234 → ribuan
    else s = s.replace(',', '.')                          // 12,5 → desimal
  } else if (hasDot) {
    // "10.000" (ID: sepuluh ribu) vs "10.50" (desimal) — heuristik: grup tepat
    // 3 digit setelah titik + ≤3 digit sebelumnya → pemisah ribuan ala ID/MY.
    const pcs = s.split('.')
    if (pcs.length > 2 && /^-?\d{1,3}$/.test(pcs[0]) && pcs.slice(1).every((p) => /^\d{3}$/.test(p))) s = pcs.join('')
    else if (/^-?\d{1,3}\.\d{3}$/.test(s)) s = s.replace('.', '')
  }
  const n = parseFloat(s)
  if (!isFinite(n)) return null
  return neg ? -Math.abs(n) : n
}

export function normalizeDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(v.getTime())) return v
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Serial date Excel
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return isNaN(d.getTime()) ? null : d
  }
  const s = String(v).trim()
  // new Date() menggulung tanggal invalid (31 Feb → 3 Mar) alih-alih gagal,
  // jadi komponen yang dibangun diverifikasi ulang; kalau bergeser = input salah.
  const exactDate = (d, y, m0, day) =>
    d.getFullYear() === y && d.getMonth() === m0 && d.getDate() === day
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) {
    const y = Number(m[1]), m0 = Number(m[2]) - 1, day = Number(m[3])
    const d = new Date(y, m0, day)
    return exactDate(d, y, m0, day) ? d : null
  }
  // Day-first default (ID/MY): DD/MM/YYYY. Jika salah satu > 12, itu pasti harinya.
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (m) {
    const a = Number(m[1]), b = Number(m[2])
    const y = Number(m[3].length === 2 ? '20' + m[3] : m[3])
    let day = a, mon = b
    if (a > 12 && b <= 12) { day = a; mon = b }
    else if (b > 12 && a <= 12) { day = b; mon = a }
    const d = new Date(y, mon - 1, day)
    return exactDate(d, y, mon - 1, day) ? d : null
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

const normT = (s) => String(s ?? '').trim().toLowerCase()

export function normalizeType(v, amount) {
  const s = normT(v)
  if (/(income|credit|kredit|masuk|pemasukan|pendapatan|gelir)/.test(s)) return 'income'
  if (/(expense|debit|keluar|pengeluaran|perbelanjaan|gider|belanja)/.test(s)) return 'expense'
  if (/(transfer|pindah|kirim|havale)/.test(s)) return 'transfer'
  return amount != null && amount < 0 ? 'expense' : 'income'
}

export function normalizeDesc(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// Beberapa bank mengekspor deskripsi dengan HTML entities (mis. &#43; untuk +).
// Decode sebelum dipakai agar tampil bersih di review maupun transaksi final.
const HTML_ENTITY_RE = /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export function decodeHtmlEntities(s) {
  return String(s ?? '').replace(HTML_ENTITY_RE, (m, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10)
      if (Number.isFinite(code) && code > 0 && code < 0x110000) {
        try { return String.fromCodePoint(code) } catch { return m }
      }
      return m
    }
    return NAMED_ENTITIES[ent.toLowerCase()] ?? m
  })
}

export const fmtDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Normalize rows into canonical transactions.
export function normalizeRows(aoa, mapping, dirMode, defaultCurrency = 'MYR') {
  const out = []
  const cell = (row, i) => (i >= 0 && row ? row[i] : '')
  for (const row of aoa) {
    let amount = null
    let type = 'expense'
    if (dirMode === 'split') {
      const d = parseAmount(cell(row, mapping.debit)) || 0
      const c = parseAmount(cell(row, mapping.credit)) || 0
      if (!d && !c) continue
      if (d && !c) { amount = Math.abs(d); type = 'expense' }
      else if (c && !d) { amount = Math.abs(c); type = 'income' }
      else { amount = Math.abs(c - d); type = c >= d ? 'income' : 'expense' }
    } else {
      amount = parseAmount(cell(row, mapping.amount))
      if (amount == null) continue
      type = dirMode === 'type_col' ? normalizeType(cell(row, mapping.type), amount) : (amount < 0 ? 'expense' : 'income')
      amount = Math.abs(amount)
    }
    const date = normalizeDate(cell(row, mapping.date))
    const desc = decodeHtmlEntities(String(cell(row, mapping.desc) ?? '').trim())
    if (!date && !desc) continue
    const balRaw = mapping.balance >= 0 ? parseAmount(cell(row, mapping.balance)) : null
    const curRaw = String(cell(row, mapping.currency) || '').trim().toUpperCase()
    out.push({
      date: date || new Date(),
      dateStr: fmtDateStr(date || new Date()),
      desc: desc || '(no description)',
      amount,
      type,
      currency: /^[A-Z]{3}$/.test(curRaw) ? curRaw : defaultCurrency,
      balanceAfter: balRaw,
    })
  }
  return out
}

// Konversi hasil AI (parse PDF) ke baris kanonis — bentuk sama seperti
// normalizeRows agar flow review/dedup/rekonsiliasi bisa dipakai ulang.
export function aiTransactionsToRows(list, defaultCurrency = 'MYR') {
  const out = []
  for (const t of list || []) {
    const date = normalizeDate(t?.date)
    const desc = decodeHtmlEntities(String(t?.description ?? t?.desc ?? '').trim())
    const amount = parseAmount(t?.amount)
    if (!date && !desc) continue
    if (amount == null || amount === 0) continue
    const balRaw = t?.balance == null || t?.balance === '' ? null : parseAmount(t.balance)
    const curRaw = String(t?.currency || '').trim().toUpperCase()
    out.push({
      date: date || new Date(),
      dateStr: fmtDateStr(date || new Date()),
      desc: desc || '(no description)',
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      currency: /^[A-Z]{3}$/.test(curRaw) ? curRaw : defaultCurrency,
      balanceAfter: balRaw,
    })
  }
  return out
}

// Fingerprint and deduplicate rows.

// cyrb53 — hash non-kriptografis, cukup untuk fingerprint dedup client-side
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export function rowFingerprint(r) {
  const s = [r.dateStr, Number(r.amount).toFixed(2), (r.currency || '').toUpperCase(), normalizeDesc(r.desc)].join('|')
  return cyrb53(s).toString(16)
}

export function rowKey(r) {
  return [r.dateStr, Number(r.amount).toFixed(2), (r.currency || '').toUpperCase(), normalizeDesc(r.desc)].join('|')
}

// Tandai duplikat di dalam file yang sama
export function markInFileDuplicates(rows) {
  const counts = {}
  for (const r of rows) { const k = rowFingerprint(r); counts[k] = (counts[k] || 0) + 1 }
  for (const r of rows) r.dupInFile = counts[rowFingerprint(r)] > 1
  return rows
}

// Validate balance continuity and date ranges.
export function checkBalanceContinuity(rows) {
  // Validasi mapping kolom: saldo[i] harus = saldo[i-1] ± nominal[i].
  // Baris duplikat (fingerprint sama) hanya dihitung sekali agar tidak
  // memicu false positive — duplikat sudah ditangani penanda dedup.
  const seen = new Set()
  const withBal = rows.filter((r) => {
    if (r.balanceAfter == null) return false
    const k = rowFingerprint(r)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  if (withBal.length < 2) return { checked: false }
  const sorted = [...withBal].sort((a, b) => a.date - b.date)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], cur = sorted[i]
    const expected = prev.balanceAfter + (cur.type === 'income' ? cur.amount : -cur.amount)
    // NaN/Infinity tidak boleh lolos: perbandingan dengan NaN selalu false,
    // dulu baris rusak dianggap "kontinu" tanpa peringatan ke user.
    if (!Number.isFinite(expected) || !Number.isFinite(cur.balanceAfter)) {
      return { checked: true, ok: false, at: cur.dateStr }
    }
    if (Math.abs(expected - cur.balanceAfter) > 0.01) {
      return { checked: true, ok: false, at: cur.dateStr }
    }
  }
  return { checked: true, ok: true }
}

export function getDateRange(rows) {
  if (!rows.length) return null
  let min = rows[0].date, max = rows[0].date
  for (const r of rows) {
    if (r.date < min) min = r.date
    if (r.date > max) max = r.date
  }
  return { min, max, minStr: fmtDateStr(min), maxStr: fmtDateStr(max) }
}

export function rangesOverlap(a, b) {
  return a.min <= b.max && b.min <= a.max
}

// Learn categories locally without AI or server calls.
const CATMAP_KEY = 'arshif_import_catmap'
const catKeyOf = (desc) => normalizeDesc(desc).split(' ').slice(0, 3).join(' ')

export function suggestCategory(desc, type) {
  try {
    const map = JSON.parse(localStorage.getItem(CATMAP_KEY) || '{}')
    const learned = map[catKeyOf(desc)]
    // Pilihan manual user selalu menang atas aturan bawaan
    if (learned) return learned
  } catch { /* abaikan */ }
  return keywordCategory(desc, type)
}

export function learnCategory(desc, category) {
  try {
    const map = JSON.parse(localStorage.getItem(CATMAP_KEY) || '{}')
    map[catKeyOf(desc)] = category
    const keys = Object.keys(map)
    if (keys.length > 500) delete map[keys[0]]
    localStorage.setItem(CATMAP_KEY, JSON.stringify(map))
  } catch { /* abaikan */ }
}

// Apply deterministic built-in category keywords, only when the user has not
// yet taught a category for this merchant (normalizeDesc-shaped input).
const CAT_TYPES = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.types]))

const CATEGORY_KEYWORDS = [
  [/\b(gaji|salary|payroll|upah|elaun|allowance|bonus|komisen|commission|kwsp|epf)\b/, 'salary'],
  [/\b(freelance|invoice|project fee|upwork|fiverr)\b/, 'freelance'],
  [/\b(dividen|dividend|interest|faedah|hibah)\b/, 'investment'],
  [/\b(hadiah|gift|angpao|angpow|duit raya)\b/, 'gift'],
  [/(tnb|syabas|air selangor|\bsaj\b|pln|pdam|indah water|sesb)/, 'bills'],
  [/(unifi|streamyx|maxis|celcom|digi|u mobile|umobile|yes 5g|time internet|indihome|telkom|telkomsel|\bxl\b|indosat|\btri\b)/, 'bills'],
  [/(netflix|spotify|youtube|disney|hotstar|iqiyi|\bviu\b|icloud|google one|microsoft|canva)/, 'bills'],
  [/(insurans|insurance|takaful|asuransi|prudential|\baia\b|great eastern|allianz)/, 'bills'],
  [/(cukai|lhdn|pajak|\bpbb\b|saman|compound|\bdbkl\b)/, 'bills'],
  [/(alex|kfc|mcdonald|\bmcd\b|pizza|domino|sushi|tealive|starbucks|coffee bean|\bzus\b|kenangan|kopi|mamak|nasi kandar|nasi lemak|warteg|padang|restoran|restaurant|cafe|kafe|boba|chatime|mixue|coolblog|grabfood|foodpanda|shopeefood|gofood|secret recipe|nando|texas chicken|marrybrown|subway|burger king)/, 'food'],
  [/(7 eleven|familymart|family mart|mynews|kk mart|speedmart|giant|\baeon\b|tesco|lotus|jaya grocer|village grocer|indomaret|alfamart|alfamidi|super indo|hypermart|pasaraya|grocery|grocer|pasar)/, 'groceries'],
  [/(petronas|shell|petron|\bbhp\b|caltex|touch n go|\btng\b|grab|\btoll\b|\btol\b|plus highway|\blrt\b|\bmrt\b|\bktm\b|rapid|parkir|parking|gojek|uber|petrol|\bbbm\b)/, 'transport'],
  [/(shopee|lazada|zalora|uniqlo|\bh m\b|ikea|mr diy|\bdiy\b|watsons|guardian|tokopedia|blibli|bukalapak|padini|parkson|sogo)/, 'shopping'],
  [/(clinic|klinik|hospital|pharmacy|farmasi|doctor|doktor|dental|gigi)/, 'health'],
  [/(gsc|\btgv\b|cinema|pawagam|steam|playstation|xbox|nintendo|karaoke|\bgame\b)/, 'entertainment'],
  [/(airasia|malaysia airlines|garuda|lion air|batik air|citilink|hotel|airbnb|agoda|booking com|traveloka|tiket com|trip com|klook)/, 'travel'],
  [/(school|sekolah|university|universiti|course|kursus|udemy|tuition|tusyen|skillshare)/, 'education'],
  [/(rent|\bsewa\b|condo|apartemen|apartment|maintenance|\bjmb\b)/, 'housing'],
  [/(salon|barber|gunting rambut|spa|massage|reflexology)/, 'personal'],
]

function keywordCategory(desc, type) {
  const s = normalizeDesc(desc)
  if (!s) return null
  for (const [re, cat] of CATEGORY_KEYWORDS) {
    if (!re.test(s)) continue
    const types = CAT_TYPES[cat]
    if (!types) continue
    // Hormati tipe transaksi: mis. keyword 'gaji' tak dipakai untuk expense
    if (!type || types.includes(type)) return cat
  }
  return null
}

// Store optional user mapping presets locally.
const PRESET_KEY = 'arshif_import_presets'

export function listMappingPresets() {
  try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '[]') } catch { return [] }
}

export function saveMappingPreset(name, mapping, dirMode) {
  try {
    const list = listMappingPresets().filter((p) => p.name !== name)
    list.unshift({ name, mapping, dirMode, at: new Date().toISOString() })
    localStorage.setItem(PRESET_KEY, JSON.stringify(list.slice(0, 10)))
  } catch { /* abaikan */ }
}
