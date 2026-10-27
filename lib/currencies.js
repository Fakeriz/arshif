// Comprehensive list of world currencies: code, name, symbol, flag
export const CURRENCIES = [
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', flag: '🇵🇭' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', flag: '🇸🇦' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', flag: '🇩🇰' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', flag: '🇵🇱' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', flag: '🇨🇿' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', flag: '🇭🇺' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', flag: '🇷🇺' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', flag: '🇲🇽' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', flag: '🇪🇬' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', flag: '🇵🇰' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', flag: '🇧🇩' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', flag: '🇱🇰' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs', flag: '🇳🇵' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QR', flag: '🇶🇦' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD', flag: '🇰🇼' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD', flag: '🇧🇭' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR', flag: '🇴🇲' },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'JD', flag: '🇯🇴' },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', flag: '🇮🇱' },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', flag: '🇹🇼' },
  { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', flag: '🇲🇲' },
  { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', flag: '🇰🇭' },
  { code: 'LAK', name: 'Lao Kip', symbol: '₭', flag: '🇱🇦' },
  { code: 'BND', name: 'Brunei Dollar', symbol: 'B$', flag: '🇧🇳' },
  { code: 'ARS', name: 'Argentine Peso', symbol: 'AR$', flag: '🇦🇷' },
  { code: 'CLP', name: 'Chilean Peso', symbol: 'CL$', flag: '🇨🇱' },
  { code: 'COP', name: 'Colombian Peso', symbol: 'CO$', flag: '🇨🇴' },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', flag: '🇵🇪' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', flag: '🇺🇦' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', flag: '🇷🇴' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', flag: '🇧🇬' },
  { code: 'ISK', name: 'Icelandic Krona', symbol: 'kr', flag: '🇮🇸' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD', flag: '🇲🇦' },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'DT', flag: '🇹🇳' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', flag: '🇬🇭' },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', flag: '🇺🇬' },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', flag: '🇹🇿' },
  { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', flag: '🇪🇹' },
  { code: 'DZD', name: 'Algerian Dinar', symbol: 'DA', flag: '🇩🇿' },
  { code: 'IQD', name: 'Iraqi Dinar', symbol: 'IQD', flag: '🇮🇶' },
  { code: 'IRR', name: 'Iranian Rial', symbol: '﷼', flag: '🇮🇷' },
  { code: 'AFN', name: 'Afghan Afghani', symbol: '؋', flag: '🇦🇫' },
  { code: 'UZS', name: 'Uzbekistani Som', symbol: 'soʻm', flag: '🇺🇿' },
  { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸', flag: '🇰🇿' },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾', flag: '🇬🇪' },
  { code: 'AMD', name: 'Armenian Dram', symbol: '֏', flag: '🇦🇲' },
  { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼', flag: '🇦🇿' },
  { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br', flag: '🇧🇾' },
  { code: 'MDL', name: 'Moldovan Leu', symbol: 'L', flag: '🇲🇩' },
  { code: 'RSD', name: 'Serbian Dinar', symbol: 'din', flag: '🇷🇸' },
  { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден', flag: '🇲🇰' },
  { code: 'ALL', name: 'Albanian Lek', symbol: 'L', flag: '🇦🇱' },
  { code: 'BAM', name: 'Bosnia-Herzegovina Mark', symbol: 'KM', flag: '🇧🇦' },
  { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', flag: '🇸🇳' },
  { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA', flag: '🇨🇲' },
  { code: 'MUR', name: 'Mauritian Rupee', symbol: '₨', flag: '🇲🇺' },
  { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: 'Rf', flag: '🇲🇻' },
  { code: 'FJD', name: 'Fijian Dollar', symbol: 'FJ$', flag: '🇫🇯' },
  { code: 'PGK', name: 'Papua New Guinean Kina', symbol: 'K', flag: '🇵🇬' },
  { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs', flag: '🇧🇴' },
  { code: 'PYG', name: 'Paraguayan Guarani', symbol: '₲', flag: '🇵🇾' },
  { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', flag: '🇺🇾' },
  { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q', flag: '🇬🇹' },
  { code: 'HNL', name: 'Honduran Lempira', symbol: 'L', flag: '🇭🇳' },
  { code: 'NIO', name: 'Nicaraguan Cordoba', symbol: 'C$', flag: '🇳🇮' },
  { code: 'CRC', name: 'Costa Rican Colon', symbol: '₡', flag: '🇨🇷' },
  { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$', flag: '🇩🇴' },
  { code: 'JMD', name: 'Jamaican Dollar', symbol: 'J$', flag: '🇯🇲' },
  { code: 'TTD', name: 'Trinidad & Tobago Dollar', symbol: 'TT$', flag: '🇹🇹' },
  { code: 'BSD', name: 'Bahamian Dollar', symbol: 'B$', flag: '🇧🇸' },
  { code: 'BBD', name: 'Barbadian Dollar', symbol: 'Bds$', flag: '🇧🇧' },
  { code: 'XCD', name: 'East Caribbean Dollar', symbol: 'EC$', flag: '🇦🇬' },
  { code: 'CUP', name: 'Cuban Peso', symbol: '₱', flag: '🇨🇺' },
  { code: 'VES', name: 'Venezuelan Bolivar', symbol: 'Bs.S', flag: '🇻🇪' },
  { code: 'MOP', name: 'Macanese Pataca', symbol: 'MOP$', flag: '🇲🇴' },
  { code: 'MNT', name: 'Mongolian Tugrik', symbol: '₮', flag: '🇲🇳' },
  { code: 'BTN', name: 'Bhutanese Ngultrum', symbol: 'Nu.', flag: '🇧🇹' },
  { code: 'KGS', name: 'Kyrgyzstani Som', symbol: 'с', flag: '🇰🇬' },
  { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'SM', flag: '🇹🇯' },
  { code: 'TMT', name: 'Turkmenistani Manat', symbol: 'T', flag: '🇹🇲' },
  { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل', flag: '🇱🇧' },
  { code: 'YER', name: 'Yemeni Rial', symbol: '﷼', flag: '🇾🇪' },
  { code: 'LYD', name: 'Libyan Dinar', symbol: 'LD', flag: '🇱🇾' },
  { code: 'SDG', name: 'Sudanese Pound', symbol: 'SDG', flag: '🇸🇩' },
  { code: 'SOS', name: 'Somali Shilling', symbol: 'Sh', flag: '🇸🇴' },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw', flag: '🇷🇼' },
  { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK', flag: '🇲🇼' },
  { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', flag: '🇿🇲' },
  { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', flag: '🇲🇿' },
  { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz', flag: '🇦🇴' },
  { code: 'NAD', name: 'Namibian Dollar', symbol: 'N$', flag: '🇳🇦' },
  { code: 'BWP', name: 'Botswana Pula', symbol: 'P', flag: '🇧🇼' },
  { code: 'MGA', name: 'Malagasy Ariary', symbol: 'Ar', flag: '🇲🇬' },
  { code: 'SCR', name: 'Seychellois Rupee', symbol: '₨', flag: '🇸🇨' },
  { code: 'CVE', name: 'Cape Verdean Escudo', symbol: '$', flag: '🇨🇻' },
  { code: 'GMD', name: 'Gambian Dalasi', symbol: 'D', flag: '🇬🇲' },
  { code: 'GNF', name: 'Guinean Franc', symbol: 'FG', flag: '🇬🇳' },
  { code: 'SLE', name: 'Sierra Leonean Leone', symbol: 'Le', flag: '🇸🇱' },
  { code: 'LRD', name: 'Liberian Dollar', symbol: 'L$', flag: '🇱🇷' },
  { code: 'DJF', name: 'Djiboutian Franc', symbol: 'Fdj', flag: '🇩🇯' },
  { code: 'KMF', name: 'Comorian Franc', symbol: 'CF', flag: '🇰🇲' },
  { code: 'BIF', name: 'Burundian Franc', symbol: 'FBu', flag: '🇧🇮' },
  { code: 'CDF', name: 'Congolese Franc', symbol: 'FC', flag: '🇨🇩' },
  { code: 'HTG', name: 'Haitian Gourde', symbol: 'G', flag: '🇭🇹' },
  { code: 'SRD', name: 'Surinamese Dollar', symbol: 'Sr$', flag: '🇸🇷' },
  { code: 'GYD', name: 'Guyanese Dollar', symbol: 'G$', flag: '🇬🇾' },
  { code: 'BZD', name: 'Belize Dollar', symbol: 'BZ$', flag: '🇧🇿' },
  { code: 'AWG', name: 'Aruban Florin', symbol: 'ƒ', flag: '🇦🇼' },
  { code: 'ANG', name: 'Netherlands Antillean Guilder', symbol: 'ƒ', flag: '🇨🇼' },
  { code: 'KYD', name: 'Cayman Islands Dollar', symbol: 'CI$', flag: '🇰🇾' },
  { code: 'BMD', name: 'Bermudian Dollar', symbol: 'BD$', flag: '🇧🇲' },
  { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.', flag: '🇵🇦' },
  { code: 'XPF', name: 'CFP Franc', symbol: '₣', flag: '🇵🇫' },
  { code: 'WST', name: 'Samoan Tala', symbol: 'WS$', flag: '🇼🇸' },
  { code: 'TOP', name: 'Tongan Paʻanga', symbol: 'T$', flag: '🇹🇴' },
  { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'VT', flag: '🇻🇺' },
  { code: 'SBD', name: 'Solomon Islands Dollar', symbol: 'SI$', flag: '🇸🇧' },
  { code: 'MRU', name: 'Mauritanian Ouguiya', symbol: 'UM', flag: '🇲🇷' },
  { code: 'SYP', name: 'Syrian Pound', symbol: '£S', flag: '🇸🇾' },
  { code: 'SSP', name: 'South Sudanese Pound', symbol: 'SS£', flag: '🇸🇸' },
  { code: 'ERN', name: 'Eritrean Nakfa', symbol: 'Nfk', flag: '🇪🇷' },
  { code: 'STN', name: 'Sao Tome Dobra', symbol: 'Db', flag: '🇸🇹' },
  { code: 'SZL', name: 'Swazi Lilangeni', symbol: 'E', flag: '🇸🇿' },
  { code: 'LSL', name: 'Lesotho Loti', symbol: 'L', flag: '🇱🇸' },
]

const MAP = Object.fromEntries(CURRENCIES.map((c) => [c.code, { ...c, flag: '' }]))
export const getCurrency = (code) => MAP?.[code] || { code, name: code, symbol: code, flag: '' }

// Currencies with zero decimals by convention
const ZERO_DEC = new Set(['IDR', 'JPY', 'KRW', 'VND', 'HUF', 'CLP', 'ISK', 'PYG', 'UGX', 'RWF', 'XOF', 'XAF', 'KMF', 'DJF', 'GNF', 'VUV', 'XPF', 'LAK', 'MMK', 'IRR', 'LBP', 'MNT', 'KHR', 'COP', 'TZS', 'MGA', 'BIF', 'CDF', 'SLE', 'SOS', 'UZS', 'KZT'])

export function formatMoney(amount, code, opts = {}) {
  const n = Number(amount) || 0
  const cur = getCurrency(code)
  const decimals = ZERO_DEC.has(code) ? 0 : 2
  const compact = opts.compact
  let body
  try {
    body = new Intl.NumberFormat(opts.locale || 'en-US', {
      minimumFractionDigits: compact ? 0 : decimals,
      maximumFractionDigits: decimals,
      notation: compact ? 'compact' : 'standard',
    }).format(Math.abs(n))
  } catch {
    body = Math.abs(n).toFixed(decimals)
  }
  const sign = n < 0 ? '-' : ''
  return opts.symbolOnly === false ? `${sign}${body} ${code}` : `${sign}${cur.symbol} ${body}`
}

export function roundMoney(amount, code) {
  const n = Number(amount) || 0
  const d = ZERO_DEC.has(code) ? 0 : 2
  if (!Number.isFinite(n)) return 0
  const sign = n < 0 ? -1 : 1
  const raw = Math.abs(n).toString().toLowerCase()
  const [coefficient, exponentText] = raw.split('e')
  const exponent = Number(exponentText || 0)
  const [whole, fraction = ''] = coefficient.split('.')
  const digits = `${whole}${fraction}` || '0'
  const decimalPosition = whole.length + exponent
  const targetPosition = decimalPosition + d
  let units
  if (targetPosition <= 0) {
    units = 0n
  } else {
    const kept = (digits.slice(0, targetPosition) + '0'.repeat(Math.max(0, targetPosition - digits.length))) || '0'
    units = BigInt(kept)
    const firstDiscarded = digits[targetPosition]
    if (firstDiscarded && firstDiscarded >= '5') units += 1n
  }
  const scale = 10 ** d
  return sign * Number(units) / scale
}

export function addMoney(total, amount, code) {
  return roundMoney((Number(total) || 0) + (Number(amount) || 0), code)
}

export function allocateEqualShares(total, count, code) {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  if (!n) return []
  const target = roundMoney(total, code)
  const base = roundMoney(target / n, code)
  const shares = Array(n).fill(base)
  const remainder = roundMoney(target - shares.reduce((sum, value) => sum + value, 0), code)
  shares[n - 1] = roundMoney(shares[n - 1] + remainder, code)
  return shares
}
