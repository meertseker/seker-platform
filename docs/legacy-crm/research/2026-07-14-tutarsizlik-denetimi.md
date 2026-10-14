# AnaOkulCRM — Vizyon Tutarsızlık Denetimi

**Tarih:** 2026-07-14 · Vizyon: 3 sekme, "bugün" merkezli, mobil-öncelik, Kanban yok, her şey akışta net, en az adım.
Her madde kod/akış üzerinde **doğrulandı** (D) veya **şüpheli/gözlem** (G) olarak işaretlidir.

## A) Vizyon ihlalleri — düzeltilmeli

1. **[D] Veliler hâlâ Kanban.** `app/(app)/pipeline/page.tsx:290` açık lead'leri yatay kaydırmalı sütunlara (`grid-flow-col auto-cols-[18rem] overflow-x-auto`, masaüstünde 5 sütun) diziyor. Vizyon: **Kanban yok → filtre-çip + tek sütun kart listesi.** Mobilde yatay-kaydırma-sütun = en kötü desen. *En büyük ihlal.*

2. **[D] Randevu "kayboluyor" (senin yaşadığın bug).** Randevu oluşturuluyor (`actions/appointments.ts` çalışıyor, `/takvim` revalidate ediliyor) ama:
   - Bugün ekranındaki "Bugünkü randevular" bloğu **yalnız bugünü** gösterir.
   - Takvim **haftalık** görünüm (`takvim/page.tsx:141`, Pzt-Pzt) ve artık ana menüde **yok** (profil menüsü/Tümünü gör'de).
   - Sonuç: bugün olmayan bir randevu ne Bugün'de ne de kolay erişilebilir bir yerde görünür. "Randevu tabına atmadı" hissi bundan. Vizyon: randevuya net ve tek bir erişim yolu.

3. **[D] Mobil uyum eksik yer: Ödemeler.** `odemeler/page.tsx:178` bir `<table>` (yatay kaydırmalı). Masaüstü tablo, mobil-sade vizyona aykırı; kart listesi olmalı.

4. **[G] Takvim ağır.** Tam haftalık takvim ızgarası, "randevu = lead detay + Bugün bloğu" vizyonundan daha ağır. Basit "yaklaşan randevular listesi" yeterli olabilir.

## B) Akış netliği — kafa karıştıran yerler

5. **[D] "Sonraki iş" yok.** Mert'in vizyonunda Lead Detayı'nda **"Sonraki İş: Yarın 10:00"** var. Şu an lead detayında net bir "bir sonraki adım" göstergesi yok → kullanıcı "şimdi ne yapmalıyım" diye düşünüyor.

6. **[D] Randevu tipi ↔ lead durumu ilişkisi belirsiz.** Randevu eklemek yalnız `yeni/ulasildi` durumundayken otomatik `randevu`ya çeker (`appointments.ts:183`). Zaten `görüşme_yapıldı`/`teklif`teysen "demo ders randevusu" eklemek durumu değiştirmez → "randevu girdim ama bir şey olmadı" hissi. Randevu tipleri (görüşme/demo/oryantasyon) ile pipeline durumu arasında görsel bağ kurulmalı.

7. **[G] Teklif onay akışı iki-rollü, tek kullanıcıda kafa karıştırıcı.** Danışman teklif oluşturur → yönetici onaylar (farklı hesap). Test ederken tek kişi iki rolü oynayınca "öbüründen kabul ettim" adımı doğal gelmiyor. Akış doğru ama onboarding/etiketlerle netleştirilmeli (kimin ne yapacağı).

8. **[G] Öğrenci ödeme planı sadeliği.** Vizyon: "Temmuz ✔ / Ağustos ✔ / Eylül Bekliyor" gibi tek dokunuşlu. Mevcut öğrenci detayı plan/taksit gösteriyor ama bu sade "ay + tik" görünümüne uygunluğu doğrulanmalı.

## C) Kozmetik / terminoloji

9. **[D] URL hâlâ `/pipeline`.** Etiket "Veliler" ama adres `/pipeline`. `/veliler` olmalı (kozmetik).

10. **[D] "Bugünkü randevular" adı.** Yalnız bugünü gösteriyorsa ve kullanıcı yaklaşanları bekliyorsa isim yanıltıcı; "Yaklaşan randevular" + bugünü üste alma daha net olabilir (madde 2 ile bağlantılı).

11. **[G] Bugün blok sırası & yönetici/danışman farkı** ekranda net etiketlenmeli (hangi blok kime ait).

---

## Öncelik sırası (öneri)
1. **Veliler: Kanban → filtre-çip + tek sütun liste** (madde 1) — en görünür kazanç.
2. **Randevu erişimi** (madde 2, 10): Bugün'de "Yaklaşan randevular", Veliler'e "Randevu" filtresi/erişimi, Takvim'i sadeleştir/kolay erişilebilir yap.
3. **Lead detayı "Sonraki iş"** (madde 5) + randevu-durum bağı (madde 6).
4. **Ödemeler mobil kart** (madde 3).
5. Kozmetik (9, 10, 11).
