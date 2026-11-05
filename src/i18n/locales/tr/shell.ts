import type { Messages } from '../id';

const shell: Messages['shell'] = {
  tab: { home: 'Ana Sayfa', transactions: 'İşlemler', budget: 'Bütçe', coach: 'Coach', assets: 'Varlıklar' },
  assets: { title: 'Varlıklar', subtitle: 'Hisse senetleri ve diğer varlıklar', soonTitle: 'Yakında', soonMessage: 'Hisse senedi ve diğer varlık özelliklerini hazırlıyoruz. Şimdilik hesap bakiyelerin Ana Sayfa\'da.' },
  capture: {
    title: 'İşlem ekle',
    subtitle: 'Senin için en hızlı yolu seç',
    limitBadge: 'Limit',
    scan: {
      title: 'Fiş Tara',
      short: 'Fiş Tara',
      sub: 'Fişin fotoğrafını çek, gerisini AI doldursun · {count} tarama kaldı',
      sub_one: 'Fişin fotoğrafını çek, gerisini AI doldursun · {count} tarama kaldı',
      subLimited: 'Bu ayın tarama kotası doldu',
      reason: 'Free fiş tarama kotan ({free}/ay) doldu. Ayın 1’inde sıfırlanır ya da ayda {premium} tarama için yükselt.',
    },
    voice: {
      title: 'Voice Log',
      short: 'Voice Log',
      sub: 'Söyle, hemen kaydedilsin',
      subLimited: 'Bu ayın otomasyon kotası doldu',
      reason: 'Free otomasyon kotan ({free}/ay, Voice Log dahil) doldu. Sınırsız kullanım için yükselt.',
    },
    pdf: {
      title: 'Hesap Özeti İçe Aktar',
      short: 'PDF Aktar',
      sub: 'Bankadan PDF · bu ay {count} aktarım kaldı',
      sub_one: 'Bankadan PDF · bu ay {count} aktarım kaldı',
      subLimited: 'Bu ayın aktarım kotası doldu',
      reason: 'Free PDF aktarımın ({free}/ay) kullanıldı. Ayda {premium} aktarım için yükselt.',
    },
    manual: { title: 'Elle Ekle', short: 'Elle', sub: 'Tutarı ve kategoriyi kendin gir' },
  },
  currencySheet: { title: 'Para birimi seç' },
  notifications: {
    title: 'Bildirimler',
    unread: '{count} okunmamış',
    allRead: 'Hepsi okundu',
    emptyTitle: 'Henüz bildirim yok',
    emptyMessage: 'Fatura hatırlatmaları ve bütçe uyarıları burada görünür.',
    stateRead: 'Okundu',
    stateUnread: 'Okunmadı',
    markAll: 'Tümünü okundu say',
  },
  paywall: {
    title: 'Premium ile sınırları kaldır',
    benefitScan: 'Ayda {premium} fiş tarama (Free {free})',
    benefitPdf: 'Ayda {premium} PDF hesap özeti aktarımı (Free {free})',
    benefitUnlimited: 'Sınırsız hesap, hedef ve fatura',
    benefitVoice: 'Sınırsız Voice Log ve otomasyon',
    benefitCoach: 'Aylık özet ve günde 20 soru ile Coach’a Sor',
    benefitTax: 'Tam vergi araçları ve PDF dışa aktarma',
    cta: 'Premium paketleri gör',
    later: 'Şimdi değil',
    inactiveTitle: 'Satın alma henüz aktif değil',
    inactiveMessage: 'Paketler ve fiyatlar, RevenueCat 3. Aşamada bağlandığında görünür.',
  },
};

export default shell;
