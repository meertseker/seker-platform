# Rapor paneli — tasarım (2026-10-20)

Menüdeki "Rapor" (`/dashboard`) baştan yazılır. Eski ekran tek ay, dört kutu ve iki "tüm zamanlar" tablosuydu;
yeni ekran platformdaki her veri kaynağını bir dönem seçimiyle, önceki dönemle karşılaştırarak gösterir ve her
bölüm indirilebilir. Migration yok: bütün sayılar mevcut tablolardan okunur.

## Kim, hangi soruyu soruyor

| Kişi | Soru | Bölüm |
|---|---|---|
| Mehtap Hanım (yönetici) | Bu ay okul nasıl gidiyor, geçen aya göre iyi mi? | Özet |
| Mehtap Hanım | Gelen veliler nerede takılıyor, kaç gün bekliyor? | Aday hunisi |
| Mehtap Hanım | Reklama verdiğim para kayda dönüyor mu, hangi kelime işe yarıyor? | Kaynaklar ve reklam |
| Mehtap Hanım | Danışmanlar veliye ne kadar hızlı dönüyor? | Ön büro |
| Mehtap Hanım | Neden kaybediyoruz? | Kayıp nedenleri |
| Mehtap Hanım | Teklifte ne kadar indirim veriyoruz? | Teklifler |
| Mehtap Hanım | Aidat ne kadar gelmeli, ne kadar geldi, kim gecikti? | Öğrenciler ve tahsilat |
| Mehtap Hanım | Öğretmenler içerik görevlerini zamanında teslim ediyor mu? | İçerik |
| Mehtap Hanım | Siteye kaç kişi geldi, nereden? | Site trafiği |
| Mehtap Hanım | Otomatik mesajlar ve reklam bildirimleri çalışıyor mu? | Otomasyonlar |
| Danışman (Zehra, Rüya) | Benim velilerim ne durumda, ilk aramada hızlı mıyım? | Özet (para yok), huni, kaynaklar (harcama yok), kendi ön büro satırı, kayıp nedenleri, öğrenci sayıları |

## Dönem ve karşılaştırma

URL: `/dashboard?donem=bu-ay|gecen-ay|egitim-yili|ozel&bas=YYYY-MM-DD&bit=YYYY-MM-DD`. Varsayılan `bu-ay`.
Bütün günler İstanbul takvimiyle; `timestamptz` kolonlar `[bas 00:00+03, bit+1 00:00+03)` aralığıyla süzülür.

| Dönem | Aralık | Karşılaştırılan önceki dönem |
|---|---|---|
| Bu ay | ayın 1'i → bugün | geçen ayın 1'i → aynı gün (ay kısaysa ay sonu) |
| Geçen ay | geçen ayın tamamı | ondan önceki ayın tamamı |
| Bu eğitim yılı | 1 Eylül → bugün | geçen yılın 1 Eylül'ü → geçen yılın bugünü |
| Özel | bas → bit (en çok 366 gün) | hemen önceki aynı uzunlukta aralık |

"Bu ay" yarım ayı yarım ayla karşılaştırır; böylece ayın 10'unda "geçen aydan %60 az" gibi yanlış bir alarm çıkmaz.
Değişim: `(şimdi − önce) / önce`; önceki dönem 0 ise yüzde gösterilmez, yalnız fark yazılır. Ok rengi metriğin
yönüne göre: aday, kayıt, tahsilat artınca iyi; aday başı maliyet, kayıp artınca kötü; reklam harcaması yorumsuz (gri).

Dönem dışı iki "şimdiki durum" kutusu her zaman bugünü gösterir: açık veliler (aşama başına) ve geciken taksitler.
Son 12 ay grafikleri dönemden bağımsızdır (seçili dönemin bitiş ayıyla biter).

## Bölümler ve metrikler

Kısaltmalar: "kohort" = dönemde **gelen** veliler (`leads.created_at` dönemde); "olay" = dönemde **olan** iş.

### (a) Özet
| Metrik | Tanım |
|---|---|
| Yeni aday | `leads.created_at` dönemde |
| Verilen randevu | `appointments.created_at` dönemde, `outcome <> 'iptal'` |
| Ziyarete gelen | `appointments.scheduled_at` dönemde, `outcome = 'geldi'` |
| Yeni kayıt | dönemde kazanılan farklı veli: `events` `durum_degisti` (`payload.to='kazanildi'`) ya da `ogrenciye_donusturuldu` (`payload.leadId`), `created_at` dönemde |
| Aktif öğrenci | `students.status='aktif'` (bugün) |
| Tahsil edilen (yönetici) | `installments.status='odendi'`, `paid_at` dönemde, `sum(paid_amount)` |
| Reklam harcaması (yönetici) | `ad_spend_daily.date` dönemde, `sum(cost_micros)` |
| Aday başı maliyet (yönetici) | harcama ÷ dönemde gelen ücretli reklam velisi (kayıt başı maliyet bölüm (c)'de) |

Üstte bir cümle: "Ekim'de (1–20) 42 aday geldi, 6 kayıt oldu; geçen ayın aynı günlerine göre 8 aday fazla."
Altında son 12 ay: aylık yeni aday ve yeni kayıt (gruplu sütun, tek eksen, ikisi de adet).

### (b) Aday hunisi (kohort)
Adımlar Yeni → Ulaşıldı → Randevu → Görüşme → Teklif → Kayıt. Her veli ulaştığı **en ileri** aşamada ve öncesinin
hepsinde sayılır (kaybedilen veli de geçtiği aşamalarda kalır). Aşamaya ulaşma:
- Ulaşıldı: `first_contact_at` dolu, `q_reached = true` ya da durum geçmişi ulaşıldı ve sonrası.
- Randevu: iptal dışı randevu ya da durum geçmişi randevu ve sonrası.
- Görüşme: randevu sonucu `geldi` ya da durum geçmişi `gorusme_yapildi` ve sonrası.
- Teklif: `offers` satırı ya da durum geçmişi `teklif` ve sonrası.
- Kayıt: şu an `kazanildi` ya da `converted_student_id` dolu.
"Durum geçmişi" = `leads.status` + `events.durum_degisti.payload.to` değerlerinin en ilerisi (`beklemede`/`kaybedildi` sıralamaya girmez).

Her adım: adet, gelenlere oranı, bir önceki adımdan geçiş oranı, ortanca bekleme (önceki adıma giriş → bu adıma giriş,
gün). Giriş zamanları: Yeni `created_at`; Ulaşıldı `first_contact_at` ya da ilk `ulasildi` olayı; Randevu ilk randevunun
`created_at`'i; Görüşme ilk `geldi` randevusunun `scheduled_at`'i ya da ilk `gorusme_yapildi` olayı; Teklif ilk teklifin
`created_at`'i; Kayıt ilk kazanma olayı. En büyük düşüş kırmızı işaretlenir.

Yanında "Şu an açık veliler": kapanmamış veliler (`status not in (kazanildi, kaybedildi)`) aşama başına, ve 7 günden
uzun süredir dokunulmamış (`last_activity_at`) olanların sayısı, Veliler ekranına bağlantıyla.

### (c) Kaynaklar ve reklam (kohort)
- Kaynak tablosu: Google reklamı, Instagram reklamı ayrı, diğerleri `leads.source`. Aday, ulaşılan, randevu, kayıt,
  kayıt oranı. Reklam ayrımı `lib/ads/weekly.ts` K10 kuralıyla (`gclid`/`source='reklam'`/`ad_platform`).
- (Yönetici) Platform satırı: harcama, tıklama, aday başı maliyet, kayıt başı maliyet. Kampanya tablosu
  `buildMarketingReport` ile (Pazarlama ekranıyla aynı hesap).
- Arama kelimesi: `leads.utm_term` küçük harf ve boşluk sadeleştirilmiş; kelime başına aday, randevu, kayıt.
  Kelimesiz reklam velileri "kelime bilinmiyor" satırında.
- Harcama yoksa ve reklam velisi yoksa bölüm "Henüz reklam verisi yok" der; kampanyalar duraklatılmışsa ayrıca
  Kampanyalar ekranına bağlantı verir.

### (d) Ön büro (kohort + olay)
Danışman (`leads.assigned_to`) başına: gelen aday, ilk arama ortancası (mesai dakikası, `lead_flow` mesai ayarı; hiç
aranmayan veli bugüne kadar beklediği süreyle girer — Bu hafta kapısıyla aynı kural), 7 günde ulaşma oranı (yalnız 7
günü dolmuş veliler; `first_contact_at − created_at ≤ 7 gün`), randevu verme oranı (nitelikliden), ziyarete gelme oranı
(`scheduled_at` dönemde: geldi ÷ (geldi + gelmedi)), kayıt, açık ve geciken görev (bugün). Danışman yalnız kendi satırını
ve okul toplamını görür.

### (e) Kayıp nedenleri (olay)
Dönemde `kaybedildi`'ye geçen veliler (`durum_degisti` olayı), neden `payload.lostReason`, yoksa `leads.lost_reason`.
Neden başına adet ve pay; önceki dönemle yan yana.

### (f) Teklifler (yönetici, olay)
Dönemde oluşturulan teklifler: verilen, onaylanan, reddedilen, revize; ortalama indirim
`1 − offered_price / list_price`; şu an onay bekleyen sayısı (Teklifler ekranına bağlantı).

### (g) Öğrenciler ve tahsilat
- Herkes: aktif öğrenci, program dağılımı ve aktif fiyat listesindeki kontenjana göre doluluk, dönemde ayrılan
  (`left_date` dönemde).
- Yönetici: beklenen (`installments.due_date` dönemde, iptal hariç, `sum(amount)`), tahsil edilen (`paid_at` dönemde,
  `sum(paid_amount)`), dönemde vadesi gelenin tahsil oranı, iade (`refunds.refund_date` dönemde), kalem türüne göre
  kırılım, geciken toplam ve yaşlandırma (`v_overdue_installments.days_overdue`: 1–30, 31–60, 61–90, 90+), son 12 ay
  beklenen/tahsil edilen grafiği.

### (h) İçerik (yönetici)
`content_items`: dönemde verilen (`created_at`), teslim edilen (`submitted_at`), onaylanan (`approved_at`), zamanında
teslim oranı (`submitted_at ≤ due_at`), şu an geciken (`status in (taslak, duzeltme)` ve `due_at < şimdi`); öğretmen başına.

### (i) Site trafiği (yönetici)
`site_visit_daily` (çerezsiz sayaç): ziyaret (`entrances`), sayfa görüntüleme, telefondan pay, kaynak ve en çok bakılan
sayfalar; önceki dönemle. Google Analytics ayrıntısı Pazarlama'da kalır.

### (j) Otomasyonlar (yönetici)
WhatsApp grup mesajları (`wa_outbox`, `created_at` dönemde: gönderildi, hata, atlandı) ve reklam platformuna dönüşüm
bildirimleri (`conversion_uploads`, `conversion_at` dönemde: gönderildi, bekliyor, hata, atlandı; platform başına).

## Tekrar eden ekranlarla ilişki
- **Bu hafta** haftalık toplantı ekranıdır (kapılar, kararlar, görev planı). Rapor kapı hesabını kopyalamaz; ön büro
  bölümü aynı ilk arama kuralını dönem için uygular ve "Bu hafta"ya bağlantı verir.
- **Kampanyalar** kampanya durdurma/bütçe işidir; rapor yalnız dönem harcamasını ve maliyeti özetler, bağlantı verir.
- **Pazarlama** CSV harcama yükleme, GA4 ve dönüşüm listesi ekranıdır; rapor aynı `buildMarketingReport` hesabını
  kullanır, böylece iki ekranın sayıları tutar.
- **Bugün** eski `lib/queries/dashboard.ts` fonksiyonlarını kullanmaya devam eder; o dosyaya dokunulmaz.

## İndirme
- Her bölümün başlığında "Excel" ve "CSV". CSV: UTF-8 BOM, `;` ayraç, ondalık virgül (Türkçe Excel doğrudan açar).
- Üstte "Tüm raporu indir (Excel)": bölüm başına bir sayfa, ilk sayfa "Özet" ve dönem bilgisi.
- Kütüphane: panelde zaten kullanılan `xlsx` 0.18.5. Tutarlar TL sayı (`#,##0.00 ₺` biçimi), oranlar yüzde biçimli sayı.
- Uç: `GET /dashboard/indir?bolum=<anahtar|tum>&bicim=xlsx|csv&donem=…`. Ekrandakiyle aynı rol süzgeci uygulanır;
  danışmanın isteğinde yönetici bölümleri dosyaya hiç girmez.

## Rol ayrımı
`lib/role-access.ts`'e göre `/dashboard` yönetici ve danışmana açık, öğretmene kapalı. RLS zaten
`ad_spend_daily`, `site_visit_daily`, `wa_outbox`, `conversion_uploads` tablolarını yalnız yöneticiye açıyor.
Rapor buna ek olarak danışmana para (tahsilat, teklif tutarları, harcama) göstermez, ön büroda yalnız kendi satırını
ve okul toplamını gösterir, içerik/site/otomasyon bölümlerini göstermez. **Değişiklik:** eski ekran danışmana aylık
tahsilat kutularını gösteriyordu; yeni ekranda göstermez.

## Görsel dil
Panelin mevcut token'ları (yüzey, kenar, `primary` yalnız eylem için). Grafikler HTML/SVG, kütüphane yok. Tek seri
grafik tek renk (mavi `#2a78d6`), iki seri mavi + turuncu (`#eb6834`, doğrulanmış varsayılan sıra); "beklenen/tahsil"
aynı mavinin açık ve koyu adımı. Durum renkleri (yeşil/kırmızı) yalnız iyi/kötü değişim ve en büyük düşüş için, her zaman
ok ve metinle. Her grafiğin yanında ya da altında aynı sayıların tablosu var; değerler doğrudan yazılır, üzerine gelince
ipucu yalnız ek bilgidir. Telefonda bölümler tek sütun, tablolar kendi içinde yana kayar, bölüm menüsü yatay kaydırılır.

## Test
Saf modüller (`lib/report/*`): dönem çözümü ve önceki dönem, oran ve değişim (0'a bölme), maliyet bölmeleri, huni
aşama hesabı ve bekleme ortancası, kaynak/kelime kırılımı, yaşlandırma kovaları, CSV biçimi ve Excel sayfaları.
