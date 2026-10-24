/**
 * İçerik alanı etiketleri — "Sayfa › Bölüm › Alan" kalıbı.
 *
 * Slot dosyaları yalnızca alanın kendi adını yazar ("Başlık", "Üst etiket", "Açıklama");
 * sayfa ve bölüm adı buradan eklenir. Etiket şu yerlerde görünür: Listeler… menüsü ve
 * liste paneli başlığı, Sayfa ayarları, Geçmiş, "biri aynı anda değiştirdi" uyarısı.
 * Bağlamsız "Bölüm başlığı" yerine "Ana sayfa › Bir günümüz › Başlık" okunur.
 *
 * Anahtar adları değişmez; yalnızca gösterilen etiket üretilir.
 */

const SEP = ' › ';

/** Anahtarın ilk parçası → sayfa adı. */
const PAGES: Record<string, string> = {
  home: 'Ana sayfa',
  hakkimizda: 'Hakkımızda',
  guvenlik: 'Hakkımızda',
  egitim: 'Eğitim yaklaşımı',
  yasgruplari: 'Yaş grupları',
  yasgrubu: 'Yaş grubu sayfası',
  gunlukakis: 'Günlük akış',
  aktiviteler: 'Branş dersleri',
  kayit: 'Kayıt',
  iletisim: 'İletişim',
  tesekkurler: 'Teşekkür sayfası',
  yorumlar: 'Veli yorumları',
  sss: 'SSS',
  gizlilik: 'KVKK sayfası',
  kullanim: 'Kullanım şartları',
  cerez: 'Çerez politikası',
  site: 'Okul bilgileri',
  chrome: 'Site geneli',
  form: 'Randevu formu',
  legal: 'Yasal metinler',
};

/** Anahtar öneki → bölüm adı; en uzun eşleşen önek kazanır. Sayfa adı farklıysa "Sayfa › Bölüm" olarak yazılır. */
const SECTIONS: Record<string, string> = {
  'home.hero': 'Üst alan',
  'home.testimonials': 'Veli yorumları',
  'home.day': 'Bir günümüz',
  'home.garden': 'Bahçelerimiz',
  'home.features': 'Neden biz',
  'home.activities': 'Branş dersleri',
  'home.announcements': 'Duyurular',
  'home.faq': 'Merak edilenler',
  'home.faqLink': 'Merak edilenler',
  'home.contact': 'Randevu formu',
  // Haftalık ritim Günlük Akış sayfasında yaşıyor; anahtar adı eski (okulun kaydı korunur).
  'home.week': `Günlük akış${SEP}Haftalık ritim`,

  'chrome.nav': 'Üst menü',
  'chrome.header': 'Üst menü',
  'chrome.footer': 'Alt bilgi',
  'chrome.mobile': 'Telefon alt çubuğu',
  'chrome.whatsapp': 'WhatsApp balonu',
  'chrome.contact': 'İletişim kartları',
  'chrome.cookie': 'Çerez bandı',
  'chrome.lp': 'Reklam sayfası alt bilgi',

  'hakkimizda.hero': 'Üst alan',
  'hakkimizda.facts': 'Künye',
  'hakkimizda.values': 'Değerlerimiz',
  'hakkimizda.visit': 'Randevu formu',
  'guvenlik.hero': 'Güvenlik ve sağlık',
  'guvenlik.sections': 'Güvenlik ve sağlık',

  'egitim.hero': 'Üst alan',
  'egitim.sections': 'Soru-cevap bölümleri',
  'egitim.english': 'İngilizce',
  'egitim.ages': 'Yaş grupları',
  'egitim.cta': 'Randevu formu',

  'yasgruplari.hero': 'Üst alan',
  'yasgruplari.card': 'Grup kartları',
  'yasgruplari.cta': 'Randevu formu',
  'yasgrubu.classSize': 'Giriş',
  'yasgrubu.focus': 'Odak alanları',
  'yasgrubu.flow': 'Günün akışından',
  'yasgrubu.cta': 'Randevu formu',

  'gunlukakis.hero': 'Üst alan',
  'gunlukakis.plan.full': 'Tam gün',
  'gunlukakis.plan.half': 'Yarım gün',
  'gunlukakis.scene': 'Sahneler',
  'gunlukakis.roster': 'Sınıf künyesi',
  'gunlukakis.cta': 'Randevu formu',

  'aktiviteler.hero': 'Üst alan',
  'aktiviteler.tab': 'Sekmeler',
  'aktiviteler.season': 'Sekmeler',
  'aktiviteler.card': 'Ders kartları',
  'aktiviteler.detail': 'Ders ayrıntısı',
  'aktiviteler.cta': 'Randevu formu',

  'kayit.hero': 'Üst alan',
  'kayit.form': 'Randevu formu',
  'kayit.steps': 'Kayıt adımları',

  'iletisim.hero': 'Üst alan',
  'iletisim.contact': 'Randevu formu',

  'tesekkurler.hero': 'Üst alan',

  'yorumlar.hero': 'Üst alan',
  'yorumlar.source': 'Kaynak etiketleri',
  'yorumlar.empty': 'Boş durum',
  'yorumlar.cta': 'Randevu formu',
  'yorumlar.share': 'Yorum bırakma çağrısı',

  'sss.hero': 'Üst alan',
  'sss.cta': 'Alt çağrı',

  'form.help': 'Alt satır',
  'form.err': 'Hata mesajları',
  'form.start': 'Başlangıç seçenekleri',
  'form.birth': 'Doğum tarihi',
  'form.district': 'Semt',

  'legal.gizlilik': 'KVKK sayfası',
  'legal.kullanim': 'Kullanım şartları',
  'legal.cerez': 'Çerez politikası',
  'legal.common': 'Ortak',
};

/** Birden çok sayfada okunan ortak listeler: etiketleri ait oldukları sayfayla sabit. */
const FIXED: Record<string, string> = {
  'faq.items': `SSS${SEP}Sorular ve cevaplar`,
  'testimonials.items': `Veli yorumları${SEP}Yorumlar`,
  'day.chapters': `Günlük akış${SEP}Günün sahneleri`,
  'program.branches': `Branş dersleri${SEP}Dersler`,
  'program.weekDays': `Günlük akış${SEP}Haftanın günleri`,
  'ageGroups.items': `Yaş grupları${SEP}Gruplar`,
};

function section(key: string): string | undefined {
  const parts = key.split('.');
  for (let n = parts.length - 1; n >= 2; n--) {
    const hit = SECTIONS[parts.slice(0, n).join('.')];
    if (hit) return hit;
  }
  return undefined;
}

/** Slot dosyasındaki kısa alan adından panelde görünen tam etiketi üretir. */
export function labelFor(key: string, raw: string): string {
  if (FIXED[key]) return FIXED[key];
  // Reklam sayfaları ayrı bir iş; fotoğraf etiketleri alt yazıdan türer.
  if (key.startsWith('lp.')) return raw;
  if (key.startsWith('media.')) return `Fotoğraf${SEP}${raw}`;
  const [first, second] = key.split('.');
  if (first === 'meta') {
    const page = PAGES[second] ?? second;
    return `${page}${SEP}Google${SEP}${raw}`;
  }
  const page = PAGES[first];
  if (!page) return raw;
  const sec = section(key);
  // Bölüm adı zaten sayfa adıyla başlıyorsa (home.week → Günlük akış) sayfa tekrar yazılmaz.
  if (sec?.includes(SEP)) return `${sec}${SEP}${raw}`;
  return [page, sec, raw].filter(Boolean).join(SEP);
}
