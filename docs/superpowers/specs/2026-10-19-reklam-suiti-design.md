# Reklam Suiti — Tasarım

Tarih: 19.10.2026 · Sahibi: Mert Şeker · Durum: onaylandı (prototip ve planlar)

Kaynaklar (bu belge hepsini birleştirir, çelişkide bu belge geçerlidir):
- Strateji ve iş akışı: https://claude.ai/artifact/KJPB3DuphXTAhY6fsAQvnE (`Desktop\Seker-Reklam-Akisi.html`)
- Google + Instagram entegrasyonu: https://claude.ai/artifact/7JfCNTUwTei6rxWeL8u5VM (`Desktop\Seker-Instagram-Reklam-Plani.html`)
- Tıklanabilir arayüz prototipi (9 ekran): https://claude.ai/artifact/XW3PqbxYLpt45VVhRVcnbB
- Önceki genel plan: https://claude.ai/artifact/CppSMo7zKFmZT7mGBwpp1X

## 1. Neden

Geçen yaz Meta reklamlarına 400 veli yazdı, tek kayıt alınamadı. Kayıp reklamda değil, mesajdan sonraki adımlarda yaşandı: kime cevap verildiği, kimin arandığı, kimin okulu gezdiği bilinmiyor. Bu sezon:

1. Gelen her veli, kanalı ne olursa olsun, panelde bir kayıt olur ve 5 dakikada aranır.
2. Her hafta 2 Reels ve 2 reklam sayfası üretilir, küçük bütçeyle test edilir, kazananlar büyütülür.
3. Google ve Instagram tek ekrandan izlenir ve yönetilir. Kararlar paneldeki gerçek veliye göre verilir, platformun kendi sayısına göre değil.
4. Bütçe, personel akışı sağlıklıysa artar ("bütçe kapıları").

Kullanıcının en sert şartı: **arayüz çok anlaşılır olmalı.** Personel karar vermez, sıradaki işi yapar. Her ekranın tek bir ana düğmesi vardır. Panel kendi yaptığını işlemden sonra listeler.

## 2. Hedefler

- G1. Ön büro: Bugün ekranında sayaçlı "Şimdi ara" listesi, arama ekranı (konuşma sırası, 4 nitelik, sonuç, ziyaret saati), mesajdan veli ekleme, 7 günlük otomatik takip sırası, ziyaret hatırlatmaları.
- G2. Web: reklam sayfası formunda 4 nitelik sorusu. `fbclid`/`_fbc`/`_fbp` kaydı. Çerez onayına bağlı Meta pikseli. Reels/sayfa kodu adayla birlikte saklanır.
- G3. Meta bağlantısı: sistem kullanıcısı anahtarıyla günlük harcama senkronu (reklam seviyesi), Conversions API ile `Lead`/`Schedule`/`Enrolled` geri bildirimi, Instagram Reels organik sayıları.
- G4. Öğretmen: "Görevim" ekranı. Reels yükleme ya da sayfa metni yazma, otomatik kontroller, teslim, iki aşamalı onay.
- G5. Yönetici "Reklam" bölümü: **Bu hafta** (kapılar, panel önerileri, huni, ekip karnesi, haftanın görevleri), **İçerik panosu** (Görev → Kontrol → Organik → Test → Kazanan → Arşiv), **Kampanyalar** (Google + Instagram tek tablo, iki mercek, durdur/başlat/bütçe onaylı ve kayıtlı), **Ayarlar ve hedefler**.
- G6. Bugünkü Google entegrasyonu çok platformlu hale gelir. Mevcut Google davranışı bozulmaz.

## 3. Hedef olmayanlar

- Panelden yeni kampanya kurmak. Kampanyaları Claude API ile duraklatılmış kurar, panel sadece durdurur/başlatır/bütçe değiştirir.
- Reklam metni ya da sayfa metni üretmek. Metni okul yazar, panel yalnızca kontrol eder.
- Panelden yeni `/lp/...` adresi açmak (sayfa oluşturucu). Ayrı bir iş. Bu projede yeni sayfa geçici yöntemle eklenir: öğretmen metni Görevim'de yazar, adresi geliştirici kodla açar.
- Instagram içi form (Lead Ads), WhatsApp Business Platform, `ctwa_clid`. Sonraki aşama.
- Veliye otomatik WhatsApp gönderimi. Bkz. Karar K3.

## 4. Kesinlikle olmaması gerekenler

- Panel dışında kalan veli. Mesajdan gelen veliyi eklemek 30 saniyeyi geçmemeli.
- Personelin "şimdi ne yapmalıyım" diye düşündüğü bir ekran.
- Reklam platformlarına çocuk bilgisi (ad, yaş, doğum tarihi) gitmesi. Reklam izni olmayan veliler için hiçbir olay gönderilmemesi.
- Bir kapı kırmızıyken uyarı görmeden ve gerekçe yazmadan bütçe artırılması.
- Mevcut Google dönüşüm gönderimini ya da raporunu bozmak.

## 5. Kısıtlar

- **MEB Ek Madde 4:** Reklamda öğrenci yüzü, adı ve başarı bilgisi kullanılamaz. Yükleme ekranında "öğrenci yüzü ya da adı var mı?" sorusu zorunlu, "Evet" cevabı teslimi engeller.
- **KVKK ve çerez:** Meta pikseli yalnız "reklam" onayıyla yüklenir. Onay yoksa sunucudan da Meta'ya olay gitmez. Mevcut `ad_consent_revoked_at` ve sadece telefon izni kuralları Meta için de geçerlidir. Aydınlatma metni değişikliği hukuk onayı ister. Piksel bu onay gelene kadar `NEXT_PUBLIC_META_PIXEL_ID` boş bırakılarak kapalı tutulur.
- **Meta hesabı henüz hazır değil.** Okul "Öne çıkar" kullanıyor. Hesap düzeni (İşletme Portföyü, reklam hesabı, veri kümesi, sistem kullanıcısı) Mert'in elle yapacağı bir iş. Kod, Meta anahtarları yokken "kurulmadı" durumuna düşer ve hata vermez (Google'daki `skipped` davranışı gibi).
- **Google anahtarları sunucuda yok** (7 `GOOGLE_ADS_*`). Aynı şekilde kurulmadı durumu.
- **Canlıya alma koordinasyonu:** Bu iş `feat/reklam-suiti` dalında (`Desktop\seker-platform-reklam-suiti`) yapılır. main'e push ve prod migration koordinatör oturumundadır. Migration numaraları 0014'ten başlar (0013 `feat/wa-grup`'ta). Numaralar koordinatörle teyit edilir.
- **Teknoloji:** Mevcut yığın. Next.js 16 panel ve web, Supabase (Postgres + RLS), Vitest, Docker + cron konteyneri (`infra/cron/crontab`), sunucu Lightsail. Yeni bağımlılık eklemeden önce gerekçe yazılır.
- **Tasarım dili:** `apps/panel/app/globals.css` token'ları, büyük dokunma hedefleri (min 44–56 px), Türkçe metinler. Prototipteki ekranlar bağlayıcı referanstır (yerleşim, metin tonu, adımlar).
- **Roller:** Bugün `yonetici` ve `danisman` var. Öğretmen için yeni rol gerekir (K1).
- **API sürümleri:** Google Ads v25 (mevcut). Meta Graph/Marketing API v25. Başlarken Meta sürüm sayfasından teyit edilir.

## 6. Kararlar

Kullanıcının onayladıkları (planlar ve prototip üzerinden):
- Instagram reklamı web sayfasındaki forma gider, mesaj ikinci yol olarak kalır.
- Formda 4 nitelik sorusu var: doğum ay/yıl, semt, başlama zamanı, telefon (+ WhatsApp tercihi).
- **Nitelikli veli:** yaş 2–6 uygun + semt servis alanında + 6 ay içinde başlar + ulaşıldı. Personel ilk aramada işaretler. Form cevapları ön doldurur.
- Reels önce organik paylaşılır. 72 saat sonra öndeki teste girer.
- Testin ana ölçüsü nitelikli veli başı maliyet. Randevu ve kayıt 4 haftalık doğrulama.
- Başlangıç kuralları (Ayarlar'dan değişir): hedef nitelikli veli başı 1.000 TL. Durdur = hedefin 3 katı harcama ve 0 nitelikli. Kazandı = en az 5 nitelikli ve hedefin altında. Sonuçsuz = 3 hafta. Büyütme = haftada en fazla %20. Yorgunluk = sıklık > 3, tıklama oranı ilk haftaya göre %30 düşük ve maliyet artışı.
- Bütçe kapıları: ortanca ilk arama ≤ 15 dk, 7 günde ulaşma ≥ %80, nitelikliden randevu ≥ %35, randevuya gelme ≥ %70. Biri kırmızıysa panel bütçe artışı önermez; elle artışta kırmızı uyarı ve zorunlu gerekçe çıkar.
- Takip sırası: 0. dk arama → açmazsa hazır WhatsApp; +3 saat; ertesi gün sabah ve akşam; 3. gün arama + iki ziyaret saati; 7. gün son deneme → "Kaybedildi · Ulaşılamadı". 1 ay sonra tek "kontenjan" denemesi.
- Randevu: onay mesajı, 1 gün önce ve aynı sabah hatırlatma. "Gelmedi" aynı gün aranır. Ziyaret sonrası 24 saatte teşekkür, 48 saatte arama, 7 günde son arama.
- Meta olayları: form = `Lead` (website, pikselle aynı `event_id`). Randevu/görüşme/teklif = `Schedule`. Kazanıldı = özel `Enrolled` (değer: teklif tutarı). Kaynak `system_generated`. Eşleşme: `fbc`, `fbp`, SHA-256 telefon/e-posta, şifrelenmiş `external_id`.
- Panelden kampanya kurulmaz. Durdur/başlat/bütçe onaylı ve `ad_change_log`'a kayıtlı.
- Metinleri ve WhatsApp şablonlarını okul yazar, bir yönetici onaylar.

Benim kararlarım (kullanıcı itiraz etmedi, değiştirilebilir):
- **K1. Öğretmen rolü:** `ogretmen` rolü eklenir. Bu rol yalnız kendi görevlerini görür ve teslim eder. Veli, öğrenci, ödeme ve reklam verisi görmez.
- **K2. Mesai:** 08:30–18:00, hafta içi (Ayarlar'dan değişir). Mesai dışı gelen velinin sayacı ertesi mesai başlangıcında başlar. Takip sırası saatleri mesaiye göre kayar.
- **K3. WhatsApp:** Veliye giden mesajlar ilk aşamada personelin telefonundan tek dokunuşla gönderilir (hazır metinli `wa.me` bağlantısı, mevcut `WhatsAppButton` gibi). Prototipteki "WhatsApp onayı gönderildi" ifadesi "WhatsApp mesajı hazır · Gönder" olur. Otomatik gönderim (`feat/wa-grup`'taki WAHA altyapısıyla) numara engellenme riski taşır, ayrı karar ister.
- **K4. Bildirim:** Yeni veli bildirimi mevcut panel bildirimleriyle verilir. 15 dakika uyarısı yöneticiye gider. Telefona anlık bildirim (push ya da WhatsApp grubu) `feat/wa-grup` birleşince ona bağlanır.
- **K5. Reels/sayfa kodu:** `R-<yıl2><hafta2>-<A|B|C>` (Reels), `S-<yıl2><hafta2>-<G|I>` (sayfa). Örnek `R-2645-A`. Reklam bağlantılarına `utm_content=<kod>` eklenir. Kod adaya `utm_content`'ten ya da mesajdan ekleme ekranında seçilerek yazılır.
- **K6. Huni ve kapı hesapları:** Yalnız reklam kaynaklı velilerle (Google, Instagram reklamı, Instagram mesajı) hesaplanır. Referans ve tabela velileri hariç.
- **K7. Ölçüm penceresi:** Meta "7 gün tıklama + 1 gün görüntüleme". Platform sayısı yalnız gri küçük sayı olarak görünür.
- **K9. Meta'ya sunucudan olay gönderimi (onay):** Form onay metni yeni bir sürüme geçer ve Google ile birlikte Meta'yı da adıyla sayar (`consent_version`). Formdaki çerez bandı durumu (reklam onayı verildi mi) adayla birlikte saklanır (`ad_cookie_consent`). `Lead` olayı yalnız ikisi de varsa gider. `Schedule`/`Enrolled` olayları yalnız yeni onay sürümü olan adaylar için gider. Eski onaylı adaylar Meta'ya hiç gitmez. Tüm Meta gönderimi `META_CAPI_ENABLED` anahtarıyla kapalı gelir, hukuk onayıyla açılır.
- **K10. Kaynak alanı:** `leads.source` anlamı değişmez. `reklam` yalnız Google (gclid) için kalır. Yeni `ad_platform` alanı (`google` | `meta` | boş) ve `channel` alanı eklenir. Instagram reklamından gelen veli `source='instagram'`, `ad_platform='meta'` olur. Google tetikleyicisi, raporu ve `isAd` yalnız `ad_platform='google'`/gclid'e bakacak şekilde netleştirilir. Organik Reels'ten mesajla gelen veli `source='instagram'`, `ad_platform` boş olur. Huni ve kapılarda sayılır (personel yükü), maliyet hesaplarında sayılmaz.
- **K11. Meta reklamı ↔ içerik kodu:** Claude'un kurduğu her Meta reklamının adı içerik koduyla başlar (`R-2645-A · Bir günümüz`). Senkron kodu addan çözer. Kodsuz reklam "eşleşmemiş" görünür ve Kampanyalar'da elle koda bağlanabilir.

Kullanıcı kararları (19.10, builder check sonrası):
- **Veli sahipliği: ortak liste.** Tüm ön büro "Şimdi ara" listesini birlikte görür. İlk "Ara"ya basan veliyi üstlenir (`assigned_to` o kişi olur). Takip görevleri ona düşer. Ekip karnesi ona yazılır. Üstlenilmiş veli 15 dakikada ilk temas almazsa yeniden herkese açılır.
- **Onaylar: tek onay yeter.** İçerikte de bütçede de herhangi bir yöneticinin tek onayı yeterlidir. İçerikte "okul onayı / reklam onayı" iki adımı yoktur, tek "Onayla" vardır. Kapı kırmızıyken bütçe artışı engellenmez ama onay penceresi kırmızı uyarıyı gösterir ve onaylayan bir gerekçe yazmak zorundadır (gerekçe `ad_change_log`'a yazılır). Bölüm 4'teki "tek onayla bütçe artırılması" maddesi bu şekilde okunur.
- **K8.** "Ayarlar ve hedefler" ekranı: hedef nitelikli veli maliyeti, kural eşikleri, kapı eşikleri, mesai, aylık platform bütçesi, servis alanı semt listesi, şablon metinleri.

## 7. Mevcut sistem (bilinmesi gerekenler)

- Veli durumları (`LEAD_STATUSES`): yeni, ulasildi, randevu, gorusme_yapildi, teklif, beklemede, kazanildi, kaybedildi. Kayıp nedeni zorunlu (`LOST_REASONS`). Kaynaklar `LEAD_SOURCES`'ta.
- `tasks` tablosunda `rule_key` ile otomatik görev altyapısı var (tek açık görev / kural). Randevular `appointments` tablosunda, sonuçlar `APPOINTMENT_OUTCOMES`.
- `CallButton` (`components/call-outcome.tsx`) "Görüşme nasıl geçti?" sheet'ini açar. Bugün ekranı `app/(app)/bugun/page.tsx`.
- Web formu: `apps/web` `LeadForm` → `/api/lead` → RPC `create_web_lead` (`0006`). Atıf `apps/web/lib/attribution.ts` (sadece `gclid` + UTM).
- Google: `apps/panel/lib/ads/*`, `ad_spend_daily (date, campaign_id)`, `conversion_uploads` (gclid, randevu/kayit, trigger `enqueue_conversion_upload`), cron `/api/cron/ads` 06:00, Data Manager API. Ayrıntı: `docs/pazarlama-kurulum.md`.
- "Google" sabit yazılı yerler: `ad_spend_daily` PK, `conversion_uploads` tekilliği ve `gclid`, trigger, `report.ts` `isAd`, `marketing-table.tsx` rozeti, web `attribution.ts`, `leadSchema`, `visits.ts` kaynakları.
- Bildirimler: `notification-bell.tsx`, `lib/notification-text.ts`, `lib/events.ts`.

## 8. Ekranlar (prototipe göre)

Her ekranın davranışı prototiptedir. Burada yalnız veri ve kurallar:

1. **Bugün (danışman):** "Şimdi ara" listesi, `first_contact_at` boş reklam ya da web velileri, sayaç `created_at`'ten (mesai dışıysa mesai başından). Renk: ≤5 dk yeşil, 5–15 sarı, >15 kırmızı. Sonra "Takip aramaları" (bugün vadesi gelen takip görevleri), sonra "Bugünkü ziyaretler" (Geldi/Gelmedi). Üstte "Instagram / WhatsApp mesajını ekle". "?" yardım kutusu ilk açılışta açık, kapatılınca kullanıcı başına hatırlanır.
2. **Arama:** Konuşma sırası metni (Ayarlar'dan düzenlenir, fiyat cevabı dahil), 4 nitelik işareti, not, sonuç (Randevu verildi / Geri aranacak / Ulaşılamadı / Uygun değil). Randevuda `appointments`'tan boş saat önerisi. Kayıt sonrası "Panel şunları yaptı" listesi. İlk kayıtta `first_contact_at` yazılır (Ulaşılamadı da bir temas denemesidir, ilk dönüş süresine sayılır).
3. **Mesajdan veli ekle:** Kanal (Instagram mesajı / Instagram yorumu / WhatsApp / Telefon), telefon (zorunlu), ad, Reels kodu (son 4 haftanın kodları, küçük görsel) ya da "Bilmiyorum". `created_at` = mesaj saati (personel düzeltebilir, varsayılan şimdi).
4. **Veli kartı ve takip:** Mevcut veli sayfasına eklenir: aşama çubuğu, "Nereden geldi" kartı (kod, kanal, form cevapları), takip sırası zaman çizelgesi, hazır mesajlar.
5. **Görevim (öğretmen):** Haftanın görevleri (Reels / sayfa). Reels: video yükleme (Supabase Storage), yüz sorusu, açıklama metni. Sayfa: başlık ve sayfa alanları (mevcut `lp.*` slot yapısı). Canlı kontroller: uzunluk, yasaklı ifadeler listesi (Ayarlar'da), boşluk. Teslim → Kontrol: herhangi bir yönetici tek "Onayla" ile onaylar. "Düzeltme iste" görevi notla geri gönderir.
6. **Bu hafta (yönetici):** Pazartesi–Pazar haftası. Kapılar, öneriler (Onayla / Şimdilik bekle, kayıtlı), huni (bu hafta gelen reklam velilerinin bugünkü aşaması, en büyük düşüş kırmızı) ve kayıp nedenleri, ekip karnesi (kişi başına ortanca ilk arama, ulaşma, randevu oranı, açık görev), haftanın konusu ve 4 görev ataması. "Toplantıyı kaydet" kararları ve görevleri yazar.
7. **İçerik panosu:** Kart = bir içerik (Reels ya da sayfa). Sütunlar aşamadır. Kart detayında kural ilerleme çubukları, sayılar ve öneri. Eylemler: Teste al, Durdur, Büyütmeye taşı, Kütüphaneye al, Öğrenilen not.
8. **Kampanyalar:** Platform filtresi, KPI kartları, aylık bütçe gidişatı, kampanya → reklam satırları. Sütunlar: harcama, gelen veli (büyük) + platform sayısı (gri), nitelikli, randevu, kayıt, nitelikli veli başı (yeşil ≤ hedef, sarı ≤ 2×, kırmızı > 2×). Bütçe/Durdur/Başlat onay penceresi.

## 9. Veri modeli (taslak, builder netleştirir)

- `leads` ekleri: `fbclid`, `fbc`, `fbp`, `meta_event_id`, `content_code`, `channel` (form / ig_dm / ig_yorum / whatsapp / telefon), `child_birth_month` (date, ayın 1'i), `district`, `start_window` (hemen / 1_3_ay / 3_6_ay / gelecek_yil), `wants_whatsapp`, `first_contact_at`, nitelik işaretleri (`q_age_ok`, `q_area_ok`, `q_timing_ok`, `q_reached`) ve türetilmiş `is_qualified`.
- `ad_spend_daily` → platform-bağımsız: `platform`, `level` (campaign/adset/ad), `object_id`, `parent_id`, ad, `spend_micros` (ya da kuruş), clicks, impressions, reach, frequency, `platform_results`. PK `(platform, date, level, object_id)`. Mevcut Google satırları taşınır.
- `conversion_uploads` → `platform`, `click_id_type`, `event_id`. Tekillik `(lead_id, conversion_action, platform)`. Trigger iki platformu da besler.
- Yeni: `content_items` (kod, tür, platform, konu, hafta, aşama, sahibi, medya yolu, metin, yüz cevabı, platform kimlikleri, öğrenilen not), `content_tasks` (atama, son tarih, durum, onaylar), `content_organic_stats` (Reels günlük organik sayılar), `weekly_reviews` (hafta, konu, kararlar), `ad_recommendations` (öneri, kural, durum, karar veren), `ad_change_log`, `ad_settings` (hedefler, eşikler, mesai, bütçeler, semtler, yasaklı ifadeler, şablonlar), `followup` görevleri için `tasks.rule_key` desenleri.
- Rol: `profiles.role` içine `ogretmen`. RLS buna göre.

## 10. Builder'a bırakılanlar

Kodun yeri ve isimlendirme, tablo/kolon adlarının kesin hali, senkron sıklığı (Meta: günlük, son 7 gün yeniden; organik: günlük), önerilerin hesaplandığı yer (cron ya da sayfa yüklenirken), Storage düzeni, test stratejisi (mevcut Vitest düzeni), işin aşamalara bölünmesi. Aşama sırası şu mantığı izler: önce personel akışı (Meta beklemeden değer üretir), sonra çok platformlu veri ve Meta, sonra öğretmen görevleri ve içerik panosu, sonra Bu hafta ve Kampanyalar yönetimi.
