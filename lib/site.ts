const address = {
  street: 'Cumhuriyet Mahallesi, Uludağ Sokak No:6',
  district: 'Beykent, Büyükçekmece',
  city: 'İstanbul',
  postalCode: '34500', // TODO: doğrula
  country: 'TR',
};

export const SITE = {
  name: 'Özel Şeker Anaokulu',
  legalName: 'Özel Şeker Anaokulu',
  alternateNames: ['Şeker Akademi', 'Özel Şeker Akademi Anaokulu'],
  url: 'https://sekeranaokulu.com',
  foundingYear: 2011,
  description:
    'Beykent Büyükçekmece\'de 2011\'den beri, 2-6 yaş için Montessori ve High Scope temelli okul öncesi eğitim.',
  phone: {
    display: '0530 101 88 75',
    e164: '+905301018875',
  },
  email: 'sekerakademi@gmail.com',
  address,
  geo: {
    // TODO: Google Maps'ten gerçek koordinatı al
    latitude: 41.0082,
    longitude: 28.6389,
  },
  mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(
    `${address.street} ${address.district}/${address.city}`,
  )}`,
  hours: { opens: '07:15', closes: '19:15' },
  /** Servis güzergâhının kapsadığı bölgeler — okul yönetimi tarafından doğrulandı (1 Ağustos 2026). */
  areaServed: ['Beykent', 'Beylikdüzü', 'Mimaroba', 'Gürpınar', 'Yakuplu', 'Büyükçekmece'],
  social: {
    // TODO: hesaplar açıldığında gerçek URL'lerle değiştir; boş bırakılanlar render edilmez
    instagram: '',
    facebook: '',
    youtube: '',
  },
  whatsapp: {
    number: '905301018875',
    defaultMessage: 'Merhaba, Şeker Anaokulu hakkında bilgi almak istiyorum.',
  },
} as const;

export const WHATSAPP_URL = `https://wa.me/${SITE.whatsapp.number}?text=${encodeURIComponent(
  SITE.whatsapp.defaultMessage,
)}`;
