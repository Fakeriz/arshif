// Demo content untuk Onboarding — sesuai bahasa & mata uang yang dipilih user.
// Konten ilustrasi di-slide sengaja hardcoded per bahasa (ini konten demo, bukan UI copy):
// item, merchant, dan harga terasa lokal kalau match dengan bahasa yang aktif.

export const ONBOARD_DEMO = {
  id: {
    currency: 'IDR',
    voice: { item: 'Nasi goreng', price: 'Rp 28.000' },
    receipt: {
      merchant: 'Indomaret',
      tag: 'Groceries',
      items: [['Beras 5kg', '68.000'], ['Minyak goreng 2L', '36.000'], ['Telur 1kg', '29.000']],
      total: 'Rp 133.000',
      note: 'Bisa dipajak • Klaim LHDN',
    },
    balance: { label: 'onboard_total_balance', amount: 'Rp 24.850.000' },
    conversions: [
      ['🇺🇸', '$120', 'Rp 1,9 jt'],
      ['🇲🇾', 'RM 170', 'Rp 640 rb'],
      ['🇹🇷', '₺60', 'Rp 25 rb'],
    ],
  },
  ms: {
    currency: 'MYR',
    voice: { item: 'Nasi lemak', price: 'RM 5.00' },
    receipt: {
      merchant: 'Era Superstore',
      tag: 'Groceries',
      items: [['Milo 1kg', '25.00'], ['Beras 10kg', '38.00'], ['Ayam 2kg', '24.00']],
      total: 'RM 170.00',
      note: 'Boleh tolak cukai • Tuntutan LHDN',
    },
    balance: { label: 'onboard_total_balance', amount: 'RM 5,850.00' },
    conversions: [
      ['🇺🇸', '$120', 'RM 560'],
      ['🇮🇩', 'Rp 2 jt', 'RM 640'],
      ['🇹🇷', '₺60', 'RM 8.50'],
    ],
  },
  en: {
    currency: 'USD',
    voice: { item: 'Coffee & bagel', price: '$8.50' },
    receipt: {
      merchant: 'FreshMart',
      tag: 'Groceries',
      items: [['Coffee beans 1kg', '12.50'], ['Milk 2L', '5.00'], ['Eggs 12pk', '4.80']],
      total: '$22.30',
      note: 'Tax deductible • Business expense',
    },
    balance: { label: 'onboard_total_balance', amount: '$3,850.00' },
    conversions: [
      ['🇮🇩', 'Rp 2 jt', '$130'],
      ['🇲🇾', 'RM 170', '$36'],
      ['🇹🇷', '₺60', '$1.80'],
    ],
  },
  tr: {
    currency: 'TRY',
    voice: { item: 'Simit & çay', price: '₺35.00' },
    receipt: {
      merchant: 'BİM Market',
      tag: 'Groceries',
      items: [['Ekmek 2 adet', '30.00'], ['Süt 2L', '75.00'], ['Yumurta 10lu', '68.00']],
      total: '₺173.00',
      note: 'Vergi indirilebilir • Şirket gideri',
    },
    balance: { label: 'onboard_total_balance', amount: '₺128.500,00' },
    conversions: [
      ['🇺🇸', '$120', '₺4.100'],
      ['🇮🇩', 'Rp 2 jt', '₺4.800'],
      ['🇲🇾', 'RM 170', '₺1.150'],
    ],
  },
}
