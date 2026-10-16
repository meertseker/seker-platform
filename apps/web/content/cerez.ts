/**
 * Çerez Politikası varsayılan metni (legal.cerez.body). Panelden düzenlenebilir; düzenlenmişse bu varsayılan görünmez.
 * Zengin metin kuralları: yalnız h2 başlık; göreli bağlantılar temizlendiği için bağlantı yok.
 * Yasal metin taslağıdır: avukat okumasından geçmeli (bkz. Desktop/seker-platform-SONA-KALANLAR.md).
 * Çerez adları ve süreler Google'ın yayımladığı değerlerdir; etiket eklenip çıkarıldıkça güncellenmeli.
 */
export const CEREZ_DESC =
  'Özel Şeker Anaokulu web sitesinde kullanılan çerezler, amaçları, süreleri ve tercihinizi nasıl değiştirebileceğiniz.';

export const CEREZ_HTML = [
  '<h2>Çerez nedir?</h2>',
  '<p>Çerezler, bir web sitesini ziyaret ettiğinizde tarayıcınıza kaydedilen küçük metin dosyalarıdır. Sitemiz, siteyi çalıştırmak için gereken kayıtların dışında yalnızca sizin onay vermeniz halinde çerez kullanır.</p>',

  '<h2>Kullandığımız çerezler</h2>',
  '<p><strong>Zorunlu kayıtlar (onay gerekmez)</strong></p>',
  '<ul>',
  '<li><strong>Çerez tercihiniz:</strong> "Kabul et" veya "Reddet" seçiminiz, banner\'ın her sayfada yeniden çıkmaması için tarayıcınızın yerel depolamasında tutulur. Siz silene kadar kalır.</li>',
  '<li><strong>Okul personeli girişi:</strong> yalnızca okul yönetim paneline giriş yapan personel için oturum çerezi kullanılır; ziyaretçiler için kullanılmaz.</li>',
  '</ul>',
  '<p><strong>Analitik çerezler (yalnızca onayınızla)</strong></p>',
  '<ul>',
  '<li><strong>Google Analytics (_ga, _ga_&lt;kimlik&gt;):</strong> sitemizin kaç kişi tarafından ziyaret edildiğini, hangi sayfalara bakıldığını ve ziyaretçilerin hangi kaynaktan (arama, reklam, sosyal medya) geldiğini ölçmek için. Saklama süresi en fazla 2 yıl.</li>',
  '</ul>',
  '<p><strong>Reklam çerezleri (yalnızca onayınızla)</strong></p>',
  '<ul>',
  '<li><strong>Google Ads (_gcl_au, _gcl_aw):</strong> bir Google reklamına tıklayarak geldiyseniz, reklamın bir başvuruya dönüşüp dönüşmediğini ölçmek için. Saklama süresi 90 gün.</li>',
  '</ul>',

  '<h2>Çerezsiz ziyaret sayımı</h2>',
  '<p>Sitemizin kaç kez ziyaret edildiğini ve hangi sayfalara bakıldığını, çerez veya tarayıcı depolaması kullanmadan, kendi sunucumuzda sayıyoruz. Bu sayımda yalnızca bakılan sayfa, sitemize hangi kaynaktan (arama motoru, sosyal medya, reklam, doğrudan) gelindiği ve cihazın telefon mu bilgisayar mı olduğu, günlük toplamlar halinde tutulur. IP adresiniz, tarayıcı kimliğiniz veya sizi tanımlayabilecek başka bir bilgi kaydedilmez; bu nedenle sayım çerez tercihinizden bağımsız olarak yapılır.</p>',

  '<h2>Onay vermezseniz</h2>',
  '<p>"Reddet" seçerseniz analitik ve reklam çerezleri tarayıcınıza yazılmaz. Bu durumda Google etiketleri, sizi tanımlayan bir çerez veya kimlik kullanmadan, yalnızca sayfanın açıldığına dair sınırlı bir sinyal gönderebilir (Google onay modu). Sitenin tüm özellikleri onay vermeden de çalışır.</p>',

  '<h2>Verilerin aktarımı</h2>',
  '<p>Analitik ve reklam çerezleri aracılığıyla toplanan bilgiler Google tarafından işlenir ve yurt dışındaki sunuculara aktarılabilir. Ayrıntılar sitemizdeki KVKK Aydınlatma Metni\'nde yer alır.</p>',

  '<h2>Tercihinizi değiştirmek</h2>',
  '<p>Tercihinizi değiştirmek için tarayıcınızın ayarlarından bu sitenin çerezlerini ve site verilerini silebilirsiniz; bir sonraki ziyaretinizde tercih banner\'ı yeniden gösterilir. Tarayıcınızın ayarlarından çerezleri tamamen de engelleyebilirsiniz.</p>',
].join('');
