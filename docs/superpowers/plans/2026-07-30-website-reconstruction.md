# Şeker Anaokulu Web Sitesi Yeniden Yapılandırma Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mevcut Next.js sitesini, yıllık 250.000 TL ücret bandını haklı çıkaran, lead yakalayan ve ölçülebilir bir premium anaokulu platformuna dönüştürmek.

**Architecture:** Mevcut Next.js 15 App Router kod tabanı korunur; üzerine dört katman eklenir — (1) `lib/site.ts` tek doğruluk kaynağı ve `content/` altında veri-odaklı içerik dosyaları, (2) çalışan lead hattı (API route + e-posta + teşekkür sayfası + WhatsApp), (3) metadata/schema/sitemap SEO altyapısı, (4) premium tasarım dili (serif tipografi, lacivert-krem-altın paleti, geniş boşluk). Sayfalar JSX'e gömülü metin yerine `content/` veri dosyalarından beslenir; böylece içerik güncellemesi kod değişikliği gerektirmez.

**Tech Stack:** Next.js 15.3.1 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Vitest + Testing Library (yeni), Zod (yeni), Resend (yeni), next/font.

---

## Global Constraints

Bu kısıtlar **her task için geçerlidir**, tekrar edilmez:

- **Dil:** Tüm kullanıcıya görünen metin Türkçedir ve Türkçe karakterler (ı, İ, ş, ğ, ü, ö, ç) doğru kullanılır. "Bultenler" → "Bültenler", "Sikca" → "Sıkça".
- **NAP tek kaynak:** Ad, adres, telefon, e-posta **yalnızca** `lib/site.ts` içinde tanımlanır. Hiçbir bileşen bu değerleri hard-code etmez.
  - Ad: `Özel Şeker Anaokulu`
  - Adres: `Cumhuriyet Mahallesi, Uludağ Sokak No:6, Beykent, Büyükçekmece/İstanbul`
  - Telefon: `0530 101 88 75` / E.164: `+905301018875`
  - E-posta: `sekerakademi@gmail.com`
  - Kuruluş: `2011`
- **Marka adı:** Her yerde "Özel Şeker Anaokulu". "Şeker Akademi" yalnızca `alternateName` olarak schema'da geçer.
- **Konumlandırma:** Premium. `indirim`, `kampanya`, `uygun fiyat`, `bütçe dostu`, `fırsat` kelimeleri **hiçbir kullanıcıya görünen metinde kullanılmaz**. Bunun yerine: `kontenjan`, `ön görüşme`, `değerlendirme`, `ödeme planı`, `burs`.
- **Birincil CTA metni:** `Ön Görüşme Randevusu` — tüm sayfalarda aynı. İkincil: `WhatsApp'tan Yazın`.
- **Yaş aralığı: 2-6 yaş, DÖRT grup** — `2-3-yas`, `3-4-yas`, `4-5-yas`, `5-6-yas`.
  En küçük grubun görünen adı **"Oyun Grubu"**dur. `bebek` ve `0-2 yaş` kavramları
  geçmez (okul 2 yaşından önce kabul etmiyor), ancak `2-3 yaş` ve `oyun grubu`
  terimleri **kullanılmalıdır** — bunlar hedef arama kelimeleridir.
- **Sınıf mevcudu: 10 çocuk, 2 öğretmen, öğretmen başına 5 çocuk.** Bu rakamlar sabittir.
- **Ücret rakamı hiçbir sayfada yazılmaz.** `250.000`, `250 bin`, `₺` ile birlikte herhangi
  bir tutar, aylık/yıllık fiyat — hiçbiri kullanıcıya görünen metinde yer almaz.
  Ücret sorusunun tek cevabı ön görüşme davetidir.
- **İngilizce iddiası:** "Çocuklarımız mezun olduğunda İngilizce konuşuyor" — native
  öğretmen bu sonucun gerekçesi olarak ikinci sırada anılır, tek başına manşet yapılmaz.
- **Node/paket:** Yeni bağımlılık eklerken `npm install` kullanılır, sürüm sabitlenmez (caret).
- **Commit:** Her task sonunda tek commit, Türkçe olmayan conventional commit mesajı (`feat:`, `fix:`, `chore:`, `test:`).
- **Test komutu:** `npm test` (Vitest). Build doğrulaması: `npm run build`.
- **Gizli anahtarlar:** Hiçbir API anahtarı repoya yazılmaz. `.env.local` kullanılır, `.env.example` repoda tutulur.

---

## Stratejik Brief (uygulamadan önce oku)

### Fiyat–konumlandırma uyumsuzluğu — bu planın var oluş sebebi

| Bölge | Yıllık anaokulu ücret bandı |
|---|---|
| Beylikdüzü / Bahçelievler / Avcılar | 80.000 – 150.000 TL |
| Kadıköy / Üsküdar / Ataşehir | 120.000 – 250.000 TL |
| Prestijli bölgeler (Beşiktaş, Şişli, Sarıyer) | 150.000 – 300.000 TL |
| **Şeker Anaokulu (Beykent)** | **250.000 TL** |

250.000 TL, bulunduğu ilçenin bandının **tepesinde**, Kadıköy/Üsküdar bandının **üst sınırında** ve Bahçeşehir Koleji / MEV Koleji / Alman Liseliler Vakfı anaokullarının (200.000–350.000 TL tahmini bandı) **içinde**.

**Sonuç:** Rakip kümesi mahalle butikleri değil, ulusal zincir markalar. Mevcut site ise 80.000 TL'lik bir okul gibi görünüyor. Bu planın tek amacı bu boşluğu kapatmaktır.

**Hedef kitle coğrafyası** — mahalle değil, gelir segmenti hedefleyin:
- Alkent 2000, Pelican Hill, Toskana Vadisi (villa, üst gelir)
- Mimaroba, Sinanoba (orta-üst/üst)
- Beykent / Adnan Kahveci şerefiyeli siteler (m² 20.000 TL'ye çıkabiliyor)
- Bahçeşehir (orta-üst, çocuklu beyaz yaka)

### Rakip site analizi (gerçek incelemeler)

| | **Düş Bilginleri** (Beylikdüzü) | **Neşe Erberk** (Beylikdüzü) | **Nurtopu** (Beylikdüzü) | **Şeker (mevcut)** |
|---|---|---|---|---|
| Hero mesajı | "Erken Kayıt Dönemi Başladı" | "Eğitimi ciddiye alıyoruz, neş'e ile uyguluyoruz" | "Mutlu ve Öğrenen Çocuklar" | "Hoş Geldiniz!" ❌ |
| Fiyat | PDF liste indirilebilir | **Tamamen gizli** (premium sinyali) | "Uygun fiyat" ❌ | Yok |
| Kadro sayfası | ✅ 9 kişi, özgeçmişli | Kurucu mesajı | Sadece kurucu | ❌ |
| Günlük akış | ✅ 07:30–19:00 detaylı | ❌ | ❌ | ❌ |
| Veli yorumları | ✅ | ❌ | ❌ | ❌ |
| Tanıtım videosu | ✅ | ❌ | ❌ | ❌ |
| 360° sanal tur | ❌ | ❌ | ❌ | ❌ |
| WhatsApp | ❌ | ✅ | ❌ | ❌ |
| Form | ✅ | ✅ Ön kayıt | ❌ sadece telefon | ⚠️ **çalışmıyor** |
| Online randevu takvimi | ❌ | ❌ | ❌ | ❌ |
| İngilizce site | ✅ TR/EN | ❌ | ❌ | ❌ |
| Ölçek kanıtı | Kurumsal ortaklıklar (THY, Mercedes) | "49 Okul, 600 Öğretmen, 4500 Öğrenci" | "2009'dan beri" | ❌ |
| Güvenlik detayı | ✅ kamera, yangın, jeneratör | ❌ | ❌ | ❌ |
| Konumlandırma | Üst-orta, **fiyatla yarışıyor** | Premium (fiyat gizli) | Orta, değer eğitimi | Belirsiz |

**Pazardaki boşluklar — hiçbir rakipte yok, ilk yapan alır:**
1. 360°/video sanal tur
2. Takvimden saat seçmeli online randevu
3. Site içinde gerçek Google yorumu entegrasyonu
4. Gerçekten lüks görsel dil (hepsi renkli-kalabalık "çocuk clipart" estetiğinde)
5. Öğretmen başına düşen çocuk sayısının açıkça ilan edilmesi

**En kritik rekabet kararı:** Düş Bilginleri "bütçenize dost" diyerek fiyatla yarışıyor. Şeker 250.000 TL ile bu savaşa **giremez ve girmemelidir**. Farklılaşma ekseni: seçicilik, öğretmen niteliği, düşük mevcut, 15 yıllık süreklilik.

### Keyword haritası → sayfa eşlemesi

Her hedef sayfa, belirli bir arama kümesini karşılar. Bu tablo Task 12–18'in içerik yazımını yönlendirir.

| Sayfa | Birincil keyword | İkincil keywordler | Niyet | Rekabet |
|---|---|---|---|---|
| `/` | beykent anaokulu | özel anaokulu beykent, beykent kreş | Ticari | Yüksek |
| `/egitim-yaklasimimiz` | montessori anaokulu beykent | high scope anaokulu, çoklu zeka anaokulu, reggio emilia anaokulu istanbul, oyun temelli eğitim | Ticari+Bilgi | Orta |
| `/yas-gruplari/2-3-yas` | beylikdüzü oyun grubu | 2 yaş kreş beykent, 2-3 yaş oyun grubu, 2 yaş anaokulu büyükçekmece | Ticari | Orta |
| `/yas-gruplari/3-4-yas` | 3 yaş anaokulu beykent | 3 yaş çocuk için kreş büyükçekmece | Ticari | Orta |
| `/yas-gruplari/4-5-yas` | 4 yaş anaokulu beylikdüzü | 4-5 yaş okul öncesi eğitim | Ticari | Orta |
| `/yas-gruplari/5-6-yas` | 5 yaş hazırlık sınıfı | ilkokula hazırlık sınıfı bahçeşehir | Ticari+Bilgi | Orta |
| `/kadromuz` | anaokulu öğretmen kadrosu | deneyimli anaokulu öğretmeni beykent | Bilgi | Düşük |
| `/gunluk-akis` | anaokulu günlük program | anaokulunda bir gün nasıl geçer | Bilgi | Düşük |
| `/guvenlik` | kameralı anaokulu beykent | güvenli anaokulu, bahçeli anaokulu, servisli anaokulu | Ticari | Düşük |
| `/ucretler` | beykent anaokulu fiyatları | özel anaokulu ücretleri büyükçekmece, montessori anaokulu fiyatları | Ticari→İşlem | Orta |
| `/veli-yorumlari` | beykent anaokulu yorumları | anaokulu tavsiye beylikdüzü, en iyi anaokulu büyükçekmece | Ticari | Orta |
| `/kayit` | anaokulu kayıt beykent | anaokulu ön kayıt, 2026 2027 anaokulu kayıtları | İşlem | Düşük |
| `/blog/*` | anaokulu uyum süreci | anaokuluna ne zaman başlamalı, ayrılık kaygısı | Bilgi | Düşük |

**Negatif alan (bu kelimeler için içerik ÜRETİLMEZ):** ücretsiz anaokulu, devlet anaokulu, MEB atama, iş ilanı, öğretmen alımı, anaokulu şarkıları, boyama sayfası.

### ✅ Okul yönetimi kararları (2026-07-30 — BAĞLAYICI)

Bu dört karar okul yönetimi tarafından verildi. Plan boyunca bağlayıcıdır ve
her task'ın gereksinimlerine dahildir:

1. **Yaş aralığı: 2 yaştan 5 yaşın sonuna kadar** — sitede `2-6 yaş` olarak yazılır
   (Türkiye'de yaygın gösterim). **Dört** yaş grubu vardır:
   `2-3-yas`, `3-4-yas`, `4-5-yas`, `5-6-yas`.
   En küçük grup sitede **"Oyun Grubu"** olarak adlandırılır — bu terim Türkiye'de
   bu yaş için en çok aranan kelimedir (`beylikdüzü oyun grubu`, `2-3 yaş oyun grubu`).
   Dizinlerdeki "0-2" ve "6+" kayıtları geçersizdir ve düzeltilecektir.

   > ⚠️ **DÜZELTME GEÇMİŞİ (2026-07-30):** Bu karar bir kez ters yönde uygulandı.
   > İlk bilgi "3-6 yaş, üç grup" idi ve Task 1-7 bu varsayımla yazıldı; okul
   > yönetimi sonradan aralığın 2 yaştan başladığını bildirdi. Task 8a bu hatayı
   > geri alır. `2-3 yaş` ve `oyun grubu` terimleri artık **yasaklı değil, zorunludur**.
2. **Sınıf mevcudu: 10 çocuk, 2 öğretmen.** Öğretmen başına **5 çocuk** düşer.
3. **Ücret sitede GÖSTERİLMEZ.** Hiçbir sayfada rakam yer almaz. Ücret yalnızca ön
   görüşmede paylaşılır.
4. **İngilizce: native öğretmen mevcut. Çocuklar mezun olduğunda İngilizce konuşuyor.**

#### Karar 2 hakkında — bu rakam olağanüstüdür, buna göre kullanın

MEB okul öncesi yönetmeliğine göre 4 yaş üstü sınıflarda öğretmen başına 20 çocuğa
kadar izin verilir. **1:5 oranı bu üst sınırın dörtte biridir** ve 250.000 TL
ücretin tek başına en güçlü gerekçesidir.

Bu yüzden sitede pasif bir "sınıf mevcudumuz 10 kişidir" cümlesi olarak **değil**,
tekrar eden ve karşılaştırmalı bir iddia olarak kullanılır:
- `TrustBar`: `10 çocuk` / `Sınıf mevcudu` ve `1 : 5` / `Öğretmen başına çocuk`
- Hero alt metni, `FeaturesSection` birinci farklılaştırıcı
- Her yaş grubu sayfasında `classSize` alanı
- `/ucretler` sayfasının ana argümanı

#### Karar 4 hakkında — çıktı odaklı ifade edin

"Native öğretmenimiz var" bir özelliktir; **"çocuklar mezun olduğunda İngilizce
konuşuyor" bir sonuçtur.** Yüksek gelirli veliler çıktı satın alır. Metinlerde
daima sonuç önce, özellik sonra gelir.

#### Karar 3 hakkında — kabul edilmiş maliyet ve telafisi

Bölge bandı 80.000–150.000 TL iken 250.000 TL ücretle rakam vermemek, görüşmeye
gelen lead'lerin bir kısmının fiyatı duyunca çekilmesine yol açar; nitelik
filtrelemesi siteden satış görüşmesine kayar. Bu bilinçli bir tercihtir.

Planda iki telafi mekanizması vardır:
- `/ucretler` sayfası rakam vermeden **beklenti kurar** ve ücreti belirleyen
  unsurları anlatır (bkz. Task 14).
- `LeadForm` yaş grubu, program ve başlangıç dönemi sorarak görüşme öncesi nitelik
  sinyali toplar (bkz. Task 2-3).

---

## File Structure

### Yeni dosyalar

| Dosya | Sorumluluk |
|---|---|
| `lib/site.ts` | NAP, saatler, sosyal linkler, coğrafi koordinat — tek doğruluk kaynağı |
| `lib/metadata.ts` | `buildMetadata()` — canonical + OG + Twitter üreten tek fonksiyon |
| `lib/schema.ts` | *(yeniden yazılır)* `preschoolSchema`, `buildFaqSchema()`, `buildBreadcrumbSchema()` |
| `lib/analytics.ts` | `trackEvent()` — dataLayer'a tip güvenli olay gönderimi |
| `content/ageGroups.ts` | 4 yaş grubunun tüm içeriği (tek kaynak, 4 sayfayı besler) |
| `content/teachers.ts` | Öğretmen kadrosu verisi |
| `content/faq.ts` | SSS verisi — hem `/sss` sayfasını hem FAQPage schema'yı besler |
| `content/testimonials.ts` | Veli yorumları |
| `content/dailyFlow.ts` | Günlük akış saatleri |
| `app/api/lead/route.ts` | Lead alma, doğrulama, e-posta gönderme |
| `app/tesekkurler/page.tsx` | Dönüşüm ölçüm sayfası (noindex) |
| `app/sitemap.ts` | Next.js native sitemap (bozuk script'in yerine) |
| `app/robots.ts` | Next.js native robots.txt |
| `app/components/WhatsAppButton.tsx` | Sabit yüzen WhatsApp butonu |
| `app/components/MobileActionBar.tsx` | Mobil alt bar: Ara / WhatsApp / Randevu |
| `app/components/TrustBar.tsx` | Güven şeridi (yıl, mevcut, oran, puan) |
| `app/components/LeadForm.tsx` | Çalışan, nitelik filtreleyen form (ContactForm yerine) |
| `app/components/Analytics.tsx` | GTM script enjeksiyonu |
| `app/components/JsonLd.tsx` | Schema enjeksiyonu için tekrar kullanılabilir bileşen |
| `app/yas-gruplari/[slug]/page.tsx` | Dinamik yaş grubu sayfaları |
| `app/kadromuz/page.tsx` | Öğretmen kadrosu |
| `app/egitim-yaklasimimiz/page.tsx` | Pedagoji |
| `app/gunluk-akis/page.tsx` | Günlük akış |
| `app/guvenlik/page.tsx` | Güvenlik & sağlık |
| `app/ucretler/page.tsx` | Ücret bandı + burs + ödeme |
| `app/veli-yorumlari/page.tsx` | Sosyal kanıt |
| `app/kayit/page.tsx` | Ana dönüşüm sayfası |
| `scripts/optimize-images.mjs` | Görselleri WebP'ye çeviren tek seferlik script |
| `vitest.config.ts` | Test yapılandırması |
| `.env.example` | Gerekli ortam değişkenleri şablonu |

### Değiştirilen dosyalar

| Dosya | Değişiklik |
|---|---|
| `app/layout.tsx` | `lang="tr"`, keywords silinir, font değişir, Analytics + JsonLd + WhatsAppButton eklenir |
| `app/globals.css` | Premium tasarım tokenları |
| `app/components/Header.tsx` | Yeni menü yapısı, Türkçe karakterler, premium CTA |
| `app/components/HeroSection.tsx` | Yeniden yazılır — değer önerisi + konum + yaş |
| `app/components/Footer.tsx` | `lib/site.ts`'ten beslenir, yıl dinamik, gerçek sosyal linkler |
| `app/components/ContactInfo.tsx` | `tel:`/`mailto:`/harita linkleri |
| `app/components/SocialMediaLinks.tsx` | Gerçek URL'ler `lib/site.ts`'ten |
| `app/components/FAQSection.tsx` | `content/faq.ts`'ten beslenir |
| `next.config.ts` | ESLint bypass kaldırılır, görsel formatları |
| `package.json` | Test script'leri, bozuk postbuild kaldırılır |

### Silinen dosyalar

| Dosya | Sebep |
|---|---|
| `app/admin/page.tsx` + `app/admin/components/` | Çalışmayan, kimlik doğrulamasız sahte login |
| `app/components/ContactForm.tsx` | `LeadForm.tsx` ile değiştirilir |
| `scripts/generate-sitemap.js` | `app/sitemap.ts` ile değiştirilir |
| `public/logo.pdf` | Web'de kullanılmıyor |

---

# FAZ 0 — TEMEL

### Task 1: Test altyapısı ve proje yapılandırma düzeltmeleri

**Files:**
- Create: `vitest.config.ts`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `next.config.ts`
- Modify: `app/layout.tsx:56` (`lang` özniteliği), `app/layout.tsx:19-52` (keywords bloğu)
- Delete: `scripts/generate-sitemap.js`
- Test: `lib/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: yok (ilk task)
- Produces: `npm test` komutu çalışır durumda; sonraki tüm task'lar buna dayanır.

- [ ] **Step 1: Test bağımlılıklarını kur**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npm install zod
```

- [ ] **Step 2: `vitest.config.ts` oluştur**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 3: Başarısız olacak smoke testi yaz**

`lib/__tests__/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SITE } from '../site';

describe('test altyapısı', () => {
  it('site sabitlerini yükleyebilir', () => {
    expect(SITE.name).toBe('Özel Şeker Anaokulu');
  });
});
```

- [ ] **Step 4: `package.json` script'lerini güncelle**

`scripts` bloğunu şununla değiştir (bozuk `postbuild` kaldırılıyor):

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test`
Expected: FAIL — `Cannot find module '../site'`

- [ ] **Step 6: `lib/site.ts` oluştur**

```typescript
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
  address: {
    street: 'Cumhuriyet Mahallesi, Uludağ Sokak No:6',
    district: 'Beykent, Büyükçekmece',
    city: 'İstanbul',
    postalCode: '34500', // TODO: doğrula
    country: 'TR',
  },
  geo: {
    // TODO: Google Maps'ten gerçek koordinatı al
    latitude: 41.0082,
    longitude: 28.6389,
  },
  mapsUrl: 'https://maps.google.com/?q=Cumhuriyet+Mahallesi+Uludağ+Sokak+No:6+Beykent+Büyükçekmece',
  hours: { opens: '07:15', closes: '19:15' },
  areaServed: ['Beykent', 'Büyükçekmece', 'Beylikdüzü', 'Bahçeşehir', 'Esenyurt', 'Avcılar'],
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
```

- [ ] **Step 7: Testi çalıştır, geçtiğini doğrula**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: `app/layout.tsx` içinde `lang` düzelt ve keywords sil**

`lang="en"` → `lang="tr"`. `metadata` nesnesindeki **tüm `keywords` bloğunu** (19-52. satırlar) sil. Google 2009'dan beri bu etiketi yok sayıyor; ayrıca rakiplere hedef kelime listenizi veriyor.

- [ ] **Step 9: `next.config.ts` düzelt**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
```

Not: `ignoreDuringBuilds` kaldırıldı ve dosya `module.exports` yerine ESM `export default` kullanıyor (dosya uzantısı `.ts`, önceki hâli tutarsızdı).

- [ ] **Step 10: `.env.example` oluştur**

```bash
# Lead e-postalarını göndermek için (https://resend.com)
RESEND_API_KEY=
LEAD_NOTIFICATION_EMAIL=sekerakademi@gmail.com

# Google Tag Manager konteyner kimliği
NEXT_PUBLIC_GTM_ID=
```

- [ ] **Step 11: Bozuk sitemap script'ini sil**

```bash
git rm scripts/generate-sitemap.js
```

- [ ] **Step 12: Build'in geçtiğini doğrula**

Run: `npm run build`
Expected: Başarılı derleme, ESLint hatası yok. Hata varsa düzelt — bu, `ignoreDuringBuilds` ile gizlenen mevcut hataları ortaya çıkarır.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: add vitest, site constants, fix lang and build config"
```

---

# FAZ 1 — LEAD YAKALAMA (gelir-kritik)

### Task 2: Lead API route'u ve doğrulama

**Files:**
- Create: `lib/leadSchema.ts`
- Create: `app/api/lead/route.ts`
- Test: `lib/__tests__/leadSchema.test.ts`

**Interfaces:**
- Consumes: `SITE` (`lib/site.ts`)
- Produces:
  - `leadSchema` — Zod şeması
  - `type Lead = z.infer<typeof leadSchema>`
  - `POST /api/lead` → `200 {ok: true}` | `400 {ok: false, errors: Record<string,string[]>}` | `500 {ok: false, message: string}`

- [ ] **Step 1: Başarısız olacak testi yaz**

`lib/__tests__/leadSchema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { leadSchema } from '../leadSchema';

const valid = {
  parentName: 'Ayşe Yılmaz',
  phone: '05301018875',
  email: 'ayse@example.com',
  childAge: '3-4',
  program: 'tam-gun',
  startTerm: '2026-2027',
  message: 'Bilgi almak istiyorum',
  kvkkConsent: true,
};

describe('leadSchema', () => {
  it('geçerli bir lead kabul eder', () => {
    expect(leadSchema.safeParse(valid).success).toBe(true);
  });

  it('KVKK onayı olmadan reddeder', () => {
    const r = leadSchema.safeParse({ ...valid, kvkkConsent: false });
    expect(r.success).toBe(false);
  });

  it('kısa telefon numarasını reddeder', () => {
    const r = leadSchema.safeParse({ ...valid, phone: '123' });
    expect(r.success).toBe(false);
  });

  it('telefondaki boşluk ve parantezleri temizler', () => {
    const r = leadSchema.safeParse({ ...valid, phone: '(0530) 101 88 75' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe('05301018875');
  });

  it('e-posta boş bırakılabilir', () => {
    const r = leadSchema.safeParse({ ...valid, email: '' });
    expect(r.success).toBe(true);
  });

  it('geçersiz yaş grubunu reddeder', () => {
    const r = leadSchema.safeParse({ ...valid, childAge: '15-16' });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test`
Expected: FAIL — `Cannot find module '../leadSchema'`

- [ ] **Step 3: `lib/leadSchema.ts` yaz**

```typescript
import { z } from 'zod';

export const AGE_GROUPS = ['2-3', '3-4', '4-5', '5-6'] as const;
export const PROGRAMS = ['tam-gun', 'yarim-gun', 'oyun-grubu', 'yaz-okulu'] as const;

export const leadSchema = z.object({
  parentName: z.string().trim().min(2, 'Ad soyad en az 2 karakter olmalı').max(80),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s()\-+]/g, ''))
    .pipe(z.string().regex(/^\d{10,13}$/, 'Geçerli bir telefon numarası girin')),
  email: z.union([z.literal(''), z.string().email('Geçerli bir e-posta girin')]),
  childAge: z.enum(AGE_GROUPS, { message: 'Yaş grubu seçin' }),
  program: z.enum(PROGRAMS, { message: 'Program seçin' }),
  startTerm: z.string().trim().min(1, 'Başlangıç dönemi seçin').max(20),
  message: z.string().trim().max(1000).optional().default(''),
  kvkkConsent: z.literal(true, { message: 'Devam etmek için aydınlatma metnini onaylayın' }),
});

export type Lead = z.infer<typeof leadSchema>;
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm test`
Expected: PASS (6 test)

- [ ] **Step 5: Resend kur**

```bash
npm install resend
```

- [ ] **Step 6: `app/api/lead/route.ts` yaz**

```typescript
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { leadSchema } from '@/lib/leadSchema';
import { SITE } from '@/lib/site';

export const runtime = 'nodejs';

const PROGRAM_LABELS: Record<string, string> = {
  'tam-gun': 'Tam Gün',
  'yarim-gun': 'Yarım Gün',
  'oyun-grubu': 'Oyun Grubu (2-3 yaş)',
  'yaz-okulu': 'Yaz Okulu',
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Geçersiz istek' }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const lead = parsed.data;
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFICATION_EMAIL ?? SITE.email;

  // Anahtar yoksa lead'i kaybetme — logla ve başarı dön.
  if (!apiKey) {
    console.warn('[lead] RESEND_API_KEY tanımsız, lead yalnızca loglandı:', lead);
    return NextResponse.json({ ok: true });
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: 'Şeker Anaokulu Web <onboarding@resend.dev>', // TODO: doğrulanmış alan adıyla değiştir
      to,
      replyTo: lead.email || undefined,
      subject: `Yeni ön görüşme talebi — ${lead.parentName} (${lead.childAge} yaş)`,
      text: [
        `Veli: ${lead.parentName}`,
        `Telefon: ${lead.phone}`,
        `E-posta: ${lead.email || '—'}`,
        `Çocuk yaş grubu: ${lead.childAge}`,
        `Program: ${PROGRAM_LABELS[lead.program] ?? lead.program}`,
        `Başlangıç dönemi: ${lead.startTerm}`,
        '',
        `Mesaj: ${lead.message || '—'}`,
        '',
        `⏱ Hedef yanıt süresi: 15 dakika`,
      ].join('\n'),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[lead] e-posta gönderilemedi:', error, lead);
    return NextResponse.json(
      { ok: false, message: 'Talebiniz alınamadı, lütfen telefonla ulaşın.' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 7: TypeScript yolunu doğrula**

`tsconfig.json` içinde `"@/*": ["./*"]` path alias'ının tanımlı olduğunu kontrol et. Yoksa `compilerOptions.paths` altına ekle.

Run: `npm run build`
Expected: Başarılı

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add lead capture API with zod validation"
```

---

### Task 3: Çalışan lead formu ve teşekkür sayfası

**Files:**
- Create: `app/components/LeadForm.tsx`
- Create: `app/tesekkurler/page.tsx`
- Modify: `app/components/ContactSection.tsx`
- Delete: `app/components/ContactForm.tsx`

**Interfaces:**
- Consumes: `leadSchema`, `AGE_GROUPS`, `PROGRAMS` (`lib/leadSchema.ts`); `POST /api/lead`
- Produces: `<LeadForm variant="full" | "compact" />` — her sayfada kullanılabilir

- [ ] **Step 1: `app/components/LeadForm.tsx` yaz**

Kritik: mevcut form 5 alan soruyordu ve hiçbiri lead'i nitelemiyordu. Yeni form premium segmentte **nitelik filtreliyor** — yaş grubu ve program, satış görüşmesine hazırlık verisi.

```tsx
'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AGE_GROUPS, PROGRAMS } from '@/lib/leadSchema';

const PROGRAM_LABELS: Record<(typeof PROGRAMS)[number], string> = {
  'tam-gun': 'Tam Gün',
  'yarim-gun': 'Yarım Gün',
  'oyun-grubu': 'Oyun Grubu (2-3 yaş)',
  'yaz-okulu': 'Yaz Okulu',
};

type FieldErrors = Partial<Record<string, string[]>>;

export default function LeadForm({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError('');

    const data = new FormData(event.currentTarget);
    const payload = {
      parentName: String(data.get('parentName') ?? ''),
      phone: String(data.get('phone') ?? ''),
      email: String(data.get('email') ?? ''),
      childAge: String(data.get('childAge') ?? ''),
      program: String(data.get('program') ?? ''),
      startTerm: String(data.get('startTerm') ?? ''),
      message: String(data.get('message') ?? ''),
      kvkkConsent: data.get('kvkkConsent') === 'on',
    };

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setErrors(result.errors ?? {});
        setFormError(result.message ?? 'Lütfen işaretli alanları kontrol edin.');
        return;
      }

      window.dataLayer?.push({ event: 'lead_submit', child_age: payload.childAge });
      router.push('/tesekkurler');
    } catch {
      setFormError('Bağlantı hatası. Lütfen telefonla ulaşın.');
    } finally {
      setSubmitting(false);
    }
  }

  const field = 'w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-navy-900 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600';
  const label = 'mb-1.5 block text-sm font-medium text-navy-800';
  const err = (name: string) =>
    errors[name] ? <p className="mt-1 text-sm text-red-600">{errors[name]![0]}</p> : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="parentName" className={label}>Adınız Soyadınız *</label>
          <input id="parentName" name="parentName" className={field} required />
          {err('parentName')}
        </div>
        <div>
          <label htmlFor="phone" className={label}>Telefon *</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" placeholder="05XX XXX XX XX" className={field} required />
          {err('phone')}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="childAge" className={label}>Çocuğunuzun yaş grubu *</label>
          <select id="childAge" name="childAge" className={field} required defaultValue="">
            <option value="" disabled>Seçiniz</option>
            {AGE_GROUPS.map((age) => (
              <option key={age} value={age}>{age} yaş</option>
            ))}
          </select>
          {err('childAge')}
        </div>
        <div>
          <label htmlFor="program" className={label}>İlgilendiğiniz program *</label>
          <select id="program" name="program" className={field} required defaultValue="">
            <option value="" disabled>Seçiniz</option>
            {PROGRAMS.map((program) => (
              <option key={program} value={program}>{PROGRAM_LABELS[program]}</option>
            ))}
          </select>
          {err('program')}
        </div>
      </div>

      <div>
        <label htmlFor="startTerm" className={label}>Başlamayı düşündüğünüz dönem *</label>
        <select id="startTerm" name="startTerm" className={field} required defaultValue="">
          <option value="" disabled>Seçiniz</option>
          <option value="2026-2027">2026-2027 eğitim yılı</option>
          <option value="donem-ici">Dönem içi</option>
          <option value="yaz-2027">2027 yaz dönemi</option>
          <option value="arastiriyorum">Henüz araştırma aşamasındayım</option>
        </select>
        {err('startTerm')}
      </div>

      {variant === 'full' && (
        <div>
          <label htmlFor="email" className={label}>E-posta</label>
          <input id="email" name="email" type="email" className={field} />
          {err('email')}
        </div>
      )}

      {variant === 'full' && (
        <div>
          <label htmlFor="message" className={label}>Eklemek istedikleriniz</label>
          <textarea id="message" name="message" rows={4} className={field} />
        </div>
      )}

      <label className="flex items-start gap-3 text-sm text-navy-700">
        <input type="checkbox" name="kvkkConsent" required className="mt-1 h-4 w-4" />
        <span>
          <a href="/gizlilik" className="underline">KVKK Aydınlatma Metni</a>'ni okudum, iletişim
          kurulmasına onay veriyorum. *
        </span>
      </label>
      {err('kvkkConsent')}

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-navy-900 px-8 py-4 font-medium text-white transition hover:bg-navy-800 disabled:opacity-60"
      >
        {submitting ? 'Gönderiliyor…' : 'Ön Görüşme Randevusu'}
      </button>

      <p className="text-center text-sm text-navy-600">
        Talebinize ortalama <strong>15 dakika</strong> içinde dönüş yapıyoruz.
      </p>
    </form>
  );
}
```

- [ ] **Step 2: `dataLayer` için tip tanımı ekle**

`lib/analytics.ts` (Task 5'te genişletilecek, şimdilik sadece global tip):

```typescript
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}
export {};
```

- [ ] **Step 3: `app/tesekkurler/page.tsx` oluştur**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '../components/Header';
import { SITE, WHATSAPP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Talebiniz Alındı',
  robots: { index: false, follow: false },
};

export default function TesekkurlerPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl text-navy-900">Talebiniz bize ulaştı.</h1>
        <p className="mt-6 text-lg text-navy-700">
          Okul yönetimimiz en geç <strong>15 dakika</strong> içinde sizi arayacak ve ön görüşme
          randevunuzu birlikte planlayacağız.
        </p>
        <p className="mt-4 text-navy-700">
          Acele bir sorunuz varsa doğrudan ulaşabilirsiniz:
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <a href={`tel:${SITE.phone.e164}`} className="rounded-full bg-navy-900 px-8 py-4 text-white">
            {SITE.phone.display}
          </a>
          <a href={WHATSAPP_URL} className="rounded-full border border-navy-900 px-8 py-4 text-navy-900">
            WhatsApp'tan Yazın
          </a>
        </div>
        <Link href="/" className="mt-10 inline-block text-navy-600 underline">
          Ana sayfaya dön
        </Link>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: `ContactSection.tsx` içinde formu değiştir**

`import ContactForm from './ContactForm'` → `import LeadForm from './LeadForm'`, JSX'te `<ContactForm />` → `<LeadForm variant="full" />`. Bölüm başlığını da güncelle: "Bize Ulaşın" → "Ön Görüşme Randevusu Alın".

- [ ] **Step 5: Eski formu sil**

```bash
git rm app/components/ContactForm.tsx
```

- [ ] **Step 6: Uçtan uca elle doğrula**

```bash
npm run dev
```
- `/iletisim` sayfasını aç
- Formu **eksik** doldur → alan altında Türkçe hata mesajları görünmeli
- Formu **tam** doldur, KVKK kutusunu işaretle → `/tesekkurler` sayfasına yönlendirmeli
- Terminal loglarında `[lead] RESEND_API_KEY tanımsız, lead yalnızca loglandı:` satırını ve lead verisini gör (anahtar henüz yok — beklenen davranış, veri kaybolmuyor)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: replace dead contact form with working qualified lead form"
```

---

### Task 4: WhatsApp, tıklanabilir telefon ve mobil aksiyon barı

**Files:**
- Create: `app/components/WhatsAppButton.tsx`
- Create: `app/components/MobileActionBar.tsx`
- Modify: `app/components/ContactInfo.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `SITE`, `WHATSAPP_URL` (`lib/site.ts`)
- Produces: `<WhatsAppButton />`, `<MobileActionBar />` — layout'ta global olarak render edilir

- [ ] **Step 1: `app/components/WhatsAppButton.tsx` yaz**

```tsx
'use client';
import { WHATSAPP_URL } from '@/lib/site';

export default function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp'tan yazın"
      onClick={() => window.dataLayer?.push({ event: 'whatsapp_click', location: 'float' })}
      className="fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition hover:scale-105 md:bottom-6"
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.898 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
      </svg>
    </a>
  );
}
```

- [ ] **Step 2: `app/components/MobileActionBar.tsx` yaz**

Mobilde ekranın altına sabitlenmiş üç aksiyon — dönüşümün en büyük tek kaldıracı.

```tsx
'use client';
import Link from 'next/link';
import { SITE, WHATSAPP_URL } from '@/lib/site';

export default function MobileActionBar() {
  const track = (event: string) => () => window.dataLayer?.push({ event, location: 'mobile_bar' });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-3 border-t border-navy-100 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.08)] md:hidden">
      <a
        href={`tel:${SITE.phone.e164}`}
        onClick={track('tel_click')}
        className="py-3.5 text-center text-sm font-medium text-navy-900"
      >
        Ara
      </a>
      <a
        href={WHATSAPP_URL}
        onClick={track('whatsapp_click')}
        className="border-x border-navy-100 py-3.5 text-center text-sm font-medium text-navy-900"
      >
        WhatsApp
      </a>
      <Link
        href="/kayit"
        onClick={track('cta_click')}
        className="bg-navy-900 py-3.5 text-center text-sm font-medium text-white"
      >
        Randevu
      </Link>
    </nav>
  );
}
```

- [ ] **Step 3: `ContactInfo.tsx` içindeki değerleri tıklanabilir yap**

`contactItems` dizisine her öğe için `href` alanı ekle ve `lib/site.ts`'ten besle:

```tsx
// interface'e ekle:
href: string

// telefon öğesi:
value: SITE.phone.display,
href: `tel:${SITE.phone.e164}`,

// e-posta öğesi:
value: SITE.email,
href: `mailto:${SITE.email}`,

// adres öğesi:
value: `${SITE.address.street}\n${SITE.address.district}/${SITE.address.city}`,
href: SITE.mapsUrl,
```

Render kısmında `<p>{item.value}</p>` yerine:

```tsx
<a href={item.href} className="text-gray-600 whitespace-pre-line hover:underline">
  {item.value}
</a>
```

Dosyanın en üstüne `import { SITE } from '@/lib/site'` ekle.

- [ ] **Step 4: Global bileşenleri `layout.tsx`'e ekle**

`<Footer />` satırından sonra:

```tsx
<WhatsAppButton />
<MobileActionBar />
```

Import'ları ekle. Ayrıca mobil barın içeriği örtmemesi için `<body>` className'ine `pb-14 md:pb-0` ekle.

- [ ] **Step 5: Elle doğrula**

```bash
npm run dev
```
- Masaüstü: sağ altta WhatsApp butonu, mobil bar görünmüyor
- Mobil görünüm (DevTools, 375px): alt bar görünüyor, WhatsApp butonu barın üstünde
- `/iletisim`: telefona tıkla → arama başlatma diyalogu; adrese tıkla → Google Maps açılıyor

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add whatsapp button, mobile action bar, clickable contact info"
```

---

# FAZ 2 — ÖLÇÜM

### Task 5: Google Tag Manager ve olay izleme

**Files:**
- Modify: `lib/analytics.ts`
- Create: `app/components/Analytics.tsx`
- Modify: `app/layout.tsx`
- Test: `lib/__tests__/analytics.test.ts`

**Interfaces:**
- Consumes: `window.dataLayer`
- Produces: `trackEvent(name: TrackedEvent, payload?: Record<string, unknown>): void`

- [ ] **Step 1: Başarısız olacak testi yaz**

`lib/__tests__/analytics.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { trackEvent } from '../analytics';

describe('trackEvent', () => {
  beforeEach(() => {
    window.dataLayer = [];
  });

  it('olayı dataLayer\'a gönderir', () => {
    trackEvent('lead_submit', { child_age: '3-4' });
    expect(window.dataLayer).toEqual([{ event: 'lead_submit', child_age: '3-4' }]);
  });

  it('payload olmadan çalışır', () => {
    trackEvent('whatsapp_click');
    expect(window.dataLayer).toEqual([{ event: 'whatsapp_click' }]);
  });

  it('dataLayer tanımsızsa hata fırlatmaz', () => {
    delete window.dataLayer;
    expect(() => trackEvent('tel_click')).not.toThrow();
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test`
Expected: FAIL — `trackEvent is not a function`

- [ ] **Step 3: `lib/analytics.ts` yaz**

```typescript
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export const TRACKED_EVENTS = [
  'lead_submit',
  'whatsapp_click',
  'tel_click',
  'cta_click',
  'tour_request',
  'pricing_view',
] as const;

export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

export function trackEvent(name: TrackedEvent, payload: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined' || !window.dataLayer) return;
  window.dataLayer.push({ event: name, ...payload });
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: `app/components/Analytics.tsx` yaz**

```tsx
import Script from 'next/script';

export default function Analytics() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  if (!gtmId) return null;

  return (
    <Script id="gtm" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
    </Script>
  );
}
```

- [ ] **Step 6: Layout'a ekle ve bileşenleri `trackEvent`'e geçir**

`layout.tsx` içinde `<body>` başına `<Analytics />` ekle.

`WhatsAppButton.tsx` ve `MobileActionBar.tsx` içindeki ham `window.dataLayer?.push({...})` çağrılarını `trackEvent('whatsapp_click', { location: 'float' })` biçimine çevir. `LeadForm.tsx` içindeki `window.dataLayer?.push({ event: 'lead_submit', ... })` → `trackEvent('lead_submit', { child_age: payload.childAge })`.

- [ ] **Step 7: Doğrula**

```bash
npm test && npm run build
```
Expected: Testler geçer, build başarılı. `NEXT_PUBLIC_GTM_ID` tanımsızken `<Analytics />` hiçbir şey render etmez — build kırılmaz.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add GTM integration and typed event tracking"
```

---

# FAZ 3 — SEO ALTYAPISI

### Task 6: Metadata sistemi

**Files:**
- Create: `lib/metadata.ts`
- Modify: `app/layout.tsx`
- Test: `lib/__tests__/metadata.test.ts`

**Interfaces:**
- Consumes: `SITE`
- Produces: `buildMetadata({ title, description, path, image?, noindex? }): Metadata` — Task 12–18'deki her sayfa bunu kullanır

- [ ] **Step 1: Başarısız olacak testi yaz**

`lib/__tests__/metadata.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildMetadata } from '../metadata';

describe('buildMetadata', () => {
  const meta = buildMetadata({
    title: 'Ücretler',
    description: 'Şeffaf ücret bilgisi.',
    path: '/ucretler',
  });

  it('başlığa marka son ekini ekler', () => {
    expect(meta.title).toBe('Ücretler | Özel Şeker Anaokulu');
  });

  it('canonical URL üretir', () => {
    expect(meta.alternates?.canonical).toBe('https://sekeranaokulu.com/ucretler');
  });

  it('OpenGraph verisi üretir', () => {
    expect(meta.openGraph?.url).toBe('https://sekeranaokulu.com/ucretler');
    expect(meta.openGraph?.locale).toBe('tr_TR');
  });

  it('ana sayfada çift marka adı kullanmaz', () => {
    const home = buildMetadata({ title: 'Özel Şeker Anaokulu', description: 'x', path: '/' });
    expect(home.title).toBe('Özel Şeker Anaokulu');
  });

  it('noindex bayrağına uyar', () => {
    const hidden = buildMetadata({ title: 'X', description: 'y', path: '/z', noindex: true });
    expect(hidden.robots).toEqual({ index: false, follow: false });
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: `lib/metadata.ts` yaz**

```typescript
import type { Metadata } from 'next';
import { SITE } from './site';

export function buildMetadata({
  title,
  description,
  path,
  image = '/og-default.jpg',
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noindex?: boolean;
}): Metadata {
  const url = `${SITE.url}${path === '/' ? '' : path}`;
  const fullTitle = title === SITE.name ? title : `${title} | ${SITE.name}`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE.name,
      locale: 'tr_TR',
      type: 'website',
      images: [{ url: `${SITE.url}${image}`, width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [`${SITE.url}${image}`],
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm test`
Expected: PASS (5 test)

- [ ] **Step 5: `layout.tsx` metadata'sını `buildMetadata` ile değiştir**

```tsx
export const metadata: Metadata = {
  ...buildMetadata({
    title: SITE.name,
    description: SITE.description,
    path: '/',
  }),
  metadataBase: new URL(SITE.url),
};
```

- [ ] **Step 6: OG görselini oluştur**

`public/og-default.jpg` — 1200×630px. Okulun en iyi dış cephe veya sınıf fotoğrafı + logo + "Beykent • 2011'den beri" metni. Bu görsel WhatsApp'ta link paylaşıldığında görünür ve veli gruplarında en çok paylaşılan varlıktır.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add metadata builder with canonical and OG support"
```

---

### Task 7: Yapısal veri (Preschool + FAQPage schema)

**Files:**
- Modify: `lib/schema.ts` *(tamamen yeniden yazılır)*
- Create: `app/components/JsonLd.tsx`
- Create: `content/faq.ts`
- Modify: `app/layout.tsx`
- Modify: `app/components/FAQSection.tsx`
- Test: `lib/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: `SITE`, `content/faq.ts`
- Produces:
  - `preschoolSchema` — sabit nesne
  - `buildFaqSchema(items: FaqItem[])`
  - `type FaqItem = { id: string; question: string; answer: string; featured: boolean }`
  - `<JsonLd data={...} />`

- [ ] **Step 1: Başarısız olacak testi yaz**

`lib/__tests__/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { preschoolSchema, buildFaqSchema } from '../schema';
import { SITE } from '../site';

describe('preschoolSchema', () => {
  it('Preschool tipini kullanır', () => {
    expect(preschoolSchema['@type']).toBe('Preschool');
  });

  it('gerçek telefon numarasını kullanır (placeholder değil)', () => {
    expect(preschoolSchema.telephone).toBe(SITE.phone.e164);
    expect(preschoolSchema.telephone).not.toContain('555-123');
  });

  it('adres ve koordinat içerir', () => {
    expect(preschoolSchema.address.addressLocality).toContain('Beykent');
    expect(preschoolSchema.geo['@type']).toBe('GeoCoordinates');
  });

  it('çalışma saatlerini içerir', () => {
    expect(preschoolSchema.openingHoursSpecification[0].opens).toBe(SITE.hours.opens);
  });

  it('boş sosyal medya linklerini dahil etmez', () => {
    expect(preschoolSchema.sameAs.every((url: string) => url.length > 0)).toBe(true);
  });
});

describe('buildFaqSchema', () => {
  it('soruları FAQPage yapısına çevirir', () => {
    const schema = buildFaqSchema([
      { id: 'a', question: 'Kaç yaş?', answer: '2-6 yaş.', featured: true },
    ]);
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity[0].name).toBe('Kaç yaş?');
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe('2-6 yaş.');
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: `lib/schema.ts` yeniden yaz**

```typescript
import { SITE } from './site';
import type { FaqItem } from '@/content/faq';

export const preschoolSchema = {
  '@context': 'https://schema.org',
  '@type': 'Preschool',
  '@id': `${SITE.url}/#organization`,
  name: SITE.name,
  alternateName: [...SITE.alternateNames],
  description: SITE.description,
  url: SITE.url,
  logo: `${SITE.url}/logo.png`,
  image: `${SITE.url}/og-default.jpg`,
  telephone: SITE.phone.e164,
  email: SITE.email,
  foundingDate: String(SITE.foundingYear),
  priceRange: '$$$',
  address: {
    '@type': 'PostalAddress',
    streetAddress: SITE.address.street,
    addressLocality: SITE.address.district,
    addressRegion: SITE.address.city,
    postalCode: SITE.address.postalCode,
    addressCountry: SITE.address.country,
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: SITE.geo.latitude,
    longitude: SITE.geo.longitude,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: SITE.hours.opens,
      closes: SITE.hours.closes,
    },
  ],
  areaServed: SITE.areaServed.map((name) => ({ '@type': 'Place', name })),
  sameAs: Object.values(SITE.social).filter((url) => url.length > 0),
};

export function buildFaqSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function buildBreadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${SITE.url}${crumb.path}`,
    })),
  };
}
```

- [ ] **Step 4: `content/faq.ts` oluştur**

Mevcut SSS içeriğini JSX'ten çıkarıp veriye taşı. Yaş aralığı **Stratejik Brief'teki Karar 1'e göre** doldurulmalı — aşağıdaki değerler mevcut FAQSection'dan alınmıştır, doğrulanmalıdır.

```typescript
export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  featured: boolean;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'yas-araligi',
    question: 'Anaokulunuza kaç yaş arası çocuklar kabul ediliyor?',
    answer:
      'Özel Şeker Anaokulu 2 yaşından itibaren, çocuk 5 yaşını tamamlayana kadar kabul eder. 2-3 yaş oyun grubu, 3-4 yaş, 4-5 yaş ve 5-6 yaş için ayrı sınıflarımız ve her gruba özel eğitim programlarımız vardır.',
    featured: true,
  },
  {
    id: 'sinif-mevcudu',
    question: 'Sınıf mevcudunuz ve öğretmen başına düşen çocuk sayısı nedir?',
    answer:
      'Sınıflarımızda 10 çocuk bulunur ve her sınıfta iki öğretmen görev yapar — öğretmen başına beş çocuk düşer. Millî Eğitim Bakanlığı yönetmeliği bu yaş grubunda öğretmen başına 20 çocuğa kadar izin verirken, biz bu üst sınırın dörtte biriyle çalışıyoruz.',
    featured: true,
  },
  {
    id: 'ingilizce',
    question: 'İngilizce eğitiminiz nasıl işliyor?',
    answer:
      'Çocuklarımız mezun olduğunda İngilizce konuşuyor. Bunu haftada birkaç saatlik ders ile değil, native İngilizce öğretmenimizin günlük akışın doğal parçası olmasıyla sağlıyoruz.',
    featured: true,
  },
  {
    id: 'calisma-saatleri',
    question: 'Çalışma saatleriniz nelerdir?',
    answer:
      'Hafta içi 07:15-19:15 saatleri arasında hizmet veriyoruz. Tam gün ve yarım gün seçeneklerimiz mevcuttur; yarım gün programı 07:15-13:00 arasındadır.',
    featured: true,
  },
  {
    id: 'egitim-programi',
    question: 'Eğitim yaklaşımınız nedir?',
    answer:
      'Montessori, High Scope ve Çoklu Zeka kuramlarını temel alan, oyun temelli bir program uyguluyoruz. Sanat, müzik, drama, fen, matematik ve dil gelişimi alanlarında günlük etkinlikler düzenlenir.',
    featured: true,
  },
  {
    id: 'guvenlik',
    question: 'Güvenlik önlemleriniz nelerdir?',
    answer:
      '24 saat kamera sistemi, kontrollü giriş-çıkış, yangın alarm sistemi ve ilk yardım sertifikalı personel bulunmaktadır.',
    featured: true,
  },
  {
    id: 'servis',
    question: 'Servis hizmetiniz hangi bölgeleri kapsıyor?',
    answer:
      'TODO: Gerçek güzergâhları yazın. Beykent, Büyükçekmece, Beylikdüzü gibi bölge adlarını açıkça geçirin — yerel arama görünürlüğü için kritik.',
    featured: false,
  },
  {
    id: 'yemek',
    question: 'Yemekler nerede ve nasıl hazırlanıyor?',
    answer: 'TODO: Mutfak, diyetisyen onayı, menü döngüsü bilgisini yazın.',
    featured: false,
  },
  {
    id: 'uyum-sureci',
    question: 'Uyum süreci nasıl işliyor?',
    answer: 'TODO: Kademeli başlangıç planınızı adım adım anlatın.',
    featured: false,
  },
];

export const FEATURED_FAQ = FAQ_ITEMS.filter((item) => item.featured);
```

- [ ] **Step 5: Testi çalıştır, geçtiğini doğrula**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: `app/components/JsonLd.tsx` oluştur**

```tsx
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

- [ ] **Step 7: `layout.tsx` ve `FAQSection.tsx`'i bağla**

`layout.tsx`: `<head>` içindeki mevcut `organizationSchema` script'ini `<JsonLd data={preschoolSchema} />` ile değiştir.

`FAQSection.tsx`: içerideki `featuredFAQs` dizisini sil, `import { FEATURED_FAQ } from '@/content/faq'` kullan. `id` alanı artık `string` — `openItems` state tipini `string[]` yap. Bileşenin sonuna `<JsonLd data={buildFaqSchema(FEATURED_FAQ)} />` ekle.

- [ ] **Step 8: Doğrula**

```bash
npm test && npm run build && npm run dev
```
Sayfa kaynağında iki adet `application/ld+json` bloğu olmalı. İçeriği [Google Rich Results Test](https://search.google.com/test/rich-results)'a yapıştırıp doğrula.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: replace organization schema with Preschool and FAQPage structured data"
```

---

### Task 8: Native sitemap ve robots

**Files:**
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`
- Delete: `public/robots.txt`
- Test: `app/__tests__/sitemap.test.ts`

**Interfaces:**
- Consumes: `SITE`, `content/ageGroups.ts` (Task 12'de oluşturulacak — bu task önce çalıştırılırsa yaş grubu URL'leri elle listelenir, Task 12'de dinamikleştirilir)
- Produces: `/sitemap.xml`, `/robots.txt` (Next.js tarafından üretilir)

- [ ] **Step 1: Başarısız olacak testi yaz**

`app/__tests__/sitemap.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import sitemap from '../sitemap';

describe('sitemap', () => {
  const entries = sitemap();

  it('ana sayfayı içerir', () => {
    expect(entries.some((e) => e.url === 'https://sekeranaokulu.com')).toBe(true);
  });

  it('teşekkür sayfasını içermez', () => {
    expect(entries.some((e) => e.url.includes('/tesekkurler'))).toBe(false);
  });

  it('her girdinin geçerli bir önceliği vardır', () => {
    expect(entries.every((e) => typeof e.priority === 'number' && e.priority <= 1)).toBe(true);
  });

  it('ana sayfa en yüksek önceliğe sahiptir', () => {
    const home = entries.find((e) => e.url === 'https://sekeranaokulu.com');
    expect(home?.priority).toBe(1);
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: `app/sitemap.ts` yaz**

```typescript
import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

const ROUTES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/kayit', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/ucretler', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/egitim-yaklasimimiz', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/yas-gruplari/2-3-yas', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/yas-gruplari/3-4-yas', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/yas-gruplari/4-5-yas', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/yas-gruplari/5-6-yas', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/kadromuz', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/gunluk-akis', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/guvenlik', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/veli-yorumlari', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/aktiviteler', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/hakkimizda', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/sss', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/bultenler', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/iletisim', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/gizlilik', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/kullanim', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/cerez', priority: 0.3, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((route) => ({
    url: `${SITE.url}${route.path === '/' ? '' : route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
```

- [ ] **Step 4: `app/robots.ts` yaz**

```typescript
import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/tesekkurler'],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
```

- [ ] **Step 5: Eski statik robots.txt'i sil**

```bash
git rm public/robots.txt
```

Sebep: `public/robots.txt` varsa Next.js'in ürettiği `app/robots.ts` gölgelenir ve eski dosya servis edilir.

- [ ] **Step 6: Testi çalıştır ve build'i doğrula**

```bash
npm test && npm run build && npm run dev
```
`http://localhost:3000/sitemap.xml` ve `http://localhost:3000/robots.txt` adreslerini aç — ikisi de dolu ve doğru olmalı.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: replace broken sitemap script with native app router sitemap and robots"
```

---

# FAZ 4 — PREMIUM TASARIM DİLİ

### Task 9: Tasarım tokenları ve tipografi

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: Tailwind sınıfları `navy-{50..900}`, `gold-{300..600}`, `cream`, `font-display`, `font-sans` — Task 10 sonrası tüm bileşenler bunları kullanır

**Neden:** Mevcut palet (parlak pembe #e657a2, sarı #f5da28, turuncu #ef6700 bir arada) ve Geist Mono/Sans tipografisi "bütçe dostu çocuk kulübü" sinyali veriyor. Premium eğitim markaları derin nötr tonlar, sınırlı palet, serif başlık ve geniş boşluk kullanıyor. Marka sürekliliği için lacivert korunur; pembe/sarı yalnızca küçük vurgu olarak kalır.

- [ ] **Step 1: `app/globals.css` yaz**

```css
@import "tailwindcss";

@theme {
  /* Premium palet — lacivert ana, altın vurgu, krem zemin */
  --color-navy-50:  #f2f4fa;
  --color-navy-100: #e3e7f4;
  --color-navy-200: #c4cce8;
  --color-navy-300: #94a3d4;
  --color-navy-400: #6274bb;
  --color-navy-500: #3f4f9f;
  --color-navy-600: #2c3a80;
  --color-navy-700: #1e2a63;
  --color-navy-800: #14204a;
  --color-navy-900: #0b1533;

  --color-gold-300: #e8d9a8;
  --color-gold-400: #d4bd77;
  --color-gold-500: #b89b4a;
  --color-gold-600: #967a33;

  --color-cream: #faf8f4;
  --color-ivory: #ffffff;

  /* Marka mirası — yalnızca küçük vurgu olarak */
  --color-accent-coral: #ef6700;

  --font-display: var(--font-fraunces), Georgia, serif;
  --font-sans: var(--font-inter), system-ui, sans-serif;
}

:root {
  --background: var(--color-ivory);
  --foreground: var(--color-navy-900);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* Premium tipografi ölçeği: büyük, sakin başlıklar, geniş satır arası */
h1, h2, h3 {
  font-family: var(--font-display);
  letter-spacing: -0.015em;
  line-height: 1.15;
}

p {
  line-height: 1.75;
}

/* Lüks his için yavaş, yumuşak geçişler */
@media (prefers-reduced-motion: no-preference) {
  a, button {
    transition: all 240ms cubic-bezier(0.4, 0, 0.2, 1);
  }
}
```

Not: Karanlık mod `@media (prefers-color-scheme: dark)` bloğu **kaldırıldı**. Mevcut sitede bu blok tanımlıydı ama hiçbir bileşen buna uyumlu değildi; karanlık modda okunamayan metinler oluşuyordu.

- [ ] **Step 2: `layout.tsx` içinde fontları değiştir**

```tsx
import { Fraunces, Inter } from 'next/font/google';

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin-ext'],
  weight: ['400', '600'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin-ext'],
  display: 'swap',
});
```

`<body>` className'ini `${fraunces.variable} ${inter.variable} antialiased pb-14 md:pb-0` yap. Geist import'larını sil.

**Kritik:** `subsets` mutlaka `latin-ext` olmalı — `latin` Türkçe ı, ğ, ş, İ karakterlerini içermez ve bu harfler yedek fontla render edilerek görünür bozulma yaratır.

- [ ] **Step 3: Doğrula**

```bash
npm run dev
```
- Başlıklar serif, gövde sans-serif görünmeli
- "Şeker Anaokulu'nda ığüşöç İĞÜŞÖÇ" metnini geçici olarak bir başlığa yaz — tüm karakterler aynı fontla render edilmeli
- Sistem karanlık moddayken sayfa hâlâ okunabilir olmalı

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: introduce premium design tokens and serif display typography"
```

---

### Task 10: Hero yeniden yazımı ve güven şeridi

**Files:**
- Modify: `app/components/HeroSection.tsx` *(tamamen yeniden yazılır)*
- Create: `app/components/TrustBar.tsx`
- Modify: `app/Anasayfa.tsx`

**Interfaces:**
- Consumes: `SITE`, `trackEvent`
- Produces: `<TrustBar />`

**Neden:** Mevcut hero "Şeker Anaokulu'na Hoş Geldiniz!" diyor — konum yok, yaş yok, farklılaştırıcı yok, fiyat gerekçesi yok. Rakiplerin hepsi bundan iyi. Yeni hero üç soruyu ilk ekranda cevaplamalı: *Neredesiniz? Kaç yaş? Neden siz?*

- [ ] **Step 1: `HeroSection.tsx` yeniden yaz**

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { SITE, WHATSAPP_URL } from '@/lib/site';

export default function HeroSection() {
  const yearsActive = new Date().getFullYear() - SITE.foundingYear;

  return (
    <section className="relative isolate overflow-hidden bg-navy-900">
      <Image
        src="/cocukklar.jpg"
        alt="Şeker Anaokulu'nda etkinlik sırasındaki çocuklar"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_30%] opacity-35"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900/85 via-navy-900/70 to-navy-900/90" />

      <div className="relative mx-auto max-w-4xl px-6 py-28 text-center md:py-36">
        <p className="mb-6 text-sm uppercase tracking-[0.2em] text-gold-400">
          Beykent · Büyükçekmece · {SITE.foundingYear}'den beri
        </p>

        <h1 className="font-display text-4xl leading-tight text-white md:text-6xl">
          Bir sınıfta 10 çocuk.
          <br />
          İki öğretmen.
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-navy-100">
          2-6 yaş için Montessori ve High Scope temelli okul öncesi eğitim.
          Native öğretmenimizle çocuklarımız mezun olduğunda İngilizce konuşuyor.
          {' '}{yearsActive} yıldır Beykent'te, aynı çatı altında.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/kayit"
            className="w-full rounded-full bg-gold-500 px-10 py-4 font-medium text-navy-900 hover:bg-gold-400 sm:w-auto"
          >
            Ön Görüşme Randevusu
          </Link>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-full border border-white/40 px-10 py-4 font-medium text-white hover:bg-white/10 sm:w-auto"
          >
            WhatsApp'tan Yazın
          </a>
        </div>
      </div>
    </section>
  );
}
```

Not: `"use client"` kaldırıldı — bu bileşende artık istemci durumu yok, sunucu bileşeni olarak render edilir (daha az JS). Dekoratif CSS şekiller de kaldırıldı; premium estetikte boşluk, süslemeden değerlidir.

- [ ] **Step 2: `app/components/TrustBar.tsx` oluştur**

```tsx
import { SITE } from '@/lib/site';

const STATS = [
  { value: '10', label: 'Sınıf mevcudu' },
  { value: '1 : 5', label: 'Öğretmen başına çocuk' },
  { value: `${new Date().getFullYear() - SITE.foundingYear} yıl`, label: 'Beykent\'te kesintisiz' },
  { value: 'Native', label: 'İngilizce öğretmeni' },
];

export default function TrustBar() {
  return (
    <section className="border-y border-navy-100 bg-cream">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="font-display text-3xl text-navy-900">{stat.value}</p>
            <p className="mt-2 text-sm text-navy-600">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `Anasayfa.tsx` bölüm sırasını düzelt**

Araştırmaya göre dönüşüm optimize sıralama:

```tsx
<Header />
<HeroSection />
<TrustBar />           {/* güven, kaydırmadan önce */}
<FeaturesSection />    {/* 3 farklılaştırıcı */}
<ActivitiesSection />
{/* mevcut AboutSection blokları */}
<FAQSection />
<ContactSection />
```

`"use client"` direktifini `Anasayfa.tsx`'ten kaldır (artık istemci durumu yok; alt bileşenler kendi `"use client"` direktiflerini taşıyor).

- [ ] **Step 4: Doğrula**

```bash
npm run build && npm run dev
```
Ana sayfa ilk ekranda: konum, kuruluş yılı, yaş aralığı, pedagoji ve iki CTA görünmeli.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: rewrite hero with premium positioning and add trust bar"
```

---

### Task 11: Header ve Footer yeniden yapılandırma

**Files:**
- Modify: `app/components/Header.tsx`
- Modify: `app/components/Footer.tsx`
- Modify: `app/components/SocialMediaLinks.tsx`

**Interfaces:**
- Consumes: `SITE`

- [ ] **Step 1: `Header.tsx` menüsünü yeniden yapılandır**

Menü dizisini bileşenin dışına çıkar (masaüstü ve mobilde tekrarlanan JSX'i ortadan kaldırır):

```tsx
const NAV_ITEMS = [
  { href: '/egitim-yaklasimimiz', label: 'Eğitim Yaklaşımımız' },
  { href: '/yas-gruplari', label: 'Yaş Grupları' },
  { href: '/gunluk-akis', label: 'Günlük Akış' },
  { href: '/kadromuz', label: 'Kadromuz' },
  { href: '/aktiviteler', label: 'Aktiviteler' },
  { href: '/ucretler', label: 'Ücretler' },
  { href: '/veli-yorumlari', label: 'Veli Yorumları' },
] as const;
```

Hem masaüstü hem mobil menüde `NAV_ITEMS.map(...)` kullan. CTA butonunu `/iletisim` → `/kayit` yap ve metnini `Ön Görüşme Randevusu` olarak değiştir. Renkleri `style={{ color: '#071997' }}` inline stillerinden `text-navy-900` sınıfına geçir.

- [ ] **Step 2: Logo'ya erişilebilir alt metni ve ana sayfa linki ekle**

Mevcut kodda `<Image src="/logo.png" alt="" />` — boş alt metin ve link yok.

```tsx
<Link href="/" aria-label={`${SITE.name} ana sayfa`}>
  <Image src="/logo.png" alt={SITE.name} width={72} height={72} priority />
</Link>
```

- [ ] **Step 3: `Footer.tsx`'i `lib/site.ts`'e bağla**

- Adres, telefon, e-posta hard-code değerlerini `SITE`'ten al
- Telefonu `<a href={\`tel:${SITE.phone.e164}\`}>`, e-postayı `mailto:` yap
- `© 2024` → `© {new Date().getFullYear()}`
- Hızlı linkler listesini `NAV_ITEMS`'tan üret (Header'dan export et)
- Dekoratif `animate-pulse` daireleri ve üçgenleri kaldır — premium estetikle çelişiyor
- Arka planı `bg-navy-900` yap, gradient'i kaldır

- [ ] **Step 4: `SocialMediaLinks.tsx`'i düzelt**

`href: '#'` olan ölü linkler kaldırılır. `SITE.social` içinde **dolu olan** girdiler render edilir:

```tsx
import { SITE } from '@/lib/site';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: /* mevcut svg */ },
  { key: 'facebook', label: 'Facebook', icon: /* mevcut svg */ },
  { key: 'youtube', label: 'YouTube', icon: /* mevcut svg */ },
] as const;

export default function SocialMediaLinks() {
  const active = PLATFORMS.filter((p) => SITE.social[p.key]);
  if (active.length === 0) return null;

  return (
    <div className="flex gap-4">
      {active.map((p) => (
        <a
          key={p.key}
          href={SITE.social[p.key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={p.label}
          className="text-navy-200 hover:text-white"
        >
          {p.icon}
        </a>
      ))}
    </div>
  );
}
```

Hesap yoksa hiçbir şey render edilmez — ölü `#` linki göstermekten iyidir.

- [ ] **Step 5: Doğrula**

```bash
npm run build && npm run dev
```
Menüde tüm yeni sayfalar görünmeli (henüz 404 verecekler — Task 12+ ile dolacaklar). Türkçe karakterler doğru. Footer'da yıl dinamik. Ölü sosyal link yok.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: restructure header and footer with site constants and premium styling"
```

---

# FAZ 5 — İÇERİK MİMARİSİ

### Task 12: Yaş grubu sayfaları

**Files:**
- Create: `content/ageGroups.ts`
- Create: `app/yas-gruplari/page.tsx`
- Create: `app/yas-gruplari/[slug]/page.tsx`
- Modify: `app/sitemap.ts`
- Test: `content/__tests__/ageGroups.test.ts`

**Interfaces:**
- Consumes: `buildMetadata`, `buildBreadcrumbSchema`
- Produces: `AGE_GROUPS_CONTENT: AgeGroup[]`, `getAgeGroup(slug): AgeGroup | undefined`

**Neden:** Veliler "3 yaş anaokulu beykent", "2 yaş kreş beylikdüzü" diye arıyor. Tek bir genel sayfa bu aramaların hiçbirine cevap veremez. Dört ayrı sayfa, dört ayrı arama girişi demektir.

⚠️ **Ön koşul:** Stratejik Brief Karar 1 (gerçek yaş aralığı) netleşmiş olmalı.

- [ ] **Step 1: Başarısız olacak testi yaz**

`content/__tests__/ageGroups.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { AGE_GROUPS_CONTENT, getAgeGroup } from '../ageGroups';

describe('ageGroups içeriği', () => {
  it('dört yaş grubu tanımlar (2-6 yaş)', () => {
    expect(AGE_GROUPS_CONTENT).toHaveLength(4);
  });

  it('grupları 2-3 yaştan başlayarak sırayla tanımlar', () => {
    const slugs = AGE_GROUPS_CONTENT.map((g) => g.slug);
    expect(slugs).toEqual(['2-3-yas', '3-4-yas', '4-5-yas', '5-6-yas']);
  });

  it('her grup sınıf mevcudunu 10 çocuk / 2 öğretmen olarak belirtir', () => {
    for (const group of AGE_GROUPS_CONTENT) {
      expect(group.classSize).toContain('10');
      expect(group.classSize).toContain('2 öğretmen');
    }
  });

  it('her grubun benzersiz slug\'ı vardır', () => {
    const slugs = AGE_GROUPS_CONTENT.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('her grubun SEO metni doludur', () => {
    for (const group of AGE_GROUPS_CONTENT) {
      expect(group.metaDescription.length).toBeGreaterThan(70);
      expect(group.metaDescription.length).toBeLessThanOrEqual(160);
    }
  });

  it('slug ile grup bulur', () => {
    expect(getAgeGroup('3-4-yas')?.title).toContain('3-4');
  });

  it('bilinmeyen slug için undefined döner', () => {
    expect(getAgeGroup('99-yas')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: `content/ageGroups.ts` yaz**

```typescript
export type AgeGroup = {
  slug: string;
  title: string;
  ageLabel: string;
  headline: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  focusAreas: { title: string; description: string }[];
  dailyHighlights: string[];
  classSize: string;
  image: string;
};

const CLASS_SIZE = '10 çocuk, 2 öğretmen — öğretmen başına 5 çocuk';

export const AGE_GROUPS_CONTENT: AgeGroup[] = [
  {
    slug: '2-3-yas',
    title: '2-3 Yaş Oyun Grubu',
    ageLabel: '2-3 yaş',
    headline: 'İlk ayrılık, on kişilik bir sınıfta.',
    metaTitle: '2-3 Yaş Oyun Grubu — Beykent',
    metaDescription:
      'Beykent Büyükçekmece\'de 2-3 yaş oyun grubu. 10 kişilik sınıf, iki öğretmen, kademeli uyum süreci. Çocuğunuzun ilk okul deneyimi için ön görüşme alın.',
    intro:
      'İki yaş, çocuğun aileden ilk kez ayrıldığı dönemdir. Bu yaşta önceliğimiz akademik kazanım değil, güvenli bağlanma ve kademeli uyumdur. On kişilik sınıfımızda iki öğretmen bulunması, bu yaş için tercih değil zorunluluktur.',
    focusAreas: [
      { title: 'Uyum ve bağlanma', description: 'Kademeli başlangıç planıyla ayrılık kaygısının yönetimi.' },
      { title: 'Öz bakım becerileri', description: 'Tuvalet eğitimi desteği, kendi başına yeme, el yıkama.' },
      { title: 'Duyusal oyun', description: 'Kum, su, hamur ve doku çalışmalarıyla duyusal gelişim.' },
      { title: 'Dil gelişimi', description: 'Şarkı, tekerleme ve hikâye ile kelime dağarcığının genişletilmesi; native öğretmenle İngilizceye ilk temas.' },
    ],
    dailyHighlights: ['Karşılama ve serbest oyun', 'Duyusal atölye', 'Bahçe zamanı', 'Öğle uykusu', 'Müzik ve hareket'],
    classSize: CLASS_SIZE,
    image: '/motorskills.jpg',
  },
  {
    slug: '3-4-yas',
    title: '3-4 Yaş Anaokulu',
    ageLabel: '3-4 yaş',
    headline: 'Merakın en yüksek olduğu yaş.',
    metaTitle: '3-4 Yaş Anaokulu — Beykent',
    metaDescription:
      'Beykent\'te 3-4 yaş anaokulu programı. Montessori materyalleri, İngilizce, sanat ve drama atölyeleriyle çocuğunuzun keşif dönemi.',
    intro:
      'Üç yaş, "neden" sorusunun yaşıdır. Programımız bu merakı bastırmak yerine yönlendirmek üzerine kuruludur.',
    focusAreas: [
      { title: 'Montessori çalışmaları', description: 'Bireysel hızda ilerleyen, hazırlanmış ortam çalışmaları.' },
      { title: 'Sosyal beceriler', description: 'Sıra bekleme, paylaşma, çatışma çözme.' },
      { title: 'İngilizce', description: 'Native öğretmenle günlük İngilizce — dil, ders olarak değil günün doğal parçası olarak öğrenilir.' },
      { title: 'Yaratıcı ifade', description: 'Seramik, resim ve drama atölyeleri.' },
    ],
    dailyHighlights: ['Sabah çemberi', 'Montessori çalışma saati', 'İngilizce', 'Bahçe zamanı', 'Atölye'],
    classSize: CLASS_SIZE,
    image: '/art.jpg',
  },
  {
    slug: '4-5-yas',
    title: '4-5 Yaş Anaokulu',
    ageLabel: '4-5 yaş',
    headline: 'Bilişsel sıçramanın yılı.',
    metaTitle: '4-5 Yaş Anaokulu — Beykent',
    metaDescription:
      'Beykent\'te 4-5 yaş anaokulu. Robotik kodlama, satranç, matematik ve okuma yazmaya hazırlık çalışmalarıyla zenginleştirilmiş program.',
    intro:
      'Dört yaş, soyut düşüncenin filizlendiği dönemdir. Program bu yaşta problem çözme ve mantıksal düşünmeye ağırlık verir.',
    focusAreas: [
      { title: 'Robotik ve kodlama', description: 'Algoritmik düşünmenin oyunla temellendirilmesi.' },
      { title: 'Satranç', description: 'Planlama, sonuç öngörme ve odaklanma becerileri.' },
      { title: 'Matematik temelleri', description: 'Sayı, örüntü, ölçme ve geometri çalışmaları.' },
      { title: 'Bilim atölyesi', description: 'Deney ve gözlem yoluyla neden-sonuç ilişkisi.' },
    ],
    dailyHighlights: ['Sabah çemberi', 'Bilim veya robotik atölyesi', 'İngilizce', 'Satranç', 'Bahçe zamanı'],
    classSize: CLASS_SIZE,
    image: '/robotic.jpg',
  },
  {
    slug: '5-6-yas',
    title: '5-6 Yaş İlkokula Hazırlık',
    ageLabel: '5-6 yaş',
    headline: 'İlkokula hazır, ama çocukluğundan ödün vermeden.',
    metaTitle: '5-6 Yaş İlkokula Hazırlık Sınıfı — Beykent',
    metaDescription:
      'Beykent\'te 5-6 yaş ilkokula hazırlık sınıfı. Okuma yazmaya hazırlık, dikkat ve odaklanma çalışmaları, ilkokul geçiş programı.',
    intro:
      'Bu yaşta hedef okuma yazma öğretmek değil, ilkokulda ihtiyaç duyulacak dikkat süresini, kalem tutuşunu ve öğrenme alışkanlığını kurmaktır.',
    focusAreas: [
      { title: 'Okuma yazmaya hazırlık', description: 'Ses farkındalığı, çizgi ve kalem tutuş çalışmaları.' },
      { title: 'Dikkat ve odaklanma', description: 'Süresi kademeli uzayan bireysel çalışma seansları.' },
      { title: 'Sorumluluk', description: 'Görev alma, kendi eşyasını yönetme, plan takibi.' },
      { title: 'İlkokul geçişi', description: 'TODO: İlkokul yerleştirme desteği veriliyorsa yazın.' },
    ],
    dailyHighlights: ['Sabah çemberi', 'Hazırlık çalışması', 'İngilizce', 'Proje saati', 'Bahçe zamanı'],
    classSize: CLASS_SIZE,
    image: '/satranc.jpg',
  },
];

export function getAgeGroup(slug: string): AgeGroup | undefined {
  return AGE_GROUPS_CONTENT.find((group) => group.slug === slug);
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm test`
Expected: PASS (5 test)

- [ ] **Step 5: `app/yas-gruplari/[slug]/page.tsx` yaz**

```tsx
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/app/components/Header';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { AGE_GROUPS_CONTENT, getAgeGroup } from '@/content/ageGroups';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema } from '@/lib/schema';

export function generateStaticParams() {
  return AGE_GROUPS_CONTENT.map((group) => ({ slug: group.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = getAgeGroup(slug);
  if (!group) return {};
  return buildMetadata({
    title: group.metaTitle,
    description: group.metaDescription,
    path: `/yas-gruplari/${group.slug}`,
    image: group.image,
  });
}

export default async function AgeGroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = getAgeGroup(slug);
  if (!group) notFound();

  return (
    <div className="min-h-screen bg-ivory">
      <Header />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Yaş Grupları', path: '/yas-gruplari' },
          { name: group.title, path: `/yas-gruplari/${group.slug}` },
        ])}
      />

      <section className="bg-navy-900 py-20 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-gold-400">{group.ageLabel}</p>
        <h1 className="mx-auto mt-4 max-w-3xl px-6 font-display text-4xl text-white md:text-5xl">
          {group.headline}
        </h1>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-lg text-navy-700">{group.intro}</p>
        <p className="mt-6 rounded-xl bg-cream px-6 py-4 text-navy-800">
          <strong>Sınıf mevcudu:</strong> {group.classSize}
        </p>
      </section>

      <section className="bg-cream py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-3xl text-navy-900">
            {group.ageLabel} programında odak alanlarımız
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {group.focusAreas.map((area) => (
              <div key={area.title} className="rounded-xl bg-white p-8">
                <h3 className="font-display text-xl text-navy-900">{area.title}</h3>
                <p className="mt-3 text-navy-700">{area.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Image
            src={group.image}
            alt={`${group.title} etkinlikleri`}
            width={640}
            height={480}
            className="rounded-2xl object-cover"
          />
          <div>
            <h2 className="font-display text-3xl text-navy-900">Günün akışından</h2>
            <ul className="mt-6 space-y-3">
              {group.dailyHighlights.map((item) => (
                <li key={item} className="flex gap-3 text-navy-700">
                  <span className="text-gold-500">—</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/gunluk-akis" className="mt-8 inline-block text-navy-900 underline">
              Tam günlük akışı görün
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-cream py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-navy-900">
            {group.ageLabel} kontenjanımızı sorun
          </h2>
          <p className="mt-4 text-center text-navy-700">
            Sınıf mevcudumuz sınırlı olduğu için kayıtları dönem başında kapatıyoruz.
          </p>
          <div className="mt-10">
            <LeadForm variant="compact" />
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: `app/yas-gruplari/page.tsx` (genel sayfa) yaz**

Dört gruba kart olarak link veren bir index sayfası. `buildMetadata` ile metadata, `AGE_GROUPS_CONTENT.map` ile kartlar; her kart `title`, `ageLabel`, `headline` ve `image` gösterir, `/yas-gruplari/${slug}` adresine linkler.

- [ ] **Step 7: `app/sitemap.ts`'i dinamikleştir**

Elle yazılmış dört yaş grubu satırını sil, yerine:

```typescript
import { AGE_GROUPS_CONTENT } from '@/content/ageGroups';

// ROUTES dizisine ekle:
{ path: '/yas-gruplari', priority: 0.8, changeFrequency: 'monthly' },
...AGE_GROUPS_CONTENT.map((group) => ({
  path: `/yas-gruplari/${group.slug}`,
  priority: 0.8 as const,
  changeFrequency: 'monthly' as const,
})),
```

- [ ] **Step 8: Doğrula**

```bash
npm test && npm run build && npm run dev
```
- `/yas-gruplari` → dört kart
- `/yas-gruplari/3-4-yas` → dolu sayfa, sekme başlığı "3-4 Yaş Anaokulu — Beykent | Özel Şeker Anaokulu"
- `/yas-gruplari/olmayan` → 404
- `/sitemap.xml` → beş yeni URL

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add age group content model and dynamic age group pages"
```

---

### Task 13: Kadro, günlük akış ve güvenlik sayfaları

**Files:**
- Create: `content/teachers.ts`, `content/dailyFlow.ts`
- Create: `app/kadromuz/page.tsx`, `app/gunluk-akis/page.tsx`, `app/guvenlik/page.tsx`
- Test: `content/__tests__/teachers.test.ts`

**Interfaces:**
- Consumes: `buildMetadata`, `SITE`
- Produces: `TEACHERS: Teacher[]`, `DAILY_FLOW: FlowItem[]`

**Neden:** Araştırmada yüksek gelirli velilerin baktığı ilk iki sinyal **öğretmen niteliği** ve **öğretmen başına düşen çocuk sayısı**. Düş Bilginleri 9 kişilik özgeçmişli kadro sayfasıyla bu alanda bölgede önde. Şeker'de hiç yok.

- [ ] **Step 1: Başarısız olacak testi yaz**

`content/__tests__/teachers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TEACHERS } from '../teachers';

describe('öğretmen kadrosu', () => {
  it('en az bir kişi içerir', () => {
    expect(TEACHERS.length).toBeGreaterThan(0);
  });

  it('her kişinin adı, unvanı ve fotoğrafı vardır', () => {
    for (const person of TEACHERS) {
      expect(person.name.length).toBeGreaterThan(2);
      expect(person.role.length).toBeGreaterThan(2);
      expect(person.photo).toMatch(/^\/kadro\//);
    }
  });

  it('her kişinin eğitim bilgisi vardır', () => {
    for (const person of TEACHERS) {
      expect(person.education.length).toBeGreaterThan(5);
    }
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: `content/teachers.ts` yaz**

```typescript
export type Teacher = {
  id: string;
  name: string;
  role: string;
  education: string;
  experience: string;
  photo: string;
};

// TODO: Gerçek kadro bilgileriyle doldurun. Fotoğraflar public/kadro/ altına konur.
// Her öğretmenden yazılı izin alın (KVKK).
export const TEACHERS: Teacher[] = [
  {
    id: 'kurucu',
    name: 'TODO: Kurucu adı',
    role: 'Kurucu ve Okul Müdürü',
    education: 'TODO: Üniversite ve bölüm',
    experience: 'TODO: Kaç yıllık deneyim, önceki kurumlar',
    photo: '/kadro/kurucu.jpg',
  },
];
```

- [ ] **Step 4: `content/dailyFlow.ts` yaz**

```typescript
export type FlowItem = {
  time: string;
  title: string;
  description: string;
};

export const DAILY_FLOW: FlowItem[] = [
  { time: '07:15 – 08:30', title: 'Karşılama ve serbest oyun', description: 'Çocuklar öğretmenleriyle bireysel karşılanır, güne yumuşak bir geçiş yapılır.' },
  { time: '08:30 – 09:00', title: 'Kahvaltı', description: 'TODO: Mutfak ve menü bilgisi.' },
  { time: '09:00 – 09:30', title: 'Sabah çemberi', description: 'Gün planı, hava durumu, paylaşım ve şarkılar.' },
  { time: '09:30 – 10:45', title: 'Ana çalışma saati', description: 'Yaş grubuna göre Montessori çalışmaları veya atölye.' },
  { time: '10:45 – 11:30', title: 'Bahçe zamanı', description: 'Hava koşulları elverdiğince her gün açık hava etkinliği.' },
  { time: '11:30 – 12:15', title: 'Öğle yemeği', description: 'TODO: Menü döngüsü ve diyetisyen onayı bilgisi.' },
  { time: '12:15 – 14:00', title: 'Dinlenme / sessiz saat', description: 'Küçük yaş gruplarında uyku, büyüklerde sakin etkinlik.' },
  { time: '14:00 – 15:30', title: 'Branş ve atölyeler', description: 'İngilizce, müzik, drama, robotik, satranç, seramik.' },
  { time: '15:30 – 16:00', title: 'İkindi kahvaltısı', description: 'TODO' },
  { time: '16:00 – 19:15', title: 'Serbest oyun ve uğurlama', description: 'Günün değerlendirmesi ve veli ile kısa bilgi paylaşımı.' },
];
```

- [ ] **Step 5: Testi çalıştır, geçtiğini doğrula**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Üç sayfayı oluştur**

Üçü de aynı deseni izler: `Header` → koyu lacivert başlık bölümü → içerik → `LeadForm variant="compact"` ile kapanış. Her sayfanın en üstünde `buildMetadata` ile metadata export edilir.

`app/kadromuz/page.tsx` — `TEACHERS.map()` ile kart ızgarası (fotoğraf, ad, unvan, eğitim, deneyim). Metadata:
```typescript
export const metadata = buildMetadata({
  title: 'Öğretmen Kadromuz',
  description:
    'Özel Şeker Anaokulu öğretmen kadrosu. Okul öncesi öğretmenliği ve çocuk gelişimi mezunu, deneyimli eğitimcilerimizle tanışın.',
  path: '/kadromuz',
});
```

`app/gunluk-akis/page.tsx` — `DAILY_FLOW.map()` ile dikey zaman çizelgesi. Metadata:
```typescript
export const metadata = buildMetadata({
  title: 'Günlük Akış',
  description:
    'Şeker Anaokulu\'nda bir gün nasıl geçiyor? 07:15\'ten 19:15\'e saat saat günlük programımız, öğün düzenimiz ve atölye saatlerimiz.',
  path: '/gunluk-akis',
});
```

`app/guvenlik/page.tsx` — Bölümler: kamera sistemi, kontrollü giriş-çıkış, yangın güvenliği, deprem dayanıklılık belgesi, hijyen protokolü, sağlık personeli, servis güvenliği, acil durum planı. Her bölüm TODO ile işaretlenir ve gerçek bilgiyle doldurulur. Metadata:
```typescript
export const metadata = buildMetadata({
  title: 'Güvenlik ve Sağlık',
  description:
    'Kamera sistemi, kontrollü giriş-çıkış, yangın güvenliği ve hijyen protokolleriyle Beykent\'te güvenli anaokulu ortamı.',
  path: '/guvenlik',
});
```

- [ ] **Step 7: Doğrula**

```bash
npm test && npm run build && npm run dev
```
Üç sayfa da açılmalı, her birinin sekme başlığı farklı olmalı.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add staff, daily schedule and safety pages"
```

---

### Task 14: Ücretler sayfası (premium fiyat çerçevesi)

**Files:**
- Create: `app/ucretler/page.tsx`
- Modify: `content/faq.ts` (ücret SSS'leri eklenir)

**Interfaces:**
- Consumes: `buildMetadata`, `buildFaqSchema`, `LeadForm`, `trackEvent`

**Neden ve nasıl:** Araştırma net — premium segmentte ne tam gizlemek ne de çıplak fiyat yazmak doğru. En iyi sonucu veren hibrit model: **bandı göster, neyin dahil olduğunu ayrıntılandır, kesin rakamı görüşmeye bırak.** Bu, fiyat hassasiyeti yüksek trafiği eler (satış ekibinin zamanını korur) ama "saklıyorlar" algısı yaratmaz.

Rakip kıyası: Neşe Erberk fiyatı tamamen gizliyor, Düş Bilginleri PDF liste veriyor ve "bütçenize dost" diyerek fiyatla yarışıyor. Şeker ikisinin arasında konumlanmalı.

- [ ] **Step 1: `app/ucretler/page.tsx` yaz**

```tsx
import Header from '@/app/components/Header';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { buildMetadata } from '@/lib/metadata';
import { buildFaqSchema } from '@/lib/schema';
import { FAQ_ITEMS } from '@/content/faq';

export const metadata = buildMetadata({
  title: 'Ücretler ve Ödeme',
  description:
    'Özel Şeker Anaokulu 2026-2027 ücretlendirmesi. 10 kişilik sınıflar, iki öğretmen ve native İngilizce öğretmeni. Ücret ve ödeme planı için ön görüşme randevusu alın.',
  path: '/ucretler',
});

// TODO(okul yönetimi): dahil/hariç listesini doğrulayın. Ücret RAKAMI eklenmez.
const INCLUDED = [
  'Tam gün eğitim programı (07:15 – 19:15)',
  'Native öğretmenle günlük İngilizce',
  'Tüm branş dersleri: müzik, drama, seramik, satranç, robotik kodlama',
  'Rehberlik ve psikolojik danışmanlık desteği',
  'Eğitim materyalleri ve kırtasiye',
  'Dönemlik gelişim raporu ve veli görüşmeleri',
];

const EXCLUDED = [
  'Servis hizmeti (güzergâha göre ayrıca fiyatlanır)',
  'Okul kıyafeti',
  'İsteğe bağlı ekstra atölyeler (binicilik, yüzme)',
];

const FAQ_SUBSET = FAQ_ITEMS.filter((item) =>
  ['sinif-mevcudu', 'servis', 'yemek'].includes(item.id),
);

export default function UcretlerPage() {
  return (
    <div className="min-h-screen bg-ivory">
      <Header />
      <JsonLd data={buildFaqSchema(FAQ_SUBSET)} />

      <section className="bg-navy-900 py-20 text-center">
        <h1 className="px-6 font-display text-4xl text-white md:text-5xl">
          Ücretimiz ve neye karşılık geldiği
        </h1>
        <p className="mx-auto mt-6 max-w-2xl px-6 text-navy-100">
          Ücretimizi web sitesinde yayımlamıyoruz — çünkü bir rakam, tek başına
          neyi kapsadığını anlatmıyor. Okulu gezmeden ve sınıfı görmeden verilen
          bir fiyat, doğru karar vermenize yardımcı olmaz.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl border border-navy-100 bg-cream p-10 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-navy-600">
            2026-2027 eğitim yılı
          </p>
          <p className="mt-5 font-display text-3xl leading-snug text-navy-900">
            Bölgemizin üst segmentinde konumlanıyoruz.
          </p>
          <p className="mx-auto mt-5 max-w-xl text-navy-700">
            10 kişilik sınıflar, her sınıfta iki öğretmen ve native İngilizce
            öğretmeni bir arada, ancak belirli bir maliyetle mümkün. Bunu saklamak
            yerine, neyin karşılığı olduğunu anlatmayı tercih ediyoruz.
          </p>
          <p className="mt-6 text-sm text-navy-600">
            Ücret, ödeme planı, kardeş ve peşin ödeme koşulları ön görüşmede
            size özel olarak paylaşılır.
          </p>
        </div>
      </section>

      <section className="bg-cream py-16">
        <div className="mx-auto grid max-w-4xl gap-12 px-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl text-navy-900">Ücrete dahil</h2>
            <ul className="mt-6 space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-navy-700">
                  <span className="text-gold-500">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-2xl text-navy-900">Ayrıca fiyatlanır</h2>
            <ul className="mt-6 space-y-3">
              {EXCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-navy-600">
                  <span className="text-navy-300">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="font-display text-3xl text-navy-900">Ücretimizi ne belirliyor?</h2>
        <div className="mt-8 space-y-6 text-navy-700">
          <p>
            <strong>Sınıflarımızda 10 çocuk bulunur ve her sınıfta iki öğretmen görev
            yapar</strong> — öğretmen başına beş çocuk. Millî Eğitim Bakanlığı
            yönetmeliği bu yaş grubunda öğretmen başına 20 çocuğa kadar izin veriyor.
            Biz bu üst sınırın dörtte biriyle çalışıyoruz. Ücretimizin tek en büyük
            bileşeni budur.
          </p>
          <p>
            <strong>Çocuklarımız mezun olduğunda İngilizce konuşuyor.</strong> Bunu
            haftada birkaç saatlik ders ile değil, native İngilizce öğretmenimizin
            günün doğal parçası olmasıyla sağlıyoruz.
          </p>
          <p>
            {new Date().getFullYear() - 2011} yıldır aynı adreste, aynı kadro anlayışıyla
            çalışıyoruz. Çocuğunuz yıl ortasında öğretmen değiştirmez.
          </p>
        </div>
      </section>

      <section className="bg-cream py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-navy-900">
            Size özel ödeme planı için görüşelim
          </h2>
          <div className="mt-10">
            <LeadForm variant="full" />
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: `content/faq.ts`'e ücret sorularını ekle**

```typescript
{
  id: 'ucret-taksit',
  question: 'Ödeme planı ve taksit seçenekleriniz nelerdir?',
  answer: 'TODO: Gerçek taksit sayısı, peşin indirimi ve kardeş koşullarını yazın.',
  featured: false,
},
{
  id: 'ucret-dahil',
  question: 'Yıllık ücrete yemek ve branş dersleri dahil mi?',
  answer: 'Tam gün programımıza günlük İngilizce, tüm branş dersleri, rehberlik desteği ve eğitim materyalleri dahildir. Servis ve okul kıyafeti ayrıca fiyatlanır. Güncel ücret ve ödeme planı ön görüşmede paylaşılır.',
  featured: false,
},
```

- [ ] **Step 3: Doğrula**

```bash
npm test && npm run build && npm run dev
```
`/ucretler` açılmalı; sayfa kaynağında FAQPage schema bulunmalı.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add pricing page with premium value framing"
```

---

### Task 15: Kayıt sayfası, veli yorumları ve eğitim yaklaşımı

**Files:**
- Create: `content/testimonials.ts`
- Create: `app/kayit/page.tsx`, `app/veli-yorumlari/page.tsx`, `app/egitim-yaklasimimiz/page.tsx`
- Test: `content/__tests__/testimonials.test.ts`

**Interfaces:**
- Consumes: `buildMetadata`, `LeadForm`, `SITE`
- Produces: `TESTIMONIALS: Testimonial[]`

- [ ] **Step 1: Başarısız olacak testi yaz**

`content/__tests__/testimonials.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TESTIMONIALS } from '../testimonials';

describe('veli yorumları', () => {
  it('her yorumun metni ve kaynağı vardır', () => {
    for (const item of TESTIMONIALS) {
      expect(item.quote.length).toBeGreaterThan(20);
      expect(['google', 'form', 'yuz-yuze']).toContain(item.source);
    }
  });

  it('tam isim yerine kısaltma kullanır (KVKK)', () => {
    for (const item of TESTIMONIALS) {
      expect(item.author).toMatch(/\.$/);
    }
  });
});
```

Not: İkinci test, veli adlarının "Ayşe K." biçiminde kısaltılmış olmasını zorunlu kılar — tam ad yayımlamak KVKK açısından ek rıza gerektirir.

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: `content/testimonials.ts` yaz**

```typescript
export type Testimonial = {
  id: string;
  quote: string;
  author: string;
  context: string;
  source: 'google' | 'form' | 'yuz-yuze';
};

// TODO: Gerçek yorumlarla doldurun. Her veliden yayın için yazılı onay alın.
// Yorumu alırken "Beykent", "servis", "Montessori" gibi kelimelerin geçmesi
// hem sosyal kanıt hem yerel SEO değeri taşır.
export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'ornek-1',
    quote: 'TODO: Gerçek veli yorumu.',
    author: 'TODO A.',
    context: 'TODO: 4 yaş velisi, 2 yıldır',
    source: 'google',
  },
];
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: `app/kayit/page.tsx` yaz**

Ana dönüşüm sayfası. Menüdeki tüm CTA'lar buraya gelir. Yapı:
1. Başlık: "2026-2027 kayıtlarımız açık" + kontenjan vurgusu (indirim dili **yok**)
2. Üç adımlı süreç: Ön görüşme talebi → Okul ziyareti ve tanışma → Kayıt
3. `<LeadForm variant="full" />`
4. Alternatif iletişim: telefon + WhatsApp, "15 dakika içinde dönüş" taahhüdü

Metadata:
```typescript
export const metadata = buildMetadata({
  title: '2026-2027 Kayıtları',
  description:
    'Özel Şeker Anaokulu 2026-2027 ön kayıt. Beykent Büyükçekmece\'de sınırlı kontenjanlı, 2-6 yaş okul öncesi eğitim. Ön görüşme randevusu alın.',
  path: '/kayit',
});
```

- [ ] **Step 6: `app/veli-yorumlari/page.tsx` yaz**

`TESTIMONIALS.map()` ile alıntı kartları. Sayfanın altına Google İşletme Profili'ne yorum bırakma bağlantısı ekle (`SITE`'e `googleReviewUrl` alanı eklenebilir). Metadata:
```typescript
export const metadata = buildMetadata({
  title: 'Veli Yorumları',
  description:
    'Şeker Anaokulu velilerinin deneyimleri. Beykent Büyükçekmece\'de anaokulu arayan aileler için gerçek veli görüşleri.',
  path: '/veli-yorumlari',
});
```

- [ ] **Step 7: `app/egitim-yaklasimimiz/page.tsx` yaz**

Bu sayfa keyword haritasındaki en değerli orta-rekabet kümesini hedefler (montessori/high scope/çoklu zeka + lokasyon). AEO kurallarına uy: her bölüm başlığı bir soru, ilk cümle o soruyu doğrudan cevaplasın.

Bölümler:
- "Montessori yaklaşımı nedir ve biz nasıl uyguluyoruz?"
- "High Scope programı çocuğa ne kazandırır?"
- "Çoklu zeka kuramını günlük programda nasıl kullanıyoruz?"
- "Oyun temelli öğrenme neden akademik hazırlıktan önce gelir?"
- "Çocuklar mezun olduğunda İngilizce konuşabiliyor mu?" — cevap evet ile başlar, native öğretmen gerekçe olarak ikinci sırada anlatılır

Metadata:
```typescript
export const metadata = buildMetadata({
  title: 'Eğitim Yaklaşımımız',
  description:
    'Montessori, High Scope ve Çoklu Zeka temelli okul öncesi eğitim programımız. Beykent Büyükçekmece\'de oyun temelli öğrenme yaklaşımı.',
  path: '/egitim-yaklasimimiz',
});
```

- [ ] **Step 8: Doğrula**

```bash
npm test && npm run build && npm run dev
```
Üç sayfa da açılmalı, Header menüsündeki linkler artık 404 vermemeli.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add enrollment, testimonials and pedagogy pages"
```

---

# FAZ 6 — PERFORMANS

### Task 16: Görsel optimizasyonu

**Files:**
- Create: `scripts/optimize-images.mjs`
- Modify: `public/*.jpg` → `public/*.webp`
- Modify: Görsel referansı olan tüm bileşenler

**Interfaces:**
- Consumes: yok
- Produces: `.webp` görseller

**Neden:** `muzik.jpg` 1,8 MB, `seramik.jpg` 1,6 MB, `binincilik.jpg` 1,6 MB. `/aktiviteler` sayfası bunların çoğunu yüklüyor — mobilde 10 MB+ sayfa ağırlığı. Premium algısını en hızlı yok eden şey yavaş yüklenen bir sitedir.

- [ ] **Step 1: sharp kur**

```bash
npm install -D sharp
```

- [ ] **Step 2: `scripts/optimize-images.mjs` yaz**

```javascript
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_DIR = path.resolve('public');
const MAX_WIDTH = 1600;
const QUALITY = 82;

const files = await readdir(PUBLIC_DIR);
const images = files.filter((file) => /\.(jpe?g|png)$/i.test(file) && file !== 'logo.png');

for (const file of images) {
  const source = path.join(PUBLIC_DIR, file);
  const target = source.replace(/\.(jpe?g|png)$/i, '.webp');
  const before = (await stat(source)).size;

  await sharp(source)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(target);

  const after = (await stat(target)).size;
  const saved = Math.round((1 - after / before) * 100);
  console.log(`${file} → ${path.basename(target)}  ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB  (-${saved}%)`);
}
```

- [ ] **Step 3: Script'i çalıştır**

```bash
node scripts/optimize-images.mjs
```
Expected: Her dosya için %70-85 arası küçülme raporu.

- [ ] **Step 4: Referansları güncelle**

```bash
grep -rn "\.jpg\|\.png" app content --include="*.tsx" --include="*.ts"
```
Çıkan her referansı `.webp` uzantısına çevir. `logo.png` **değiştirilmez** (şeffaflık gerektirir ve zaten küçüktür).

- [ ] **Step 5: Eski dosyaları sil**

```bash
git rm public/*.jpg public/asyalicocuk.png public/logo.pdf
```

- [ ] **Step 6: Doğrula**

```bash
npm run build && npm run dev
```
- Hiçbir sayfada kırık görsel olmamalı
- DevTools → Network → `/aktiviteler` sayfasının toplam transfer boyutunu ölç, 2 MB altında olmalı
- Lighthouse mobil performans skorunu kaydet (öncesi/sonrası karşılaştırması için)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "perf: convert images to webp and reduce page weight"
```

---

### Task 17: next/image geçişi ve LCP optimizasyonu

**Files:**
- Modify: `app/aktiviteler/page.tsx`, `app/components/ActivitiesSection.tsx`, `app/components/AboutSection.tsx`, `app/bultenler/page.tsx`

**Interfaces:**
- Consumes: Task 16'nın `.webp` dosyaları

- [ ] **Step 1: Tüm `next/image` kullanımlarına `sizes` ekle**

`fill` kullanan her `<Image>` için `sizes` zorunludur; yoksa Next.js her ekran için en büyük varyantı indirir.

```bash
grep -rn "<Image" app --include="*.tsx"
```

Kart ızgaralarında: `sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"`
Tam genişlik görsellerde: `sizes="100vw"`

- [ ] **Step 2: Ekran altı görselleri tembel yükle**

Hero dışındaki tüm görsellerde `priority` **kullanılmaz** (varsayılan olarak lazy). Yalnızca `HeroSection` içindeki görselde `priority` kalır — LCP öğesi odur.

- [ ] **Step 3: `AboutSection` içindeki yinelenen görseli kaldır**

`Anasayfa.tsx` içinde `asyalicocuk` görseli üç kez render ediliyor; biri yalnızca mobilde gösterilen gereksiz bir kopya (`md:hidden` bloğu). Bu bloğu sil.

- [ ] **Step 4: Doğrula**

```bash
npm run build && npm start
```
Lighthouse mobil çalıştır (`npx lighthouse http://localhost:3000 --preset=desktop --view` ve mobil için `--form-factor=mobile`):
- LCP < 2,5 sn
- CLS < 0,1
- Performans skoru > 85

Hedefe ulaşılmıyorsa hangi kaynağın engellediğini raporda tespit et ve düzelt.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "perf: add responsive image sizes and optimize LCP"
```

---

# FAZ 7 — TEMİZLİK

### Task 18: Ölü kod temizliği ve son doğrulama

**Files:**
- Delete: `app/admin/` (tüm klasör)
- Modify: `app/components/FeaturesSection.tsx`
- Modify: `app/sss/SSS.tsx`
- Create: `README.md` *(yeniden yazılır)*

- [ ] **Step 1: Admin sayfasını sil**

```bash
git rm -r app/admin
```

Sebep: Kimlik doğrulaması yok, form hiçbir şey yapmıyor, `process.env.REACT_APP_PASSWORD` Next.js'te istemciye hiç ulaşmayan bir değişken. Yayında olması hem güvenlik hem itibar riski. Gerçek bir yönetim paneli gerekirse ayrı bir plan konusudur.

- [ ] **Step 2: `content/faq.ts`'e yayın hazırlık bayrağı ekle**

⚠️ **Bu adım Task 18'in en riskli kısmıdır.** `content/faq.ts` içindeki üç cevap (`servis`,
`yemek`, `uyum-sureci`) hâlâ literal `TODO:` metni taşıyor. `/sss` sayfası `FAQ_ITEMS`
listesinin tamamını render edecek — yani **hiçbir önlem alınmazsa "TODO: Gerçek
güzergâhları yazın" metni canlı sayfada velilere görünür ve `FAQPage` yapısal verisine
girip Google tarafından indekslenir.** Bu, Task 7'nin sahte telefon numarası için
engellediği hatanın birebir aynısıdır.

`featured` bayrağı bunu çözmez — o "ana sayfada göster" demek, "yayına hazır" demek değil.
Ayrı ve dik bir bayrak ekleyin:

```typescript
export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  featured: boolean;
  /** false ise cevap henüz okul tarafından doldurulmamıştır; hiçbir yerde render edilmez. */
  ready: boolean;
};

/** Yayına hazır sorular — render edilecek ve schema'ya girecek tek liste budur. */
export const PUBLISHED_FAQ = FAQ_ITEMS.filter((item) => item.ready);
export const FEATURED_FAQ = PUBLISHED_FAQ.filter((item) => item.featured);
```

`TODO:` ile başlayan cevabı olan üç maddeye `ready: false`, diğerlerine `ready: true` verin.

- [ ] **Step 3: Koruma testi yaz — TODO metni asla yayına çıkmasın**

`content/__tests__/faq.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { FAQ_ITEMS, PUBLISHED_FAQ, FEATURED_FAQ } from '../faq';
import { buildFaqSchema } from '@/lib/schema';

describe('FAQ yayın güvenliği', () => {
  it('yayınlanan hiçbir cevap TODO metni içermez', () => {
    for (const item of PUBLISHED_FAQ) {
      expect(item.answer).not.toMatch(/TODO/i);
      expect(item.question).not.toMatch(/TODO/i);
    }
  });

  it('öne çıkan sorular yayınlananların alt kümesidir', () => {
    for (const item of FEATURED_FAQ) {
      expect(PUBLISHED_FAQ).toContain(item);
    }
  });

  it('schema çıktısına TODO metni sızmaz', () => {
    const json = JSON.stringify(buildFaqSchema(PUBLISHED_FAQ));
    expect(json).not.toMatch(/TODO/i);
  });

  it('hazır olmayan maddeler hâlâ FAQ_ITEMS içinde durur (kaybolmaz)', () => {
    expect(FAQ_ITEMS.length).toBeGreaterThan(PUBLISHED_FAQ.length);
  });
});
```

Son test kasıtlıdır: hazır olmayan sorular silinmez, sadece render edilmez — okul
cevapları verdiğinde `ready: true` yapmak yeterli olsun.

- [ ] **Step 4: `SSS.tsx`'i `content/faq.ts`'e bağla**

Sayfa içindeki soru dizisini sil, **`PUBLISHED_FAQ`** kullan (`FAQ_ITEMS` değil).
Sayfaya `buildFaqSchema(PUBLISHED_FAQ)` ile FAQPage schema ekle.

⚠️ Mevcut `SSS.tsx` bayat içerik taşıyor: "2-6 yaş" ifadesi ve fiyat/indirim dili.
Bunlar bağlayıcı kararlara aykırıdır ve dosyayla birlikte gitmelidir.

`FAQSection.tsx`'in `FEATURED_FAQ` kullanımı değişmez — o zaten artık `PUBLISHED_FAQ`
üzerinden türetiliyor.

⚠️ **`/ucretler` sayfası da düzeltilmeli.** Task 14 o sayfada `FAQ_ITEMS`'ı üç id'ye
göre filtreliyor (`sinif-mevcudu`, `servis`, `yemek`) ve sonucu `buildFaqSchema`'ya
veriyor. Bunlardan **`servis` ve `yemek` hâlâ `TODO:` metni taşıyor** — yani şu anda
`/ucretler` sayfası indekslenebilir yapısal veriye TODO metni gömüyor.

`app/ucretler/page.tsx` içindeki filtreyi `FAQ_ITEMS` yerine **`PUBLISHED_FAQ`**
üzerinden çalışacak biçimde değiştirin:

```typescript
const FAQ_SUBSET = PUBLISHED_FAQ.filter((item) =>
  ['sinif-mevcudu', 'servis', 'yemek'].includes(item.id),
);
```

Böylece okul cevapları doldurup `ready: true` yapana kadar o iki soru ne sayfada ne
schema'da görünür. Task 18 Step 3'teki koruma testi bunu zaten yakalar — ama
`buildFaqSchema` çağıran **her** sayfayı tarayın, sadece bilinen ikisini değil:

```bash
grep -rn "buildFaqSchema" app --include="*.tsx"
```

- [ ] **Step 3: `FeaturesSection.tsx`'i premium mesajla güncelle**

Üç farklılaştırıcıya indir ve rakiplerden ayrışan noktaları öne çıkar:
1. **10 kişilik sınıf, 2 öğretmen, öğretmen başına 5 çocuk** — MEB üst sınırının dörtte biri
2. **Çocuklarımız mezun olduğunda İngilizce konuşuyor** — native öğretmen, günlük akışın parçası
3. Branş genişliği: robotik, satranç, seramik, yüzme, binicilik, dans, drama, müzik + psikolog desteği

- [ ] **Step 4: `README.md` yeniden yaz**

Create-next-app şablon metnini sil. Yeni içerik: proje tanımı, kurulum, `.env.local` gereksinimleri, içerik güncelleme rehberi (`content/` klasörünün nasıl düzenleneceği), deploy notu (AWS Amplify).

- [ ] **Step 4b: Kırık görsel referanslarını temizle**

⚠️ Task 16'nın incelemesi, hiç var olmamış dosyalara işaret eden referanslar buldu.
Bunlar **canlı sayfalarda kırık görsel** olarak görünüyor:

| Dosya | Referans | Durum |
|---|---|---|
| `app/bultenler/page.tsx:98-165` | `/gezi1.jpg` … `/gezi4.jpg`, `/aktivite1.jpg` … `/aktivite6.jpg` | 10 adet, hiç var olmadı |
| `app/bultenler/page.tsx:300,324` | `/placeholder.jpg` (fallback) | yok |
| `app/aktiviteler/page.tsx:258,298` | `/placeholder.jpg` (fallback) | yok |
| `app/components/ActivitiesSection.tsx:72` | `/placeholder.jpg` (fallback) | yok |
| `app/admin/components/Gezi.tsx:23` | `/gezi-placeholder.jpg` | admin ile birlikte silinecek |

Yapılacaklar:

1. **`/bultenler` sayfasındaki 10 sahte görsel yolunu kaldırın.** `gezi` ve `aktivite`
   dizilerindeki `resim` alanları ya tamamen silinmeli ya da `resim: null` yapılıp
   kart görselsiz render edilmeli. Sahte fotoğraf yolu bırakmayın — okul gerçek
   etkinlik fotoğrafı verene kadar görselsiz kart, kırık görselden iyidir.
2. **`/placeholder.jpg` fallback'lerini gerçek bir dosyayla değiştirmeyin** — bunun
   yerine görsel yoksa `<Image>` hiç render edilmesin:
   ```tsx
   {aktivite.resim ? (
     <Image src={aktivite.resim} alt={aktivite.başlık} ... />
   ) : null}
   ```
3. Bittiğinde doğrulayın — kodda kalan **her** görsel yolu `public/` içinde
   gerçekten var olmalı. Tek istisna `content/teachers.ts` içindeki `/kadro/*`
   yollarıdır (okuldan fotoğraf bekleniyor, bilinen boşluk):

```bash
grep -rhno '"/[^"]*\.\(jpg\|jpeg\|png\|webp\|svg\)"' app content lib \
  --include="*.tsx" --include="*.ts" | sed 's/.*"\(\/[^"]*\)"/\1/' | sort -u | \
  while read -r p; do [ -f "public$p" ] || echo "EKSİK: $p"; done
```

Beklenen çıktı: yalnızca `/kadro/kurucu.jpg` ve `/og-default.jpg`.

- [ ] **Step 4c: Küçük düzeltmeler (önceki task incelemelerinden biriktirildi)**

- `app/components/Header.tsx:16` — `z-9999` geçersiz bir Tailwind sınıfı, hiç CSS
  üretmiyor. `z-[9999]` yapın.
- `app/veli-yorumlari/page.tsx` — boş durum CTA'sı çıplak `<a href="/kayit">`
  kullanıyor; sitenin en değerli dönüşüm yolunda tam sayfa yenileme yapıyor ve hiç
  analytics olayı göndermiyor. `TrackedLink`'e çevirin:
  `event="cta_click" payload={{ page: 'veli-yorumlari', target: 'empty-state' }}`
- `app/components/FAQSection.tsx` — gereksiz `const featuredFAQs = FEATURED_FAQ` takma
  adı; doğrudan `FEATURED_FAQ` kullanın.

- [ ] **Step 5: Tam doğrulama geçişi**

```bash
npm test
npm run lint
npm run build
```
Üçü de temiz geçmeli.

Elle kontrol listesi:
- [ ] Her sayfanın sekme başlığı farklı
- [ ] `/sitemap.xml` tüm sayfaları içeriyor, `/tesekkurler` içermiyor
- [ ] `/robots.txt` doğru sitemap adresini gösteriyor
- [ ] Form gönderimi `/tesekkurler` sayfasına yönlendiriyor
- [ ] WhatsApp butonu doğru numaraya ve ön yazılı mesaja gidiyor
- [ ] Mobilde alt bar içeriği örtmüyor
- [ ] Hiçbir sayfada "Bultenler" / "Sikca" yazımı kalmadı
- [ ] Footer'da içinde bulunulan yıl görünüyor
- [ ] Hiçbir yerde `href="#"` sosyal link yok
- [ ] Sayfa kaynağında `+90-555-123-4567` geçmiyor
- [ ] Sayfa kaynağında `meta name="keywords"` yok
- [ ] `indirim` / `kampanya` / `uygun fiyat` kelimeleri hiçbir sayfada geçmiyor

Son kontrol komutu:

```bash
grep -rn "555-123\|href=\"#\"\|Bultenler\|Sikca\|© 2024\|indirim\|kampanya\|uygun fiyat\|250\.000\|250 bin\|3-6 yaş\|0-2 yaş\|TODO:" app content lib --include="*.tsx" --include="*.ts"
```
Expected: Hiçbir sonuç dönmemeli.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove dead admin page, wire FAQ content, rewrite readme"
```

---

## Uygulama Sonrası: İçerik Doldurma Kontrol Listesi

Kod tamamlandığında geriye TODO işaretli **içerik** kalır. Bunlar kod işi değil, okul yönetiminin bilgi işidir:

| Öncelik | TODO | Nerede |
|---|---|---|
| 🔴 | Öğretmen kadrosu: fotoğraf, eğitim, deneyim (native öğretmen dahil) | `content/teachers.ts` + `public/kadro/` |
| 🔴 | Gerçek veli yorumları (yazılı onaylı) | `content/testimonials.ts` |
| 🔴 | Google Maps koordinatı, posta kodu | `lib/site.ts` |
| 🔴 | Instagram/Facebook hesap URL'leri | `lib/site.ts` |
| 🟠 | Ücrete dahil / hariç listesinin doğrulanması (rakam DEĞİL) | `/ucretler`, `faq.ts` |
| 🟠 | Servis güzergâhları | `faq.ts`, `/guvenlik` |
| 🟠 | Yemek/mutfak detayı, menü döngüsü | `dailyFlow.ts`, `faq.ts` |
| 🟠 | Güvenlik altyapısı detayı, deprem belgesi | `/guvenlik` |
| 🟠 | OG görseli (1200×630) | `public/og-default.jpg` |
| 🟡 | Profesyonel fotoğraf çekimi | Tüm görseller |
| 🟡 | Tanıtım videosu / 360° sanal tur | `/kayit`, ana sayfa |

**Dizin düzeltmeleri (kod dışı, ama acil):** `anaokuluvekresler.com` ve `okul.com.tr`
kayıtlarındaki "0-2, 2-3 yaş" ve "Ücret: 1.000-1.500 TL" bilgileri yanlıştır ve
2-6 yaş olarak düzeltilmelidir. Eski `sekerakademi.com` domaini
`sekeranaokulu.com`'a 301 ile yönlendirilmelidir.

---

## Self-Review

**1. Spec coverage**

| Kullanıcı isteği | Karşılayan bölüm |
|---|---|
| "websitesini güncellememiz lazım" | Task 1-18, tüm plan |
| "güncelleme planını yap" | 18 task, bite-sized adımlar |
| "bu okulun seneliği 250.000 TL biraz lüks bi okul" | Stratejik Brief fiyat analizi, Task 9 (premium tasarım), Task 10 (hero), Task 14 (ücret çerçevesi), Global Constraints (kampanya dili yasağı) |
| "doğru insanların karşısına çıkmak lazım" | Stratejik Brief hedef coğrafya (Alkent 2000, Mimaroba, Bahçeşehir), keyword haritası, Task 3 (nitelik filtreleyen form) |
| "öbür siteleri de incele" | Stratejik Brief rakip tablosu — Düş Bilginleri, Neşe Erberk, Nurtopu gerçek site incelemeleri |
| "keywordleri toparla" | Keyword haritası → sayfa eşlemesi tablosu + negatif alan |
| "website için bir reconstruction planı" | File Structure + 18 task, 7 faz |

**2. Placeholder taraması**

Planda `TODO` işaretleri var — ancak bunlar *plan boşluğu* değil, **kasıtlı içerik ayrımı**: okul yönetiminden gelmesi gereken gerçek veriler (sınıf mevcudu, öğretmen özgeçmişleri, servis güzergâhları). Her biri "Uygulama Sonrası İçerik Doldurma Kontrol Listesi"nde sahibi ve konumuyla listelendi. Kod, TODO metinleriyle de çalışır durumdadır — uygulama bunları beklemek zorunda değildir.

**3. Tip tutarlılığı**

- `SITE` — Task 1'de tanımlandı, 2/4/6/7/8/10/11/13/15'te kullanıldı, alan adları tutarlı
- `leadSchema` / `AGE_GROUPS` / `PROGRAMS` — Task 2'de tanımlandı, Task 3'te tüketildi
- `buildMetadata` — Task 6'da tanımlandı, Task 12-15'te aynı imzayla kullanıldı
- `FaqItem` — `content/faq.ts` (Task 7) tanımlıyor, `lib/schema.ts` import ediyor; döngüsel bağımlılık yok (schema → content tek yönlü)
- `trackEvent` — Task 5'te tanımlandı, Task 3/4'ün ham `dataLayer.push` çağrıları Task 5 Step 6'da bu fonksiyona geçirildi
- `AgeGroup.slug` — Task 12'de `string`, Task 8'in sitemap'inde aynı alanla tüketiliyor
- `FaqItem.id` — `string` olarak tanımlı; `FAQSection`'ın `openItems` state'i Task 7 Step 7'de `string[]`'e çevriliyor (eski kod `number[]` idi)

**Tespit edilen ve düzeltilen tutarsızlık:** Task 8 (sitemap) yaş grubu URL'lerini elle listeliyor ama Task 12 `content/ageGroups.ts`'i oluşturuyor. Task 8 önce çalıştığı için elle liste kabul edildi, Task 12 Step 7'de dinamik hale getiriliyor. Sıralama bağımlılığı planda açıkça belirtildi.
