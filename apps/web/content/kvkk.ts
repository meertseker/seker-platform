import { SITE } from '@/lib/site';

// Literal ifade bilerek bölünmüş: grep yalnızca gerçek yer tutucuları saysın.
export const TEYIT_MARKER = '[OKULDAN ' + 'TEYİT ALINACAK';

const address = `${SITE.address.street}, ${SITE.address.district}, ${SITE.address.city}`;

export const KVKK_CONSENT_LABEL =
  'Aydınlatma Metni\'ni okudum. Başvurum için aranmama ve başvuru bilgilerimin reklamlarımızın etkinliğini ölçmek amacıyla Google ile paylaşılmasına onay veriyorum.';

export type KvkkSection = { id: string; title: string; paragraphs: string[]; items?: string[] };

export const KVKK_TEXT: { updatedOn: string; sections: KvkkSection[] } = {
  updatedOn: '[OKULDAN TEYİT ALINACAK: yayın tarihi, ör. 1 Kasım 2026]',
  sections: [
    {
      id: 'veri-sorumlusu',
      title: 'Veri sorumlusu',
      paragraphs: [
        `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu ${SITE.legalName}'dur ([OKULDAN TEYİT ALINACAK: tam ticari unvan / işleten gerçek veya tüzel kişi, MERSİS veya vergi no]). Adres: ${address}. E-posta: ${SITE.email}. Telefon: ${SITE.phone.display}.`,
      ],
    },
    {
      id: 'veriler',
      title: 'Hangi kişisel verileri işliyoruz',
      paragraphs: ['Web sitemizdeki ön görüşme formu ve reklam sayfalarımız aracılığıyla şu verileri işliyoruz:'],
      items: [
        'Kimlik ve iletişim: velinin adı soyadı ve telefon numarası.',
        'Başvuru bilgisi: formun doldurulduğu sayfa, tarih ve saat, onay kaydı.',
        'Reklam ve pazarlama bilgisi: bir Google reklamına tıklayarak geldiyseniz reklam tıklama kimliği (gclid) ve kampanya bilgisi (UTM parametreleri).',
        'Görüşme süreci: sizinle yaptığımız görüşme, randevu ve kayıt aşamalarına ilişkin notlar.',
      ],
    },
    {
      id: 'amaclar',
      title: 'Verilerinizi hangi amaçlarla işliyoruz',
      paragraphs: [],
      items: [
        'Başvurunuza dönüş yapmak, sizi aramak, WhatsApp üzerinden yazmak ve okul ziyareti randevusu oluşturmak.',
        'Kayıt sürecini yürütmek ve kayıt olmanız halinde sözleşme ilişkisini kurmak.',
        'Hangi reklam ve sayfaların başvuru ve kayıt getirdiğini ölçmek; bu amaçla başvurunuzun bir randevuya veya kayda dönüştüğü bilgisini, reklam tıklama kimliğiyle birlikte Google\'a bildirmek.',
        'Yasal yükümlülüklerimizi yerine getirmek ve olası uyuşmazlıklarda hakkımızı korumak.',
      ],
    },
    {
      id: 'hukuki-sebep',
      title: 'Hukuki sebepler',
      paragraphs: [
        'Başvurunuza dönüş yapılması ve kayıt süreci, KVKK md. 5/2-(c) uyarınca bir sözleşmenin kurulmasıyla doğrudan ilgili olması ve md. 5/2-(f) uyarınca meşru menfaatimiz hukuki sebeplerine dayanır.',
        'Başvuru ve kayıt bilgisinin reklam ölçümü amacıyla Google ile paylaşılması ve bu kapsamda yurt dışına aktarılması, formda verdiğiniz açık rızaya (KVKK md. 5/1 ve md. 9) dayanır.',
      ],
    },
    {
      id: 'aktarim',
      title: 'Verilerinizi kimlerle paylaşıyoruz',
      paragraphs: [
        'Verilerinizi satmıyoruz. Yalnızca hizmeti yürütmek için aşağıdaki hizmet sağlayıcılarla, bu amaçla sınırlı olarak paylaşıyoruz. Bu sağlayıcıların sunucuları yurt dışındadır; aktarım KVKK md. 9 kapsamında açık rızanıza ve/veya Kurul\'un öngördüğü standart sözleşmelere dayanır.',
      ],
      items: [
        'Google (Google Ads, Google Tag Manager): reklam ölçümü; başvurunuzun randevu veya kayda dönüştüğü bilgisi reklam tıklama kimliğiyle birlikte bildirilir. Ad ve telefon numaranız Google\'a gönderilmez.',
        'Supabase: başvuru ve kayıt bilgilerinin saklandığı veritabanı (Avrupa Birliği, Frankfurt [OKULDAN TEYİT ALINACAK: Supabase proje bölgesi]).',
        'Amazon Web Services: web sitesi ve okul yönetim panelinin çalıştığı sunucu ve yedekler (Avrupa Birliği, Frankfurt).',
        'Resend: yeni başvuru bildiriminin okul yönetimine e-posta ile iletilmesi (ABD).',
        'Yetkili kamu kurum ve kuruluşları: yalnızca hukuken zorunlu olduğunda.',
      ],
    },
    {
      id: 'toplama',
      title: 'Toplama yöntemi',
      paragraphs: [
        'Verileriniz web sitemizdeki form aracılığıyla elektronik ortamda, otomatik yollarla toplanır. Reklam tıklama kimliği, Google reklamına tıkladığınızda adres satırında sitemize iletilir.',
      ],
    },
    {
      id: 'saklama',
      title: 'Saklama süresi',
      paragraphs: [
        'Kayıtla sonuçlanmayan başvurular [OKULDAN TEYİT ALINACAK: süre, ör. 2 yıl] sonra silinir veya anonim hale getirilir. Kayıt olan öğrencilere ilişkin veriler sözleşme süresi ve ilgili mevzuattaki saklama süreleri boyunca tutulur. Yedeklerdeki kopyalar en geç 30 gün içinde kendiliğinden silinir.',
      ],
    },
    {
      id: 'haklar',
      title: 'KVKK md. 11 kapsamındaki haklarınız',
      paragraphs: ['Bize başvurarak:'],
      items: [
        'Kişisel verinizin işlenip işlenmediğini öğrenme,',
        'İşlenmişse buna ilişkin bilgi talep etme,',
        'İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,',
        'Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,',
        'Eksik veya yanlış işlenmişse düzeltilmesini isteme,',
        'KVKK md. 7 şartları çerçevesinde silinmesini veya yok edilmesini isteme,',
        'Düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme,',
        'Münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme,',
        'Kanuna aykırı işleme sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme',
      ],
    },
    {
      id: 'basvuru',
      title: 'Başvuru ve rızanın geri alınması',
      paragraphs: [
        `Haklarınıza ilişkin taleplerinizi ${SITE.email} adresine e-posta ile veya ${address} adresine yazılı olarak iletebilirsiniz. Talebiniz en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.`,
        'Google ile reklam ölçümü paylaşımına verdiğiniz açık rızayı aynı yollarla dilediğiniz zaman geri alabilirsiniz; geri alma, o tarihten sonraki paylaşımları durdurur.',
      ],
    },
  ],
};
