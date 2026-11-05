import type { Messages } from '../id';

const budget: Messages['budget'] = {
  title: 'Bütçe',
  period: '{start} - {end} · {days} gün kaldı',
  errorTitle: 'Bütçe yüklenemedi',
  errorMessage: 'Bağlantını kontrol edip tekrar dene. Verilerin güvende.',
  loading: 'Bütçe yükleniyor',
  adjust: 'Ayarla',
  safeToSpend: 'Güvenle harcanabilir',
  perDay: 'günlük',
  untouched: 'Bu dönem henüz harcama yok, bütçenin tamamı duruyor.',
  remaining: '{days} gün boyunca ihtiyaç ve istekler için {amount} kaldı.',
  donutCenter: 'Bu dönem harcanan',
  donutEmpty: 'Bu dönem henüz harcama yok',
  donutCaption: 'Limit {amount} · %{pct}',
  chartHint: 'Bu grafiği doldurmak için ilk işlemini kaydet.',
  bucket: {
    ofIncomeTarget: 'Hedef: gelirden %{pct}',
    ofIncome: 'Gelirden %{pct}',
    ofTarget: 'Hedefe göre %{pct}',
    target: 'hedef {amount}',
    of: '/ {amount}',
    reached: '{label} ulaşılan',
    used: '{label} kullanılan',
    categoryPct: '{label} yüzde {pct}',
    empty: 'Bu grupta henüz harcama yok.',
  },
  split: {
    title: 'Bütçe oranlarını ayarla',
    subtitle: 'Toplam tam olarak %100 olmalı',
    decrease: '{label} azalt',
    increase: '{label} artır',
    valid: 'Toplam %100, kaydetmeye hazır',
    over: 'Toplam %{total}. %100 için %{n} azalt.',
    under: 'Toplam %{total}. %100 için %{n} ekle.',
    save: 'Oranları kaydet',
  },
};

export default budget;
