import type { Messages } from '../id';

const shell: Messages['shell'] = {
  tab: { home: 'Utama', transactions: 'Transaksi', budget: 'Bajet', coach: 'Coach', assets: 'Aset' },
  assets: { title: 'Aset', subtitle: 'Saham dan aset lain', soonTitle: 'Akan datang', soonMessage: 'Ciri saham dan aset lain sedang kami sediakan. Buat masa ini, baki akaun anda kekal di Utama.' },
  capture: {
    title: 'Rekod transaksi',
    subtitle: 'Pilih cara paling pantas untuk anda',
    scan: {
      title: 'Imbas Resit',
      short: 'Imbas Resit',
      sub: 'Foto resit, AI isi semuanya · baki {count} imbasan',
      sub_one: 'Foto resit, AI isi semuanya · baki {count} imbasan',
      subLimited: 'Kuota imbasan bulan ini sudah habis',
      reason: 'Kuota imbas resit Free ({free}/bulan) sudah habis. Set semula pada 1 haribulan, atau naik taraf untuk {premium} imbasan/bulan.',
    },
    voice: {
      title: 'Voice Log',
      short: 'Voice Log',
      sub: 'Sebut sahaja, terus direkod',
      subLimited: 'Kuota automasi bulan ini sudah habis',
      reason: 'Kuota automasi Free ({free}/bulan, termasuk Voice Log) sudah habis. Naik taraf untuk tanpa had.',
    },
    pdf: {
      title: 'Import Penyata Bank',
      short: 'Import PDF',
      sub: 'PDF daripada bank · baki {count} import bulan ini',
      sub_one: 'PDF daripada bank · baki {count} import bulan ini',
      subLimited: 'Kuota import bulan ini sudah habis',
      reason: 'Import PDF Free ({free}/bulan) sudah digunakan. Naik taraf untuk {premium} import/bulan.',
    },
    manual: { title: 'Rekod Manual', short: 'Manual', sub: 'Isi sendiri amaun dan kategori' },
  },
  currencySheet: { title: 'Pilih mata wang' },
  notifications: {
    title: 'Pemberitahuan',
    unread: '{count} belum dibaca',
    allRead: 'Semua sudah dibaca',
    emptyTitle: 'Belum ada pemberitahuan',
    emptyMessage: 'Peringatan bil dan amaran belanjawan muncul di sini.',
    stateRead: 'Sudah dibaca',
    stateUnread: 'Belum dibaca',
    markAll: 'Tandakan semua dibaca',
  },
  paywall: {
    title: 'Buka had dengan Premium',
    benefitScan: 'Imbas resit {premium}/bulan (Free {free})',
    benefitPdf: 'Import penyata bank PDF {premium}/bulan (Free {free})',
    benefitUnlimited: 'Akaun, matlamat dan bil tanpa had',
    benefitVoice: 'Voice Log dan automasi tanpa had',
    benefitCoach: 'Rekap bulanan dan Tanya Coach 20 soalan/hari',
    benefitTax: 'Alat cukai lengkap dan eksport PDF',
    cta: 'Lihat pakej Premium',
    later: 'Nanti dulu',
  },
};

export default shell;
