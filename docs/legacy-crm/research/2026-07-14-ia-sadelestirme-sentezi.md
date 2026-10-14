# AnaOkulCRM — Bilgi Mimarisi (IA) Sadeleştirme Sentezi

**Tarih:** 2026-07-14 · **Kaynak:** Perplexity (Composio), 2 derin sorgu, çok kaynaklı.
**Tetikleyen:** Mevcut UI ~10 sayfalık "tam CRM" gibi görünüyor, karışık; WhatsApp-yerel ekip için fazla. Mert Şeker'in 3-sekme/6-ekran önerisi test edildi.

## Karar: 3 ana sekme, alt-nesneler detaya gömülü (Mert'in yönü doğrulandı)

Başarılı küçük-ekip CRM'lerinin (HubSpot mobile, Pipedrive, Capsule, Folk, Streak) mobil IA'sı net bir ortak noktada buluşuyor: **3–5 sekme, "bugün/işlerim" merkezli, alt-nesneler (randevu/deal/ödeme) kayıt detayının içinde.** Teknik olmayan + mobil ekip için Folk/Capsule ucu (2–3 sekme) doğru.

### Doğrulanan (Mert = kanıt)
- **3 ana sekme** minimal ve yeterli. Teknik olmayan mobil ekip için ideal.
- **"Bugün/İşlerim" NBA ana ekranı** merkeze — modern CRM'lerin tamamında var (mobile dashboard / activities).
- **Randevu + Teklif + Aktivite → Lead detayına gömme** modern CRM'de baskın desen (HubSpot/Pipedrive/Capsule "relationship view"). **Ödeme → Öğrenci detayına.**
- **Mobilde Kanban YOK.** Filtre-çip + liste + tek-tık durum değiştir daha hızlı, daha az hata, daha kolay öğrenilir. Sürükle-bırak mobilde riskli.
- **Az zorunlu alan + akıllı varsayılan + tek-ekranda-tamamlama + progressive disclosure.**

### Sharpened / Mert'e 3 ekleme (kanıttan)
1. **Aggregate görünüm şart.** Randevuyu lead detayına gömsen de danışman "bugün hangi randevularım var" toplu görünümüne ihtiyaç duyar → **Ana ekranın "Bugünkü Randevular" bloğu** bu ihtiyacı karşılar (ayrı Takvim sekmesine gerek yok). Aynısı "geciken ödemeler" için Ana ekran tahsilat bloğu.
2. **Detay ekranı şişme riski.** Her şeyi lead/öğrenci detayına gömünce 6-7 sekmeli dev ekran olmasın → **bölüm + "özet + Tümünü gör / Yeni ekle"** (progressive disclosure), hepsi açık değil.
3. **Ana ekranda mikro-aksiyon.** Küçük işler için detaya gitmeye zorlama: karttan **Ara / WhatsApp / Ödendi işaretle / Ertele** doğrudan. Büyük düzenleme detayda.

### Ana ekran blok sırası (kanıt: zaman-kritik → dönüşüm → iç süreç)
1. Bugünkü Randevular  2. Takip Bekleyenler  3. Bugünkü Tahsilatlar  4. [Yönetici] Bekleyen Onaylar
(Mert'in sırasından tek fark: Tahsilat, Onaylar'dan önce.)

## Uygulanacak IA (mevcut ~10 route → 3 sekme + 2 detay)

**Alt bar (mobil-öncelik):**
1. **Bugün / İşlerim** — açılış. Selam + "bugün N iş" + bloklar (yukarıdaki sıra), her blok 3-5 kart + "Tümünü gör" + kart içi birincil aksiyon. En altta "Bu ay" mini özet (Dashboard buraya gömülü). Sağ altta **+ Yeni Veli** (FAB). Bildirimler üstte. Yönetici: ekstra Onaylar bloğu + tahsilat toplamları.
2. **Veliler** — arama + filtre çipleri (Tümü/Yeni/Ulaşıldı/Randevu/Teklif/Beklemede/Kazanıldı/Kaybedildi) + kart listesi (Kanban değil). → **Lead Detayı**: Ara/WhatsApp, durum, sonraki iş, teklif, randevular, notlar, aktivite zaman çizelgesi. Randevu + Teklif **burada** oluşturulur.
3. **Öğrenciler** — liste → **Öğrenci Detayı**: program, aidat, ödeme planı (Ödendi butonları), ayrılış-iade. Ödemeler buraya gömülü + toplu tahsilat Ana ekranda.

**Ayrı sekme olmaktan çıkanlar:** Takvim (→ Ana ekran + lead detay), Ödemeler (→ Öğrenci detay + Ana ekran), Teklifler (→ Ana ekran onay bloğu + lead detay), Dashboard (→ Ana ekran altı), Pipeline (→ "Veliler" filtreli liste), Ayarlar (→ profil menüsü, yalnız yönetici), Bildirimler (→ Ana ekran üstü).

**Toplam kullanıcı-görünür ekran: 6** (Giriş, Bugün, Veliler, Lead Detayı, Öğrenciler, Öğrenci Detayı) + gizli Ayarlar.

## Yönetici
Ayrı uygulama değil — aynı uygulama, ekstralar: Ana ekranda "Bekleyen Onaylar" bloğu (onayla/karşı teklif/reddet inline veya tek ekran), Öğrenciler'de tahsilat özetleri, Ana ekran altı "Bu ay" genişletilmiş. Ayarlar (fiyat listesi/kullanıcı) yalnız yöneticide.
