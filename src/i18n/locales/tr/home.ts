import type { Messages } from '../id';

const home: Messages['home'] = {
  profileA11y: 'Profil ve ayarlar',
  notifA11y: 'Bildirimler',
  notifUnreadA11y: 'Bildirimler, {count} okunmamış',
  netWorth: 'Toplam net varlık',
  showBalance: 'Bakiyeyi göster',
  hideBalance: 'Bakiyeyi gizle',
  balanceMeta: '{count} hesap · {currency} cinsinden · örnek kur {date}',
  balanceMeta_one: '{count} hesap · {currency} cinsinden · örnek kur {date}',
  sampleData: 'Örnek veri',
  accountLimitA11y: '4 hesap sınırına ulaşıldı. Hesap eklemek için Premium’u aç',
  accountLimitReason: 'Free paket 4 hesap ve cüzdanla sınırlı. Premium’da sınır yok.',
  cardPosition: 'Kart {n} / {total}',
  accountLimitTitle: '4 hesap sınırına ulaşıldı',
  accountLimitSub: 'Hesap eklemek için Premium',
  recapTitle: 'Haftalık özetin hazır',
  recapMessage: 'Geçen hafta paranın nereye gittiğine bak.',
  budget: {
    title: 'Bu dönemin bütçesi',
    a11y: 'Bu dönemin bütçesi, {pace}. Günde {amount} güvenle harcayabilirsin. Bütçeyi aç',
    period: '{start} - {end} · {count} gün kaldı',
    period_one: '{start} - {end} · {count} gün kaldı',
    safe: 'Güvenle harcanabilir',
    perDay: 'günlük',
    usageA11y: 'İhtiyaç ve istek bütçesi kullanımı',
    usage: 'İhtiyaç ve istekler için {limit} bütçenin {spent} kadarı kullanıldı',
  },
  health: {
    title: 'Finansal sağlık',
    openCoach: '{label}. Coach’u aç',
  },
  recent: {
    title: 'Son işlemler',
    seeAll: 'Tümünü gör',
    emptyTitle: 'Henüz işlem yok',
    emptyMessage: 'Fişin fotoğrafını çek ya da harcamanı söyle, 10 saniyede kaydedilsin.',
    emptyAction: 'Şimdi ekle',
    accountFallback: 'Hesap',
  },
  error: {
    title: 'Ana sayfa yüklenemedi',
    message: 'Bağlantını kontrol edip tekrar dene. Verilerin güvende.',
  },
};

export default home;
