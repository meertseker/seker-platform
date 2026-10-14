export type Testimonial = {
  id: string;
  quote: string;
  author: string;
  context: string;
  source: 'google' | 'form' | 'yuz-yuze';
  /** false ise yorum henüz yayına uygun değildir; hiçbir yerde render edilmez. */
  ready: boolean;
};

/**
 * Google İşletme Profili'nde herkese açık olarak yayımlanmış veli yorumları.
 * Kısaltma dışında değiştirilmemiştir; kısaltılan yerlerde anlam korunmuştur.
 * Veli adları Google'da zaten herkese açık göründüğü biçimiyle, soyadı kısaltılarak
 * kullanılır.
 */
export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'emre-kolej-karsilastirma',
    quote:
      'Şu an 4 yaşında olan kızımız için 1,5 yıl içinde 3 farklı yer denedik. Daha köklü ve iyi olur diye kolej anaokuluna bile gönderdik. Sonunda burada karar kıldık.',
    author: 'Emre',
    context: 'Google yorumu · 4 yaş velisi',
    source: 'google',
    ready: true,
  },
  {
    id: 'arzu-ikinci-cocuk',
    quote:
      'Şu an ortaokulda olan büyük kızımla 2012’de başlayan Şeker Akademi maceram, 2021’de küçük kızımla devam etti. Bu yıl o da mezun oluyor. Hiç pişman olmadım.',
    author: 'Arzu Ö.',
    context: 'Google yorumu · iki çocuğunu da gönderen veli',
    source: 'google',
    ready: true,
  },
  {
    id: 'ece-iletisim',
    quote:
      'Okul öncesi eğitimin kapsamlı olduğu, velinin neredeyse her an hem telefonla hem uygulamadan bilgilendirildiği, öğretmenlerin güler yüzlü olduğu beş yıldızlık bir okul.',
    author: 'Ece P.',
    context: 'Google yorumu',
    source: 'google',
    ready: true,
  },
  {
    id: 'yonca-ucuncu-yil-sonu',
    quote:
      '3 yılın sonunda akademik olarak branş derslerinde iyi olan, daha önemlisi kendini rahat ifade edebilen, hakkını arayan, hayvan seven, yemek seçmeyen, sosyal kurallara uyan bir çocuğum var.',
    author: 'Yonca M.',
    context: 'Google yorumu · 3 yıl sonunda',
    source: 'google',
    ready: true,
  },
  {
    id: 'gizem-ilkokul',
    quote:
      '6 yaşındaki oğlum Şeker Akademi’ye iki yıl gidip mezun oldu. Şu an birinci sınıfta. Çocukların hem akademik hem davranışsal gelişimine çok büyük katkısı oluyor; ilkokula geçince etkisi açıkça görülüyor.',
    author: 'Gizem K.Ç.',
    context: 'Google yorumu · mezun velisi',
    source: 'google',
    ready: true,
  },
  {
    id: 'ismail-uyum',
    quote:
      'Kızımızı okula vermeye karar verdiğimizde çok araştırdık, pek çok okul gezdik ve görüşmelerimizdeki samimiyeti düşünerek Şeker Akademi’de karar kıldık. Başta kaygılarımız vardı ama uyum sürecindeki uzman desteği bunları giderdi.',
    author: 'İsmail A.',
    context: 'Google yorumu · uyum süreci',
    source: 'google',
    ready: true,
  },
  {
    id: 'serdar-iki-yil',
    quote:
      'İki yıldır oğlumuzu bu okula gönderiyoruz ve çok memnunuz. Hem eğitim hem eğlence veren, kendinizi ailenin bir parçası gibi hissettiren bir okul.',
    author: 'Serdar G.',
    context: 'Google yorumu · 2 yıllık veli',
    source: 'google',
    ready: true,
  },
  {
    id: 'zeynep-arastirma',
    quote:
      'Oğlum 3 yıl gitti. Çok araştırdım, ilçedeki her okulu gezdim. Çocuğunuzu gönül rahatlığıyla emanet edebileceğiniz bir okul. 16 branş dersini ve öğretmenlerini saymıyorum bile.',
    author: 'Zeynep A.E.',
    context: 'Google yorumu · 3 yıl gönderen veli',
    source: 'google',
    ready: true,
  },
  {
    id: 'esra-iki-kiz',
    quote:
      'Önce büyük kızımızı Ecem öğretmene, sonra küçük kızımızı Beyza öğretmene emanet ettik. Çocuklarımız için sevgi ve ilgiyle kocaman, sıcacık bir ev oldular.',
    author: 'Esra',
    context: 'Google yorumu · iki çocuğunu da gönderen veli',
    source: 'google',
    ready: true,
  },
  {
    id: 'muge-ilkokul-olsa',
    quote:
      'Kızım iki yıldır gidiyor. Gözüm kapalı emanet ediyorum. Keşke ilkokulları da olsa, hiç ayrılmasak.',
    author: 'Müge İ.',
    context: 'Google yorumu · 2 yıllık veli',
    source: 'google',
    ready: true,
  },
];

/** Yayına hazır yorumlar — render edilecek tek liste budur. */
export const PUBLISHED_TESTIMONIALS = TESTIMONIALS.filter((item) => item.ready);
