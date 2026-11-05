import type { Messages } from '../id';

const budget: Messages['budget'] = {
  title: 'Belanjawan',
  period: '{start} hingga {end} · {days} hari lagi',
  errorTitle: 'Belanjawan gagal dimuatkan',
  errorMessage: 'Semak sambungan anda dan cuba lagi. Data anda selamat.',
  loading: 'Memuatkan belanjawan',
  adjust: 'Atur',
  safeToSpend: 'Selamat dibelanjakan',
  perDay: 'sehari',
  untouched: 'Belum ada perbelanjaan tempoh ini, jadi seluruh belanjawan masih utuh.',
  remaining: 'Baki {amount} untuk keperluan dan kehendak selama {days} hari.',
  donutCenter: 'Belanja tempoh ini',
  donutEmpty: 'Belum ada perbelanjaan tempoh ini',
  donutCaption: 'Had {amount} · {pct}%',
  chartHint: 'Rekod transaksi pertama anda untuk mengisi carta ini.',
  bucket: {
    ofIncomeTarget: 'Sasaran {pct}% daripada pendapatan',
    ofIncome: '{pct}% daripada pendapatan',
    ofTarget: '{pct}% sasaran',
    target: 'sasaran {amount}',
    of: 'daripada {amount}',
    reached: '{label} dicapai',
    used: '{label} digunakan',
    categoryPct: '{label} {pct} peratus',
    empty: 'Belum ada perbelanjaan dalam bahagian ini.',
  },
  split: {
    title: 'Atur peratusan belanjawan',
    subtitle: 'Jumlah mesti tepat 100%',
    decrease: 'Kurangkan {label}',
    increase: 'Tambah {label}',
    valid: 'Jumlah 100%, sedia disimpan',
    over: 'Jumlah {total}%. Kurangkan {n}% supaya tepat 100%.',
    under: 'Jumlah {total}%. Tambah {n}% supaya tepat 100%.',
    save: 'Simpan peratusan',
  },
};

export default budget;
