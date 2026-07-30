/** Header menu — deliberately focused. */
export const NAV_ITEMS = [
  { href: '/egitim-yaklasimimiz', label: 'Eğitim Yaklaşımımız' },
  { href: '/yas-gruplari', label: 'Yaş Grupları' },
  { href: '/gunluk-akis', label: 'Günlük Akış' },
  { href: '/kadromuz', label: 'Kadromuz' },
  { href: '/aktiviteler', label: 'Aktiviteler' },
  { href: '/ucretler', label: 'Ücretler' },
  { href: '/veli-yorumlari', label: 'Veli Yorumları' },
] as const;

/** Footer link set — must reach every indexable page. */
export const FOOTER_LINKS = [
  ...NAV_ITEMS,
  { href: '/guvenlik', label: 'Güvenlik' },
  { href: '/hakkimizda', label: 'Hakkımızda' },
  { href: '/bultenler', label: 'Bültenler' },
  { href: '/sss', label: 'Sıkça Sorulan Sorular' },
  { href: '/iletisim', label: 'İletişim' },
  { href: '/kayit', label: 'Ön Görüşme Randevusu' },
] as const;
