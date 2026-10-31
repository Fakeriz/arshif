// Sanitasi hasil parse AI sebagai fungsi pure: bisa diuji tanpa memanggil
// Gemini dan dipakai bersama oleh route API maupun komponen client.

// Kata currency yang diucapkan user -> kode ISO. Urutan penting: "ringgit"
// dicek sebelum "rb" supaya "20 ribu ringgit" tetap MYR, bukan IDR.
export const GLOBAL_CURRENCIES = [
  { regex: /\b(ringgit|rm)\b/i, code: 'MYR' },
  { regex: /\b(rupiah|rp|perak|ribu|rb|jt|juta)\b/i, code: 'IDR' },
  { regex: /\b(lira|tl|turki)\b/i, code: 'TRY' },
  { regex: /\b(usd|dollar|dolar|buck|bucks|\$)\b/i, code: 'USD' },
  { regex: /\b(eur|euro|€)\b/i, code: 'EUR' },
  { regex: /\b(sgd|sing\s*dollar|dolar\s*singapura)\b/i, code: 'SGD' },
  { regex: /\b(gbp|pound|sterling|£)\b/i, code: 'GBP' },
  { regex: /\b(jpy|yen|¥)\b/i, code: 'JPY' },
  { regex: /\b(aud|aussie|dolar\s*australia)\b/i, code: 'AUD' },
  { regex: /\b(thb|baht)\b/i, code: 'THB' },
  { regex: /\b(sar|riyal|riyal\s*saudi)\b/i, code: 'SAR' },
  { regex: /\b(aed|dirham)\b/i, code: 'AED' },
  { regex: /\b(cny|yuan|renminbi)\b/i, code: 'CNY' },
  { regex: /\b(krw|won)\b/i, code: 'KRW' },
  { regex: /\b(php|peso)\b/i, code: 'PHP' },
  { regex: /\b(vnd|dong)\b/i, code: 'VND' },
]

export function detectSpokenCurrency(text) {
  const s = String(text ?? '')
  for (const cur of GLOBAL_CURRENCIES) {
    if (cur.regex.test(s)) return cur.code
  }
  return null
}

// Currency final: kata currency di teks menang, lalu mata uang akun. Tebakan
// currency dari Gemini yang tidak ada buktinya di teks asli dibuang supaya
// jatuh ke home currency user, bukan MYR atau kode karangan lainnya.
export function sanitizeCurrency({
  text = '',
  txCurrency = null,
  spokenCurrency = detectSpokenCurrency(text),
  accountCurrency = null,
  homeCurrency = 'IDR',
}) {
  if (spokenCurrency) return spokenCurrency
  if (accountCurrency) return String(accountCurrency).toUpperCase().slice(0, 3)
  const txCur = txCurrency ? String(txCurrency).toUpperCase().slice(0, 3) : null
  if (txCur && txCur === detectSpokenCurrency(text)) return txCur
  return String(homeCurrency).toUpperCase().slice(0, 3)
}

// Kata kerja belanja di awal ucapan: bukan nama toko.
const ACTION_PREFIX_RE = /^(beli|beliin|jajan|bayar|pesan|order|dapat|terima|belanja|ambil|ngambil|topup|tarik|setor)\b/i
// Kata sambung di awal ("di Alfamart", "pake BCA"): dibuang sebelum validasi.
const PREPOSITION_PREFIX_RE = /^(di|dari|ke|pada|via|pakai|pake|dengan|memakai|at|in|on|from|to|by|use|using)\b/i
// Nominal di dalam "merchant" berarti itu ucapan belanja, bukan nama toko.
// Angka 1-2 digit dibiarkan supaya nama asli seperti "7-Eleven" atau "99 Speedmart" aman.
const AMOUNT_HINT_RE = /(\d{3,}|\d+[.,]\d{3}|\b(ribu|rb|jt|juta|ratus|rebuan|ringgit|rupiah|perak|lira|dolar|dollar|euro|yen|baht|riyal|dirham|peso|won|yuan|dong)\b)/i

// Kata generik tanpa nama proper: bukan merchant.
const GENERIC_MERCHANT_WORDS = new Set([
  'toko', 'toko online', 'kedai', 'kedai runcit', 'kedai kopi', 'warung', 'warung kopi',
  'minimarket', 'supermarket', 'swalayan', 'mall', 'pasar', 'store', 'shop', 'market',
  'gerai', 'kios', 'lapak', 'bazar', 'mart', 'restoran', 'restaurant', 'rumah makan',
  'rm', 'kantin', 'food court', 'cafe', 'kafe', 'kafetaria', 'spbu', 'pom bensin',
  'bank', 'atm', 'marketplace', 'aplikasi', 'platform', 'website', 'situs', 'web', 'app',
])

// Nama barang elektronik dan belanja umum (plus padanan ms/tr): sering salah
// diisi Gemini sebagai merchant padahal itu produk yang dibeli.
const PRODUCT_MERCHANT_WORDS = new Set([
  'hdmi', 'kabel', 'kabel data', 'kabel charger', 'kabel hdmi', 'kabel usb', 'kabel power', 'kabel lan',
  'charger', 'pengecas', 'mouse', 'keyboard', 'papan kekunci', 'klavye', 'kablo', 'sarj aleti',
  'flashdisk', 'flash disk', 'hardisk', 'hard disk', 'ssd', 'hdd', 'usb', 'type c', 'type-c', 'lightning',
  'headphone', 'headset', 'earphone', 'earbud', 'tws', 'fon kepala', 'kulaklik', 'speaker',
  'powerbank', 'power bank', 'adaptor', 'adapter', 'baterai', 'lampu', 'lampu led', 'remote',
  'ac', 'kipas', 'kipas angin', 'printer', 'toner', 'tinta', 'ram', 'vga', 'monitor', 'tv', 'televisi',
  'modem', 'router', 'wifi', 'repeater', 'extender', 'dongle', 'hub', 'card reader', 'micro sd',
  'sd card', 'memory card', 'memory', 'joystick', 'gamepad', 'konsol', 'ps5', 'ps4', 'nintendo',
  'switch', 'xbox', 'stik ps',
  'iphone', 'ipad', 'ipod', 'macbook', 'imac', 'mac mini', 'airpods', 'apple watch', 'galaxy',
  'samsung', 'apple', 'xiaomi', 'redmi', 'poco', 'huawei', 'oppo', 'vivo', 'realme', 'oneplus',
  'nord', 'asus', 'zenfone', 'vivobook', 'thinkpad', 'ideapad', 'lenovo', 'acer', 'aspire', 'msi',
  'dell', 'inspiron', 'xps', 'hp', 'pavilion', 'elitebook', 'laptop', 'komputer', 'pc', 'cpu',
  'motherboard', 'psu', 'casing', 'tempered glass', 'screen protector', 'pelindung layar', 'lensa',
  'kamera', 'camera', 'tripod', 'gimbal', 'drone', 'smartwatch', 'smart band', 'mi band', 'fitbit',
  'garmin', 'kindle', 'nokia', 'motorola', 'infinix', 'tecno', 'itel', 'advan', 'evercoss',
  'polytron', 'sharp', 'panasonic', 'toshiba', 'lg', 'philips', 'sony', 'jbl', 'anker', 'baseus',
  'ugreen', 'romoss', 'sennheiser', 'logitech', 'razer', 'corsair', 'kingston', 'sandisk',
  'transcend', 'western digital', 'seagate', 'canon', 'nikon', 'fujifilm', 'gopro', 'dji',
  'beras', 'minyak', 'gula', 'kopi', 'teh', 'susu', 'roti', 'mie', 'mi instan', 'ayam', 'bebek',
  'sapi', 'kambing', 'ikan', 'sayur', 'buah', 'telur', 'cabai', 'bawang', 'bensin', 'pertalite',
  'pertamax', 'solar', 'rokok', 'gas', 'elpiji', 'tabung gas', 'detergen', 'shampoo', 'sampo',
  'sabun', 'pasta gigi', 'sikat gigi', 'skincare', 'makeup', 'kosmetik', 'parfum', 'perfume',
  'bedak', 'lipstik', 'serum', 'sunscreen', 'pembersih wajah', 'facial wash', 'conditioner',
  'tisu', 'tissue', 'kapas', 'cotton bud', 'masker', 'hand sanitizer', 'handsanitizer', 'pembalut',
  'popok', 'obat', 'vitamin',
  'pulsa', 'paket data', 'kuota', 'token', 'listrik', 'voucher', 'tiket', 'karcis', 'buku',
  'novel', 'komik', 'majalah', 'koran', 'tas', 'ransel', 'sepatu', 'sandal', 'baju', 'kaos',
  'kemeja', 'celana', 'jaket', 'dompet', 'payung', 'kaca mata', 'jam tangan',
  'google play', 'itunes', 'netflix', 'spotify', 'youtube', 'canva', 'chatgpt', 'openai',
  'gemini', 'midjourney', 'capcut', 'alight motion', 'kinemaster', 'filmora', 'premiere',
  'photoshop', 'illustrator', 'figma', 'sketch', 'notion', 'evernote', 'obsidian', 'word',
  'excel', 'powerpoint', 'windows', 'microsoft', 'office', 'office 365',
])

function normalizeName(name) {
  return String(name ?? '')
    .trim()
    .replace(/^["'“”‘’\s]+|["'“”‘’\s.,;:!?]+$/g, '')
    .trim()
}

function stripLeadingWords(name) {
  let s = name
  let prev
  do {
    prev = s
    s = s.replace(ACTION_PREFIX_RE, '').replace(PREPOSITION_PREFIX_RE, '').trim()
  } while (s && s !== prev)
  return s
}

// Buang kata awalan belanja ("Beli HDMI" -> "HDMI") untuk display dan note.
export function stripActionPrefix(title) {
  return stripLeadingWords(normalizeName(title))
}

// Merchant cuma nama toko/brand yang benar-benar disebut user. Nama produk,
// kata generik, dan ucapan yang masih mengandung nominal jadi null.
export function sanitizeMerchant(merchant, items) {
  const stripped = stripLeadingWords(normalizeName(merchant))
  if (!stripped || stripped.length > 60) return null

  const key = stripped.toLowerCase().replace(/\s+/g, ' ')
  const itemNames = (Array.isArray(items) ? items : [])
    .map((it) => normalizeName(it?.name).toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean)

  // Merchant yang sama dengan (atau cuma potongan dari) nama item adalah produk.
  if (itemNames.some((n) => n === key || (key.length >= 4 && n.includes(key)))) return null
  if (GENERIC_MERCHANT_WORDS.has(key)) return null
  if (PRODUCT_MERCHANT_WORDS.has(key)) return null
  if (AMOUNT_HINT_RE.test(stripped)) return null

  return stripped
}
