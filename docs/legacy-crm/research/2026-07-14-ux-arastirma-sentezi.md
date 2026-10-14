# AnaOkulCRM — UX / Kullanıcı / Erişilebilirlik Araştırma Sentezi

**Tarih:** 2026-07-14
**Kaynak:** Perplexity (sonar-pro, web-grounded) üzerinden 6 paralel derin sorgu, 115 kaynak.
**Amaç:** Domain uyumu + handoff implementasyon planını beslemek. Bulgular doğrudan "danışman ekranı / kurucu ekranı nasıl tasarlanmalı" kararlarına bağlandı.

> Bağlam hatırlatma: Tek anaokulu, teknik olmayan danışmanlar (mobil-öncelikli) + kurucu (onay/dashboard). Bugün her şey WhatsApp grubunda; lead'lerin ~%22'si takipsiz unutuluyor (Zehra %23, Rüya %6). CRM WhatsApp'ı **değiştirmeyecek**, onun hafızası ve patronun gözü olacak.

---

## 0. En kritik 6 çıkarım (yönetici özeti)

1. **CRM çift-iş gibi hissedilirse ölür.** Türkiye KOBİ vakalarında CRM başarısızlığının 1 numaralı sebebi: süreçten önce yazılım + aynı bilgiyi iki yere girme. → Danışman için CRM, **WhatsApp'ın doğal uzantısı** olmalı, rakibi değil.
2. **"CRM'de yazılmayan iş yapılmamıştır" kuralı** tasarıma gömülmeli (kurucunun dashboard'unda "bugün WhatsApp'tan gelen ≠ CRM'e girilen" farkı görünür olmalı).
3. **Danışman mobil ekranı = ana ürün.** Kurucu dashboard'u ikincil. Her kritik akış ≤3 dokunuş, yeni lead formunda ≤4 zorunlu alan.
4. **İlk 2-4 hafta alışkanlık dönemi** kritik: günlük mikro-hedef ("bugün 5 lead güncelle") + görünür ilerleme.
5. **Erişilebilirlik sayısal eşikleri net:** metin kontrast ≥4.5:1, dokunma hedefi pratik 44px, gövde font ≥16px (yaşça büyük kullanıcı).
6. **Domain kalıpları hazır:** household (veli=ana, öğrenci=bağlı), kardeş indirimi aile-kuralına bağlı, ayrılış-iade sözleşme-temelli, tur/demo ayrı dönüşüm aşaması — Türkiye örnekleriyle doğrulandı.

---

## 1. CRM Adopsiyonu — Danışman Mobil Ekranı için 10 Kural

Kaynaklardan damıtılan, tasarım checklist'i olarak kullanılacak kurallar:

1. **Tek ana ekran, tek görev odağı** — açılışta sadece "Bugün takip listesi" + "Yeni lead" görünür. Rapor/ayar bu ekranda yok.
2. **Yeni lead formunda ≤4 zorunlu alan** — çocuk adı, veli adı, telefon, kaynak. Gerisi opsiyonel; boş bırakmak hata değil.
3. **Pipeline aşamaları eyleme dayalı ve net** — muğlak değil ("Ulaşıldı", "Randevu/Demo", "Görüşme", "Teklif"). Tek tap ile değişir.
4. **Alt bar'da 3 ana aksiyon** — "Bugün", "Pipeline/Leadler", "Yeni lead". Başka ikon yok.
5. **Lead listesi WhatsApp zihinsel modeline benzer** — dikey feed, satırda veli/çocuk/aşama/son aktivite + sağda "WhatsApp'ta aç".
6. **Her aksiyon sonrası mikro geri bildirim** (2-3 sn snackbar) + kısa "geri al".
7. **"Bugün" ekranında birincil aksiyon işaretli** — her satırda "Ara" / "WhatsApp" + "Ertele". Boşsa net boş-durum mesajı.
8. **Numara bazlı eşleştirme** — aynı telefonla yeni kayıtta "Bu numara zaten var, devam et?" uyarısı (mükerrer engeli).
9. **Günlük hedef + ilerleme çubuğu** görünür ("3/5 lead tamamlandı") — ilk 2-4 hafta alışkanlık için.
10. **Hata affediciliği + offline toleransı** — bağlantı yoksa kayıt "Beklemede"ye düşer, otomatik tekrar denenir; kritik eylemlerde undo.

**Akıllı varsayılanlar:** kaynak default = son kullanılan, tarih = bugün, atanan = o an giriş yapan danışman, sezon = aktif sezon. Amaç: çoğu kaydı **2 dokunuşla** bitirmek.

---

## 2. Pipeline / "Bugün" / Form UX

- **Aşama sayısı 6-7 ideal** (mevcut model uygun). Desktop'ta drag-drop, **mobilde swipe/tek-tık** (sağa=sonraki aşama, sola=önceki, uzun-bas=aşama sheet'i). Mobilde tam kanban KULLANMA — segment sekmeli liste kullan.
- **"Bugün" ekranı = önceliklendirilmiş aksiyon kuyruğu, liste değil.**
  - Üstte "Bugün odaklan: 3 iş" (skor: vade + aşama + değer + son aktivite).
  - Sekmeler: **Bugün / Vadesi Geçen / Tümü**. Vadesi geçenler ayrı, kırmızı.
  - Her kartta birincil CTA (Ara/WhatsApp/Toplantı) + ikincil (Tamamla/Ertele/Not).
- **Otomatik görev üretimi aşamaya bağlı:** "Ulaşıldı"→24s içinde tekrar ara; "Randevu/Demo"→1s önce hatırlat + 1 gün sonra takip; "Teklif"→3 gün sonra teklif takibi. (Mevcut takipsizlik-görevi motoruyla uyumlu genişletme.)
- **Ertele deseni:** "Bugün sonra / Yarın / Gelecek hafta / Tarih seç" + "2 kez ertelendi" rozeti (farkındalık).
- **Form:** telefon → numerik klavye + otomatik format (5xx xxx xx xx) + **non-blocking** validasyon; tarih → native picker + "Bugün/Yarın" hızlı seçim + hazır saat slotları (10:00, 14:00). Doğum: ay+yıl seçici (şema ile uyumlu).

---

## 3. Erişilebilirlik (WCAG 2.2) — Sayısal Standart

| Konu | Eşik / Kural |
|---|---|
| Metin kontrastı | **≥ 4.5:1** (gövde), büyük metin **≥ 3:1** |
| UI bileşen / ikon / durum göstergesi | **≥ 3:1** |
| Gövde font | **≥ 16px** (yaşça büyük kullanıcı; 12-14px kullanma) |
| Satır yüksekliği | gövde 1.4-1.6 |
| Dokunma hedefi | WCAG min **24×24px**, pratik **44-48px** (padding dahil) |
| Odak göstergesi | görünür, ≥2px, sticky header altında kalmamalı (Focus Not Obscured) |
| Form | görünür label (placeholder yetmez), hata "ne oldu + nasıl düzelir" |
| Sürükleme | tek-işaretçi alternatifi zorunlu (Dragging Movements) → mobilde swipe/buton |
| Yardım | her sayfada tutarlı yerde (Consistent Help) |
| Giriş | otomatik doldurma/yapıştırma engellenmez, bilişsel bulmaca yok (Accessible Authentication) |

**Durum sadece renkle anlatılmaz** — renk + ikon + metin birlikte. Türkçe karakterler (ı/İ/ş/ğ) için net x-height'li font; dar kolonlarda metin sıkıştırma yok.

---

## 4. Bildirim & Hatırlatma — SLA + Eskalasyon

- **Bildirim yorgunluğunu önle:** aynı lead/görev için **gün başına en fazla 1 kesinti (interrupt)**; digest'te listelenmek ayrı sayılmaz.
- **Kanal matrisi:**
  - Kullanıcı uygulamada → **uygulama-içi** (push YOK).
  - Yeni yüksek-öncelik lead → push + app-içi; mesai dışıysa ertele.
  - Gün sonu → **e-posta/dashboard digest** (düşük aciliyet, çok bilgi).
  - Kritik eskalasyon → kurucuya app-içi + e-posta (SMS/WhatsApp sadece opt-in).
- **SLA (lead sıcaklığına göre):** Sıcak 30dk-2s, Ilık 24s, Soğuk 48s. SLA durumu: Running/Paused/Breached/Resolved; **mesai dışında Paused** (sadece çalışma saati sayılır).
- **Eskalasyon merdiveni (yığın değil, sırayla):** T0 atama → T+2s danışmana nazik → T+1gün danışmana kuvvetli + yedek → sonra kurucuya. → Mevcut `takipsizlik_gun` (3 gün) ayarını bu merdivene bağla.
- **Veliye** (opsiyonel ileride): form/başvuru sonrası otomatik teşekkür dönüşü artırıyor; haftada ≤2-3 mesaj.

---

## 5. Anaokulu/Kreş Sektörü CRM Kalıpları (Türkiye + global)

Domain kararlarımızı doğrulayan/şekillendiren örüntüler:

- **Household modeli:** NetpusCRM "**veli = ana kişi, öğrenci = bağlı kişi**" — bizim seçtiğimiz **tam aile tablosu (FK)** kararıyla birebir örtüşüyor. Aynı ailenin çocukları tek household, tek bakiye.
- **Kardeş indirimi aile kuralına bağlı** (çocuğa değil): Terakki 2. kardeşe %10; Öykü Adası "bir kardeş ayrılınca indirim biter"; bazı kurumlar hiç uygulamıyor → **kural konfigüre edilebilir olmalı**. Alanlar: aile kodu, aktif kardeş sayısı, indirim tipi. Kardeş ayrılınca **otomatik yeniden hesap**.
- **Sezon/yenileme:** her eğitim yılı ayrı dönem; mevcut öğrenciler **yenileme havuzuna** otomatik; erken/orta/son 3 dalga çağrı; sadece değişen alanlar toplanır. (Eyotek: otomatik artış oranı + yeni tutar tek sayfa.)
- **Ayrılış/iade sözleşmeye bağlı:** Öykü Adası deseni — ilk hafta günlük kesinti + kalan iade; sonra 1 aylık ücret. → **"finans kapanış" akışı**: kalan taksitler iptal + iade kaydı (bizim kararımız). Fatura ekranı 4 şey gösterir: **toplam / ödenen / kalan / gecikme**.
- **Tur/demo/oryantasyon ayrı dönüşüm aşaması** (pazarlama etkinliği değil): tek-link randevu + tur öncesi 5 soru (yaş, başlama tarihi, tam/yarım gün, kardeş?, bütçe) + tur sonrası 24s içinde otomatik takip + etiket değişimi. → **demo/oryantasyon randevu tipleri** kararımızı doğruluyor.
- **Kontenjan + waitlist:** sınıf/program bazlı kapasite + **canlı sıra** (pasif liste değil); yer açılınca sıradaki 3 aileye aynı anda bildirim; yanıt yoksa sıradakine geç. → Bizim **soft kontenjan** kararımızın üstüne, ileride waitlist ikinci aşama.

---

## 6. Görsel Tasarım Dili (Tailwind + shadcn uyumlu)

**İlke:** Sakin, profesyonel, hızlı taranabilir. Nötr taban + tek primary (mavi). Durumlar renk+ikon+metin.

**Palet (HEX):**

| Rol | HEX | Kullanım |
|---|---|---|
| background | `#F5F7FA` | Genel arka plan |
| card | `#FFFFFF` | Kart/modal/panel |
| border | `#D1D5DB` | Sınırlar |
| foreground | `#111827` | Ana metin |
| muted-foreground | `#6B7280` | Açıklama/meta |
| primary | `#2563EB` | Ana buton, link, aktif tab |
| primary-soft | `#DBEAFE` | Soft badge/highlight |
| accent | `#14B8A6` | İkincil vurgu (nadiren) |

**Durum renkleri (renk-körü güvenli, badge = bg + text/border + ikon + label):**

| Durum | bg | text/border | ikon |
|---|---|---|---|
| Yeni | `#DBEAFE` | `#1D4ED8` | ● dot |
| Randevu/Demo | `#FEF3C7` | `#D97706` | takvim |
| Teklif | `#E0F2FE` | `#0369A1` | belge |
| Kazanıldı | `#DCFCE7` | `#15803D` | ✓ |
| Kaybedildi | `#FEE2E2` | `#B91C1C` | ✕ |
| Takipsiz/Beklemede | `#E5E7EB` | `#4B5563` | saat |

**Tipografi:** Inter (Türkçe destekli). h1 24px / h2 20px / h3 18px / gövde 14px (a11y için önemli metinlerde 16px) / meta 12px. Önemli isimler `font-semibold`, gerisi muted.

**Yoğun veri:** her şey card içinde (`rounded-xl border`), kartlar arası `space-y-6`, tablo satırı ~44px (`py-3`), zebra `even:bg-slate-50`, satırda "önce kim, sonra durum" (durum+tarih sağda), `line-clamp-2` + detay için `Sheet`. Soft shadow + ince border + monokrom ikon (Lucide/Tabler); cam/neon/aşırı gradient YOK.

**Dokunma:** buton `h-10`, tıklanabilir satır `py-3` (~44px), ikon buton çevresi `p-2` hit-area. Mobil: alt nav `h-16`; masaüstü: sol nav 240/72px + kayda tıklayınca sağdan `Sheet` 360-420px.

---

## 7. Bu araştırmanın implementasyon planına 8 doğrudan girdisi

1. **Danışman mobil "Bugün" ekranı** yeniden tasarım — önceliklendirilmiş aksiyon kuyruğu + WhatsApp butonları.
2. **Yeni/hızlı lead formu** — ≤4 zorunlu alan, akıllı varsayılanlar, non-blocking validasyon.
3. **Pipeline** — mobilde swipe/segment, desktop drag-drop; demo/oryantasyon aşama görünürlüğü.
4. **Tasarım sistemi** — yukarıdaki palet + tipografi + durum rozetleri `globals.css`/tokens'a; a11y eşikleri lint/checklist.
5. **Bildirim/eskalasyon** — SLA durumu + mesai-dışı Paused + merdiven eskalasyon (`takipsizlik_gun` üstüne).
6. **Household/kardeş** — aile FK + konfigüre edilebilir indirim kuralı + ayrılışta yeniden hesap.
7. **Ayrılış-iade** — finans kapanış akışı (taksit iptal + iade kaydı), fatura 4-alan görünümü.
8. **Kurucu dashboard** — "WhatsApp'tan gelen ≠ CRM'e girilen" farkı + kaynak dönüşümü + doluluk + "danışman bugün X kayıt güncelledi".

---

*Ham kaynak listesi (115 URL) araştırma çıktısında mevcuttur; kilit kaynaklar: uxmatters.com (CRM UX 2026), w3c.github.io/wcag/22, mybrightwheel.com childcare karşılaştırma, procaresoftware.com, crea.mba (Tailwind v4 + shadcn 2026), perakendeokulum.com (CRM başarısızlık), NetpusCRM/OkulAile/Terakki/Öykü Adası (TR domain).*
