# Reklam Odaklı Tasarım ve Landing Page Sistemi — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 45.000 TL/ay Google Ads arama trafiğini karşılayacak yüzeyi kurmak: kırık test altyapısını onarmak, sinematik-bilgilendirici bir tasarım sistemi kurmak, reklam ölçümünü (Consent Mode v2, GCLID, yaşa göre dönüşüm değeri) tamamlamak ve en çok harcayan beş reklam grubu için sessiz, hızlı, tek CTA'lı dedike landing page sistemi eklemek.

**Architecture:** Mevcut Next.js 15 App Router kod tabanı korunur — 17 sayfa, veri katmanı, metadata/schema/sitemap altyapısı çalışıyor. Üzerine beş katman eklenir: (1) çalışan test altyapısı ve bütünlük testleri, (2) yeni tasarım dili — kâğıt/mürekkep zemin, gün ışığı derecelendirmesi, üç rollü tipografi ve üç sinematik ilkel bileşen (`Frame`, `Timecode`, `Roster`), (3) aynı dilin **üç yoğunlukta** uygulanması — `/gunluk-akis` tam sinematik, `/` ölçülü, `/lp/*` sessiz, (4) reklam ölçüm altyapısı, (5) `app/(site)` / `app/(lp)` route group ayrımıyla iki sayfa kabuğu.

**Tech Stack:** Next.js 15.3.1 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Vitest 4, **happy-dom** (jsdom yerine — Task 1), Zod 4, Resend, `next/font/google`.

---

## Global Constraints

Bu kısıtlar **her task için geçerlidir**, tekrar edilmez.

- **Dil:** Tüm kullanıcıya görünen metin Türkçedir; `ı İ ş ğ ü ö ç` doğru kullanılır.
- **NAP tek kaynak:** Ad, adres, telefon, e-posta **yalnızca** `lib/site.ts` içinde. Hiçbir bileşen hard-code etmez.
- **Marka adı:** Her yerde `Özel Şeker Anaokulu`.
- **Yaş aralığı: 2 yaşından 5 yaşının sonuna kadar. 6 yaş yoktur.** Dört grup: `2-3`, `3-4`, `4-5`, `5-6`. Metinlerde ibare **`2-6 yaş`**.
- **Sınıf mevcudu: 10 çocuk, 2 öğretmen — öğretmen başına 5 çocuk.** Bu rakam `content/ageGroups.ts` içindeki grup bazlı `classSize` alanından okunur, global sabit olarak hard-code edilmez.
- **Ücret rakamı hiçbir sayfada yazılmaz.** Tutar, `₺`, aylık/yıllık fiyat — hiçbiri kullanıcıya görünen metinde yer almaz.
- **Yasak kelimeler:** `indirim`, `kampanya`, `uygun fiyat`, `bütçe dostu`, `fırsat`. Yerine: `kontenjan`, `ön görüşme`, `değerlendirme`, `ödeme planı`, `burs`.
- **Birincil CTA:** `Ön Görüşme Randevusu`. İkincil: `WhatsApp'tan Yazın`.
- **Hareket:** Her animasyon `@media (prefers-reduced-motion: no-preference)` içinde tanımlanır. Hareket kapalıyken sayfa **tam anlaşılır** kalır; içerik animasyonla ortaya çıkmaz, sadece hareketle *vurgulanır*.
- **Mobil öncelik:** Trafiğin ~%80'i mobil. `2.39:1` letterbox **yalnızca `md` ve üzeri**; mobilde `4:5`.
- **Performans geçidi:** Reklam hedefi olan her URL mobilde **LCP < 2.5 sn**. Aşan sayfa reklamda kullanılmaz.
- **Test komutu:** `npm test`. Build: `npm run build`. Her task sonunda ikisi de yeşil.
- **Commit:** Her task sonunda tek commit, İngilizce conventional commit mesajı.
- **`@/` alias'ı** proje köküne işaret eder; yeni import'larda kullanılır.

---

## Mevcut Durum (2026-07-31 tespiti)

Önceki plan (`2026-07-30-website-reconstruction.md`) büyük ölçüde uygulandı. Fiili durum:

| Alan | Durum |
|---|---|
| 17 site sayfası (`/`, `/kayit`, `/ucretler`, `/egitim-yaklasimimiz`, `/veli-yorumlari`, `/yas-gruplari/*`, `/kadromuz`, `/gunluk-akis`, `/guvenlik`, `/aktiviteler`, `/hakkimizda`, `/bultenler`, `/sss`, `/iletisim`, yasal sayfalar, `/tesekkurler`) | ✅ Var |
| Veri katmanı: `ageGroups`, `dailyFlow`, `faq`, `nav`, `teachers`, `testimonials` | ✅ Var |
| `lib/`: `site`, `metadata`, `schema`, `analytics`, `leadSchema` | ✅ Var |
| Lead API + `LeadForm` + `/tesekkurler` | ✅ Var |
| GTM (`Analytics.tsx`), `sitemap.ts`, `robots.ts` | ✅ Var |
| Görseller webp'e çevrilmiş | ✅ Var |
| **Test altyapısı** | 🔴 **ÇÖKMÜŞ** — `npm test` → 0 test, 11 hata |
| **`app/admin/`** | 🔴 Kimlik doğrulamasız sahte login, hâlâ duruyor |
| **Kırık görsel referansları** | 🔴 `/gezi1.jpg`…`/gezi4.jpg`, `/aktivite1.jpg`…`/aktivite3.jpg`, `/placeholder.jpg`, `/gezi-placeholder.jpg` — `public/` içinde **yok** |
| `asyalicocuk.webp` (400×400 stok avatar) | 🔴 Hâlâ kullanımda |
| Consent Mode v2, GCLID, yaşa göre dönüşüm değeri | 🔴 Yok |
| Dedike landing page sistemi | 🔴 Yok |

---

## Tasarım Dili

### Tez

Bu okulun ürünü bir sayı: **on çocuk, iki öğretmen, öğretmen başına beş.** MEB yirmiye izin veriyor. Tasarım bu sayının etrafında kurulur — dekor olarak değil, taşıyıcı yapı olarak.

Sinematik dil, Oxford *Interacting with Computers* dergisindeki [cinematographic approach to web design](https://academic.oup.com/iwc/article/38/1/24/8246686) çerçevesinden alınır ve üç mekanizmaya indirgenir:

| Mekanizma | Bu sitedeki karşılığı |
|---|---|
| **Indexing** — kamera hareketiyle dikkati yönlendirme | `TimeSpine`: sol kenarda kaydırmayla ilerleyen timecode |
| **Bracketing** — kadrajla anlamlı öğeyi çerçeveleme | `Frame`: letterbox oranlı, dereceli fotoğraf kadrajı |
| **Scaling** — öğeyi anlatıdaki önemine göre büyütme | `Roster`: künye yalnızca tek bir bölümde tam boyutta |

### Üç yoğunluk

Aynı sistem, hedefin niyetine göre farklı yoğunlukta:

| Yüzey | Yoğunluk | Gerekçe |
|---|---|---|
| `/lp/*` (bütçenin %46'sı) | **Sessiz.** Yalnızca `Frame` (statik) + tipografi. Scroll animasyon CSS'i yüklenmez. | Yüksek niyetli trafik hız ister. |
| `/` (bütçenin %19'u + marka) | **Ölçülü.** `Roster` hero'da tam boyut, günün üç sahnelik önizlemesi, hafif giriş hareketi. Form ilk kaydırmada erişilebilir. | Hem ikna hem dönüşüm. |
| `/gunluk-akis` (K10 hedefi + organik) | **Tam sinematik.** Dokuz bölüm, `TimeSpine`, kadraj derecelendirmesi, scroll-driven geçişler. | Buraya gelen kişi zaten "bir gün nasıl geçiyor" diye sormuş. |

### Tokenlar

```
Kâğıt ve mürekkep — sabit. Okunaklılık pazarlık konusu değil.
  paper       #F7F6F2      paper-warm  #EFEDE5
  ink         #14170F      ink-soft    #4A4E42
  rule        #D8D5C9

Gün ışığı dereceleri — yalnızca kadraj grading'i ve bölüm vurgusu.
  dawn        #3E4A5B      morning     #2F5A45
  midday      #C98A2E      golden      #A8763A
  dusk        #232742

Künye işareti — tek vurgu rengi, tek görev.
  mark        #C98A2E
```

**Tipografi — üç rol, üç aile:**

| Rol | Aile | Kullanım |
|---|---|---|
| Başlık | **Bricolage Grotesque** | Bölüm başlıkları, hero. Değişken genişlikli, karakterli. |
| Okuma | **Newsreader** | Uzun metin. Optik boyut eksenli, sıcak, edebi. |
| Veri | **Martian Mono** | Yalnızca timecode, rakamlar, etiketler. |

Üçü de `latin-ext` alt kümesiyle yüklenir; Türkçe karakter render'ı Task 3'te doğrulanır.

---

## File Structure

### Yeni dosyalar

| Dosya | Sorumluluk |
|---|---|
| `lib/consent.ts` | Consent Mode v2 saf fonksiyonları |
| `lib/attribution.ts` | GCLID + landing path yakalama ve saklama |
| `content/media.ts` | Görsel tek doğruluk kaynağı |
| `content/day.ts` | "Bir Gün" bölümleri — `/gunluk-akis` ve `/` önizlemesini besler |
| `content/landingPages.ts` | Beş LP'nin tüm içeriği |
| `app/components/cine/Frame.tsx` | Letterbox kadraj + derecelendirme |
| `app/components/cine/Timecode.tsx` | Mono zaman etiketi |
| `app/components/cine/TimeSpine.tsx` | Sol kenar zaman omurgası |
| `app/components/cine/Roster.tsx` | Künye: 10 + 2 işaret, 20 soluk işaret |
| `app/components/ConsentDefaults.tsx` | GTM öncesi varsayılan onay reddi |
| `app/components/CookieBanner.tsx` | KVKK onay bandı |
| `app/components/AttributionFields.tsx` | LeadForm gizli alanları |
| `app/components/lp/LpHeader.tsx` | Menüsüz üst bar |
| `app/components/lp/LpFooter.tsx` | Menüsüz alt bar |
| `app/components/lp/ProofStrip.tsx` | Dört rakamlı kanıt şeridi |
| `app/(site)/layout.tsx` | Site kabuğu |
| `app/(lp)/layout.tsx` | LP kabuğu |
| `app/(lp)/lp/[slug]/page.tsx` | Dinamik LP rotası |
| `app/cine.css` | Scroll-driven animasyon katmanı — **yalnızca `(site)` yükler** |

### Silinecek

`app/admin/` · `public/asyalicocuk.webp` · `public/next.svg` · `public/vercel.svg` · `public/file.svg` · `public/globe.svg` · `public/window.svg`

---

# FAZ 0 — ONARIM

### Task 1: Test altyapısını onar ve bütünlük testleri ekle

**Files:**
- Modify: `package.json`, `vitest.config.mts`
- Create: `app/__tests__/routes.test.ts`, `app/__tests__/assets.test.ts`

**Interfaces:**
- Consumes: `NAV_ITEMS`, `FOOTER_LINKS` (`content/nav.ts`), `sitemap` (`app/sitemap.ts`), `SITE` (`lib/site.ts`)
- Produces: Çalışan `npm test`. `pageExists(href)` yardımcısı route group'ları (`(site)`, `(lp)`) tanır — Task 11 sayfaları taşıdığında test kırılmaz.

- [ ] **Step 1: Kırıklığı doğrula**

```bash
npm test
```
Expected: `Test Files no tests` · `Errors 11 errors` · `ERR_REQUIRE_ESM`. Sebep: jsdom 30.0.1 → `html-encoding-sniffer@6` → `@exodus/bytes` ESM modülünü CJS `require()` ile yüklemeye çalışıyor.

- [ ] **Step 2: jsdom'u happy-dom ile değiştir**

happy-dom seçildi: ESM/CJS çakışması yok, Vitest ile birinci sınıf destekli, React bileşen render'ı için yeterli.

```bash
npm uninstall jsdom
npm install -D happy-dom
```

- [ ] **Step 3: `vitest.config.mts` ortamını değiştir**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 4: Testlerin çalıştığını doğrula**

```bash
npm test
```
Expected: Mevcut test dosyaları çalışır ve geçer. `lib/__tests__/analytics.test.ts` içindeki `delete window.dataLayer` happy-dom'da hata verirse `window.dataLayer = undefined;` olarak değiştir.

- [ ] **Step 5: Rota bütünlüğü testini yaz**

`app/__tests__/routes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { NAV_ITEMS, FOOTER_LINKS } from '@/content/nav';
import sitemap from '../sitemap';
import { SITE } from '@/lib/site';

const APP_DIR = path.join(process.cwd(), 'app');
const ROUTE_GROUPS = ['', '(site)', '(lp)'];

/** Bir href'in karşılığı page.tsx var mı — route group'ları tanır. */
export function pageExists(href: string): boolean {
  const segments = href.split('/').filter(Boolean);
  return ROUTE_GROUPS.some((group) => {
    const parts = group ? [group, ...segments] : segments;
    return existsSync(path.join(APP_DIR, ...parts, 'page.tsx'));
  });
}

const menuHrefs = [...new Set([...NAV_ITEMS, ...FOOTER_LINKS].map((i) => i.href))];

describe('menü rotaları', () => {
  it.each(menuHrefs)('%s sayfası mevcut', (href) => {
    expect(pageExists(href)).toBe(true);
  });
});

describe('sitemap rotaları', () => {
  const paths = sitemap().map((e) => e.url.replace(SITE.url, '') || '/');

  it.each(paths)('%s sayfası mevcut', (routePath) => {
    expect(pageExists(routePath)).toBe(true);
  });

  it('landing page rotalarını listelemez', () => {
    expect(paths.some((p) => p.startsWith('/lp/'))).toBe(false);
  });
});
```

- [ ] **Step 6: Görsel referansı bütünlüğü testini yaz**

Bu test şu anda **kırmızı** olacak — `/gezi1.jpg` gibi var olmayan dosyalara referans var. Task 2 onu yeşile çevirir.

`app/__tests__/assets.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

/** Kaynak dosyalarda geçen tüm /xxx.(jpg|png|webp|svg|avif) yolları. */
function referencedAssets(): { file: string; asset: string }[] {
  const pattern = /["'`](\/[A-Za-z0-9_\-./]+\.(?:jpg|jpeg|png|webp|svg|avif))["'`]/g;
  const found: { file: string; asset: string }[] = [];
  for (const file of [
    ...walk(path.join(ROOT, 'app')),
    ...walk(path.join(ROOT, 'content')),
    ...walk(path.join(ROOT, 'lib')),
  ]) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      found.push({ file: path.relative(ROOT, file), asset: match[1] });
    }
  }
  return found;
}

describe('görsel referansları', () => {
  const refs = referencedAssets();

  it('en az bir görsel referansı bulunuyor (tarayıcı çalışıyor)', () => {
    expect(refs.length).toBeGreaterThan(0);
  });

  it.each(refs)('$file → $asset dosyası public/ içinde mevcut', ({ asset }) => {
    expect(existsSync(path.join(PUBLIC_DIR, asset))).toBe(true);
  });
});
```

- [ ] **Step 7: Testi çalıştır, doğru sebeple kırmızı olduğunu gör**

```bash
npm test
```
Expected: `routes.test.ts` **yeşil** (tüm sayfalar var). `assets.test.ts` **kırmızı** — `/gezi1.jpg`, `/aktivite1.jpg`, `/placeholder.jpg`, `/gezi-placeholder.jpg` bulunamıyor. Bu kırmızı, Task 2'nin tanımıdır.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.mts app/__tests__/
git commit -m "test: replace jsdom with happy-dom, add route and asset integrity tests"
```

---

### Task 2: Ölü kod ve kırık görsel referanslarını temizle

**Files:**
- Delete: `app/admin/`, `public/asyalicocuk.webp`, `public/next.svg`, `public/vercel.svg`, `public/file.svg`, `public/globe.svg`, `public/window.svg`
- Modify: `app/bultenler/page.tsx`, `app/aktiviteler/page.tsx`, `asyalicocuk` kullanan tüm dosyalar

**Interfaces:**
- Consumes: Task 1'in `assets.test.ts` testi
- Produces: `npm test` tamamen yeşil. Task 4'ün `content/media.ts` kataloğu temiz zemine kurulur.

- [ ] **Step 1: Kimlik doğrulamasız admin panelini sil**

```bash
git rm -r app/admin
```

- [ ] **Step 2: Kırık görsel referanslarını bul**

```bash
npm test -- assets 2>&1 | grep -o '/[a-z0-9-]*\.\(jpg\|png\|webp\)' | sort -u
```
Beklenen liste: `/gezi1.jpg`, `/gezi2.jpg`, `/gezi3.jpg`, `/gezi4.jpg`, `/aktivite1.jpg`, `/aktivite2.jpg`, `/aktivite3.jpg`, `/placeholder.jpg`, `/gezi-placeholder.jpg`.

- [ ] **Step 3: `app/bultenler/page.tsx` içindeki kırık referansları düzelt**

`resim: "/gezi1.jpg"` gibi alanları `public/` içinde **gerçekten var olan** webp dosyalarıyla değiştir. Kullanılabilir dosyalar:

```
/art.webp  /beden.webp  /binincilik.webp  /cocukklar.webp  /dans.webp
/drama.webp  /montesori.webp  /motorskills.webp  /muzik.webp
/psikolog.webp  /robotic.webp  /satranc.webp  /seramik.webp
/sportiffaaliyetler.webp  /yazaktiviteleri.webp  /yuzme.webp
```

Eşleme: gezi girişlerine `/yazaktiviteleri.webp`, `/sportiffaaliyetler.webp`, `/binincilik.webp`, `/yuzme.webp`; aktivite girişlerine `/seramik.webp`, `/robotic.webp`, `/muzik.webp`. İçeriğe anlamsal olarak en yakın olanı seç.

- [ ] **Step 4: `app/aktiviteler/page.tsx` içindeki `/placeholder.jpg` fallback'ini düzelt**

`aktivite.resim || "/placeholder.jpg"` ifadelerindeki fallback'i `/cocukklar.webp` yap (iki yerde).

- [ ] **Step 5: `asyalicocuk` kullanımlarını değiştir**

```bash
grep -rn "asyalicocuk" app/ content/
```

Bulunan her kullanımı aşağıdaki gerçek fotoğraflarla değiştir; `alt` metnini de anlamlı yap:

| Sıra | Yeni değer | alt |
|---|---|---|
| 1. kullanım | `/cocukklar.webp` | `Şeker Anaokulu sınıfında çocuklar` |
| 2. kullanım | `/montesori.webp` | `Montessori materyaliyle çalışan çocuk` |
| 3. kullanım | `/art.webp` | `Sanat atölyesinde çalışma` |

Aynı dosyada üçten fazla kullanım varsa listeyi başa dönerek tekrarla.

- [ ] **Step 6: Kullanılmayan dosyaları sil**

```bash
git rm public/asyalicocuk.webp public/next.svg public/vercel.svg public/file.svg public/globe.svg public/window.svg
```

- [ ] **Step 7: Referans kalmadığını doğrula**

```bash
grep -rn "asyalicocuk\|next.svg\|vercel.svg\|file.svg\|globe.svg\|window.svg" app/ content/ lib/
```
Expected: çıktı yok.

- [ ] **Step 8: Test ve build**

```bash
npm test && npm run build
```
Expected: **Tüm testler yeşil** — `assets.test.ts` dahil. Build başarılı.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: remove admin panel, stock avatar and broken image references"
```

---

# FAZ 1 — TASARIM SİSTEMİ

### Task 3: Tasarım tokenları ve tipografi

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`
- Test: `app/__tests__/typography.test.ts`

**Interfaces:**
- Consumes: yok
- Produces: Tailwind 4 tema tokenları (`--color-paper`, `--color-ink`, `--color-mark`, `--color-dawn` … `--color-dusk`) ve üç font değişkeni (`--font-display`, `--font-body`, `--font-mono`). Task 5-13'teki her bileşen bunları kullanır.

- [ ] **Step 1: Font değişkenleri testini yaz**

`app/__tests__/typography.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');
const layout = readFileSync(path.join(process.cwd(), 'app', 'layout.tsx'), 'utf8');

describe('tasarım tokenları', () => {
  it.each([
    '--color-paper', '--color-paper-warm', '--color-ink', '--color-ink-soft',
    '--color-rule', '--color-mark',
    '--color-dawn', '--color-morning', '--color-midday', '--color-golden', '--color-dusk',
  ])('%s tanımlı', (token) => {
    expect(css).toContain(token);
  });

  it('üç font rolü tanımlı', () => {
    expect(css).toContain('--font-display');
    expect(css).toContain('--font-body');
    expect(css).toContain('--font-mono');
  });

  it('eski lacivert/altın paleti kaldırıldı', () => {
    expect(css).not.toContain('--color-navy-');
    expect(css).not.toContain('--color-gold-');
  });
});

describe('font yüklemesi', () => {
  it.each(['Bricolage_Grotesque', 'Newsreader', 'Martian_Mono'])(
    '%s next/font ile yükleniyor',
    (family) => {
      expect(layout).toContain(family);
    },
  );

  it('Türkçe karakterler için latin-ext alt kümesi isteniyor', () => {
    expect(layout).toContain('latin-ext');
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu doğrula**

```bash
npm test -- typography
```
Expected: FAIL

- [ ] **Step 3: `app/globals.css` tema bloğunu değiştir**

Mevcut `@theme { … }` bloğunun **tamamını** şununla değiştir:

```css
@import "tailwindcss";

@theme {
  /* Kâğıt ve mürekkep — sabit. Okunaklılık pazarlık konusu değil. */
  --color-paper:      #F7F6F2;
  --color-paper-warm: #EFEDE5;
  --color-ink:        #14170F;
  --color-ink-soft:   #4A4E42;
  --color-rule:       #D8D5C9;

  /* Gün ışığı dereceleri — yalnızca kadraj grading'i ve bölüm vurgusu. */
  --color-dawn:    #3E4A5B;
  --color-morning: #2F5A45;
  --color-midday:  #C98A2E;
  --color-golden:  #A8763A;
  --color-dusk:    #232742;

  /* Künye işareti — tek vurgu rengi, tek görev. */
  --color-mark: #C98A2E;

  --font-display: var(--font-bricolage), Georgia, serif;
  --font-body:    var(--font-newsreader), Georgia, serif;
  --font-mono:    var(--font-martian), ui-monospace, monospace;
}

:root {
  --background: var(--color-paper);
  --foreground: var(--color-ink);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  font-family: var(--font-display);
  letter-spacing: -0.02em;
  line-height: 1.08;
  font-weight: 600;
}

p {
  line-height: 1.7;
}

/* Timecode ve rakamlar */
.timecode {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

/* Odak halkası — künye rengiyle aynı, tek vurgu disiplini */
:focus-visible {
  outline: 2px solid var(--color-mark);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: no-preference) {
  a, button {
    transition: color 200ms ease, background-color 200ms ease, border-color 200ms ease;
  }
}
```

- [ ] **Step 4: `app/layout.tsx` fontlarını değiştir**

`Fraunces` ve `Inter` import'larını ve tanımlarını sil, yerine:

```tsx
import { Bricolage_Grotesque, Newsreader, Martian_Mono } from "next/font/google";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const martian = Martian_Mono({
  variable: "--font-martian",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
});
```

`<body>` className'indeki `${fraunces.variable} ${inter.variable}` ifadesini `${bricolage.variable} ${newsreader.variable} ${martian.variable}` yap.

- [ ] **Step 5: Eski renk sınıflarını yeni tokenlara taşı**

```bash
grep -rln "navy-\|gold-\|bg-cream\|text-cream" app/
```

Bulunan her dosyada şu eşlemeyi uygula:

| Eski | Yeni |
|---|---|
| `bg-cream`, `bg-ivory` | `bg-paper` |
| `text-navy-900`, `text-navy-800` | `text-ink` |
| `text-navy-700`, `text-navy-600` | `text-ink-soft` |
| `text-navy-500`, `text-navy-100` | `text-ink-soft` |
| `bg-navy-900` | `bg-ink` |
| `border-navy-100`, `border-navy-200`, `ring-navy-100` | `border-rule`, `ring-rule` |
| `text-gold-500`, `text-gold-600` | `text-mark` |
| `bg-gold-*` | `bg-mark` |
| `hover:bg-navy-800` | `hover:bg-ink-soft` |

- [ ] **Step 6: Test ve build**

```bash
npm test && npm run build
```
Expected: Testler yeşil, build başarılı, hiçbir dosyada `navy-` veya `gold-` sınıfı kalmamış.

- [ ] **Step 7: Türkçe karakter render'ını gözle doğrula**

```bash
npm run dev
```
Ana sayfayı aç, şu karakterlerin üç fontta da doğru göründüğünü kontrol et: **ı İ ş Ş ğ Ğ ü Ü ö Ö ç Ç**. Bir font Türkçe karakteri düşürüyorsa, o rol için `latin-ext` destekleyen alternatife geç (başlık: `Instrument_Sans`, okuma: `Petrona`, mono: `Roboto_Mono`) ve `typography.test.ts` içindeki aile adını güncelle.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: replace design tokens and typography with paper-ink cinematic system"
```

---

### Task 4: Görsel kataloğu

**Files:**
- Create: `content/media.ts`, `content/__tests__/media.test.ts`
- Create: `docs/cekim-brief.md`

**Interfaces:**
- Consumes: `public/` dosyaları
- Produces:
  - `type MediaAsset = { src: string; alt: string; width: number; height: number; status: 'stok' | 'gercek' }`
  - `MEDIA` katalog nesnesi, `type MediaKey = keyof typeof MEDIA`
  - `pendingShootAssets(): MediaKey[]`
  - Task 6, 7, 13 bu anahtarları kullanır.

- [ ] **Step 1: Testi yaz**

`content/__tests__/media.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { MEDIA, pendingShootAssets } from '../media';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const entries = Object.entries(MEDIA);

describe('MEDIA kataloğu', () => {
  it.each(entries)('%s dosyası public/ içinde mevcut', (_key, asset) => {
    expect(existsSync(path.join(PUBLIC_DIR, asset.src))).toBe(true);
  });

  it.each(entries)('%s anlamlı alt metne sahip', (_key, asset) => {
    expect(asset.alt.length).toBeGreaterThan(10);
  });

  it.each(entries)('%s boyutları pozitif', (_key, asset) => {
    expect(asset.width).toBeGreaterThan(0);
    expect(asset.height).toBeGreaterThan(0);
  });

  it('sınıf geniş açı görseli tanımlı — hero ve LP zorunlu varlığı', () => {
    expect(MEDIA.classroomWide).toBeDefined();
  });

  it('pendingShootAssets yalnızca stok işaretlileri döndürür', () => {
    for (const key of pendingShootAssets()) {
      expect(MEDIA[key].status).toBe('stok');
    }
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu doğrula**

```bash
npm test -- media
```
Expected: FAIL — `Cannot find module '../media'`

- [ ] **Step 3: `content/media.ts` yaz**

Boyutlar diskteki gerçek dosyalardan okunmuştur (tümü 1500 px genişlik).

```typescript
export type MediaAsset = {
  /** public/ köküne göre yol. */
  src: string;
  alt: string;
  width: number;
  height: number;
  /**
   * 'stok'   — çekim sonrası değiştirilecek geçici görsel
   * 'gercek' — okulun kendi çekimi
   * Çekim geldiğinde src, boyutlar ve status birlikte güncellenir.
   */
  status: 'stok' | 'gercek';
};

export const MEDIA = {
  classroomWide: { src: '/cocukklar.webp', alt: 'Şeker Anaokulu sınıfında çocuklar ve öğretmenleri', width: 1500, height: 890, status: 'stok' },
  montessori: { src: '/montesori.webp', alt: 'Montessori materyaliyle çalışan çocuk', width: 1500, height: 1100, status: 'gercek' },
  art: { src: '/art.webp', alt: 'Sanat atölyesinde resim çalışması', width: 1500, height: 1100, status: 'gercek' },
  ceramics: { src: '/seramik.webp', alt: 'Seramik atölyesinde çamur çalışması', width: 1500, height: 1101, status: 'gercek' },
  robotics: { src: '/robotic.webp', alt: 'Robotik ve kodlama atölyesi', width: 1500, height: 1101, status: 'gercek' },
  chess: { src: '/satranc.webp', alt: 'Satranç dersinde çocuklar', width: 1500, height: 1101, status: 'gercek' },
  swimming: { src: '/yuzme.webp', alt: 'Yüzme etkinliği', width: 1500, height: 1101, status: 'gercek' },
  music: { src: '/muzik.webp', alt: 'Müzik dersinde enstrüman çalışması', width: 1500, height: 1101, status: 'gercek' },
  drama: { src: '/drama.webp', alt: 'Drama atölyesinde canlandırma', width: 1500, height: 1100, status: 'gercek' },
  dance: { src: '/dans.webp', alt: 'Dans dersinde çocuklar', width: 1500, height: 1101, status: 'gercek' },
  riding: { src: '/binincilik.webp', alt: 'Binicilik etkinliği', width: 1500, height: 1101, status: 'gercek' },
  psychologist: { src: '/psikolog.webp', alt: 'Uzman psikolog eşliğinde bireysel çalışma', width: 1500, height: 1101, status: 'gercek' },
  motorSkills: { src: '/motorskills.webp', alt: 'İnce motor becerileri çalışması', width: 1500, height: 944, status: 'gercek' },
  sports: { src: '/sportiffaaliyetler.webp', alt: 'Sportif faaliyetler', width: 1500, height: 1101, status: 'gercek' },
  physicalEducation: { src: '/beden.webp', alt: 'Beden eğitimi dersi', width: 1500, height: 1101, status: 'gercek' },
  summer: { src: '/yazaktiviteleri.webp', alt: 'Yaz dönemi etkinlikleri', width: 1500, height: 1070, status: 'gercek' },
} satisfies Record<string, MediaAsset>;

export type MediaKey = keyof typeof MEDIA;

/** Çekim sonrası değiştirilmesi gereken görseller. */
export function pendingShootAssets(): MediaKey[] {
  return (Object.keys(MEDIA) as MediaKey[]).filter((key) => MEDIA[key].status === 'stok');
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu doğrula**

```bash
npm test -- media
```
Expected: PASS

- [ ] **Step 5: `docs/cekim-brief.md` yaz**

```markdown
# Fotoğraf Çekimi Brief'i

## Zorunlu kare — diğer her şeyden önce
**10 çocuklu sınıfın geniş açı fotoğrafı, iki öğretmen kadrajda.**
Reklamın, sitenin ve fiyatlandırmanın dayandığı tek iddianın görsel kanıtı.
`MEDIA.classroomWide` bu kareyle değiştirilecek.
Yatay, en az 2400 piksel genişlik.

## KVKK
Çocukların yüzü gösterilmez: arkadan, omuz üstünden, eller ve malzeme detayı,
mekân. Yüz kullanılacaksa veliden yazılı açık rıza; öğretmen portreleri için de
yazılı izin. Rıza formları çekimden ÖNCE toplanır.

## Teknik
Yatay 3:2, en az 2400 piksel genişlik, doğal ışık, filtre ve retouch yok.
Teslim: ham JPG. Web dönüşümü ayrıca yapılacak.

## Çekim sonrası
1. Dosyaları public/ altına koy
2. content/media.ts içinde src, width, height güncelle, status: 'gercek' yap
3. npm test -- media
4. pendingShootAssets() boş dizi dönene kadar tekrarla
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add media catalog as single source of truth for images"
```

---

### Task 5: Sinematik ilkel bileşenler

**Files:**
- Create: `app/components/cine/Frame.tsx`, `app/components/cine/Timecode.tsx`, `app/components/cine/Roster.tsx`
- Create: `app/components/cine/__tests__/Roster.test.tsx`

**Interfaces:**
- Consumes: `MEDIA`, `MediaKey` (`content/media.ts`)
- Produces:
  - `<Frame mediaKey={MediaKey} grade?={Grade} ratio?={'cinema'|'portrait'} priority?={boolean} />`
  - `type Grade = 'dawn' | 'morning' | 'midday' | 'golden' | 'dusk' | 'none'`
  - `<Timecode>07:15</Timecode>`
  - `<Roster childCount={number} teacherCount={number} limit?={number} />`
  - Task 6, 7, 13 bu üçünü kullanır.

- [ ] **Step 1: Roster testini yaz**

`app/components/cine/__tests__/Roster.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Roster from '../Roster';

describe('Roster', () => {
  it('verilen sayıda çocuk ve öğretmen işareti çizer', () => {
    const { container } = render(<Roster childCount={10} teacherCount={2} limit={20} />);
    expect(container.querySelectorAll('[data-mark="child"]')).toHaveLength(10);
    expect(container.querySelectorAll('[data-mark="teacher"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-mark="limit"]')).toHaveLength(20);
  });

  it('farklı mevcut için doğru sayıda işaret çizer', () => {
    const { container } = render(<Roster childCount={8} teacherCount={2} />);
    expect(container.querySelectorAll('[data-mark="child"]')).toHaveLength(8);
  });

  it('ekran okuyucu için metin karşılığı sunar', () => {
    const { getByText } = render(<Roster childCount={10} teacherCount={2} limit={20} />);
    expect(
      getByText(/10 çocuk, 2 öğretmen/i),
    ).toBeDefined();
  });

  it('limit verilmezse karşılaştırma satırı çizilmez', () => {
    const { container } = render(<Roster childCount={10} teacherCount={2} />);
    expect(container.querySelectorAll('[data-mark="limit"]')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu doğrula**

```bash
npm test -- Roster
```
Expected: FAIL — modül yok.

- [ ] **Step 3: `app/components/cine/Roster.tsx` yaz**

```tsx
/**
 * Künye — bu sitenin imza öğesi.
 * Sınıftaki çocuk ve öğretmen sayısını işaret işaret gösterir, altında
 * MEB üst sınırını soluk konturla karşılaştırır. Argüman cümlede değil,
 * iki sıra arasındaki boşlukta.
 *
 * Jitter dizisi sabittir — Math.random SSR/CSR uyumsuzluğu yaratır.
 */
const JITTER = [0, 1.1, -0.8, 0.5, -1.3, 0.9, -0.4, 1.4, -1.0, 0.3];

function jitter(index: number): number {
  return JITTER[index % JITTER.length];
}

export default function Roster({
  childCount,
  teacherCount,
  limit,
}: {
  childCount: number;
  teacherCount: number;
  /** MEB üst sınırı. Verilmezse karşılaştırma satırı çizilmez. */
  limit?: number;
}) {
  const perRow = 5;
  const gap = 26;
  const rows = Math.ceil(childCount / perRow);
  const width = perRow * gap + 90;
  const childHeight = rows * gap;
  const limitRows = limit ? Math.ceil(limit / 10) : 0;
  const height = childHeight + (limit ? limitRows * 18 + 34 : 0) + 12;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-sm"
        role="img"
        aria-hidden="true"
      >
        {Array.from({ length: childCount }, (_, i) => (
          <circle
            key={`c${i}`}
            data-mark="child"
            className="roster-mark"
            style={{ animationDelay: `${i * 45}ms` }}
            cx={(i % perRow) * gap + 14 + jitter(i)}
            cy={Math.floor(i / perRow) * gap + 14 + jitter(i + 3)}
            r={8.2 + jitter(i) * 0.35}
            fill="var(--color-mark)"
          />
        ))}

        {Array.from({ length: teacherCount }, (_, i) => (
          <rect
            key={`t${i}`}
            data-mark="teacher"
            className="roster-mark"
            style={{ animationDelay: `${(childCount + i) * 45}ms` }}
            x={perRow * gap + 12 + i * 22}
            y={childHeight / 2 - 11 + jitter(i) * 1.5}
            width={13}
            height={22}
            rx={6.5}
            fill="var(--color-ink)"
          />
        ))}

        {limit ? (
          <g transform={`translate(0 ${childHeight + 26})`}>
            {Array.from({ length: limit }, (_, i) => (
              <circle
                key={`l${i}`}
                data-mark="limit"
                cx={(i % 10) * 15 + 8}
                cy={Math.floor(i / 10) * 18 + 8}
                r={5.4}
                fill="none"
                stroke="var(--color-rule)"
                strokeWidth={1.2}
              />
            ))}
          </g>
        ) : null}
      </svg>

      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        <span className="timecode text-ink">
          {childCount} çocuk, {teacherCount} öğretmen
        </span>
        {limit ? (
          <span className="timecode text-ink-soft">
            MEB üst sınırı {limit}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 4: Künye giriş hareketini `globals.css` sonuna ekle**

Hareket yalnızca vurgular; kapalıyken işaretler tam görünür.

```css
.roster-mark {
  opacity: 1;
}

@media (prefers-reduced-motion: no-preference) {
  .roster-mark {
    opacity: 0;
    animation: roster-in 380ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
  }

  @keyframes roster-in {
    from { opacity: 0; transform: scale(0.6); }
    to   { opacity: 1; transform: scale(1); }
  }
}
```

- [ ] **Step 5: Testi çalıştır, yeşil olduğunu doğrula**

```bash
npm test -- Roster
```
Expected: PASS (4 test)

- [ ] **Step 6: `app/components/cine/Timecode.tsx` yaz**

```tsx
export default function Timecode({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`timecode text-ink-soft ${className}`}>{children}</span>;
}
```

- [ ] **Step 7: `app/components/cine/Frame.tsx` yaz**

```tsx
import Image from 'next/image';
import { MEDIA, type MediaKey } from '@/content/media';

export type Grade = 'dawn' | 'morning' | 'midday' | 'golden' | 'dusk' | 'none';

const GRADE_TINT: Record<Grade, string> = {
  dawn: 'var(--color-dawn)',
  morning: 'var(--color-morning)',
  midday: 'var(--color-midday)',
  golden: 'var(--color-golden)',
  dusk: 'var(--color-dusk)',
  none: 'transparent',
};

const GRADE_OPACITY: Record<Grade, string> = {
  dawn: '0.22', morning: '0.16', midday: '0.14',
  golden: '0.18', dusk: '0.26', none: '0',
};

/**
 * Kadraj — bracketing. Fotoğrafı sinema oranında çerçeveler ve o sahnenin
 * ışığına göre derecelendirir.
 * Mobilde 4:5 kullanılır; 2.39:1 bir 375 px ekranda 157 px'lik şerit olur.
 */
export default function Frame({
  mediaKey,
  grade = 'none',
  ratio = 'cinema',
  priority = false,
  sizes = '(max-width: 768px) 100vw, 1100px',
}: {
  mediaKey: MediaKey;
  grade?: Grade;
  ratio?: 'cinema' | 'portrait';
  priority?: boolean;
  sizes?: string;
}) {
  const asset = MEDIA[mediaKey];
  const ratioClass =
    ratio === 'cinema'
      ? 'aspect-[4/5] md:aspect-[2.39/1]'
      : 'aspect-[4/5] md:aspect-[3/2]';

  return (
    <div className={`relative w-full overflow-hidden bg-paper-warm ${ratioClass}`}>
      <Image
        src={asset.src}
        alt={asset.alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover"
      />
      {grade !== 'none' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 mix-blend-multiply"
          style={{ backgroundColor: GRADE_TINT[grade], opacity: GRADE_OPACITY[grade] }}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 8: Test ve build**

```bash
npm test && npm run build
```
Expected: Yeşil.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add cinematic primitives frame, timecode and roster"
```

---

# FAZ 2 — SAYFA KURGULARI

### Task 6: "Bir Gün" içeriği ve sinematik günlük akış sayfası

**Files:**
- Create: `content/day.ts`, `content/__tests__/day.test.ts`
- Create: `app/cine.css`
- Create: `app/components/cine/TimeSpine.tsx`
- Modify: `app/gunluk-akis/page.tsx`

**Interfaces:**
- Consumes: `MediaKey`, `Frame`, `Timecode`, `Roster`, `AGE_GROUPS_CONTENT`
- Produces:
  - `type DayChapter = { id: string; time: string; title: string; lead: string; body: string[]; mediaKey: MediaKey; grade: Grade; feature?: 'roster' }`
  - `DAY_CHAPTERS: DayChapter[]` — Task 7'deki ana sayfa önizlemesi de bunu kullanır
  - `<TimeSpine chapters={DayChapter[]} />`

- [ ] **Step 1: Testi yaz**

`content/__tests__/day.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DAY_CHAPTERS } from '../day';
import { MEDIA } from '../media';

describe('DAY_CHAPTERS', () => {
  it('en az sekiz bölüm içerir', () => {
    expect(DAY_CHAPTERS.length).toBeGreaterThanOrEqual(8);
  });

  it('id değerleri benzersizdir', () => {
    const ids = DAY_CHAPTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('saatler kronolojik sıradadır', () => {
    const minutes = DAY_CHAPTERS.map((c) => {
      const [h, m] = c.time.split(':').map(Number);
      return h * 60 + m;
    });
    expect([...minutes].sort((a, b) => a - b)).toEqual(minutes);
  });

  it('her bölüm geçerli bir görsel anahtarı kullanır', () => {
    for (const chapter of DAY_CHAPTERS) {
      expect(MEDIA[chapter.mediaKey]).toBeDefined();
    }
  });

  it('künye yalnızca tek bölümde öne çıkar — scaling disiplini', () => {
    expect(DAY_CHAPTERS.filter((c) => c.feature === 'roster')).toHaveLength(1);
  });

  it('yasak kelime ve ücret rakamı içermez', () => {
    const text = JSON.stringify(DAY_CHAPTERS);
    for (const word of ['indirim', 'kampanya', 'uygun fiyat', 'fırsat']) {
      expect(text.toLowerCase()).not.toContain(word);
    }
    expect(text).not.toMatch(/\d{3}\.\d{3}/);
    expect(text).not.toContain('₺');
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu doğrula**

```bash
npm test -- day
```
Expected: FAIL

- [ ] **Step 3: `content/day.ts` yaz**

```typescript
import type { MediaKey } from './media';
import type { Grade } from '@/app/components/cine/Frame';

export type DayChapter = {
  id: string;
  /** HH:MM — TimeSpine ve kronoloji testi bu formata dayanır. */
  time: string;
  title: string;
  lead: string;
  body: string[];
  mediaKey: MediaKey;
  grade: Grade;
  /** Künye yalnızca bir bölümde öne çıkar. */
  feature?: 'roster';
};

export const DAY_CHAPTERS: DayChapter[] = [
  {
    id: 'karsilama',
    time: '07:15',
    title: 'Kapı açılıyor',
    lead: 'Gün, çocuğun kendi hızında başlar.',
    body: [
      'İlk gelen çocuk sabahın en sessiz saatini yakalar. Karşılamayı her zaman aynı öğretmen yapar; tanıdık yüz, ayrılığın en kolay geçtiği andır.',
      'Kahvaltıya kadar geçen süre serbesttir. Kimse oyuna zorlanmaz, kimse uyandırılmaz. Uyum dönemindeki çocuklar için bu saat ayrıca değerlidir — sınıf henüz kalabalık değildir.',
    ],
    mediaKey: 'classroomWide',
    grade: 'dawn',
  },
  {
    id: 'sabah-cemberi',
    time: '09:20',
    title: 'Sabah çemberi',
    lead: 'Herkes burada. Sayabilirsiniz.',
    body: [
      'Gün, sınıfın tamamının bir araya geldiği çemberle başlar. Günün planı burada konuşulur: kim ne yapacak, hangi atölye açık, bahçeye ne zaman çıkılacak.',
      'Bu çemberde on çocuk ve iki öğretmen bulunur. MEB okul öncesi yönetmeliği dört yaş üstü sınıflarda öğretmen başına yirmi çocuğa kadar izin verir. Bizde beş. Aradaki fark, çocuğunuzun gün içinde kaç kez söz aldığıdır.',
    ],
    mediaKey: 'motorSkills',
    grade: 'morning',
    feature: 'roster',
  },
  {
    id: 'calisma-saati',
    time: '10:00',
    title: 'Çalışma saati',
    lead: 'Montessori: çocuk seçer, öğretmen gözler.',
    body: [
      'Materyaller açık raflarda, çocuğun boyunda durur. Bir çalışmayı seçmek, bitirmek ve yerine kaldırmak çocuğun sorumluluğundadır.',
      'Bu yaklaşımın işlemesinin tek koşulu, öğretmenin her çocuğu ayrı ayrı gözleyebilmesidir. Yirmi çocuklu bir sınıfta bu mümkün değildir. Sınıf mevcudumuzun sınırlı olmasının sebebi budur — Montessori bir dekor değil, çalışma biçimidir.',
    ],
    mediaKey: 'montessori',
    grade: 'morning',
  },
  {
    id: 'ingilizce',
    time: '11:00',
    title: 'İngilizce',
    lead: 'Ders saati değil, günün dili.',
    body: [
      'Native öğretmenimiz sınıfa ders vermeye gelmez; sınıfta bulunur. İngilizce oyunun, yemeğin ve bahçenin dili olur.',
      'Mezun olan çocuklarımız İngilizce konuşarak ayrılıyor. Bunun sebebi ders saati değil, konuşma sırası. On kişilik grupta her çocuk gün içinde defalarca söz alır; kalabalık sınıfta dil ediniminin tıkandığı yer tam olarak burasıdır.',
    ],
    mediaKey: 'art',
    grade: 'morning',
  },
  {
    id: 'bahce',
    time: '11:45',
    title: 'Bahçe',
    lead: 'Hava ne olursa olsun, dışarı çıkılır.',
    body: [
      'Bahçe zamanı programın en az müdahale edilen bölümüdür. Çocuklar kendi oyunlarını kurar; öğretmenler gözler, gerektiğinde araya girer.',
      'Bahçe kapalı ve kontrollüdür. İki öğretmen de dışarıdadır — on çocuk iki yetişkinin görüş alanında kalır.',
    ],
    mediaKey: 'sports',
    grade: 'midday',
  },
  {
    id: 'ogle',
    time: '12:30',
    title: 'Öğle',
    lead: 'Sofra da bir çalışma alanıdır.',
    body: [
      'Çocuklar kendi tabağını taşır, kendi suyunu koyar, sofrayı birlikte toplar. Öz bakım becerileri ayrı bir ders değil, günün doğal parçasıdır.',
      'Alerji ve özel diyetler günlük olarak takip edilir; mutfak ve sınıf aynı listeyi paylaşır.',
    ],
    mediaKey: 'physicalEducation',
    grade: 'midday',
  },
  {
    id: 'uyku',
    time: '13:15',
    title: 'Dinlenme',
    lead: 'Küçük gruplar uyur, büyükler sessiz çalışır.',
    body: [
      'İki ve üç yaş grubu için ayrı bir uyku odası vardır. Uyku düzeni evdekiyle uyumlu olacak şekilde aileyle birlikte planlanır.',
      'Uyumayan gruplar için bu saat sessiz çalışma zamanıdır: kitap, yapboz, bireysel proje.',
    ],
    mediaKey: 'psychologist',
    grade: 'midday',
  },
  {
    id: 'atolye',
    time: '15:00',
    title: 'Atölye',
    lead: 'Robotik, seramik, satranç, müzik, drama.',
    body: [
      'Atölyeler eğlence molası değil, programın parçasıdır. Satranç planlama ve sonuç öngörme; robotik algoritmik düşünme; seramik ince motor ve sabır; drama ifade ve empati çalışmasıdır.',
      'Atölye grupları sınıftan da küçüktür. Bir seramik tezgâhının başında beş çocuk vardır.',
    ],
    mediaKey: 'ceramics',
    grade: 'golden',
  },
  {
    id: 'cikis',
    time: '17:00',
    title: 'Çıkış',
    lead: 'Günün anlatıldığı an.',
    body: [
      'Her çocuk alınırken öğretmeni velisine o günü anlatır. Ne yaptı, neyi zor buldu, neye ilk kez cesaret etti.',
      'Bu, öğretmen başına beş çocuk düştüğü için mümkündür. Yirmi çocuklu bir sınıfta günün sonunda söylenebilecek tek şey "iyiydi" olur.',
    ],
    mediaKey: 'dance',
    grade: 'dusk',
  },
  {
    id: 'kapanis',
    time: '19:15',
    title: 'Kapanış',
    lead: 'Son çocuk da alındığında gün biter.',
    body: [
      'Okul 19:15\'e kadar açıktır. Geç kalan veliler için ek ücret ya da telaş yoktur; çalışan ailelerin gerçeğine göre planlanmış bir saattir.',
    ],
    mediaKey: 'summer',
    grade: 'dusk',
  },
];

export function getChapter(id: string): DayChapter | undefined {
  return DAY_CHAPTERS.find((chapter) => chapter.id === id);
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu doğrula**

```bash
npm test -- day
```
Expected: PASS (6 test)

- [ ] **Step 5: `app/cine.css` yaz**

Scroll-driven katman ayrı dosyada; **yalnızca `(site)` kabuğu yükler**, LP'ler yüklemez.

```css
/* Sinematik katman — yalnızca site kabuğunda yüklenir. */

.cine-chapter {
  opacity: 1;
}

.cine-spine-item {
  opacity: 0.4;
}

.cine-spine-item[data-active='true'] {
  opacity: 1;
}

@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .cine-chapter {
      animation: cine-reveal linear both;
      animation-timeline: view();
      animation-range: entry 8% cover 26%;
    }

    @keyframes cine-reveal {
      from { opacity: 0.35; transform: translateY(18px); }
      to   { opacity: 1;    transform: translateY(0); }
    }
  }
}
```

- [ ] **Step 6: `app/components/cine/TimeSpine.tsx` yaz**

```tsx
import Timecode from './Timecode';
import type { DayChapter } from '@/content/day';

/**
 * Zaman omurgası — indexing. Kaydırmayla ilerleyen kamera konumu,
 * aynı zamanda bölüm navigasyonu.
 */
export default function TimeSpine({ chapters }: { chapters: DayChapter[] }) {
  return (
    <nav
      aria-label="Günün bölümleri"
      className="hidden lg:block sticky top-24 h-fit border-l border-rule pl-5"
    >
      <ol className="space-y-3">
        {chapters.map((chapter) => (
          <li key={chapter.id} className="cine-spine-item">
            <a href={`#${chapter.id}`} className="group block hover:opacity-100">
              <Timecode className="block group-hover:text-ink">{chapter.time}</Timecode>
              <span className="text-sm text-ink-soft group-hover:text-ink">
                {chapter.title}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

- [ ] **Step 7: `app/gunluk-akis/page.tsx` yeniden yaz**

```tsx
import Header from '../components/Header';
import LeadForm from '../components/LeadForm';
import Frame from '../components/cine/Frame';
import Timecode from '../components/cine/Timecode';
import TimeSpine from '../components/cine/TimeSpine';
import Roster from '../components/cine/Roster';
import { DAY_CHAPTERS } from '@/content/day';
import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'Günlük Akış',
  description:
    'Şeker Anaokulu\'nda bir gün: 07:15\'te kapı açılışından 19:15\'te kapanışa. Sabah çemberi, Montessori çalışma saati, İngilizce, bahçe, atölye. Beykent Büyükçekmece, 2-6 yaş.',
  path: '/gunluk-akis',
});

export default function GunlukAkisPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main>
        <section className="mx-auto max-w-3xl px-6 pt-20 pb-14">
          <Timecode>07:15 — 19:15</Timecode>
          <h1 className="mt-4 text-5xl text-ink md:text-6xl">
            Okulda bir gün
          </h1>
          <p className="mt-6 text-lg text-ink-soft">
            Bir okulu anlatmanın en dürüst yolu, orada geçen bir günü göstermektir.
            Aşağısı, çocuğunuzun sabah kapıdan girdiği andan akşam çıkana kadar
            yaşadığı gün.
          </p>
        </section>

        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[180px_1fr]">
          <TimeSpine chapters={DAY_CHAPTERS} />

          <div>
            {DAY_CHAPTERS.map((chapter, index) => (
              <section
                key={chapter.id}
                id={chapter.id}
                className="cine-chapter scroll-mt-24 border-t border-rule py-14 first:border-t-0 first:pt-0"
              >
                <Timecode>{chapter.time}</Timecode>
                <h2 className="mt-3 text-3xl text-ink md:text-4xl">{chapter.title}</h2>
                <p className="mt-3 text-lg text-mark">{chapter.lead}</p>

                <div className="mt-8">
                  <Frame
                    mediaKey={chapter.mediaKey}
                    grade={chapter.grade}
                    priority={index === 0}
                  />
                </div>

                <div className="mt-8 max-w-2xl">
                  {chapter.body.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)} className="mt-4 text-ink-soft">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {chapter.feature === 'roster' ? (
                  <div className="mt-10 max-w-md">
                    <Roster childCount={10} teacherCount={2} limit={20} />
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </div>

        <section className="mt-16 bg-ink py-16">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-3xl text-paper">Bu günü yerinde görün</h2>
            <p className="mt-4 text-paper/80">
              Ön görüşmeye sabah saatlerinde gelirseniz çemberi izleyebilirsiniz.
              Talebinize ortalama on beş dakika içinde dönüş yapıyoruz.
            </p>
            <div className="mt-8 rounded-2xl bg-paper p-6 md:p-8">
              <LeadForm variant="compact" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 8: `app/cine.css` dosyasını `app/globals.css` sonuna import et**

```css
@import "./cine.css";
```

> Not: Task 11'de route group ayrımı yapıldığında bu import `(site)` kabuğuna taşınacak. Şimdilik globals üzerinden yüklenir.

- [ ] **Step 9: Test, build ve gözle doğrulama**

```bash
npm test && npm run build && npm run dev
```
`/gunluk-akis` sayfasında doğrula:
- Sol tarafta zaman omurgası görünüyor (lg ve üzeri), tıklayınca bölüme kayıyor
- Kadrajlar mobilde 4:5, masaüstünde geniş
- Sabah çemberi bölümünde künye görünüyor, işaretler sırayla beliriyor
- DevTools → Rendering → "Emulate prefers-reduced-motion: reduce" → hareket duruyor, içerik tam görünür

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add cinematic day narrative to daily flow page"
```

---

### Task 7: Ana sayfa yeniden kurgusu

**Files:**
- Modify: `app/page.tsx`, `app/Anasayfa.tsx`
- Modify: `app/components/HeroSection.tsx`, `app/components/TrustBar.tsx`

**Interfaces:**
- Consumes: `Roster`, `Frame`, `Timecode`, `DAY_CHAPTERS`, `LeadForm`, `AGE_GROUPS_CONTENT`, `SITE`
- Produces: Künye odaklı hero + günün üç sahnelik önizlemesi. Form ilk kaydırmada erişilebilir.

- [ ] **Step 1: `app/components/HeroSection.tsx` yeniden yaz**

```tsx
import Link from 'next/link';
import Roster from './cine/Roster';
import Timecode from './cine/Timecode';
import { SITE, WHATSAPP_URL } from '@/lib/site';

export default function HeroSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24">
      <div className="grid gap-12 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div>
          <Timecode>Beykent · Büyükçekmece · {SITE.foundingYear}&apos;den beri</Timecode>
          <h1 className="mt-5 text-5xl text-ink md:text-6xl lg:text-7xl">
            Sınıfta on çocuk.<br />İki öğretmen.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            MEB okul öncesi yönetmeliği öğretmen başına yirmi çocuğa kadar izin
            veriyor. Bizde beş. Aradaki fark, çocuğunuzun gün içinde kaç kez
            fark edildiğidir.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/kayit"
              className="rounded-full bg-ink px-8 py-4 text-center font-medium text-paper hover:bg-ink-soft"
            >
              Ön Görüşme Randevusu
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-ink px-8 py-4 text-center font-medium text-ink hover:bg-paper-warm"
            >
              WhatsApp&apos;tan Yazın
            </a>
          </div>
        </div>

        <div className="md:justify-self-end">
          <Roster childCount={10} teacherCount={2} limit={20} />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `app/Anasayfa.tsx` içine günün önizlemesini ekle**

`HeroSection` ve `TrustBar`'dan sonra, mevcut bölümlerden önce şu bölümü ekle. `Frame`, `Timecode`, `DAY_CHAPTERS` ve `Link` import edilir.

```tsx
{/* Günün üç sahnesi — tam anlatı /gunluk-akis sayfasında */}
<section className="mx-auto max-w-6xl px-6 py-16">
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div>
      <Timecode>07:15 — 19:15</Timecode>
      <h2 className="mt-3 text-3xl text-ink md:text-4xl">Okulda bir gün</h2>
    </div>
    <Link href="/gunluk-akis" className="text-ink underline underline-offset-4">
      Günün tamamını görün
    </Link>
  </div>

  <div className="mt-10 grid gap-8 md:grid-cols-3">
    {['sabah-cemberi', 'calisma-saati', 'atolye'].map((id) => {
      const chapter = DAY_CHAPTERS.find((c) => c.id === id);
      if (!chapter) return null;
      return (
        <Link key={chapter.id} href={`/gunluk-akis#${chapter.id}`} className="group block">
          <Frame
            mediaKey={chapter.mediaKey}
            grade={chapter.grade}
            ratio="portrait"
            sizes="(max-width: 768px) 100vw, 360px"
          />
          <Timecode className="mt-4 block">{chapter.time}</Timecode>
          <h3 className="mt-1 text-xl text-ink group-hover:text-mark">{chapter.title}</h3>
          <p className="mt-1 text-sm text-ink-soft">{chapter.lead}</p>
        </Link>
      );
    })}
  </div>
</section>
```

- [ ] **Step 3: `app/components/TrustBar.tsx` içindeki renkleri ve rakamları güncelle**

Dört rakam gösterir: `10` / Sınıf mevcudu · `1 : 5` / Öğretmen başına çocuk · `2011` / Kuruluş · `2-6` / Yaş aralığı. Sayılar `font-display`, etiketler `timecode` sınıfıyla. Renkler: sayı `text-ink`, etiket `text-ink-soft`, ayırıcı `border-rule`.

- [ ] **Step 4: Formun ilk kaydırmada erişilebilir olduğunu doğrula**

`app/Anasayfa.tsx` içinde `ContactSection` (veya `LeadForm` içeren bölüm) günün önizlemesinden hemen sonra gelmeli. Daha aşağıdaysa yukarı taşı.

- [ ] **Step 5: Test, build ve gözle doğrulama**

```bash
npm test && npm run build && npm run dev
```
Ana sayfada doğrula:
- Künye hero'da görünüyor, on işaret sayılabiliyor
- Mobilde (375 px) künye taşmıyor, hero okunabilir
- Günün üç sahnesi görünüyor, tıklayınca `/gunluk-akis` içindeki doğru bölüme gidiyor
- Form, ilk ekrandan sonra bir kaydırmada erişilebiliyor

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: rebuild homepage around roster and day preview"
```

---

# FAZ 3 — REKLAM ÖLÇÜM ALTYAPISI

### Task 8: Consent Mode v2 ve KVKK çerez bandı

**Files:**
- Create: `lib/consent.ts`, `lib/__tests__/consent.test.ts`
- Create: `app/components/ConsentDefaults.tsx`, `app/components/CookieBanner.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `type ConsentChoice = 'granted' | 'denied'`, `CONSENT_KEY`, `readConsent(storage)`, `buildConsentUpdate(choice)`

> Onay sinyali olmadan Google Ads remarketing listeleri (RLSA) dolmaz ve dönüşüm modellemesi bozulur. Reklam planındaki RLSA teklif ayarları bu task olmadan çalışmaz.

- [ ] **Step 1: Testi yaz**

`lib/__tests__/consent.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CONSENT_KEY, readConsent, buildConsentUpdate } from '../consent';

function storageWith(value: string | null) {
  return { getItem: (key: string) => (key === CONSENT_KEY ? value : null) };
}

describe('readConsent', () => {
  it('kayıtlı onayı okur', () => {
    expect(readConsent(storageWith('granted'))).toBe('granted');
    expect(readConsent(storageWith('denied'))).toBe('denied');
  });

  it('kayıt yoksa null döner', () => {
    expect(readConsent(storageWith(null))).toBeNull();
  });

  it('geçersiz değeri null sayar', () => {
    expect(readConsent(storageWith('belki'))).toBeNull();
  });
});

describe('buildConsentUpdate', () => {
  it('onay verildiğinde dört sinyali açar', () => {
    expect(buildConsentUpdate('granted')).toEqual({
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted',
    });
  });

  it('onay reddedildiğinde hepsini kapalı tutar', () => {
    expect(buildConsentUpdate('denied')).toEqual({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu doğrula**

```bash
npm test -- consent
```

- [ ] **Step 3: `lib/consent.ts` yaz**

```typescript
export type ConsentChoice = 'granted' | 'denied';

export const CONSENT_KEY = 'seker_consent_v2';

const MANAGED_SIGNALS = [
  'ad_storage',
  'ad_user_data',
  'ad_personalization',
  'analytics_storage',
] as const;

export function readConsent(storage: Pick<Storage, 'getItem'>): ConsentChoice | null {
  const value = storage.getItem(CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function buildConsentUpdate(choice: ConsentChoice): Record<string, ConsentChoice> {
  return Object.fromEntries(
    MANAGED_SIGNALS.map((signal) => [signal, choice]),
  ) as Record<string, ConsentChoice>;
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu doğrula**

```bash
npm test -- consent
```
Expected: PASS (5 test)

- [ ] **Step 5: `app/components/ConsentDefaults.tsx` yaz**

```tsx
import Script from 'next/script';

export default function ConsentDefaults() {
  return (
    <Script id="consent-default" strategy="beforeInteractive">
      {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('consent','default',{
  ad_storage:'denied',
  ad_user_data:'denied',
  ad_personalization:'denied',
  analytics_storage:'denied',
  functionality_storage:'granted',
  security_storage:'granted',
  wait_for_update:500
});`}
    </Script>
  );
}
```

- [ ] **Step 6: `app/components/CookieBanner.tsx` yaz**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CONSENT_KEY, readConsent, buildConsentUpdate, type ConsentChoice } from '@/lib/consent';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readConsent(window.localStorage) === null) setVisible(true);
  }, []);

  function choose(choice: ConsentChoice) {
    window.localStorage.setItem(CONSENT_KEY, choice);
    window.gtag?.('consent', 'update', buildConsentUpdate(choice));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Çerez tercihi"
      className="fixed inset-x-0 bottom-14 z-50 border-t border-rule bg-paper p-5 shadow-[0_-2px_16px_rgba(0,0,0,0.08)] md:bottom-0"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-ink-soft">
          Deneyiminizi iyileştirmek ve reklam performansını ölçmek için çerez kullanıyoruz.{' '}
          <Link href="/cerez" className="underline">Çerez Politikası</Link>
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => choose('denied')}
            className="rounded-full border border-rule px-6 py-2.5 text-sm text-ink"
          >
            Reddet
          </button>
          <button
            type="button"
            onClick={() => choose('granted')}
            className="rounded-full bg-ink px-6 py-2.5 text-sm text-paper"
          >
            Kabul Et
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `app/layout.tsx` içine bağla**

`<body>` içinde `<Analytics />` satırından **önce** `<ConsentDefaults />`, en sona `<CookieBanner />` ekle. Import'ları da ekle.

- [ ] **Step 8: Gözle doğrula**

```bash
npm run dev
```
- Gizli sekmede aç → bant görünüyor
- Console: `dataLayer[0]` içinde `consent`, `default` ve dört `denied`
- "Kabul Et" → bant kapanıyor, `dataLayer` içinde `consent`, `update`
- Yenile → bant çıkmıyor. `localStorage.getItem('seker_consent_v2')` → `"granted"`

- [ ] **Step 9: Test, build, commit**

```bash
npm test && npm run build
git add -A
git commit -m "feat: add consent mode v2 and kvkk cookie banner"
```

---

### Task 9: GCLID ve landing path yakalama

**Files:**
- Create: `lib/attribution.ts`, `lib/__tests__/attribution.test.ts`, `app/components/AttributionFields.tsx`
- Modify: `lib/leadSchema.ts`, `app/components/LeadForm.tsx`, `app/api/lead/route.ts`

**Interfaces:**
- Produces: `type Attribution = { gclid: string; landingPath: string }`, `ATTRIBUTION_KEY`, `parseAttribution(search, pathname)`, `persistAttribution(storage, next)`, `<AttributionFields />`

> Reklam planındaki offline conversion import GCLID olmadan imkânsız. Bu olmadan Google, ücreti duyup çekilen veliyi başarı sayar.

- [ ] **Step 1: Testi yaz**

`lib/__tests__/attribution.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ATTRIBUTION_KEY, parseAttribution, persistAttribution, type Attribution } from '../attribution';

describe('parseAttribution', () => {
  it('gclid ve landing path çıkarır', () => {
    expect(parseAttribution('?gclid=Cj0ABC123', '/lp/az-mevcutlu-anaokulu')).toEqual({
      gclid: 'Cj0ABC123',
      landingPath: '/lp/az-mevcutlu-anaokulu',
    });
  });

  it('gclid yoksa boş bırakır ama yolu tutar', () => {
    expect(parseAttribution('', '/kayit')).toEqual({ gclid: '', landingPath: '/kayit' });
  });

  it('diğer parametreler arasından gclid bulur', () => {
    expect(parseAttribution('?utm_source=google&gclid=XYZ&utm_medium=cpc', '/').gclid).toBe('XYZ');
  });

  it('aşırı uzun gclid değerini kırpar', () => {
    expect(parseAttribution(`?gclid=${'a'.repeat(300)}`, '/').gclid.length).toBeLessThanOrEqual(200);
  });
});

describe('persistAttribution', () => {
  function makeStorage(initial: string | null) {
    let value = initial;
    return {
      getItem: (key: string) => (key === ATTRIBUTION_KEY ? value : null),
      setItem: (key: string, next: string) => { if (key === ATTRIBUTION_KEY) value = next; },
      read: () => value,
    };
  }

  it('kayıt yoksa yeni değeri yazar', () => {
    const storage = makeStorage(null);
    const next: Attribution = { gclid: 'A1', landingPath: '/lp/kres-2-yas' };
    expect(persistAttribution(storage, next)).toEqual(next);
    expect(storage.read()).toBe(JSON.stringify(next));
  });

  it('ilk dokunuşu korur — sonraki sayfa gclid\'i ezmez', () => {
    const first: Attribution = { gclid: 'FIRST', landingPath: '/lp/kres-2-yas' };
    const storage = makeStorage(JSON.stringify(first));
    expect(persistAttribution(storage, { gclid: '', landingPath: '/kayit' })).toEqual(first);
  });

  it('kayıtlı gclid boşsa yeni gclid günceller', () => {
    const storage = makeStorage(JSON.stringify({ gclid: '', landingPath: '/' }));
    expect(persistAttribution(storage, { gclid: 'NEW', landingPath: '/lp/kres-2-yas' }).gclid).toBe('NEW');
  });

  it('bozuk kayıtta çökmeden yeni değeri kullanır', () => {
    const storage = makeStorage('{bozuk');
    const next: Attribution = { gclid: 'B2', landingPath: '/' };
    expect(persistAttribution(storage, next)).toEqual(next);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu doğrula**

```bash
npm test -- attribution
```

- [ ] **Step 3: `lib/attribution.ts` yaz**

```typescript
export type Attribution = {
  gclid: string;
  landingPath: string;
};

export const ATTRIBUTION_KEY = 'seker_attr';

const MAX_GCLID = 200;
const MAX_PATH = 200;

export function parseAttribution(search: string, pathname: string): Attribution {
  const params = new URLSearchParams(search);
  return {
    gclid: (params.get('gclid') ?? '').slice(0, MAX_GCLID),
    landingPath: pathname.slice(0, MAX_PATH),
  };
}

/**
 * İlk dokunuşu korur: veli reklamdan /lp/... sayfasına indi, sonra /kayit'e
 * gitti — gclid ilk inişten gelir, ikinci sayfa onu ezmemelidir.
 */
export function persistAttribution(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  next: Attribution,
): Attribution {
  let stored: Attribution | null = null;
  const raw = storage.getItem(ATTRIBUTION_KEY);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Attribution>;
      if (typeof parsed.gclid === 'string' && typeof parsed.landingPath === 'string') {
        stored = { gclid: parsed.gclid, landingPath: parsed.landingPath };
      }
    } catch {
      stored = null;
    }
  }

  if (stored && stored.gclid) return stored;

  const resolved = stored && !next.gclid ? stored : next;
  storage.setItem(ATTRIBUTION_KEY, JSON.stringify(resolved));
  return resolved;
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu doğrula**

```bash
npm test -- attribution
```
Expected: PASS (9 test)

- [ ] **Step 5: `lib/leadSchema.ts` içine iki alan ekle**

`kvkkConsent` satırından **önce**:

```typescript
  gclid: z.string().trim().max(200).optional().default(''),
  landingPath: z.string().trim().max(200).optional().default(''),
```

- [ ] **Step 6: `app/components/AttributionFields.tsx` yaz**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { parseAttribution, persistAttribution, type Attribution } from '@/lib/attribution';

export default function AttributionFields() {
  const [attribution, setAttribution] = useState<Attribution>({ gclid: '', landingPath: '' });

  useEffect(() => {
    const parsed = parseAttribution(window.location.search, window.location.pathname);
    setAttribution(persistAttribution(window.sessionStorage, parsed));
  }, []);

  return (
    <>
      <input type="hidden" name="gclid" value={attribution.gclid} readOnly />
      <input type="hidden" name="landingPath" value={attribution.landingPath} readOnly />
    </>
  );
}
```

- [ ] **Step 7: `app/components/LeadForm.tsx` içine bağla**

Import ekle: `import AttributionFields from './AttributionFields';`
`<form onSubmit={handleSubmit} ...>` açılışının hemen ardına `<AttributionFields />` ekle.
`payload` nesnesine ekle:

```tsx
      gclid: String(data.get('gclid') ?? ''),
      landingPath: String(data.get('landingPath') ?? ''),
```

- [ ] **Step 8: `app/api/lead/route.ts` e-posta gövdesine ekle**

`text` dizisinde mesaj satırından sonra:

```typescript
        '',
        `Kaynak sayfa: ${lead.landingPath || '—'}`,
        `GCLID: ${lead.gclid || '—'}`,
```

- [ ] **Step 9: Gözle doğrula**

```bash
npm run dev
```
- `/kayit?gclid=TEST123` → DevTools Elements'te `<input type="hidden" name="gclid" value="TEST123">`
- Başka sayfaya git, `/kayit`'e dön (gclid'siz) → değer hâlâ `TEST123`
- Formu gönder → terminal logunda ya da e-postada `GCLID: TEST123`

- [ ] **Step 10: Test, build, commit**

```bash
npm test && npm run build
git add -A
git commit -m "feat: capture gclid and landing path for offline conversion import"
```

---

### Task 10: Yaşa göre dönüşüm değeri

**Files:**
- Modify: `lib/analytics.ts`, `lib/__tests__/analytics.test.ts`, `app/components/LeadForm.tsx`

**Interfaces:**
- Produces: `LEAD_VALUE_BY_AGE`, `leadValue(childAge)`, `trackLead(childAge, extra?)`

> Giriş yaşı öğrenci ömür boyu değerini belirler: iki yaşında giren çocuk dört yıl kalabilir, beş yaşında giren bir yıl. Değer sinyali gönderilmezse Google tüm lead'leri eşit sayar ve en kârlı segmente daha az teklif verir.

- [ ] **Step 1: Mevcut test dosyasının sonuna testleri ekle**

```typescript
import { LEAD_VALUE_BY_AGE, leadValue, trackLead } from '../analytics';
import { AGE_GROUPS } from '../leadSchema';

describe('leadValue', () => {
  it('her yaş grubu için değer tanımlı', () => {
    for (const age of AGE_GROUPS) {
      expect(LEAD_VALUE_BY_AGE[age]).toBeGreaterThan(0);
    }
  });

  it('küçük yaş daha değerli — LTV sıralamasını korur', () => {
    expect(LEAD_VALUE_BY_AGE['2-3']).toBeGreaterThan(LEAD_VALUE_BY_AGE['3-4']);
    expect(LEAD_VALUE_BY_AGE['3-4']).toBeGreaterThan(LEAD_VALUE_BY_AGE['4-5']);
    expect(LEAD_VALUE_BY_AGE['4-5']).toBeGreaterThan(LEAD_VALUE_BY_AGE['5-6']);
  });

  it('bilinmeyen yaş için en düşük değeri döner', () => {
    expect(leadValue('9-10')).toBe(LEAD_VALUE_BY_AGE['5-6']);
    expect(leadValue('')).toBe(LEAD_VALUE_BY_AGE['5-6']);
  });
});

describe('trackLead', () => {
  beforeEach(() => {
    window.dataLayer = [];
  });

  it('yaşa göre değerli dönüşüm olayı gönderir', () => {
    trackLead('2-3');
    expect(window.dataLayer).toEqual([
      { event: 'lead_submit', child_age: '2-3', value: LEAD_VALUE_BY_AGE['2-3'], currency: 'TRY' },
    ]);
  });

  it('ek alanları olaya taşır', () => {
    trackLead('4-5', { program: 'tam-gun' });
    expect(window.dataLayer?.[0]).toMatchObject({
      child_age: '4-5', program: 'tam-gun', currency: 'TRY',
    });
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu doğrula**

```bash
npm test -- analytics
```

- [ ] **Step 3: `lib/analytics.ts` sonuna ekle**

```typescript
/**
 * Lead'in beklenen değeri, çocuğun giriş yaşına göre.
 * İki yaşında giren çocuk dört yıl kalabilir, beş yaşında giren bir yıl.
 * Değerler yıllık ücret ve %80 yıllık kalma oranı varsayımıyla türetilmiştir.
 */
export const LEAD_VALUE_BY_AGE: Record<string, number> = {
  '2-3': 3500,
  '3-4': 2900,
  '4-5': 2100,
  '5-6': 1200,
};

const FALLBACK_LEAD_VALUE = LEAD_VALUE_BY_AGE['5-6'];

export function leadValue(childAge: string): number {
  return LEAD_VALUE_BY_AGE[childAge] ?? FALLBACK_LEAD_VALUE;
}

export function trackLead(childAge: string, extra: Record<string, unknown> = {}): void {
  trackEvent('lead_submit', {
    child_age: childAge,
    value: leadValue(childAge),
    currency: 'TRY',
    ...extra,
  });
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu doğrula**

```bash
npm test -- analytics
```

- [ ] **Step 5: `app/components/LeadForm.tsx` içinde olayı değiştir**

`trackEvent('lead_submit', { child_age: payload.childAge });` satırını şununla değiştir:

```tsx
      trackLead(payload.childAge, {
        program: payload.program,
        landing_path: payload.landingPath,
      });
```

Import'u güncelle: `import { trackLead } from '@/lib/analytics';` (`trackEvent` başka yerde kullanılıyorsa ikisini birlikte import et).

- [ ] **Step 6: Gözle doğrula**

```bash
npm run dev
```
`/kayit` formunu 2-3 yaş seçerek gönder → Console'da `dataLayer` içinde `{ event: 'lead_submit', child_age: '2-3', value: 3500, currency: 'TRY', ... }`

- [ ] **Step 7: Test, build, commit**

```bash
npm test && npm run build
git add -A
git commit -m "feat: send age-weighted conversion value on lead submit"
```

---

# FAZ 4 — LANDING PAGE SİSTEMİ

### Task 11: Route group ayrımı — site ve LP kabukları

**Files:**
- Create: `app/(site)/layout.tsx`, `app/(lp)/layout.tsx`
- Create: `app/components/lp/LpHeader.tsx`, `app/components/lp/LpFooter.tsx`
- Modify: `app/layout.tsx`, `app/globals.css`
- Move: tüm sayfa dizinleri `app/` → `app/(site)/`

**Interfaces:**
- Produces: İki ayrı kabuk. `app/(lp)/*` altındaki sayfalar menüsüz, minimal footer'lı ve **sinematik CSS'siz** olur.

> Route group'lar (`(isim)`) URL'e yansımaz — `app/(site)/kayit/page.tsx` yine `/kayit` adresinde yayınlanır.

- [ ] **Step 1: Site sayfalarını route group'a taşı**

```bash
mkdir -p "app/(site)"
git mv app/page.tsx "app/(site)/page.tsx"
git mv app/Anasayfa.tsx "app/(site)/Anasayfa.tsx"
for dir in aktiviteler bultenler cerez egitim-yaklasimimiz gizlilik gunluk-akis guvenlik hakkimizda iletisim kadromuz kayit kullanim sss tesekkurler ucretler veli-yorumlari yas-gruplari; do
  git mv "app/$dir" "app/(site)/$dir"
done
```

`app/api`, `app/components`, `app/__tests__`, `app/layout.tsx`, `app/globals.css`, `app/cine.css`, `app/sitemap.ts`, `app/robots.ts`, `app/favicon.ico` **kökte kalır**.

- [ ] **Step 2: Taşınan sayfalardaki göreli import'ları düzelt**

```bash
grep -rn "from '\.\./components\|from \"\.\./components" "app/(site)"
```

Bulunan her satırda `'../components/` → `'@/app/components/` yap. İki seviye derindeki sayfalarda (`yas-gruplari/[slug]`) `'../../components/` → `'@/app/components/`. Alias kullanmak gelecekteki taşımaları kırılmaz yapar.

- [ ] **Step 3: Sinematik CSS'i globals'tan çıkar**

`app/globals.css` sonundaki `@import "./cine.css";` satırını **sil**. LP'ler bu katmanı yüklemeyecek.

- [ ] **Step 4: `app/layout.tsx` içinden kabuk bileşenlerini çıkar**

Root layout yalnızca html/body/font/global script bırakır: `<ConsentDefaults />`, `<Analytics />`, `{children}`, `<CookieBanner />`. `Footer`, `WhatsAppButton`, `MobileActionBar` import'larını ve kullanımlarını **sil** — bunlar `(site)` kabuğuna taşınıyor.

- [ ] **Step 5: `app/(site)/layout.tsx` yaz**

```tsx
import '../cine.css';
import Footer from '../components/Footer';
import WhatsAppButton from '../components/WhatsAppButton';
import MobileActionBar from '../components/MobileActionBar';

export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <Footer />
      <WhatsAppButton />
      <MobileActionBar />
    </>
  );
}
```

- [ ] **Step 6: `app/components/lp/LpHeader.tsx` yaz**

```tsx
import Image from 'next/image';
import { SITE } from '@/lib/site';

/** Menüsüz üst bar — landing page'de kaçış yolu bırakılmaz. */
export default function LpHeader() {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="flex items-center gap-3">
          <Image src="/logo.png" alt={SITE.name} width={40} height={40} />
          <span className="font-display text-lg text-ink">{SITE.name}</span>
        </span>
        <a href={`tel:${SITE.phone.e164}`} className="text-sm font-medium text-ink hover:underline">
          {SITE.phone.display}
        </a>
      </div>
    </header>
  );
}
```

- [ ] **Step 7: `app/components/lp/LpFooter.tsx` yaz**

```tsx
import Link from 'next/link';
import { SITE } from '@/lib/site';

/** Minimal alt bar — site menüsüne link vermez. */
export default function LpFooter() {
  return (
    <footer className="border-t border-rule bg-paper py-10">
      <div className="mx-auto max-w-5xl px-6 text-sm text-ink-soft">
        <p className="font-medium text-ink">{SITE.name}</p>
        <p className="mt-2">
          {SITE.address.street}, {SITE.address.district}/{SITE.address.city}
        </p>
        <p className="mt-1">
          <a href={`tel:${SITE.phone.e164}`} className="hover:underline">{SITE.phone.display}</a>
          {' · '}
          <a href={`mailto:${SITE.email}`} className="hover:underline">{SITE.email}</a>
        </p>
        <p className="mt-4 text-xs">
          <Link href="/gizlilik" className="hover:underline">KVKK Aydınlatma Metni</Link>
          {' · '}
          <Link href="/cerez" className="hover:underline">Çerez Politikası</Link>
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 8: `app/(lp)/layout.tsx` yaz**

```tsx
import LpHeader from '../components/lp/LpHeader';
import LpFooter from '../components/lp/LpFooter';
import WhatsAppButton from '../components/WhatsAppButton';
import MobileActionBar from '../components/MobileActionBar';

export default function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <LpHeader />
      {children}
      <LpFooter />
      <WhatsAppButton />
      <MobileActionBar />
    </>
  );
}
```

- [ ] **Step 9: Test, build, gözle doğrulama**

```bash
npm test && npm run build && npm run dev
```
Expected: Rota testi yeşil (`pageExists` route group'ları tanıyor). Tüm sayfalar aynı URL'lerde, Footer görünüyor. Import hatası çıkarsa Step 2'ye dön.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: split site and landing shells via route groups"
```

---

### Task 12: Landing page içerik verisi

**Files:**
- Create: `content/landingPages.ts`, `content/__tests__/landingPages.test.ts`

**Interfaces:**
- Produces: `type LandingPage`, `LANDING_PAGES`, `LANDING_SLUGS`, `getLandingPage(slug)`

- [ ] **Step 1: Testi yaz**

`content/__tests__/landingPages.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { LANDING_PAGES, LANDING_SLUGS, getLandingPage } from '../landingPages';
import { MEDIA } from '../media';

const FORBIDDEN = ['indirim', 'kampanya', 'uygun fiyat', 'bütçe dostu', 'fırsat'];

describe('LANDING_PAGES', () => {
  it('beş landing page tanımlıdır', () => {
    expect(LANDING_PAGES).toHaveLength(5);
  });

  it('slug\'lar benzersizdir', () => {
    expect(new Set(LANDING_SLUGS).size).toBe(LANDING_SLUGS.length);
  });

  it('getLandingPage bilineni bulur, bilinmeyene undefined döner', () => {
    expect(getLandingPage('az-mevcutlu-anaokulu')?.campaign).toBe('K4-A');
    expect(getLandingPage('yok-boyle-bir-sey')).toBeUndefined();
  });

  it.each(LANDING_PAGES)('$slug geçerli görsel anahtarı kullanır', (page) => {
    expect(MEDIA[page.mediaKey]).toBeDefined();
  });

  it.each(LANDING_PAGES)('$slug dört kanıt rakamı içerir', (page) => {
    expect(page.proofPoints).toHaveLength(4);
  });

  it.each(LANDING_PAGES)('$slug üç gövde bloğu içerir', (page) => {
    expect(page.bodyBlocks).toHaveLength(3);
  });

  it.each(LANDING_PAGES)('$slug en az üç SSS içerir', (page) => {
    expect(page.faq.length).toBeGreaterThanOrEqual(3);
  });

  it.each(LANDING_PAGES)('$slug yasak kelime içermez', (page) => {
    const text = JSON.stringify(page).toLowerCase();
    for (const word of FORBIDDEN) expect(text).not.toContain(word);
  });

  it.each(LANDING_PAGES)('$slug ücret rakamı içermez', (page) => {
    const text = JSON.stringify(page);
    expect(text).not.toMatch(/\d{3}\.\d{3}/);
    expect(text).not.toContain('₺');
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu doğrula**

```bash
npm test -- landingPages
```

- [ ] **Step 3: `content/landingPages.ts` yaz**

```typescript
import type { MediaKey } from './media';

export type LandingPage = {
  slug: string;
  /** Bu LP'yi hedefleyen reklam kampanyası/grubu. */
  campaign: string;
  metaTitle: string;
  metaDescription: string;
  /** Reklamın sabitlenmiş birinci başlığıyla anlamca birebir örtüşür. */
  h1: string;
  subhead: string;
  mediaKey: MediaKey;
  proofPoints: { value: string; label: string }[];
  bodyBlocks: { heading: string; text: string }[];
  faq: { question: string; answer: string }[];
  formHeading: string;
  formIntro: string;
};

const PROOF_STANDARD = [
  { value: '10', label: 'Sınıf mevcudu' },
  { value: '1 : 5', label: 'Öğretmen başına çocuk' },
  { value: '2011', label: 'Kuruluş yılı' },
  { value: '2-6', label: 'Yaş aralığı' },
];

const FAQ_AGES = {
  question: 'Hangi yaş gruplarını kabul ediyorsunuz?',
  answer: 'İki yaşından beş yaşının sonuna kadar dört grubumuz var: 2-3, 3-4, 4-5 ve 5-6 yaş.',
};

const FAQ_PRICE = {
  question: 'Ücret bilgisini nasıl alabilirim?',
  answer:
    'Ücreti ön görüşmede paylaşıyoruz; programa, gün sayısına ve servis ihtiyacına göre değiştiği için. Ödeme planları ve burs imkânı da bu görüşmede konuşulur.',
};

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: 'beykent-anaokulu',
    campaign: 'K2-A',
    metaTitle: 'Beykent Anaokulu — Sınıfta 10 Çocuk, 2 Öğretmen',
    metaDescription:
      'Beykent\'te 2011\'den beri. Sınıfta on çocuk, iki öğretmen. 2-6 yaş Montessori ve High Scope temelli okul öncesi eğitim. Ön görüşme randevusu alın.',
    h1: 'Beykent\'te sınıfta on çocuk, iki öğretmen.',
    subhead:
      'MEB okul öncesi yönetmeliği öğretmen başına yirmi çocuğa kadar izin veriyor. Bizde beş. Aradaki fark, çocuğunuzun gün içinde kaç kez fark edildiğidir.',
    mediaKey: 'classroomWide',
    proofPoints: PROOF_STANDARD,
    bodyBlocks: [
      {
        heading: 'On beş yıldır aynı sokakta',
        text: 'Cumhuriyet Mahallesi Uludağ Sokak\'ta 2011\'den beri buradayız. Bugün mezunlarımızın kardeşlerini kaydediyoruz. Süreklilik, okul öncesinde en zor taklit edilen özelliktir.',
      },
      {
        heading: 'Mezunlarımız İngilizce konuşuyor',
        text: 'Native öğretmenimiz gün boyu sınıfta bulunur; İngilizce ders saati değil, oyunun ve yemeğin dilidir. On kişilik grupta her çocuk gün içinde defalarca konuşma sırası alır.',
      },
      {
        heading: 'Atölyeler programın parçası',
        text: 'Robotik, seramik, satranç, binicilik, yüzme, dans, drama ve müzik. Uzman psikoloğumuz haftalık gözlem yapar ve gerektiğinde aileyle birlikte çalışır.',
      },
    ],
    faq: [
      FAQ_AGES,
      {
        question: 'Sınıf mevcudu gerçekten on çocuk mu?',
        answer: 'Evet. Ön görüşmede sınıfa girer, çocukları ve öğretmenleri kendiniz görürsünüz.',
      },
      FAQ_PRICE,
      {
        question: 'Okulu gezebilir miyim?',
        answer: 'Ön görüşme zaten bir okul gezisidir. Yaklaşık kırk beş dakika sürer; çocuğunuzu da getirebilirsiniz.',
      },
    ],
    formHeading: 'Okulu gezin, sonra karar verin',
    formIntro: 'Talebinize ortalama on beş dakika içinde dönüş yapıyoruz.',
  },
  {
    slug: 'beylikduzu-anaokulu',
    campaign: 'K2-C',
    metaTitle: 'Beylikdüzü Anaokulu — Sınıfta 10 Çocuk, 2 Öğretmen',
    metaDescription:
      'Beylikdüzü\'ne on dakika mesafede, Beykent\'te. Sınıfta on çocuk, iki öğretmen. 2-6 yaş okul öncesi eğitim, servis hizmeti mevcut.',
    h1: 'Beylikdüzü\'nden on dakika. Sınıfta on çocuk.',
    subhead:
      'Beykent\'teki kampüsümüz Beylikdüzü\'nün büyük bölümüne on dakika mesafede. Servis hizmetimiz Adnan Kahveci, Kavaklı, Marmara ve Gürpınar hatlarını kapsıyor.',
    mediaKey: 'sports',
    proofPoints: PROOF_STANDARD,
    bodyBlocks: [
      {
        heading: 'Neden mahalledeki okul değil',
        text: 'Okul öncesinde belirleyici olan mesafe değil, öğretmen başına düşen çocuk sayısıdır. On dakikalık fark, günde beş çocuğa bakan bir öğretmenle yirmi çocuğa bakan bir öğretmen arasındaki farkı kapatmaz.',
      },
      {
        heading: 'Servis ve güvenlik',
        text: 'Güzergâhlar her dönem başında kayıtlı ailelerin adreslerine göre planlanır. Kampüs kamera ile izlenir, giriş kontrollüdür, bahçe kapalıdır.',
      },
      {
        heading: 'Montessori ve High Scope',
        text: 'Günün bir bölümü bireysel Montessori çalışmasına, bir bölümü High Scope grup planlamasına ayrılır. İkisinin de işlemesi için tek koşul vardır: öğretmenin her çocuğu ayrı ayrı gözleyebilmesi.',
      },
    ],
    faq: [
      {
        question: 'Beylikdüzü\'nden servis var mı?',
        answer: 'Evet. Güzergâhlar her dönem başında kayıtlı ailelerin adreslerine göre planlanır. Adresinizin uygunluğunu ön görüşmede birlikte değerlendiriyoruz.',
      },
      {
        question: 'Yol ne kadar sürüyor?',
        answer: 'Beylikdüzü\'nün büyük bölümünden on dakika civarında. Servis saatleri güzergâha göre belirlenir.',
      },
      FAQ_AGES,
      FAQ_PRICE,
    ],
    formHeading: 'Bir kere gelin, farkı görün',
    formIntro: 'Talebinize ortalama on beş dakika içinde dönüş yapıyoruz.',
  },
  {
    slug: 'az-mevcutlu-anaokulu',
    campaign: 'K4-A',
    metaTitle: 'Az Mevcutlu Anaokulu — MEB Sınırı 20, Bizde 5',
    metaDescription:
      'Sınıfta on çocuk, iki öğretmen. Öğretmen başına beş çocuk — MEB üst sınırının dörtte biri. Beykent Büyükçekmece\'de butik anaokulu.',
    h1: 'MEB yirmi çocuğa izin veriyor. Biz onda durduk.',
    subhead:
      'Okul öncesi yönetmeliği dört yaş üstü sınıflarda öğretmen başına yirmi çocuğa kadar izin verir. Sınıflarımızda on çocuk ve iki öğretmen bulunur.',
    mediaKey: 'classroomWide',
    proofPoints: [
      { value: '10', label: 'Sınıf mevcudu' },
      { value: '2', label: 'Sınıftaki öğretmen' },
      { value: '1 : 5', label: 'Öğretmen başına çocuk' },
      { value: '1 : 20', label: 'MEB üst sınırı' },
    ],
    bodyBlocks: [
      {
        heading: 'Bu rakam neyi değiştiriyor',
        text: 'Sessiz kalan çocuk gözden kaçmaz. Öğretmen günün sonunda çocuğunuzun ne yaptığını tek tek anlatabilir. Bir zorlanma başladığı gün fark edilir, haftalar sonra değil.',
      },
      {
        heading: 'Çekingen çocuk için belirleyici',
        text: 'Kalabalık sınıfta konuşmayan çocuk sorun çıkarmadığı için en son fark edilendir. On kişilik grupta her çocuk gün içinde defalarca söz alır; katılım tercih değil, doğal sonuçtur.',
      },
      {
        heading: 'Dil edinimi de buna bağlı',
        text: 'Mezunlarımız İngilizce konuşarak ayrılıyor. Sebebi ders saati değil, konuşma sırası. Native öğretmenimiz gün boyu sınıfta bulunur ve on kişilik grupta herkese sıra gelir.',
      },
    ],
    faq: [
      {
        question: 'On çocuk sınırını hiç aşıyor musunuz?',
        answer: 'Hayır. Kontenjan dolduğunda sıraya alıyoruz. Bu sınır, programın tamamının dayandığı koşuldur.',
      },
      {
        question: 'İki öğretmen aynı anda mı sınıfta?',
        answer: 'Evet, gün boyu iki öğretmen sınıfta bulunur. Uyum döneminde bir öğretmen yeni gelen çocukla birebir ilgilenebilir.',
      },
      {
        question: 'Bunu nasıl doğrulayabilirim?',
        answer: 'Ön görüşmede sınıfa girer, çocukları ve öğretmenleri kendiniz sayarsınız. Randevu yaklaşık kırk beş dakika sürer.',
      },
      FAQ_AGES,
    ],
    formHeading: 'Sınıfı kendiniz sayın',
    formIntro: 'Ön görüşmede sınıfa girip çocukları ve öğretmenleri görebilirsiniz.',
  },
  {
    slug: 'kres-2-yas',
    campaign: 'K9',
    metaTitle: 'Beykent Kreş ve 2-3 Yaş Grubu — Bakım Değil Eğitim',
    metaDescription:
      'İki yaşından itibaren kabul. Sınıfta on çocuk, iki öğretmen. Montessori ve High Scope temelli program, kademeli uyum süreci. Beykent Büyükçekmece.',
    h1: 'Kreş değil, anaokulu. İki yaşından itibaren.',
    subhead:
      'İki yaş, çocuğun aileden ilk kez ayrıldığı dönemdir. Bu yaşta önceliğimiz akademik kazanım değil, güvenli bağlanma ve kademeli uyumdur.',
    mediaKey: 'motorSkills',
    proofPoints: PROOF_STANDARD,
    bodyBlocks: [
      {
        heading: 'İlk hafta ağlamayla geçmek zorunda değil',
        text: 'Uyum sürecini aileyle birlikte planlıyoruz. İlk günler kısa tutulur ve çocuğun temposuna göre kademeli uzatılır. Bu süreçte veli okulda kalabilir; ayrılık çocuk hazır olduğunda gerçekleşir.',
      },
      {
        heading: 'Bakım değil, program',
        text: 'İki yaş grubunda da Montessori ve High Scope uygulanır. Duyusal oyun, öz bakım becerileri, tuvalet eğitimi desteği ve native öğretmenle İngilizceye ilk temas günün parçasıdır.',
      },
      {
        heading: 'Psikolog aileyle birlikte çalışır',
        text: 'Uyum, uyku düzeni, tuvalet eğitimi ve kardeş kıskançlığı gibi başlıklarda uzman psikoloğumuz aileyle ortak bir plan yapar. Evde ve okulda aynı yöntem uygulanır.',
      },
    ],
    faq: [
      {
        question: 'İki yaş çok erken değil mi?',
        answer: 'Erken olup olmadığı çocuğa göre değişir. Ön görüşmede çocuğunuzun hazır olup olmadığını birlikte değerlendiriyoruz; hazır değilse bunu açıkça söylüyoruz.',
      },
      {
        question: 'Tuvalet eğitimi tamamlanmamış olabilir mi?',
        answer: 'Olabilir. İki yaş grubunda tuvalet eğitimi desteği programın parçasıdır ve aileyle ortak bir planla yürütülür.',
      },
      {
        question: 'Öğle uykusu var mı?',
        answer: 'Evet. İki ve üç yaş grubunda günlük akışta dinlenme saati yer alır; ayrı bir uyku odamız bulunur.',
      },
      FAQ_PRICE,
    ],
    formHeading: 'Grubu ve öğretmenleri görün',
    formIntro: 'İlk okul deneyimi en çok özen isteyen dönem. Ön görüşme randevunuzu planlayalım.',
  },
  {
    slug: 'anaokulu-ucret',
    campaign: 'K7',
    metaTitle: 'Anaokulu Ücreti — Ön Görüşmede Paylaşıyoruz',
    metaDescription:
      'Ücreti belirleyen dört unsur: sınıf mevcudu, program, gün sayısı ve servis. Rakamı ön görüşmede paylaşıyoruz. Ödeme planı ve burs imkânı mevcut.',
    h1: 'Ücreti belirleyen dört unsur',
    subhead:
      'Rakamı sitede yazmıyoruz. Sebebi saklamak değil: ücret programa, gün sayısına ve servis ihtiyacına göre değişiyor. Aşağıda neyin neyi belirlediğini anlattık.',
    mediaKey: 'montessori',
    proofPoints: PROOF_STANDARD,
    bodyBlocks: [
      {
        heading: 'Bir — sınıf mevcudu',
        text: 'On çocuğa iki öğretmen düşürmek, yirmi çocuğa bir öğretmen düşürmekten yapısal olarak daha maliyetlidir. Ücretimizin en büyük bileşeni budur ve programın tamamı buna dayanır.',
      },
      {
        heading: 'İki — program ve gün sayısı',
        text: 'Tam gün, yarım gün ve yaz dönemi farklı fiyatlanır. Atölyeler ve native öğretmenle İngilizce ek ücretli değildir; programa dahildir.',
      },
      {
        heading: 'Üç ve dört — servis ve ödeme planı',
        text: 'Servis ihtiyacınız varsa güzergâha göre ayrıca hesaplanır. Ödeme planları ve burs imkânı ön görüşmede konuşulur; peşin ve taksitli seçenekler mevcuttur.',
      },
    ],
    faq: [
      {
        question: 'Neden rakamı sitede yazmıyorsunuz?',
        answer: 'Ücret programa, gün sayısına ve servis ihtiyacına göre değiştiği için tek bir rakam yanıltıcı olur. Ön görüşmede size özel bir hesap paylaşıyoruz.',
      },
      {
        question: 'Burs imkânı var mı?',
        answer: 'Evet, ön görüşmede değerlendiriyoruz.',
      },
      {
        question: 'Ücrete neler dahil?',
        answer: 'Atölyeler, native öğretmenle İngilizce, psikolog desteği ve beslenme programa dahildir. Servis ayrıca hesaplanır.',
      },
      {
        question: 'Ödeme planı seçebiliyor muyum?',
        answer: 'Peşin ve taksitli seçenekler mevcut. Detayları ön görüşmede birlikte belirliyoruz.',
      },
    ],
    formHeading: 'Size özel hesabı konuşalım',
    formIntro: 'Formu doldurun, ortalama on beş dakika içinde arayıp bilgi verelim.',
  },
];

export const LANDING_SLUGS = LANDING_PAGES.map((page) => page.slug);

export function getLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((page) => page.slug === slug);
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu doğrula**

```bash
npm test -- landingPages
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add landing page content data for five ad groups"
```

---

### Task 13: Landing page rotası ve indeksleme kontrolü

**Files:**
- Create: `app/components/lp/ProofStrip.tsx`, `app/(lp)/lp/[slug]/page.tsx`, `app/__tests__/robots.test.ts`
- Modify: `app/robots.ts`

**Interfaces:**
- Produces: `/lp/<slug>` rotaları, `generateStaticParams` ile statik üretilir, `noindex`.

- [ ] **Step 1: Robots testini yaz**

`app/__tests__/robots.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import robots from '../robots';

describe('robots.txt', () => {
  const rules = robots().rules;
  const disallow = Array.isArray(rules) ? rules[0].disallow : rules.disallow;
  const list = Array.isArray(disallow) ? disallow : [disallow];

  it('landing page dizinini taramaya kapatır', () => {
    expect(list).toContain('/lp/');
  });

  it('api ve teşekkür sayfasını kapalı tutar', () => {
    expect(list).toContain('/api/');
    expect(list).toContain('/tesekkurler');
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu doğrula**

```bash
npm test -- robots
```

- [ ] **Step 3: `app/robots.ts` güncelle**

`disallow` dizisini `['/api/', '/tesekkurler', '/lp/']` yap.

- [ ] **Step 4: `app/components/lp/ProofStrip.tsx` yaz**

```tsx
export type ProofPoint = { value: string; label: string };

export default function ProofStrip({ points }: { points: ProofPoint[] }) {
  return (
    <section className="border-y border-rule bg-paper-warm">
      <dl className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-4">
        {points.map((point) => (
          <div key={point.label}>
            <dt className="font-display text-3xl text-ink md:text-4xl">{point.value}</dt>
            <dd className="timecode mt-1 text-ink-soft">{point.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
```

- [ ] **Step 5: `app/(lp)/lp/[slug]/page.tsx` yaz**

```tsx
import { notFound } from 'next/navigation';
import LeadForm from '@/app/components/LeadForm';
import JsonLd from '@/app/components/JsonLd';
import Frame from '@/app/components/cine/Frame';
import ProofStrip from '@/app/components/lp/ProofStrip';
import { LANDING_PAGES, getLandingPage } from '@/content/landingPages';
import { TESTIMONIALS } from '@/content/testimonials';
import { SITE, WHATSAPP_URL } from '@/lib/site';
import { buildMetadata } from '@/lib/metadata';
import { buildFaqSchema } from '@/lib/schema';

export function generateStaticParams() {
  return LANDING_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getLandingPage(slug);
  if (!page) return {};
  return buildMetadata({
    title: page.metaTitle,
    description: page.metaDescription,
    path: `/lp/${page.slug}`,
    noindex: true,
  });
}

export default async function LandingPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getLandingPage(slug);
  if (!page) notFound();

  const quotes = TESTIMONIALS.slice(0, 2);

  return (
    <div className="bg-paper">
      <JsonLd data={buildFaqSchema(page.faq)} />

      <section className="mx-auto max-w-5xl px-6 pt-14 pb-10">
        <h1 className="text-4xl text-ink md:text-5xl">{page.h1}</h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-soft">{page.subhead}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#form" className="rounded-full bg-ink px-8 py-4 text-center font-medium text-paper">
            Ön Görüşme Randevusu
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-ink px-8 py-4 text-center font-medium text-ink"
          >
            WhatsApp&apos;tan Yazın
          </a>
        </div>
        <div className="mt-10">
          <Frame mediaKey={page.mediaKey} ratio="portrait" priority />
        </div>
      </section>

      <ProofStrip points={page.proofPoints} />

      <section className="mx-auto max-w-3xl px-6 py-14">
        {page.bodyBlocks.map((block) => (
          <div key={block.heading} className="mb-10 last:mb-0">
            <h2 className="text-2xl text-ink">{block.heading}</h2>
            <p className="mt-3 text-ink-soft">{block.text}</p>
          </div>
        ))}
      </section>

      <section id="form" className="scroll-mt-8 bg-ink py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl text-paper">{page.formHeading}</h2>
          <p className="mt-4 text-paper/80">{page.formIntro}</p>
          <div className="mt-8 rounded-2xl bg-paper p-6 md:p-8">
            <LeadForm variant="compact" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="grid gap-6 md:grid-cols-2">
          {quotes.map((quote) => (
            <figure key={quote.id} className="rounded-2xl bg-paper-warm p-7">
              <blockquote className="text-ink">&ldquo;{quote.quote}&rdquo;</blockquote>
              <figcaption className="timecode mt-4 text-ink-soft">
                {quote.parent} · {quote.year}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-14">
        <h2 className="text-3xl text-ink">Sıkça Sorulanlar</h2>
        <dl className="mt-8 space-y-6">
          {page.faq.map((item) => (
            <div key={item.question} className="border-t border-rule pt-6">
              <dt className="font-medium text-ink">{item.question}</dt>
              <dd className="mt-2 text-ink-soft">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-rule bg-paper-warm py-14">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl text-ink">Okulu gezin, sonra karar verin</h2>
          <p className="mt-4 text-ink-soft">
            {SITE.address.street}, {SITE.address.district}/{SITE.address.city}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#form" className="rounded-full bg-ink px-8 py-4 text-paper">
              Ön Görüşme Randevusu
            </a>
            <a href={`tel:${SITE.phone.e164}`} className="rounded-full border border-ink px-8 py-4 text-ink">
              {SITE.phone.display}
            </a>
            <a
              href={SITE.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-ink px-8 py-4 text-ink"
            >
              Haritada Gör
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
```

> `TESTIMONIALS` öğelerinin alan adlarını (`id`, `parent`, `quote`, `year`) `content/testimonials.ts` içinden doğrula; farklıysa bu sayfayı o alan adlarına uyarla.
> `buildFaqSchema` imzasının `{ question, answer }[]` aldığını `lib/schema.ts` içinden doğrula.

- [ ] **Step 6: Test, build ve gözle doğrulama**

```bash
npm test && npm run build && npm run dev
```
Build çıktısında beş LP rotasının statik üretildiğini gör. Her beş URL'i aç:
`/lp/beykent-anaokulu`, `/lp/beylikduzu-anaokulu`, `/lp/az-mevcutlu-anaokulu`, `/lp/kres-2-yas`, `/lp/anaokulu-ucret`

Her birinde doğrula:
- Üst barda **menü yok**, sadece logo ve telefon
- Alt barda **site menüsü linki yok**
- Sayfa kaynağında `<meta name="robots" content="noindex,nofollow">`
- "Ön Görüşme Randevusu" forma kaydırıyor
- Mobilde alt aksiyon barı ve WhatsApp çalışıyor
- Form gönderimi `/tesekkurler`'e gidiyor

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add dedicated landing pages for five ad groups"
```

---

# FAZ 5 — DOĞRULAMA

### Task 14: Reklam hedefi ve performans doğrulaması

**Files:**
- Create: `app/__tests__/adTargets.test.ts`

**Interfaces:**
- Consumes: `LANDING_SLUGS`, `AGE_GROUPS_CONTENT`, `AGE_GROUPS`, `DAY_CHAPTERS`
- Produces: Reklam planındaki her hedef URL ve çapanın var olduğunu garanti eden test.

- [ ] **Step 1: Testi yaz**

`app/__tests__/adTargets.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LANDING_SLUGS } from '@/content/landingPages';
import { AGE_GROUPS_CONTENT } from '@/content/ageGroups';
import { DAY_CHAPTERS } from '@/content/day';
import { AGE_GROUPS } from '@/lib/leadSchema';

const APP_DIR = path.join(process.cwd(), 'app');

function siteRouteExists(routePath: string): boolean {
  const segments = routePath.split('/').filter(Boolean);
  return existsSync(path.join(APP_DIR, '(site)', ...segments, 'page.tsx'));
}

/** Reklam planındaki (GOOGLE-ADS-ARAMA-PLANI-45K.md) site hedefleri. */
const AD_SITE_TARGETS = [
  '/', '/kayit', '/ucretler', '/egitim-yaklasimimiz', '/veli-yorumlari',
  '/guvenlik', '/gunluk-akis', '/kadromuz', '/yas-gruplari',
];

const EXPECTED_LPS = [
  'beykent-anaokulu', 'beylikduzu-anaokulu', 'az-mevcutlu-anaokulu',
  'kres-2-yas', 'anaokulu-ucret',
];

describe('reklam hedef sayfaları', () => {
  it.each(AD_SITE_TARGETS)('%s mevcut', (routePath) => {
    expect(siteRouteExists(routePath)).toBe(true);
  });

  it('dört yaş grubu sayfasının tümü tanımlı', () => {
    const slugs = AGE_GROUPS_CONTENT.map((g) => g.slug);
    for (const age of AGE_GROUPS) expect(slugs).toContain(`${age}-yas`);
  });
});

describe('K10 çapa hedefi', () => {
  it('/gunluk-akis içinde uyum bölümü çapası var', () => {
    const ids = DAY_CHAPTERS.map((c) => c.id);
    expect(ids).toContain('karsilama');
  });
});

describe('landing page hedefleri', () => {
  it.each(EXPECTED_LPS)('/lp/%s tanımlı', (slug) => {
    expect(LANDING_SLUGS).toContain(slug);
  });

  it('dinamik LP rotası mevcut', () => {
    expect(existsSync(path.join(APP_DIR, '(lp)', 'lp', '[slug]', 'page.tsx'))).toBe(true);
  });
});

describe('LP kabuğu sinematik CSS yüklemez', () => {
  it('cine.css yalnızca site kabuğunda import edilir', () => {
    const lpLayout = readFileSync(path.join(APP_DIR, '(lp)', 'layout.tsx'), 'utf8');
    const siteLayout = readFileSync(path.join(APP_DIR, '(site)', 'layout.tsx'), 'utf8');
    const globals = readFileSync(path.join(APP_DIR, 'globals.css'), 'utf8');

    expect(lpLayout).not.toContain('cine.css');
    expect(siteLayout).toContain('cine.css');
    expect(globals).not.toContain('cine.css');
  });
});
```

- [ ] **Step 2: Testi çalıştır**

```bash
npm test
```
Expected: **Tüm testler yeşil.** Kırmızı varsa ilgili task'a dön.

- [ ] **Step 3: Performans ölçümü**

```bash
npm run build && npm start
```

Chrome DevTools → Lighthouse → **Mobile** profilinde şu URL'leri ölç:
`/`, `/gunluk-akis`, `/kayit`, `/lp/beykent-anaokulu`, `/lp/az-mevcutlu-anaokulu`

| Metrik | Eşik |
|---|---|
| LCP | **< 2,5 sn** |
| CLS | < 0,1 |
| Performance skoru | ≥ 85 |

Eşiği aşan sayfa varsa: `Frame` bileşenindeki `sizes` değerini daralt, `priority` yalnızca ilk kadrajda kalsın, gerekirse o sayfadaki kadraj sayısını azalt. **LCP 2,5 sn'yi aşan bir URL reklamda kullanılmaz.**

- [ ] **Step 4: Elle yayın öncesi kontrol listesi**

```bash
npm run dev
```

| # | Kontrol | ✓ |
|---|---|---|
| 1 | Menü ve footer'daki hiçbir link 404 vermiyor | ☐ |
| 2 | Beş LP açılıyor, menüsüz, `noindex` | ☐ |
| 3 | `/lp/...?gclid=TEST123` → gizli alanda değer görünüyor | ☐ |
| 4 | Başka sayfaya gidip `/kayit`'e dönünce gclid korunuyor | ☐ |
| 5 | Form gönderimi `/tesekkurler`'e gidiyor | ☐ |
| 6 | `dataLayer` içinde `lead_submit` + `value` + `currency` var | ☐ |
| 7 | 2-3 yaş → `value: 3500`, 5-6 yaş → `value: 1200` | ☐ |
| 8 | Çerez bandı çıkıyor, "Kabul Et" `consent update` gönderiyor | ☐ |
| 9 | Mobilde (375 px) alt aksiyon barı ve WhatsApp çalışıyor | ☐ |
| 10 | `prefers-reduced-motion: reduce` → hareket yok, içerik tam görünür | ☐ |
| 11 | `/robots.txt` içinde `Disallow: /lp/` | ☐ |
| 12 | `/sitemap.xml` içinde `/lp/` yok | ☐ |
| 13 | Hiçbir sayfada ücret rakamı, "indirim", "kampanya" geçmiyor | ☐ |
| 14 | `/admin` 404 veriyor | ☐ |
| 15 | Türkçe karakterler (ı İ ş ğ ü ö ç) üç fontta da doğru | ☐ |

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: verify every ad target url and anchor resolves"
```

---

## Yayın Sonrası — Kod Dışı Görevler

`GOOGLE-ADS-ARAMA-PLANI-45K.md` §8.1 kapı listesi ve `ICERIK-VE-GORSEL-IHTIYAC-LISTESI.md` geçerlidir. Özet:

| # | İş | Sahibi |
|---|---|---|
| 1 | GTM: `value`, `currency`, `child_age` değişkenleri + `lead_submit` tetikleyicisi | Reklam yöneticisi |
| 2 | Google Ads dönüşümü Birincil, "her dönüşüm için farklı değer" açık | Reklam yöneticisi |
| 3 | Enhanced Conversions for Leads | Reklam yöneticisi |
| 4 | Google İşletme Profili doğrulama + Ads bağlantısı | Okul |
| 5 | Gerçek veli yorumları → `content/testimonials.ts` | Okul |
| 6 | Fotoğraf çekimi → `content/media.ts` (`docs/cekim-brief.md`) | Okul |
| 7 | 2-3 yaş MEB personel oranı doğrulaması | Okul |
| 8 | Instagram + YouTube hesapları, `lib/site.ts` `social` alanları | Okul |

---

## Plan Özeti

| Faz | Task | Çıktı |
|---|---|---|
| **0 · Onarım** | 1 | Çalışan test altyapısı + rota ve görsel bütünlük testleri |
| | 2 | Admin paneli, stok avatar, kırık görsel referansları temizlendi |
| **1 · Tasarım sistemi** | 3 | Kâğıt-mürekkep tokenları, üç rollü tipografi |
| | 4 | Görsel kataloğu + çekim brief'i |
| | 5 | Sinematik ilkeller: Frame, Timecode, Roster |
| **2 · Sayfa kurguları** | 6 | "Bir Gün" anlatısı — `/gunluk-akis` tam sinematik |
| | 7 | Ana sayfa: künye hero + gün önizlemesi |
| **3 · Ölçüm** | 8 | Consent Mode v2 + KVKK bandı |
| | 9 | GCLID yakalama — offline import mümkün |
| | 10 | Yaşa göre dönüşüm değeri |
| **4 · LP sistemi** | 11 | Site / LP kabuk ayrımı, sinematik CSS izolasyonu |
| | 12 | Beş LP'nin içeriği |
| | 13 | `/lp/[slug]` rotası, `noindex`, robots |
| **5 · Doğrulama** | 14 | Reklam hedefi testi + mobil LCP geçidi |
