// Category definitions. Labels are translated via i18n key `cat_<id>`.
export const CATEGORIES = [
  { id: 'food', icon: 'Utensils', types: ['expense'] },
  { id: 'groceries', icon: 'ShoppingBasket', types: ['expense'] },
  { id: 'transport', icon: 'Car', types: ['expense'] },
  { id: 'shopping', icon: 'ShoppingBag', types: ['expense'] },
  { id: 'bills', icon: 'Receipt', types: ['expense'] },
  { id: 'entertainment', icon: 'Clapperboard', types: ['expense'] },
  { id: 'health', icon: 'HeartPulse', types: ['expense'] },
  { id: 'education', icon: 'GraduationCap', types: ['expense'] },
  { id: 'travel', icon: 'Plane', types: ['expense'] },
  { id: 'housing', icon: 'Home', types: ['expense'] },
  { id: 'personal', icon: 'User', types: ['expense'] },
  { id: 'business', icon: 'Briefcase', types: ['expense', 'income'] },
  { id: 'salary', icon: 'Wallet', types: ['income'] },
  { id: 'freelance', icon: 'Laptop', types: ['income'] },
  { id: 'investment', icon: 'TrendingUp', types: ['income', 'expense'] },
  { id: 'gift', icon: 'Gift', types: ['income', 'expense'] },
  { id: 'transfer', icon: 'ArrowLeftRight', types: ['transfer'] },
  { id: 'other', icon: 'CircleDashed', types: ['expense', 'income'] },
]

export const getCategory = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1]

export const PAYMENT_METHODS = ['cash', 'qr', 'card', 'bank']

// Card themes — 100% Solid Opaque Physical Card Motifs:
// 1) Batik Parang (Solid #121216 with subtle gold diagonal parang ornament)
// 2) Glacier Frost (Solid #FFFFFF marble texture with adaptive black font #09090B)
// 3) Obsidian (Solid #0C0C0E obsidian luxury with top gloss border)
// 4) Batik Kawung (Solid #0C0C0E with monochrome 4-petaled kawung circles)
// 5) Web Hero (Spider) (Solid gradient #7F1D1D to #09090B with spiderweb lines)
// 6) Cyber Matrix (Solid #0A0F1D with soft teal hex grid)
export const CARD_THEMES = [
  {
    id: 'parang',
    name: 'Batik Parang',
    motif: 'parang',
    i18nKey: 'motif_parang',
    // Tanpa border berwarna — definisi tepi dari top gloss (BankCard) +
    // hairline ring (AccountDeck). Border amber/rose/teal terbaca "gak matching".
    className: 'bg-[#121216] text-white',
    swatchClass: 'bg-[#121216] border border-amber-400/40',
    isLight: false,
    network: 'visa',
  },
  {
    id: 'glacier',
    name: 'Glacier Frost',
    motif: 'glacier',
    i18nKey: 'motif_glacier',
    className: 'bg-[#FFFFFF] text-[#09090B] border border-zinc-300 border-t-zinc-200',
    swatchClass: 'bg-[#FFFFFF] border border-zinc-300',
    isLight: true,
    network: 'mastercard',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    motif: 'obsidian',
    i18nKey: 'motif_obsidian',
    className: 'bg-[#0C0C0E] text-white',
    swatchClass: 'bg-[#0C0C0E] border border-white/30',
    isLight: false,
    network: 'visa',
  },
  {
    id: 'kawung',
    name: 'Batik Kawung',
    motif: 'kawung',
    i18nKey: 'motif_kawung',
    className: 'bg-[#0C0C0E] text-white',
    swatchClass: 'bg-[#0C0C0E] border border-white/25',
    isLight: false,
    network: 'mastercard',
  },
  {
    id: 'spider',
    name: 'Web Hero (Spider)',
    motif: 'spider',
    i18nKey: 'motif_spider',
    className: 'bg-gradient-to-br from-[#7F1D1D] to-[#09090B] text-white',
    swatchClass: 'bg-gradient-to-br from-[#7F1D1D] to-[#09090B] border border-rose-500/40',
    isLight: false,
    network: 'visa',
  },
  {
    id: 'matrix',
    name: 'Cyber Matrix',
    motif: 'matrix',
    i18nKey: 'motif_matrix',
    className: 'bg-[#0A0F1D] text-white',
    swatchClass: 'bg-[#0A0F1D] border border-teal-500/60',
    isLight: false,
    network: 'visa',
  },
]

export const getTheme = (id) => {
  if (!id) return CARD_THEMES[0]
  const exact = CARD_THEMES.find((t) => t.id === id)
  if (exact) return exact
  // Graceful fallbacks for legacy theme ids
  if (id === 'obsidian') return CARD_THEMES.find((t) => t.id === 'obsidian') || CARD_THEMES[2]
  if (id === 'glacier') return CARD_THEMES.find((t) => t.id === 'glacier') || CARD_THEMES[1]
  if (id === 'ruby' || id === 'coral' || id === 'rosepink') return CARD_THEMES.find((t) => t.id === 'spider') || CARD_THEMES[4]
  if (id === 'topaz') return CARD_THEMES.find((t) => t.id === 'parang') || CARD_THEMES[0]
  if (id === 'midnight' || id === 'ocean' || id === 'emerald' || id === 'amethyst') {
    return CARD_THEMES.find((t) => t.id === 'matrix') || CARD_THEMES[5]
  }
  return CARD_THEMES[0]
}

// Account TYPE pills (Section 3)
export const ACCOUNT_TYPES = [
  { id: 'bank', label: 'Bank' },
  { id: 'ewallet', label: 'E-Wallet' },
  { id: 'cash', label: 'Cash' },
  { id: 'savings', label: 'Savings' },
  { id: 'credit', label: 'Credit Card' },
  { id: 'other', label: 'Other' },
]

// Monochrome outline ICONS (Section 4) — lucide icon names resolved in ui.js
export const ACCOUNT_ICONS = [
  { id: 'card', icon: 'CreditCard' },
  { id: 'wallet', icon: 'Wallet' },
  { id: 'cash', icon: 'Banknote' },
  { id: 'bankbuilding', icon: 'Landmark' },
  { id: 'phone', icon: 'Smartphone' },
  { id: 'chart', icon: 'BarChart3' },
  { id: 'business', icon: 'Briefcase' },
]

// Bank & e-wallet logos. Branded ones = colored initials badge.
// Generic ones (outline:true) = thin monochrome lucide outline symbol.
export const BANK_LOGOS = [
  // ---------- MALAYSIA 🇲🇾 ----------
  { id: 'maybank', name: 'Maybank', country: 'my', color: '#FFC20E', short: 'MB', dark: true },
  { id: 'cimb', name: 'CIMB', country: 'my', color: '#EC1C24', short: 'CIMB' },
  { id: 'publicbank', name: 'Public Bank', country: 'my', color: '#D71920', short: 'PB' },
  { id: 'rhb', name: 'RHB', country: 'my', color: '#0067B1', short: 'RHB' },
  { id: 'hongleong', name: 'Hong Leong', country: 'my', color: '#00539B', short: 'HL' },
  { id: 'ambank', name: 'AmBank', country: 'my', color: '#E4002B', short: 'AM' },
  { id: 'affin', name: 'Affin', country: 'my', color: '#ED1B2E', short: 'AF' },
  { id: 'alliance', name: 'Alliance', country: 'my', color: '#FDB913', short: 'ALB', dark: true },
  { id: 'bankislam', name: 'Bank Islam', country: 'my', color: '#00A79D', short: 'BI' },
  { id: 'muamalatmy', name: 'Bank Muamalat', country: 'my', color: '#6B2E68', short: 'MUA' },
  { id: 'bankrakyat', name: 'Bank Rakyat', country: 'my', color: '#004B87', short: 'BR' },
  { id: 'bsn', name: 'BSN', country: 'my', color: '#005BAA', short: 'BSN' },
  { id: 'agrobank', name: 'Agrobank', country: 'my', color: '#8DC63F', short: 'AGR', dark: true },
  { id: 'gxbank', name: 'GXBank', country: 'my', color: '#111827', short: 'GX' },
  { id: 'boostbank', name: 'Boost Bank', country: 'my', color: '#EE2E24', short: 'BB' },
  { id: 'aeonbank', name: 'AEON Bank', country: 'my', color: '#E60012', short: 'AE' },
  { id: 'rytbank', name: 'Ryt Bank', country: 'my', color: '#6D28D9', short: 'RYT' },
  { id: 'kafdigital', name: 'KAF Digital', country: 'my', color: '#0F766E', short: 'KAF' },
  { id: 'stanchartmy', name: 'Standard Chartered', country: 'my', color: '#0473EA', short: 'SC' },
  { id: 'hsbcmy', name: 'HSBC', country: 'my', color: '#DB0011', short: 'HS' },
  { id: 'uobmy', name: 'UOB', country: 'my', color: '#005EB8', short: 'UOB' },
  { id: 'ocbcmy', name: 'OCBC', country: 'my', color: '#E60012', short: 'OC' },
  { id: 'tng', name: 'TnG eWallet', country: 'my', color: '#1E4BD8', short: 'TnG' },
  { id: 'grabpay', name: 'GrabPay', country: 'my', color: '#00B14F', short: 'GB' },
  { id: 'boost', name: 'Boost', country: 'my', color: '#EE2E24', short: 'BST' },
  { id: 'shopeepaymy', name: 'ShopeePay MY', country: 'my', color: '#EE4D2D', short: 'SP' },
  { id: 'bigpay', name: 'BigPay', country: 'my', color: '#1A1A1A', short: 'BIG' },
  { id: 'setel', name: 'Setel', country: 'my', color: '#00A94F', short: 'STL' },
  { id: 'sarawakpay', name: 'Sarawak Pay', country: 'my', color: '#B08D57', short: 'SPay', dark: true },
  { id: 'lazadawalletmy', name: 'Lazada Wallet', country: 'my', color: '#0F146D', short: 'LZ' },
  { id: 'merchantrade', name: 'Merchantrade', country: 'my', color: '#F58220', short: 'MTR' },
  { id: 'kiplepay', name: 'KiplePay', country: 'my', color: '#00AEEF', short: 'KPL' },
  // ---------- TURKEY 🇹🇷 ----------
  { id: 'ziraat', name: 'Ziraat Bankası', country: 'tr', color: '#E30613', short: 'ZRT' },
  { id: 'halkbank', name: 'Halkbank', country: 'tr', color: '#005BAA', short: 'HLK' },
  { id: 'vakifbank', name: 'VakıfBank', country: 'tr', color: '#F9A01B', short: 'VKF', dark: true },
  { id: 'isbank', name: 'Türkiye İş Bankası', country: 'tr', color: '#1F3F94', short: 'İŞ' },
  { id: 'garanti', name: 'Garanti BBVA', country: 'tr', color: '#009B3A', short: 'GRT' },
  { id: 'akbank', name: 'Akbank', country: 'tr', color: '#E10514', short: 'AKB' },
  { id: 'yapikredi', name: 'Yapı Kredi', country: 'tr', color: '#004990', short: 'YK' },
  { id: 'denizbank', name: 'DenizBank', country: 'tr', color: '#005CA9', short: 'DNZ' },
  { id: 'qnbfinansbank', name: 'QNB Finansbank', country: 'tr', color: '#7A2E83', short: 'QNB' },
  { id: 'teb', name: 'TEB', country: 'tr', color: '#005EB8', short: 'TEB' },
  { id: 'kuveytturk', name: 'Kuveyt Türk', country: 'tr', color: '#00A54F', short: 'KT' },
  { id: 'albaraka', name: 'Albaraka Türk', country: 'tr', color: '#00954C', short: 'ALB' },
  { id: 'turkiyefinans', name: 'Türkiye Finans', country: 'tr', color: '#E4002B', short: 'TF' },
  { id: 'ziraatkatilim', name: 'Ziraat Katılım', country: 'tr', color: '#0B7A3B', short: 'ZK' },
  { id: 'vakifkatilim', name: 'Vakıf Katılım', country: 'tr', color: '#1B75BB', short: 'VK' },
  { id: 'enpara', name: 'Enpara', country: 'tr', color: '#F36F21', short: 'ENP' },
  { id: 'hayatfinans', name: 'Hayat Finans', country: 'tr', color: '#7C3AED', short: 'HYT' },
  { id: 'tombank', name: 'TOM Bank', country: 'tr', color: '#FF5A00', short: 'TOM' },
  { id: 'papara', name: 'Papara', country: 'tr', color: '#000000', short: 'PPR' },
  { id: 'ininal', name: 'Ininal', country: 'tr', color: '#FDB913', short: 'INL', dark: true },
  { id: 'tosla', name: 'Tosla', country: 'tr', color: '#7B3FE4', short: 'TSL' },
  { id: 'paycell', name: 'Paycell', country: 'tr', color: '#FFCB05', short: 'PC', dark: true },
  { id: 'vodafonepay', name: 'Vodafone Pay', country: 'tr', color: '#E60000', short: 'VDF' },
  { id: 'turktelekom', name: 'Türk Telekom', country: 'tr', color: '#00A0DF', short: 'TT' },
  { id: 'oldubil', name: 'OlduBil', country: 'tr', color: '#2E3192', short: 'OLD' },
  { id: 'hadi', name: 'Hadi', country: 'tr', color: '#FF2D55', short: 'HAD' },
  { id: 'bkmexpress', name: 'BKM Express', country: 'tr', color: '#E30613', short: 'BKM' },
  // ---------- INDONESIA 🇮🇩 ----------
  { id: 'mandiri', name: 'Bank Mandiri', country: 'id', color: '#003D79', short: 'MDR' },
  { id: 'bri', name: 'BRI', country: 'id', color: '#00529C', short: 'BRI' },
  { id: 'bni', name: 'BNI', country: 'id', color: '#F15A22', short: 'BNI' },
  { id: 'btn', name: 'BTN', country: 'id', color: '#003D7A', short: 'BTN' },
  { id: 'bca', name: 'BCA', country: 'id', color: '#0060AF', short: 'BCA' },
  { id: 'danamon', name: 'Danamon', country: 'id', color: '#005EA5', short: 'DNM' },
  { id: 'cimbniaga', name: 'CIMB Niaga', country: 'id', color: '#EC1C24', short: 'CN' },
  { id: 'permata', name: 'Permata', country: 'id', color: '#00A94F', short: 'PMT' },
  { id: 'panin', name: 'Panin', country: 'id', color: '#E4002B', short: 'PNN' },
  { id: 'mega', name: 'Mega', country: 'id', color: '#F7941E', short: 'MEG', dark: true },
  { id: 'ocbcid', name: 'OCBC Indonesia', country: 'id', color: '#E60012', short: 'OC' },
  { id: 'bsi', name: 'BSI', country: 'id', color: '#00A0A0', short: 'BSI' },
  { id: 'muamalatid', name: 'Bank Muamalat', country: 'id', color: '#6B2E68', short: 'MUA' },
  { id: 'bcasyariah', name: 'BCA Syariah', country: 'id', color: '#0060AF', short: 'BCAS' },
  { id: 'jenius', name: 'Jenius', country: 'id', color: '#00A9E0', short: 'JN' },
  { id: 'jago', name: 'Bank Jago', country: 'id', color: '#FFB800', short: 'JG', dark: true },
  { id: 'blubca', name: 'Blu by BCA Digital', country: 'id', color: '#0AB9E6', short: 'BLU' },
  { id: 'seabank', name: 'SeaBank', country: 'id', color: '#FF6A00', short: 'SB' },
  { id: 'superbank', name: 'Superbank', country: 'id', color: '#635BFF', short: 'SPR' },
  { id: 'allobank', name: 'Allo Bank', country: 'id', color: '#EC1C24', short: 'ALO' },
  { id: 'krombank', name: 'Krom Bank', country: 'id', color: '#111827', short: 'KRM' },
  { id: 'neobank', name: 'Neobank', country: 'id', color: '#FDB913', short: 'NEO', dark: true },
  { id: 'gopay', name: 'GoPay', country: 'id', color: '#00AED6', short: 'GP' },
  { id: 'ovo', name: 'OVO', country: 'id', color: '#4C3494', short: 'OVO' },
  { id: 'dana', name: 'DANA', country: 'id', color: '#118EEA', short: 'DN' },
  { id: 'shopeepayid', name: 'ShopeePay ID', country: 'id', color: '#EE4D2D', short: 'SP' },
  { id: 'linkaja', name: 'LinkAja', country: 'id', color: '#E31E24', short: 'LA' },
  { id: 'isaku', name: 'i.saku', country: 'id', color: '#E11931', short: 'iS' },
  { id: 'astrapay', name: 'AstraPay', country: 'id', color: '#0067B2', short: 'AP' },
  { id: 'doku', name: 'DOKU', country: 'id', color: '#F04E23', short: 'DK' },
  { id: 'sakuku', name: 'Sakuku', country: 'id', color: '#0060AF', short: 'SK' },
  // ---------- GENERIC (clean minimalist B&W outline) ----------
  { id: 'cash', name: 'Cash', country: 'generic', outline: true, icon: 'Banknote' },
  { id: 'card', name: 'Card', country: 'generic', outline: true, icon: 'CreditCard' },
  { id: 'vault', name: 'Vault / Safe', country: 'generic', outline: true, icon: 'Vault' },
  { id: 'piggy', name: 'Piggy Bank', country: 'generic', outline: true, icon: 'PiggyBank' },
  { id: 'wallet', name: 'Wallet', country: 'generic', outline: true, icon: 'Wallet' },
  { id: 'invest', name: 'Invest', country: 'generic', outline: true, icon: 'TrendingUp' },
  { id: 'crypto', name: 'Crypto', country: 'generic', outline: true, icon: 'Bitcoin' },
  { id: 'business', name: 'Business', country: 'generic', outline: true, icon: 'Briefcase' },
]
export const getLogo = (id) => BANK_LOGOS.find((l) => l.id === id) || null
