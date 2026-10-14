# Faz 2 · Yerinde Düzenleme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editör öğretmen panelden "Siteyi düzenle"ye basıp sekeranaokulu.com'un kendisinde (17 site sayfası + 5 reklam sayfası) her metni, listeyi, fotoğrafı ve duyuruyu çift tıklayarak değiştirebilsin; "Kaydet" ile değişiklik birkaç saniye içinde tüm ziyaretçilere yayınlansın, her değişiklik geçmişe yazılsın ve tek tıkla geri alınabilsin.

**Architecture:** İçerik `site_content` tablosunda anahtar → JSON değer olarak durur; satırı olmayan anahtar koddaki bugünkü metni (registry varsayılanı) gösterir. Ziyaretçi sayfaları içeriği `"use cache"` + `cacheTag('site-content')` ile önbellekten okur (Next 16 Cache Components); kayıt tek Server Action'dan (`saveContent`) atomik bir Postgres fonksiyonuyla (`save_site_content`) geçer ve `updateTag('site-content')` ile yayınlanır. Düzenleme modu Next.js Draft Mode'dur: editörde önbellek atlanır, düzenleme çubuğu (`EditBar`) yalnızca o zaman `next/dynamic` ile yüklenir; ziyaretçi HTML'i ve JS'i değişmez.

**Tech Stack:** Next.js 16.2 (cacheComponents, Server Actions, draftMode, `updateTag`), React 19, TypeScript 5, Supabase (`@supabase/ssr`, `@supabase/supabase-js`, Postgres RLS), zod 4, `sanitize-html` 2.18.0, Tiptap 3.32.0 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`), sharp 0.35.5, `@aws-sdk/client-s3` 3.1151.0, Vitest 4 + Testing Library + happy-dom.

**Spec:** `docs/superpowers/specs/2026-10-14-seker-platform-design.html` (bölümler: "Öğretmen gözünden → Siteyi düzenlemek / Bir hata yaparsam / Fotoğraf yüklerken KVKK / Duyurular", "Teknik akışlar → 2 · İçerik okuma ve yayınlama, 3 · Fotoğraf yükleme", "Veri modeli", "Güvenlik ve KVKK"). Ortak isimler: `docs/superpowers/plans/2026-10-14-00-seker-platform-index.md` → "Ortak Sözleşme".

**Önkoşul:** Faz 0 tamamlandı: `C:\Users\meert\Desktop\seker-platform` monorepo'su var, `apps/web` Next 16.2'de `output: 'standalone'` ile Lightsail'de yayında, `@seker/auth` (`authCookieOptions`, `createServerSupabase`, `createAdminSupabase`, `getEditor`) ve `@seker/db` (`packages/db/supabase/migrations`, `Database` tipi) hazır, panel RLS testleri yerel Supabase'e (`pnpm --filter @seker/db exec supabase start`, Docker) karşı koşuyor ve `seed.sql` `yonetici@test.local` / `danisman@test.local` kullanıcılarını (`sifre123`) kuruyor. Faz 1'in yapılmış olması gerekmez.

**Tahmin:** ~10–11 geliştirici günü, 19 görev.

## Global Constraints

İndeks dosyasındaki tüm Global Constraints geçerlidir. Bu faza özgü olanlar:

- Ziyaretçi sayfaları (`app/(site)`, `app/(lp)`) oturum çerezi okumaz; içerik yalnızca `getContent()` (`"use cache"` + `cacheTag('site-content')`) üzerinden gelir. `cookies()` / `getEditor()` yalnızca `app/api/edit/*`, `app/actions/*` ve draft mode'da render edilen `EditLayerServer` içinde çağrılır.
- Önbellek etiketi tek: `'site-content'` (içerik + duyurular + medya meta). Yayınlama yalnızca Server Action içinden `updateTag('site-content')`.
- Ziyaretçi HTML'i, düzenleme katmanı eklendikten sonra eklenmeden öncekiyle aynıdır (her sayfa görevinde snapshot testiyle kanıtlanır). `data-edit-*` öznitelikleri yalnızca draft mode'da üretilir.
- Ziyaretçi hiçbir düzenleme JS'i (Tiptap, EditBar) indirmez.
- Öğretmen sayfa düzenini, sınıfları, form alanlarını, takip kodlarını (GTM, `gclid`, `TrackedLink` olayları), JSON-LD yapısını, URL'leri değiştiremez; yalnızca registry'de tanımlı anahtarların değerlerini değiştirir.
- Karakter sayımı her yerde grafem bazlı: `countChars()` (`Intl.Segmenter('tr', { granularity: 'grapheme' })`).
- Zengin metin izinli etiketleri yalnızca: `p, br, b, strong, i, em, a[href: http/https/mailto/tel], ul, ol, li`.
- Fotoğraf: en fazla 10 MB, `image/jpeg | image/png | image/webp`; sunucuda `sharp().rotate().resize(2400 inside).webp()` (EXIF/GPS silinir); S3 anahtarı `site-images/YYYY/MM/<uuid>.webp`; açıklama (alt) zorunlu, ≤ 200 karakter; `faces` beyanı (`'yok' | 'bulanik_veya_izinli'`) zorunlu.
- Metin şablon belirteçleri: `{yilSayisi}` (bugünkü yıl − kuruluş yılı) ve `{kurulusYili}`. Başka belirteç yok.
- Tüm kullanıcıya görünen metinler Türkçe.
- Paket sürümleri sabit (caret yok): `sanitize-html@2.18.0`, `@types/sanitize-html@2.16.2`, `@tiptap/react@3.32.0`, `@tiptap/starter-kit@3.32.0`, `@tiptap/pm@3.32.0`, `@aws-sdk/client-s3@3.1151.0`, `server-only@0.0.1`; `sharp@0.35.5` devDependency'den dependency'ye taşınır.

## Review Focus

1. **Aynı metni iki sekmede / iki kişi düzenler:** ikinci kayıt "Bu metin siz düzenlerken değişti" uyarısı almalı, hiçbir anahtar kısmen yazılmamalı (atomik). → Task 2 (SQL çakışma testi) ve Task 7 (action çakışma testi).
2. **Word'den / bir web sayfasından yapıştırma:** düz metin alanına yalnızca metin girmeli (biçim, `<span style>`, `<o:p>` yok); zengin metinde yalnızca izinli etiketler kalmalı. → Task 7 (Word HTML örneğiyle sanitize testi) ve Task 8 (yapıştırma işleyicisi testi).
3. **Türkçe karakter ve emoji uzunluğu:** "İğüşöç" 6, "👨‍👩‍👧" 1 karakter sayılmalı; tarayıcıdaki sayaç ile sunucu doğrulaması aynı sonucu vermeli. → Task 4 (`countChars` testi) ve Task 7 (sınırda kabul/red testi).
4. **Supabase kapalı veya yavaş:** ziyaretçi hata değil, koddaki varsayılan metni görmeli; bu yedek yalnızca birkaç dakika önbellekte kalmalı, Supabase dönünce gerçek içerik geri gelmeli. → Task 4 (hata veren istemciyle `getContent` testi) ve Task 19 (canlı kontrol listesi).
5. **Düzenleme sırasında editör oturumu düşer:** "Kaydet" oturum mesajı döndürmeli, bekleyen değişiklikler kaybolmamalı (sessionStorage) ve yeniden girişten sonra geri yüklenmeli. → Task 7 (oturumsuz action testi) ve Task 8 (pending kalıcılığı testi).

---

## Dosya Haritası

Tüm yollar `C:\Users\meert\Desktop\seker-platform` köküne göredir.

**Veritabanı ve panel**
- Create `packages/db/supabase/migrations/0007_site_content.sql` — tablolar, `can_edit_site()`, `set_can_edit_site()`, `save_site_content()`, `active_announcements` view, RLS, profil koruma trigger'ı.
- Create `apps/panel/tests/rls/site-content.test.ts` — RLS + fonksiyon testleri.
- Create `apps/panel/actions/site-editors.ts`, `apps/panel/components/site-editor-toggle.tsx`.
- Modify `apps/panel/lib/auth.ts`, `apps/panel/app/(app)/ayarlar/page.tsx`, `apps/panel/components/nav.tsx`, `apps/panel/app/(app)/layout.tsx`.

**Web: içerik çekirdeği (`apps/web/lib/content/`)**
- `types.ts` — tipler. `chars.ts` — `countChars`, `fillVars`. `reader.ts` — `makeReader`, `pickData` (istemci güvenli, registry import etmez).
- `slots/*.ts` — alan tanımları (sayfa/bölüm başına bir dosya). `registry.ts` — `SLOTS`, `PAGE_IDS`.
- `getContent.ts` — `getContent`, `read`, `isEditing`, `currentYear`, `getAnnouncements` (sunucu).
- `server.ts` — `buildReaderData`, `getReaderData` (sunucu). `validate.ts` — `validateEdits`. `sanitize.ts` — `sanitizeRich`.
- `testing.ts` — `defaultData`, `sentinelData`, `uncoveredText` (yalnız testler).

**Web: düzenleme**
- `apps/web/lib/time.ts` — `currentYear` (Task 1; Task 4'te `getContent.ts`'e taşınır değil, buradan re-export edilir).
- `apps/web/lib/supabase/public.ts` — çerezsiz, publishable key'li istemci.
- `apps/web/lib/edit/safeNext.ts`, `apps/web/app/api/edit/enable/route.ts`, `apps/web/app/api/edit/disable/route.ts`.
- `apps/web/app/components/edit/Editable.tsx` — `Editable`, `EditableRich`, `editImageAttrs`.
- `apps/web/app/components/edit/EditLayerGate.tsx` (sunucu), `EditLayerClient.tsx` (istemci, `next/dynamic`), `EditBar.tsx`, `pending.ts`, `TextEditing.ts`, `RichEditor.tsx`, `ListPanel.tsx`, `SettingsPanel.tsx`, `HistoryDrawer.tsx`, `UploadDialog.tsx`, `AnnouncementDialog.tsx`, `Toasts.tsx`, `edit.css`.
- `apps/web/app/actions/content.ts` (`saveContent`, `revertRevision`, `listRevisions`), `apps/web/app/actions/media.ts` (`uploadImage`), `apps/web/app/actions/announcements.ts`.
- `apps/web/lib/media/process.ts` (`processImage`), `apps/web/lib/media/s3.ts` (`putImage`).

**Web: sayfalar** — her sayfa `page.tsx` (async, veri çeker) + `*View.tsx` (senkron, test edilir) ayrımına geçer. Ayrıntı Task 11–17'de.

**Doküman** — `docs/ogretmen-kilavuzu.md`, `docs/superpowers/plans/faz2-canli-kontrol.md`.

---

### Task 1: Next 16 Cache Components'e geçiş (web)

`"use cache"` sözleşmenin parçası; bunun için `cacheComponents: true` gerekir. Bu bayrak açılınca prerender sırasında argümansız `new Date()` hata verir. Sitede 6 yerde var: `HeroSection.tsx:23`, `TrustBar.tsx:17`, `Footer.tsx:100`, `hakkimizda/page.tsx:55`, `egitim-yaklasimimiz/page.tsx:166`, `sitemap.ts:29`, ayrıca `content/landingPages.ts:28` modül seviyesinde.

**Files:**
- Modify: `apps/web/next.config.ts`
- Create: `apps/web/lib/time.ts`
- Create: `apps/web/lib/__tests__/time.test.ts`
- Modify: `apps/web/app/components/HeroSection.tsx`, `apps/web/app/components/TrustBar.tsx`, `apps/web/app/components/Footer.tsx`, `apps/web/app/(site)/Anasayfa.tsx`, `apps/web/app/(site)/layout.tsx`, `apps/web/app/(site)/hakkimizda/page.tsx`, `apps/web/app/(site)/egitim-yaklasimimiz/page.tsx`, `apps/web/app/sitemap.ts`, `apps/web/content/landingPages.ts`, `apps/web/app/(lp)/lp/[slug]/page.tsx`, `apps/web/app/__tests__/homepage.test.tsx`

**Interfaces:**
- Produces: `currentYear(): Promise<number>`, `todayIso(): Promise<string>`, `fillYears(text: string, yearsActive: number): string` (`lib/time.ts`). `HeroSection`, `TrustBar`, `Footer` artık `yearsActive: number` (Footer: `year: number`) prop'u alır.

- [ ] **Step 1: Bayrağı aç ve hataları gör**

`apps/web/next.config.ts` içinde `nextConfig` nesnesine ekle:

```ts
  cacheComponents: true,
  partialPrefetching: true,
```

Run: `pnpm --filter @seker/web build`
Expected: FAIL. Çıktıda `new Date()` kullanan route'lar için "used `new Date()` … before accessing uncached data" türü prerender hataları (en az `/`, `/hakkimizda`, `/egitim-yaklasimimiz`, `/sitemap.xml`). Hata listesini kaydet; aşağıdaki adımlar hepsini kapatmalı.

- [ ] **Step 2: Failing test yaz**

`apps/web/lib/__tests__/time.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/cache', () => ({ cacheLife: vi.fn() }));

import { currentYear, todayIso, fillYears } from '../time';

describe('time', () => {
  it('currentYear bugünün yılını döner', async () => {
    expect(await currentYear()).toBe(new Date().getFullYear());
  });
  it('todayIso ISO tarih döner', async () => {
    expect(await todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('fillYears {yilSayisi} belirtecini doldurur', () => {
    expect(fillYears('{yilSayisi} yıl', 15)).toBe('15 yıl');
    expect(fillYears('belirteçsiz', 15)).toBe('belirteçsiz');
  });
});
```

- [ ] **Step 3: Testi koştur, düştüğünü gör**

Run: `pnpm --filter @seker/web exec vitest run lib/__tests__/time.test.ts`
Expected: FAIL — `Failed to resolve import "../time"`.

- [ ] **Step 4: `lib/time.ts` yaz**

```ts
import { cacheLife } from 'next/cache';

/** Prerender'da argümansız new Date() yasak; yıl günde bir kez hesaplanıp önbelleğe alınır. */
export async function currentYear(): Promise<number> {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}

export async function todayIso(): Promise<string> {
  'use cache';
  cacheLife('days');
  return new Date().toISOString();
}

export function fillYears(text: string, yearsActive: number): string {
  return text.replaceAll('{yilSayisi}', String(yearsActive));
}
```

- [ ] **Step 5: Bileşenleri prop'a çevir**

`HeroSection.tsx`: imzayı `export default function HeroSection({ yearsActive }: { yearsActive: number })` yap ve `const yearsActive = new Date().getFullYear() - SITE.foundingYear;` satırını sil. `TrustBar.tsx`'te aynı değişiklik. `Footer.tsx`: `export default function Footer({ year }: { year: number })`, `{new Date().getFullYear()}` → `{year}`.

`Anasayfa.tsx`:

```tsx
import { currentYear } from '@/lib/time'
import { SITE } from '@/lib/site'
// ...
const Anasayfa = async () => {
  const yearsActive = (await currentYear()) - SITE.foundingYear
  return (
    <div className="min-h-screen bg-paper">
      <HeroSection yearsActive={yearsActive} />
      {/* geri kalanı aynı */}
```

`TrustBar` kullanıldığı her yerde (`grep -rn "<TrustBar" apps/web/app`) çağıran bileşeni `async` yapıp aynı şekilde `yearsActive` geçir.

`app/(site)/layout.tsx`:

```tsx
import { currentYear } from '@/lib/time';
// ...
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const year = await currentYear();
  return (
    <>
      <Header />
      {children}
      <Footer year={year} />
      <WhatsAppButton />
      <MobileActionBar />
    </>
  );
}
```

`hakkimizda/page.tsx`: `export default async function HakkimizdaPage()`, `const yearsActive = (await currentYear()) - SITE.foundingYear`.
`egitim-yaklasimimiz/page.tsx`: sayfa fonksiyonunu `async` yap, başta `const yearsActive = (await currentYear()) - SITE.foundingYear`, satır 166'daki ifadeyi `{yearsActive}` yap.
`sitemap.ts`: `export default async function sitemap()`, `const lastModified = new Date(await todayIso());`.

`content/landingPages.ts`: `const YEARS_ACTIVE = …` satırını sil; `YEARS_ACTIVE_POINT`'i `{ value: '{yilSayisi} yıl', label: "Beykent'te aynı adreste" }` yap; dosyada `YEARS_ACTIVE` geçen başka her ifadeyi (`grep -n YEARS_ACTIVE apps/web/content/landingPages.ts`) metin içinde `{yilSayisi}` belirtecine çevir.

`app/(lp)/lp/[slug]/page.tsx`: sayfada `const yearsActive = (await currentYear()) - SITE.foundingYear;` ekle; `ProofStrip`'e `points={page.proofPoints.map((p) => ({ ...p, value: fillYears(p.value, yearsActive) }))}` geçir; `bodyBlocks`, `subhead`, `faq` metinlerini render ederken `fillYears(…, yearsActive)` ile sar.

`app/__tests__/homepage.test.tsx` içinde `<HeroSection />` render eden her yeri `<HeroSection yearsActive={new Date().getFullYear() - SITE.foundingYear} />` yap (gerekirse `import { SITE } from '@/lib/site'`).

`app/admin` hâlâ duruyorsa (Faz 1 henüz bitmediyse) `app/admin/page.tsx` ve varsa `app/admin/layout.tsx` dosyalarına `export const instant = false` ekle.

- [ ] **Step 6: Testleri ve build'i koştur**

Run: `pnpm --filter @seker/web exec vitest run`
Expected: PASS (tüm mevcut testler + `time.test.ts`).

Run: `pnpm --filter @seker/web build`
Expected: PASS; route tablosunda `/`, `/hakkimizda`, `/lp/[slug]` prerender edilmiş (◐ veya ○) görünür, hata yok.

**Geri dönüş kuralı:** Bu görev yarım günü aşarsa dur ve parent'a bildir. Alternatif: `cacheComponents` kapalı kalır, Task 4'teki `getContent` `unstable_cache(fetchRows, ['site-content'], { tags: ['site-content'] })` ile yazılır; `updateTag` klasik modelde de çalışır. Bu bir sözleşme değişikliğidir (indeks: "use cache").

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "chore(web): Cache Components'i aç, prerender'daki new Date() kullanımlarını kaldır"
```

---

### Task 2: Veritabanı: `0007_site_content.sql` ve RLS testleri

**Files:**
- Create: `packages/db/supabase/migrations/0007_site_content.sql`
- Create: `apps/panel/tests/rls/site-content.test.ts`
- Modify: `packages/db/src/database.types.ts` (üretilir)
- Create: `packages/auth/src/editor.ts`, `packages/auth/tests/editor.test.ts`; Modify: `packages/auth/package.json` (`exports`)

**Interfaces:**
- Produces (TS): `getEditor(): Promise<Editor | null>`, `type Editor = { id: string; fullName: string }` (`@seker/auth`).
- Produces (SQL): `profiles.can_edit_site boolean`; `public.can_edit_site() returns boolean`; `public.set_can_edit_site(p_user uuid, p_value boolean) returns void`; `public.save_site_content(p_edits jsonb) returns jsonb` → `{ "conflicts": text[], "saved_at": timestamptz }`; tablolar `site_content`, `content_revisions`, `announcements`, `media_assets` (indeks sözleşmesindeki kolonlar); view `public.active_announcements`.
- `p_edits` biçimi: `[{ "key": text, "kind": "text"|"rich"|"image"|"list", "value": jsonb (null = satırı sil, koddaki varsayılana dön), "baseUpdatedAt": text|null }]`. `baseUpdatedAt` Postgres'in döndürdüğü `updated_at` metninin **aynısıdır** (JS `Date`'e çevrilmez; mikrosaniye kaybolur).

- [ ] **Step 1: Failing RLS testini yaz**

`apps/panel/tests/rls/site-content.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

const DAN_ID = "00000000-0000-0000-0000-000000000002";
const KEY = "test.rls.title";
let yon: SupabaseClient, dan: SupabaseClient, anon: SupabaseClient;

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
  anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await admin.from("site_content").delete().like("key", "test.%");
  await admin.from("profiles").update({ can_edit_site: false }).eq("id", DAN_ID);
});

afterAll(async () => {
  await admin.from("site_content").delete().like("key", "test.%");
  await admin.from("content_revisions").delete().like("key", "test.%");
  await admin.from("profiles").update({ can_edit_site: false }).eq("id", DAN_ID);
});

const edit = (value: unknown, baseUpdatedAt: string | null) => [{ key: KEY, kind: "text", value, baseUpdatedAt }];

describe("site_content RLS", () => {
  it("anon okuyabilir, yazamaz", async () => {
    await admin.from("site_content").insert({ key: "test.rls.read", value: "x", kind: "text" });
    const { data } = await anon.from("site_content").select("key").eq("key", "test.rls.read");
    expect(data).toHaveLength(1);
    const { error } = await anon.from("site_content").insert({ key: "test.rls.anon", value: "x", kind: "text" });
    expect(error).not.toBeNull();
  });

  it("editör olmayan danışman save_site_content çağıramaz", async () => {
    const { error } = await dan.rpc("save_site_content", { p_edits: edit("a", null) });
    expect(error?.code).toBe("42501");
  });

  it("danışman kendi can_edit_site bayrağını açamaz", async () => {
    await dan.from("profiles").update({ can_edit_site: true }).eq("id", DAN_ID);
    const { data } = await admin.from("profiles").select("can_edit_site").eq("id", DAN_ID).single();
    expect(data!.can_edit_site).toBe(false);
  });

  it("yönetici set_can_edit_site ile bayrağı açar", async () => {
    const { error } = await yon.rpc("set_can_edit_site", { p_user: DAN_ID, p_value: true });
    expect(error).toBeNull();
    const { data } = await admin.from("profiles").select("can_edit_site").eq("id", DAN_ID).single();
    expect(data!.can_edit_site).toBe(true);
  });

  it("editör kaydeder, revizyon yazılır", async () => {
    const { data, error } = await dan.rpc("save_site_content", { p_edits: edit("İlk", null) });
    expect(error).toBeNull();
    expect(data.conflicts).toEqual([]);
    const { data: row } = await admin.from("site_content").select("value, updated_by").eq("key", KEY).single();
    expect(row!.value).toBe("İlk");
    expect(row!.updated_by).toBe(DAN_ID);
    const { data: revs } = await admin.from("content_revisions").select("old_value,new_value").eq("key", KEY);
    expect(revs).toEqual([{ old_value: null, new_value: "İlk" }]);
  });

  it("eski baseUpdatedAt ile kayıt çakışma döner ve hiçbir şey yazmaz", async () => {
    const { data: cur } = await dan.from("site_content").select("updated_at").eq("key", KEY).single();
    const first = await dan.rpc("save_site_content", { p_edits: edit("İkinci", cur!.updated_at) });
    expect(first.data.conflicts).toEqual([]);
    const stale = await dan.rpc("save_site_content", {
      p_edits: [
        { key: "test.rls.other", kind: "text", value: "yan", baseUpdatedAt: null },
        { key: KEY, kind: "text", value: "Üçüncü", baseUpdatedAt: cur!.updated_at },
      ],
    });
    expect(stale.data.conflicts).toEqual([KEY]);
    const { data: other } = await admin.from("site_content").select("key").eq("key", "test.rls.other");
    expect(other).toHaveLength(0);
  });

  it("value null satırı siler (koddaki varsayılana döner)", async () => {
    const { data: cur } = await dan.from("site_content").select("updated_at").eq("key", KEY).single();
    const res = await dan.rpc("save_site_content", { p_edits: edit(null, cur!.updated_at) });
    expect(res.data.conflicts).toEqual([]);
    const { data } = await admin.from("site_content").select("key").eq("key", KEY);
    expect(data).toHaveLength(0);
  });

  it("revizyonlar değiştirilemez ve silinemez", async () => {
    const { data: rev } = await admin.from("content_revisions").select("id").eq("key", KEY).limit(1).single();
    await dan.from("content_revisions").update({ new_value: "hack" }).eq("id", rev!.id);
    await dan.from("content_revisions").delete().eq("id", rev!.id);
    const { data } = await admin.from("content_revisions").select("new_value").eq("id", rev!.id).single();
    expect(data!.new_value).not.toBe("hack");
  });

  it("anon yalnızca yayındaki duyuruları görür", async () => {
    await admin.from("announcements").insert([
      { title: "test yayında", body: "<p>a</p>", starts_on: "2020-01-01", published: true, sort: 0 },
      { title: "test taslak", body: "<p>b</p>", starts_on: "2020-01-01", published: false, sort: 0 },
      { title: "test bitti", body: "<p>c</p>", starts_on: "2020-01-01", ends_on: "2020-02-01", published: true, sort: 0 },
    ]);
    const { data } = await anon.from("active_announcements").select("title").like("title", "test %");
    expect(data!.map((r) => r.title)).toEqual(["test yayında"]);
    await admin.from("announcements").delete().like("title", "test %");
  });
});
```

- [ ] **Step 2: Testi koştur, düştüğünü gör**

Run: `pnpm --filter @seker/db exec supabase db reset && pnpm --filter @seker/panel exec vitest run tests/rls/site-content.test.ts`
Expected: FAIL — `relation "public.site_content" does not exist`.

- [ ] **Step 3: Migration'ı yaz**

`packages/db/supabase/migrations/0007_site_content.sql`:

```sql
-- Faz 2: yerinde düzenleme

alter table public.profiles add column can_edit_site boolean not null default false;

create or replace function public.can_edit_site() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.can_edit_site
  );
$$;

-- Bayrağı yalnızca yönetici (veya service role) değiştirebilir.
create or replace function public.guard_profiles_can_edit_site() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.can_edit_site is distinct from old.can_edit_site
     and coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
     and not public.is_yonetici() then
    new.can_edit_site := old.can_edit_site;
  end if;
  return new;
end $$;

create trigger guard_profiles_can_edit_site before update on public.profiles
  for each row execute function public.guard_profiles_can_edit_site();

create or replace function public.set_can_edit_site(p_user uuid, p_value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_yonetici() then
    raise exception 'yalnızca yönetici' using errcode = '42501';
  end if;
  update public.profiles set can_edit_site = p_value where id = p_user;
end $$;
revoke all on function public.set_can_edit_site(uuid, boolean) from public, anon;
grant execute on function public.set_can_edit_site(uuid, boolean) to authenticated;

create table public.site_content (
  key text primary key check (key ~ '^[a-z0-9][a-zA-Z0-9_.-]{1,120}$'),
  value jsonb not null,
  kind text not null check (kind in ('text','rich','image','list')),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  old_value jsonb,
  new_value jsonb,
  editor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index content_revisions_created_idx on public.content_revisions (created_at desc);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  s3_key text not null unique,
  width int not null check (width > 0),
  height int not null check (height > 0),
  alt text not null check (char_length(alt) between 1 and 200),
  faces text not null check (faces in ('yok','bulanik_veya_izinli')),
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null,
  image_id uuid references public.media_assets(id) on delete set null,
  starts_on date not null default ((now() at time zone 'Europe/Istanbul')::date),
  ends_on date,
  published boolean not null default false,
  sort int not null default 0,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint ends_after_start check (ends_on is null or ends_on >= starts_on)
);

create view public.active_announcements with (security_invoker = true) as
  select id, title, body, image_id, starts_on, ends_on, sort, updated_at
  from public.announcements
  where published
    and starts_on <= (now() at time zone 'Europe/Istanbul')::date
    and (ends_on is null or ends_on >= (now() at time zone 'Europe/Istanbul')::date);

alter table public.site_content enable row level security;
alter table public.content_revisions enable row level security;
alter table public.media_assets enable row level security;
alter table public.announcements enable row level security;

create policy sel_site_content on public.site_content for select to anon, authenticated using (true);
create policy ins_site_content on public.site_content for insert to authenticated with check (public.can_edit_site());
create policy upd_site_content on public.site_content for update to authenticated
  using (public.can_edit_site()) with check (public.can_edit_site());
create policy del_site_content on public.site_content for delete to authenticated using (public.can_edit_site());

create policy sel_revisions on public.content_revisions for select to authenticated
  using (public.can_edit_site() or public.is_yonetici());
create policy ins_revisions on public.content_revisions for insert to authenticated
  with check (public.can_edit_site() and editor_id = (select auth.uid()));

create policy sel_media on public.media_assets for select to anon, authenticated using (true);
create policy ins_media on public.media_assets for insert to authenticated
  with check (public.can_edit_site() and uploaded_by = (select auth.uid()));
create policy upd_media on public.media_assets for update to authenticated
  using (public.can_edit_site()) with check (public.can_edit_site());

create policy sel_ann_public on public.announcements for select to anon using (published);
create policy sel_ann_staff on public.announcements for select to authenticated
  using (published or public.can_edit_site());
create policy ins_ann on public.announcements for insert to authenticated with check (public.can_edit_site());
create policy upd_ann on public.announcements for update to authenticated
  using (public.can_edit_site()) with check (public.can_edit_site());
create policy del_ann on public.announcements for delete to authenticated using (public.can_edit_site());

-- Tek giriş noktası: çakışma kontrolü + yazma + revizyon, tek transaction.
create or replace function public.save_site_content(p_edits jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  e jsonb;
  cur_value jsonb;
  cur_updated timestamptz;
  conflicts text[] := '{}';
  ts timestamptz := clock_timestamp();
begin
  if not public.can_edit_site() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if jsonb_typeof(p_edits) <> 'array' or jsonb_array_length(p_edits) > 100 then
    raise exception 'geçersiz istek' using errcode = '22023';
  end if;

  for e in select * from jsonb_array_elements(p_edits) loop
    select sc.updated_at into cur_updated from public.site_content sc where sc.key = e ->> 'key' for update;
    if found then
      if (e ->> 'baseUpdatedAt') is null or (e ->> 'baseUpdatedAt')::timestamptz <> cur_updated then
        conflicts := conflicts || (e ->> 'key');
      end if;
    elsif (e ->> 'baseUpdatedAt') is not null then
      conflicts := conflicts || (e ->> 'key');
    end if;
  end loop;

  if cardinality(conflicts) > 0 then
    return jsonb_build_object('conflicts', to_jsonb(conflicts), 'saved_at', null);
  end if;

  for e in select * from jsonb_array_elements(p_edits) loop
    select sc.value into cur_value from public.site_content sc where sc.key = e ->> 'key';
    insert into public.content_revisions (key, old_value, new_value, editor_id)
      values (e ->> 'key', cur_value, nullif(e -> 'value', 'null'::jsonb), (select auth.uid()));
    if e -> 'value' = 'null'::jsonb then
      delete from public.site_content where key = e ->> 'key';
    else
      insert into public.site_content (key, value, kind, updated_by, updated_at)
        values (e ->> 'key', e -> 'value', e ->> 'kind', (select auth.uid()), ts)
      on conflict (key) do update
        set value = excluded.value, kind = excluded.kind,
            updated_by = excluded.updated_by, updated_at = excluded.updated_at;
    end if;
  end loop;

  return jsonb_build_object('conflicts', '[]'::jsonb, 'saved_at', ts);
end $$;
revoke all on function public.save_site_content(jsonb) from public, anon;
grant execute on function public.save_site_content(jsonb) to authenticated;
```

- [ ] **Step 4: Testi koştur, geçtiğini gör**

Run: `pnpm --filter @seker/db exec supabase db reset && pnpm --filter @seker/panel exec vitest run tests/rls/site-content.test.ts`
Expected: PASS (9 test). Ayrıca mevcut RLS testleri bozulmamalı: `pnpm --filter @seker/panel exec vitest run tests/rls` → PASS.

- [ ] **Step 5: Tipleri üret**

Run: `pnpm --filter @seker/db gen:types`
Expected: `packages/db/src/database.types.ts` içinde `site_content`, `save_site_content` görünür (`grep -c save_site_content packages/db/src/database.types.ts` ≥ 1).

- [ ] **Step 6: `getEditor()`'ı `@seker/auth`'a ekle (indeks: Faz 2'de eklenir)**

Failing test `packages/auth/tests/editor.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const single = vi.fn();
vi.mock('../src/server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}));

import { getEditor } from '../src/editor';

beforeEach(() => {
  getUser.mockReset();
  single.mockReset();
});

describe('getEditor', () => {
  it('oturum yoksa null', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getEditor()).toBeNull();
  });
  it('yetkisi kapalıysa null', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u' } } });
    single.mockResolvedValue({ data: { id: 'u', full_name: 'A', is_active: true, can_edit_site: false } });
    expect(await getEditor()).toBeNull();
  });
  it('pasif kullanıcı null', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u' } } });
    single.mockResolvedValue({ data: { id: 'u', full_name: 'A', is_active: false, can_edit_site: true } });
    expect(await getEditor()).toBeNull();
  });
  it('aktif editör', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u' } } });
    single.mockResolvedValue({ data: { id: 'u', full_name: 'Ayşe', is_active: true, can_edit_site: true } });
    expect(await getEditor()).toEqual({ id: 'u', fullName: 'Ayşe' });
  });
});
```

Run: `pnpm --filter @seker/auth exec vitest run src/__tests__/editor.test.ts` → FAIL (modül yok).

`packages/auth/src/editor.ts`:

```ts
import { createServerSupabase } from './server';

export type Editor = { id: string; fullName: string };

/** getUser() JWT'yi Auth sunucusunda doğrular; getSession()'a güvenilmez. */
export async function getEditor(): Promise<Editor | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, is_active, can_edit_site')
    .eq('id', user.id)
    .single();
  if (!data || !data.is_active || !data.can_edit_site) return null;
  return { id: data.id, fullName: data.full_name };
}
```

`packages/auth/package.json` içindeki `exports` alanına `"./editor": "./src/editor.ts"` satırını ekle. Paketin kök export'u yoktur (indeks sözleşmesi: yalnızca alt yollar); `getEditor` ve `Editor` `@seker/auth/editor`'dan import edilir.

Run: `pnpm --filter @seker/auth exec vitest run` → PASS.

`apps/web` Faz 1'den önce bu faza giriyorsa hâlâ eski `SUPABASE_URL`/`SUPABASE_ANON_KEY` değişkenleriyle çalışıyor olabilir. Bu fazın kodu yalnızca yeni adları (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `AUTH_COOKIE_DOMAIN`, `PANEL_URL`) kullanır; web'in `.env.local`'ına ve sunucudaki `/opt/seker/.env` web bölümüne bunları ekle (eskiler Faz 1'de kaldırılır, birlikte durabilirler).

- [ ] **Step 7: Commit**

```bash
git add packages/db packages/auth apps/panel/tests/rls/site-content.test.ts
git commit -m "feat(db): site_content, revizyon, medya, duyuru tabloları, save_site_content ve getEditor"
```

Canlıya uygulama (`supabase db push`) elle onaylı iştir; Task 19'da yapılır.

---

### Task 3: Panel: editör yetkisi ve "Siteyi düzenle" bağlantısı

**Files:**
- Create: `apps/panel/actions/site-editors.ts`
- Create: `apps/panel/components/site-editor-toggle.tsx`
- Create: `apps/panel/tests/unit/site-edit-url.test.ts`
- Create: `apps/panel/lib/site-edit-url.ts`
- Modify: `apps/panel/lib/auth.ts`, `apps/panel/app/(app)/ayarlar/page.tsx`, `apps/panel/components/nav.tsx`, `apps/panel/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `public.set_can_edit_site(p_user uuid, p_value boolean)` (Task 2).
- Produces: `SessionProfile.can_edit_site: boolean`; `siteEditUrl(siteUrl: string | undefined, path?: string): string | null`; `setCanEditSite(userId: string, value: boolean): Promise<{ ok: boolean; error?: string }>`; `Nav` yeni prop `siteEditUrl: string | null`.

- [ ] **Step 1: Failing test**

`apps/panel/tests/unit/site-edit-url.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { siteEditUrl } from "@/lib/site-edit-url";

describe("siteEditUrl", () => {
  it("SITE_URL'den düzenleme modunu açan adresi üretir", () => {
    expect(siteEditUrl("https://sekeranaokulu.com")).toBe("https://sekeranaokulu.com/api/edit/enable?next=%2F");
    expect(siteEditUrl("https://sekeranaokulu.com/", "/kayit")).toBe(
      "https://sekeranaokulu.com/api/edit/enable?next=%2Fkayit",
    );
  });
  it("SITE_URL yoksa null", () => {
    expect(siteEditUrl(undefined)).toBeNull();
  });
});
```

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/site-edit-url.test.ts`
Expected: FAIL — modül bulunamadı.

- [ ] **Step 2: Uygula**

`apps/panel/lib/site-edit-url.ts`:

```ts
export function siteEditUrl(siteUrl: string | undefined, path = "/"): string | null {
  if (!siteUrl) return null;
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/api/edit/enable?next=${encodeURIComponent(path)}`;
}
```

`apps/panel/lib/auth.ts`: `SessionProfile`'a `can_edit_site: boolean;` ekle, `select("id, full_name, role, is_active")` → `select("id, full_name, role, is_active, can_edit_site")`.

`apps/panel/actions/site-editors.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export async function setCanEditSite(userId: string, value: boolean): Promise<{ ok: boolean; error?: string }> {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { ok: false, error: "Bu ayarı yalnızca yönetici değiştirebilir." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("set_can_edit_site", { p_user: userId, p_value: value });
  if (error) return { ok: false, error: "Kaydedilemedi, tekrar deneyin." };
  revalidatePath("/ayarlar");
  return { ok: true };
}
```

`apps/panel/components/site-editor-toggle.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { setCanEditSite } from "@/actions/site-editors";

export interface StaffRow {
  id: string;
  fullName: string;
  canEditSite: boolean;
}

export function SiteEditorToggle({ staff }: { staff: StaffRow[] }) {
  const [rows, setRows] = useState(staff);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(id: string, value: boolean) {
    setError(null);
    start(async () => {
      const res = await setCanEditSite(id, value);
      if (!res.ok) return setError(res.error ?? "Kaydedilemedi.");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, canEditSite: value } : r)));
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Site düzenleme yetkisi</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Yetkisi olan kişi panelden &quot;Siteyi düzenle&quot;ye basarak sitedeki yazıları ve fotoğrafları değiştirebilir.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2">
            <span>{r.fullName}</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                id={`site-edit-${r.id}`}
                type="checkbox"
                checked={r.canEditSite}
                disabled={pending}
                onChange={(e) => toggle(r.id, e.target.checked)}
              />
              Siteyi düzenleyebilir
            </label>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
```

`apps/panel/app/(app)/ayarlar/page.tsx`: mevcut sorgulardan sonra:

```tsx
const { data: staffRows } = await supabase
  .from("profiles")
  .select("id, full_name, can_edit_site")
  .eq("is_active", true)
  .order("full_name");
const staff = (staffRows ?? []).map((s) => ({ id: s.id, fullName: s.full_name, canEditSite: s.can_edit_site }));
```

ve JSX'in sonuna `<SiteEditorToggle staff={staff} />` (import: `import { SiteEditorToggle } from "@/components/site-editor-toggle";`).

`apps/panel/app/(app)/layout.tsx`: `import { siteEditUrl } from "@/lib/site-edit-url";` ve `<Nav … siteEditUrl={profile.can_edit_site ? siteEditUrl(process.env.SITE_URL) : null} />`.

`apps/panel/components/nav.tsx`: props tipine `siteEditUrl: string | null` ekle; masaüstü kenar çubuğunda `NEW_LEAD_HREF` bağlantısının hemen üstüne ve mobil menüde aynı listenin sonuna:

```tsx
{siteEditUrl ? (
  <a
    href={siteEditUrl}
    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
  >
    <PencilLine className="h-4 w-4" aria-hidden="true" />
    Siteyi düzenle
  </a>
) : null}
```

(`import { PencilLine } from "lucide-react";`). `<a>` kullanılır, `Link` değil: başka alan adına gider ve önceden yüklenmemeli.

- [ ] **Step 3: Testleri koştur**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/site-edit-url.test.ts && pnpm --filter @seker/panel build`
Expected: PASS; build hatasız.

- [ ] **Step 4: Commit**

```bash
git add apps/panel
git commit -m "feat(panel): site düzenleme yetkisi ve Siteyi düzenle bağlantısı"
```

---

### Task 4: İçerik çekirdeği: tipler, sayım, registry, okuma

**Files:**
- Create: `apps/web/lib/content/types.ts`, `chars.ts`, `reader.ts`, `registry.ts`, `getContent.ts`, `server.ts`, `sanitize.ts`, `slots/site.ts`
- Create: `apps/web/lib/supabase/public.ts`
- Create: `apps/web/lib/content/__tests__/chars.test.ts`, `reader.test.ts`, `getContent.test.ts`, `registry.test.ts`
- Modify: `apps/web/package.json` (bağımlılıklar)

**Interfaces:**
- Consumes: `currentYear()` (Task 1), `SITE` (`lib/site.ts`), `normalizeTurkishPhone` (`@seker/shared`).
- Produces:

```ts
// types.ts
export type ContentKind = 'text' | 'rich' | 'image' | 'list';
export type FieldKind = 'text' | 'rich' | 'image' | 'flag';
export type FieldDef = { kind: FieldKind; max?: number; label: string };
export type SlotDef = {
  kind: ContentKind;
  max?: number;
  default: unknown;
  label: string;
  pattern?: string;              // text için regex (ör. saat, yıl)
  fields?: Record<string, FieldDef>; // list için; her öğede ayrıca zorunlu `id: string`
  maxItems?: number;             // list için, varsayılan 50
  warn?: string;                 // düzenleme çubuğunda gösterilecek uyarı
};
export type ImageValue = { src: string; alt: string; width: number; height: number; assetId: string | null };
export type ListItem = { id: string } & Record<string, unknown>;
export type ContentMap = Record<string, { value: unknown; updatedAt: string }>;
export type SlotMeta = Pick<SlotDef, 'kind' | 'max' | 'fields' | 'label' | 'warn' | 'pattern' | 'maxItems'>;
export type ReaderData = {
  values: Record<string, unknown>;
  updatedAt: Record<string, string>;
  meta: Record<string, SlotMeta>;
  editing: boolean;
  vars: { yilSayisi: string; kurulusYili: string };
};
export type Reader = {
  editing: boolean;
  text(key: string): string;
  rich(key: string): string;
  image(key: string): ImageValue;
  list<T extends ListItem = ListItem>(key: string): T[];
  attrs(key: string, path?: string): Record<string, string>;
  listAttrs(key: string): Record<string, string>;
};
// chars.ts
export function countChars(s: string): number;
export function fillVars(s: string, vars: ReaderData['vars']): string;
// reader.ts (istemci güvenli)
export function makeReader(data: ReaderData): Reader;
export function pickData(data: ReaderData, prefixes: string[]): ReaderData;
// registry.ts
export const SLOTS: Record<string, SlotDef>;
export const PAGE_IDS: Record<string, string>; // pathname → sayfa kimliği (meta anahtarları için)
// getContent.ts (sunucu)
export async function getContent(): Promise<ContentMap>;
export function read<T>(map: ContentMap, key: string): T;
export async function isEditing(): Promise<boolean>;
// server.ts (sunucu)
export function buildReaderData(map: ContentMap, editing: boolean, year: number): ReaderData;
export const getReaderData: () => Promise<ReaderData>; // React.cache ile istek başına bir kez
// sanitize.ts
export function sanitizeRich(html: string): string;
export function richToText(html: string): string;
```

- [ ] **Step 1: Bağımlılıkları ekle**

Run:
```bash
pnpm --filter @seker/web add sanitize-html@2.18.0 server-only@0.0.1 @supabase/supabase-js @seker/auth@workspace:* @seker/shared@workspace:* @seker/db@workspace:*
pnpm --filter @seker/web add -D @types/sanitize-html@2.16.2
```
Expected: `apps/web/package.json` dependencies'te görünürler (`@supabase/supabase-js` sürümü panelinkiyle aynı olmalı; farklıysa panelin sürümünü yaz).

Vitest, `server-only` paketini react-server koşulu olmadan yükler ve paket import anında hata fırlatır; ayrıca `cacheLife`/`cacheTag` "use cache" kapsamı dışında çağrılınca hata verir. Test ortamı için `apps/web/test/empty.ts` (`export {};`) ve `apps/web/test/setup.ts` oluştur:

```ts
import { vi } from 'vitest';

// Testlerde önbellek API'leri etkisiz; tek tek test dosyaları kendi vi.mock'larıyla bunu ezebilir.
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), updateTag: vi.fn(), revalidatePath: vi.fn() }));
```

`apps/web/vitest.config.ts` içinde `test`'e `setupFiles: ['./test/setup.ts']`, `resolve.alias`'a `'server-only': path.resolve(__dirname, 'test/empty.ts')` ekle.

- [ ] **Step 2: Failing testler**

`apps/web/lib/content/__tests__/chars.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { countChars, fillVars } from '../chars';

describe('countChars', () => {
  it('Türkçe harfleri birer sayar', () => expect(countChars('İğüşöç')).toBe(6));
  it('birleşik emojiyi tek sayar', () => expect(countChars('👨‍👩‍👧')).toBe(1));
  it('boş metin 0', () => expect(countChars('')).toBe(0));
});

describe('fillVars', () => {
  it('belirteçleri doldurur', () => {
    expect(fillVars('{kurulusYili}den beri, {yilSayisi} yıl', { yilSayisi: '15', kurulusYili: '2011' })).toBe(
      '2011den beri, 15 yıl',
    );
  });
});
```

`apps/web/lib/content/__tests__/reader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeReader, pickData } from '../reader';
import type { ReaderData } from '../types';

const data: ReaderData = {
  values: {
    'home.hero.title': 'Başlık {yilSayisi}',
    'home.faq': [{ id: 'a', question: 'S?', answer: 'C' }],
    'media.x': { src: '/x.webp', alt: 'x', width: 1, height: 1, assetId: null },
    'other.key': 'z',
  },
  updatedAt: {},
  meta: {
    'home.hero.title': { kind: 'text', max: 120, label: 'Başlık' },
    'home.faq': { kind: 'list', label: 'SSS', fields: { question: { kind: 'text', max: 120, label: 'Soru' } } },
    'media.x': { kind: 'image', label: 'Foto' },
    'other.key': { kind: 'text', label: 'z' },
  },
  editing: false,
  vars: { yilSayisi: '15', kurulusYili: '2011' },
};

describe('makeReader', () => {
  it('ziyaretçide öznitelik üretmez', () => {
    const c = makeReader(data);
    expect(c.text('home.hero.title')).toBe('Başlık 15');
    expect(c.attrs('home.hero.title')).toEqual({});
    expect(c.listAttrs('home.faq')).toEqual({});
  });
  it('düzenlemede data-edit-* üretir', () => {
    const c = makeReader({ ...data, editing: true });
    expect(c.attrs('home.hero.title')).toEqual({
      'data-edit-key': 'home.hero.title',
      'data-edit-kind': 'text',
      'data-edit-max': '120',
    });
    expect(c.attrs('home.faq', 'a.question')).toEqual({
      'data-edit-key': 'home.faq',
      'data-edit-kind': 'text',
      'data-edit-max': '120',
      'data-edit-path': 'a.question',
    });
    expect(c.listAttrs('home.faq')).toEqual({ 'data-edit-list': 'home.faq', 'data-edit-label': 'SSS' });
  });
  it('bilinmeyen anahtarda hata fırlatır (yazım hatası sessiz geçmesin)', () => {
    expect(() => makeReader(data).text('yok.boyle')).toThrow(/yok.boyle/);
  });
});

describe('pickData', () => {
  it('yalnızca verilen önekleri taşır', () => {
    const picked = pickData(data, ['home.']);
    expect(Object.keys(picked.values).sort()).toEqual(['home.faq', 'home.hero.title']);
    expect(Object.keys(picked.meta).sort()).toEqual(['home.faq', 'home.hero.title']);
  });
});
```

`apps/web/lib/content/__tests__/getContent.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const cacheLife = vi.fn();
vi.mock('next/cache', () => ({ cacheLife, cacheTag: vi.fn() }));
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }) }));
vi.mock('server-only', () => ({}));

const select = vi.fn();
vi.mock('@/lib/supabase/public', () => ({
  createPublicSupabase: () => ({ from: () => ({ select }) }),
}));

import { getContent, read } from '../getContent';

beforeEach(() => {
  cacheLife.mockClear();
  select.mockReset();
});

describe('getContent', () => {
  it('satırları haritaya çevirir ve max önbellekler', async () => {
    select.mockResolvedValue({
      data: [{ key: 'home.hero.title', value: 'Yeni', updated_at: '2026-10-14 10:00:00.123456+00' }],
      error: null,
    });
    const map = await getContent();
    expect(map).toEqual({ 'home.hero.title': { value: 'Yeni', updatedAt: '2026-10-14 10:00:00.123456+00' } });
    expect(cacheLife).toHaveBeenCalledWith('max');
  });

  it('Supabase hata verirse boş harita döner ve yalnızca dakikalar önbellekler', async () => {
    select.mockResolvedValue({ data: null, error: { message: 'down' } });
    const map = await getContent();
    expect(map).toEqual({});
    expect(cacheLife).toHaveBeenCalledWith('minutes');
  });

  it('istek fırlatırsa da boş harita', async () => {
    select.mockRejectedValue(new Error('timeout'));
    expect(await getContent()).toEqual({});
  });
});

describe('read', () => {
  it('satır yoksa registry varsayılanı', () => {
    expect(read<string>({}, 'site.phone')).toBe('0530 101 88 75');
  });
});
```

`apps/web/lib/content/__tests__/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SLOTS } from '../registry';
import { countChars } from '../chars';

describe('registry', () => {
  it.each(Object.entries(SLOTS))('%s geçerli bir tanım', (key, def) => {
    expect(key).toMatch(/^[a-z0-9][a-zA-Z0-9_.-]{1,120}$/);
    expect(def.label.length).toBeGreaterThan(0);
    if (def.kind === 'text') {
      expect(typeof def.default).toBe('string');
      expect(def.max).toBeGreaterThan(0);
      expect(countChars(def.default as string)).toBeLessThanOrEqual(def.max!);
      if (def.pattern) expect(def.default as string).toMatch(new RegExp(def.pattern));
    }
    if (def.kind === 'rich') expect(typeof def.default).toBe('string');
    if (def.kind === 'image') {
      expect(def.default).toMatchObject({ src: expect.any(String), alt: expect.any(String) });
    }
    if (def.kind === 'list') {
      expect(Array.isArray(def.default)).toBe(true);
      expect(def.fields).toBeDefined();
      const ids = (def.default as { id: string }[]).map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of def.default as Record<string, unknown>[]) {
        for (const [field, f] of Object.entries(def.fields!)) {
          if (f.kind === 'text' && f.max) expect(countChars(String(item[field] ?? ''))).toBeLessThanOrEqual(f.max);
        }
      }
    }
  });
});
```

Run: `pnpm --filter @seker/web exec vitest run lib/content`
Expected: FAIL — modüller yok.

- [ ] **Step 3: Uygula**

`apps/web/lib/content/types.ts`: Interfaces bloğundaki `types.ts` tanımlarını aynen yaz.

`apps/web/lib/content/chars.ts`:

```ts
import type { ReaderData } from './types';

const segmenter = new Intl.Segmenter('tr', { granularity: 'grapheme' });

export function countChars(s: string): number {
  let n = 0;
  for (const _ of segmenter.segment(s)) n++;
  return n;
}

export function fillVars(s: string, vars: ReaderData['vars']): string {
  return s.replaceAll('{yilSayisi}', vars.yilSayisi).replaceAll('{kurulusYili}', vars.kurulusYili);
}
```

`apps/web/lib/content/reader.ts`:

```ts
import { fillVars } from './chars';
import type { ImageValue, ListItem, Reader, ReaderData } from './types';

export function makeReader(data: ReaderData): Reader {
  const get = (key: string): unknown => {
    if (!(key in data.values)) throw new Error(`İçerik anahtarı tanımsız: ${key}`);
    return data.values[key];
  };
  const fieldMeta = (key: string, path?: string) => {
    const meta = data.meta[key];
    if (!path) return { kind: meta.kind as string, max: meta.max };
    const field = path.split('.').slice(1).join('.');
    const f = meta.fields?.[field];
    return { kind: f?.kind ?? 'text', max: f?.max };
  };

  return {
    editing: data.editing,
    text: (key) => fillVars(String(get(key)), data.vars),
    rich: (key) => fillVars(String(get(key)), data.vars),
    image: (key) => get(key) as ImageValue,
    list: <T extends ListItem>(key: string) => get(key) as T[],
    attrs(key, path) {
      if (!data.editing) return {};
      const { kind, max } = fieldMeta(key, path);
      const out: Record<string, string> = { 'data-edit-key': key, 'data-edit-kind': kind };
      if (max) out['data-edit-max'] = String(max);
      if (path) out['data-edit-path'] = path;
      return out;
    },
    listAttrs(key) {
      if (!data.editing) return {};
      return { 'data-edit-list': key, 'data-edit-label': data.meta[key].label };
    },
  };
}

export function pickData(data: ReaderData, prefixes: string[]): ReaderData {
  const keep = (k: string) => prefixes.some((p) => k.startsWith(p));
  const filter = <V,>(rec: Record<string, V>) =>
    Object.fromEntries(Object.entries(rec).filter(([k]) => keep(k))) as Record<string, V>;
  return { ...data, values: filter(data.values), updatedAt: filter(data.updatedAt), meta: filter(data.meta) };
}
```

`apps/web/lib/content/slots/site.ts` (okul bilgileri; `lib/site.ts` ve `content/program.ts` değerleri varsayılan olur):

```ts
import { SITE } from '@/lib/site';
import { PROGRAM_HOURS } from '@/content/program';
import type { SlotDef } from '../types';

const HOUR = '^([01]\\d|2[0-3]):[0-5]\\d$';

export const SITE_SLOTS: Record<string, SlotDef> = {
  'site.name': { kind: 'text', max: 60, default: SITE.name, label: 'Okulun adı' },
  'site.description': { kind: 'text', max: 200, default: SITE.description, label: 'Kısa tanıtım (Google ve paylaşımlar)' },
  'site.phone': { kind: 'text', max: 20, default: SITE.phone.display, label: 'Telefon', pattern: '^0?5\\d{2} ?\\d{3} ?\\d{2} ?\\d{2}$' },
  'site.email': { kind: 'text', max: 80, default: SITE.email, label: 'E-posta', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
  'site.address.street': { kind: 'text', max: 100, default: SITE.address.street, label: 'Adres (sokak, no)' },
  'site.address.district': { kind: 'text', max: 60, default: SITE.address.district, label: 'Semt, ilçe' },
  'site.foundingYear': { kind: 'text', max: 4, default: String(SITE.foundingYear), label: 'Kuruluş yılı', pattern: '^(19|20)\\d{2}$' },
  'site.whatsappMessage': { kind: 'text', max: 200, default: SITE.whatsapp.defaultMessage, label: 'WhatsApp hazır mesajı' },
  'site.hours.full.opens': { kind: 'text', max: 5, default: PROGRAM_HOURS.full.opens, label: 'Tam gün açılış', pattern: HOUR },
  'site.hours.full.closes': { kind: 'text', max: 5, default: PROGRAM_HOURS.full.closes, label: 'Tam gün kapanış', pattern: HOUR },
  'site.hours.half.opens': { kind: 'text', max: 5, default: PROGRAM_HOURS.half.opens, label: 'Yarım gün başlangıç', pattern: HOUR },
  'site.hours.half.closes': { kind: 'text', max: 5, default: PROGRAM_HOURS.half.closes, label: 'Yarım gün bitiş', pattern: HOUR },
};
```

`apps/web/lib/content/registry.ts`:

```ts
import type { SlotDef } from './types';
import { SITE_SLOTS } from './slots/site';

// Her sayfa görevi kendi slots dosyasını buraya ekler.
export const SLOTS: Record<string, SlotDef> = {
  ...SITE_SLOTS,
};

/** pathname → sayfa kimliği; `meta.<id>.title` / `meta.<id>.description` anahtarları için. */
export const PAGE_IDS: Record<string, string> = {};
```

`apps/web/lib/supabase/public.ts`:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@seker/db';

/** Çerezsiz istemci: "use cache" içinde kullanılabilir. 3 sn'de vazgeçer. */
export function createPublicSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(3000) }) },
    },
  );
}
```

`apps/web/lib/content/sanitize.ts`:

```ts
import sanitizeHtml from 'sanitize-html';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'a', 'ul', 'ol', 'li'],
  allowedAttributes: { a: ['href', 'rel', 'target'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  transformTags: {
    // transformTags şema filtresinden önce çalışır; izinsiz şemalı href'i burada düşürürüz ki rel/target da eklenmesin.
    a: (_tag, attribs) => ({
      tagName: 'a',
      attribs: /^(https?:|mailto:|tel:)/i.test(attribs.href ?? '')
        ? { href: attribs.href, rel: 'noopener noreferrer', target: '_blank' }
        : {},
    }),
  },
  exclusiveFilter: (frame) => frame.tag === 'p' && !frame.text.trim() && !frame.mediaChildren.length,
};

export function sanitizeRich(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

export function richToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
}
```

`apps/web/lib/content/getContent.ts`:

```ts
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { draftMode } from 'next/headers';
import { createPublicSupabase } from '@/lib/supabase/public';
import { SLOTS } from './registry';
import type { ContentMap } from './types';

export async function getContent(): Promise<ContentMap> {
  'use cache';
  cacheTag('site-content');
  try {
    const { data, error } = await createPublicSupabase().from('site_content').select('key, value, updated_at');
    if (error || !data) throw new Error(error?.message ?? 'veri yok');
    cacheLife('max');
    return Object.fromEntries(data.map((r) => [r.key, { value: r.value, updatedAt: r.updated_at }]));
  } catch (err) {
    console.error('[content] Supabase okunamadı, koddaki metinler gösteriliyor:', err);
    cacheLife('minutes');
    return {};
  }
}

export function read<T>(map: ContentMap, key: string): T {
  if (key in map) return map[key].value as T;
  const def = SLOTS[key];
  if (!def) throw new Error(`İçerik anahtarı tanımsız: ${key}`);
  return def.default as T;
}

/** Ziyaretçide false önbelleklenir; draft mode'da her istekte yeniden çalışır (Next 16 davranışı). */
export async function isEditing(): Promise<boolean> {
  'use cache';
  cacheLife('max');
  return (await draftMode()).isEnabled;
}
```

`apps/web/lib/content/server.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import { currentYear } from '@/lib/time';
import { getContent, isEditing, read } from './getContent';
import { SLOTS } from './registry';
import { sanitizeRich } from './sanitize';
import type { ContentMap, ReaderData, SlotMeta } from './types';

export function buildReaderData(map: ContentMap, editing: boolean, year: number): ReaderData {
  const values: Record<string, unknown> = {};
  const updatedAt: Record<string, string> = {};
  const meta: Record<string, SlotMeta> = {};
  for (const [key, def] of Object.entries(SLOTS)) {
    const v = read<unknown>(map, key);
    values[key] = def.kind === 'rich' ? sanitizeRich(String(v)) : v;
    if (map[key]) updatedAt[key] = map[key].updatedAt;
    const { kind, max, fields, label, warn, pattern, maxItems } = def;
    meta[key] = { kind, max, fields, label, warn, pattern, maxItems };
  }
  const founding = Number(values['site.foundingYear']) || 2011;
  return {
    values,
    updatedAt,
    meta,
    editing,
    vars: { yilSayisi: String(year - founding), kurulusYili: String(founding) },
  };
}

export const getReaderData = cache(async (): Promise<ReaderData> => {
  const [map, editing, year] = await Promise.all([getContent(), isEditing(), currentYear()]);
  return buildReaderData(map, editing, year);
});
```

- [ ] **Step 4: Testleri koştur**

Run: `pnpm --filter @seker/web exec vitest run lib/content`
Expected: PASS (chars 4, reader 4, getContent 4, registry `site.*` için 12).

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): içerik çekirdeği (registry, okuyucu, önbellekli okuma, sanitize)"
```

---

### Task 5: Düzenleme modunu açma/kapama uçları

**Files:**
- Create: `apps/web/lib/edit/safeNext.ts`, `apps/web/app/api/edit/enable/route.ts`, `apps/web/app/api/edit/disable/route.ts`
- Create: `apps/web/lib/edit/__tests__/safeNext.test.ts`, `apps/web/app/api/edit/__tests__/edit-routes.test.ts`
- Modify: `apps/web/app/robots.ts` (değişiklik gerekmez; `/api/` zaten disallow — testle doğrulanır)

**Interfaces:**
- Consumes: `getEditor(): Promise<Editor | null>` (`@seker/auth`), `PANEL_URL` env.
- Produces: `safeNext(raw: string | null): string`; `GET /api/edit/enable?next=<path>`; `GET /api/edit/disable`.

- [ ] **Step 1: Failing testler**

`apps/web/lib/edit/__tests__/safeNext.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { safeNext } from '../safeNext';

describe('safeNext', () => {
  it.each([
    ['/kayit', '/kayit'],
    ['/lp/beykent-anaokulu?x=1', '/lp/beykent-anaokulu?x=1'],
    [null, '/'],
    ['', '/'],
    ['https://evil.com', '/'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['javascript:alert(1)', '/'],
    ['/api/edit/enable', '/'],
  ])('%s → %s', (input, expected) => expect(safeNext(input)).toBe(expected));
});
```

`apps/web/app/api/edit/__tests__/edit-routes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const enable = vi.fn();
const disable = vi.fn();
vi.mock('next/headers', () => ({ draftMode: async () => ({ enable, disable, isEnabled: false }) }));
const getEditor = vi.fn();
vi.mock('@seker/auth/editor', () => ({ getEditor: () => getEditor() }));

import { GET as enableGET } from '../enable/route';
import { GET as disableGET } from '../disable/route';

beforeEach(() => {
  enable.mockReset();
  disable.mockReset();
  getEditor.mockReset();
  process.env.PANEL_URL = 'https://panel.sekeranaokulu.com';
});

describe('/api/edit/enable', () => {
  it('editör değilse panel girişine yollar, draft açmaz', async () => {
    getEditor.mockResolvedValue(null);
    const res = await enableGET(new Request('https://sekeranaokulu.com/api/edit/enable?next=/kayit'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://panel.sekeranaokulu.com/login');
    expect(enable).not.toHaveBeenCalled();
  });
  it('editörse draft açar ve güvenli yola yönlendirir', async () => {
    getEditor.mockResolvedValue({ id: 'u1', fullName: 'Ayşe' });
    const res = await enableGET(new Request('https://sekeranaokulu.com/api/edit/enable?next=//evil.com'));
    expect(enable).toHaveBeenCalledOnce();
    expect(res.headers.get('location')).toBe('https://sekeranaokulu.com/');
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});

describe('/api/edit/disable', () => {
  it('draft kapatır ve ana sayfaya döner', async () => {
    const res = await disableGET(new Request('https://sekeranaokulu.com/api/edit/disable?next=/kayit'));
    expect(disable).toHaveBeenCalledOnce();
    expect(res.headers.get('location')).toBe('https://sekeranaokulu.com/kayit');
  });
});
```

Run: `pnpm --filter @seker/web exec vitest run lib/edit app/api/edit`
Expected: FAIL — modüller yok.

- [ ] **Step 2: Uygula**

`apps/web/lib/edit/safeNext.ts`:

```ts
/** Açık yönlendirmeyi engeller: yalnızca aynı sitedeki göreli yollar. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw.startsWith('/api/')) return '/';
  return raw;
}
```

`apps/web/app/api/edit/enable/route.ts`:

```ts
import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { getEditor } from '@seker/auth/editor';
import { safeNext } from '@/lib/edit/safeNext';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const editor = await getEditor();
  if (!editor) {
    return NextResponse.redirect(`${process.env.PANEL_URL}/login`, 307);
  }
  (await draftMode()).enable();
  const res = NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')), url.origin), 307);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
```

`apps/web/app/api/edit/disable/route.ts`:

```ts
import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { safeNext } from '@/lib/edit/safeNext';

export async function GET(request: Request) {
  const url = new URL(request.url);
  (await draftMode()).disable();
  const res = NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')), url.origin), 307);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
```

`app/__tests__/robots.test.ts` dosyasına ekle:

```ts
it('düzenleme uçları taranmaz', () => {
  const rules = robots().rules as { disallow: string[] };
  expect(rules.disallow).toContain('/api/');
});
```

- [ ] **Step 3: Testleri koştur**

Run: `pnpm --filter @seker/web exec vitest run lib/edit app/api/edit app/__tests__/robots.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): düzenleme modunu açan/kapatan uçlar"
```

---

### Task 6: Düzenleme ilkelleri ve düzenleme katmanı kapısı

**Files:**
- Create: `apps/web/app/components/edit/Editable.tsx`
- Create: `apps/web/app/components/edit/EditLayerGate.tsx`, `apps/web/app/components/edit/EditLayerClient.tsx`
- Create: `apps/web/lib/content/testing.ts`
- Create: `apps/web/app/components/edit/__tests__/Editable.test.tsx`, `apps/web/lib/content/__tests__/testing.test.tsx`
- Modify: `apps/web/app/(site)/layout.tsx`, `apps/web/app/(lp)/layout.tsx`

**Interfaces:**
- Consumes: `Reader`, `ReaderData`, `makeReader`, `getReaderData`, `isEditing`, `getEditor`.
- Produces:

```tsx
// Editable.tsx — sunucu ve istemci bileşenlerinde kullanılabilir (hook yok)
export function Editable(props: { c: Reader; k: string; path?: string; as?: keyof React.JSX.IntrinsicElements; className?: string; value?: string }): JSX.Element;
export function EditableRich(props: { c: Reader; k: string; path?: string; as?: 'div' | 'section'; className?: string; value?: string }): JSX.Element;
export function editImageAttrs(c: Reader, k: string, path?: string): Record<string, string>; // = c.attrs(k, path)
// EditLayerGate.tsx (sunucu)
export default async function EditLayerGate(): Promise<JSX.Element | null>;
// EditLayerClient.tsx (istemci) — props: { editor: Editor | null; data: ReaderData; announcements: AnnouncementRow[] }
// testing.ts
export function defaultData(prefixes?: string[]): ReaderData;   // registry varsayılanları, editing=false
export function sentinelData(prefixes: string[]): ReaderData;   // her metin "⟦anahtar⟧"
export function uncoveredText(root: HTMLElement): string[];     // slot'tan gelmeyen görünür metinler
```

`Editable` mevcut elemanın yerine geçer, sarmalayıcı eklemez: `<Editable c={c} k="home.hero.title" as="h1" className="mt-4 …" />` → ziyaretçide birebir `<h1 class="mt-4 …">metin</h1>`. Liste öğesi alanı için `k` liste anahtarı, `path` `"<öğe id>.<alan>"`, `value` o alanın değeri (`item.question`).

- [ ] **Step 1: Failing testler**

`apps/web/app/components/edit/__tests__/Editable.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Editable, EditableRich } from '../Editable';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

const base: ReaderData = {
  values: { 't.title': 'Merhaba', 't.body': '<p>Bir <strong>iki</strong></p>', 't.list': [{ id: 'a', q: 'Soru' }] },
  updatedAt: {},
  meta: {
    't.title': { kind: 'text', max: 40, label: 'Başlık' },
    't.body': { kind: 'rich', max: 2000, label: 'Gövde' },
    't.list': { kind: 'list', label: 'Liste', fields: { q: { kind: 'text', max: 50, label: 'Soru' } } },
  },
  editing: false,
  vars: { yilSayisi: '15', kurulusYili: '2011' },
};

describe('Editable', () => {
  it('ziyaretçide orijinal elemanı birebir üretir', () => {
    const { container } = render(<Editable c={makeReader(base)} k="t.title" as="h1" className="mt-4 text-ink" />);
    expect(container.innerHTML).toBe('<h1 class="mt-4 text-ink">Merhaba</h1>');
  });
  it('düzenlemede data-edit öznitelikleri ekler', () => {
    const { container } = render(<Editable c={makeReader({ ...base, editing: true })} k="t.title" as="h1" />);
    expect(container.innerHTML).toBe(
      '<h1 data-edit-key="t.title" data-edit-kind="text" data-edit-max="40">Merhaba</h1>',
    );
  });
  it('liste alanı path ve value ile', () => {
    const c = makeReader({ ...base, editing: true });
    const item = c.list<{ id: string; q: string }>('t.list')[0];
    const { container } = render(<Editable c={c} k="t.list" path={`${item.id}.q`} value={item.q} as="dt" />);
    expect(container.querySelector('dt')!.getAttribute('data-edit-path')).toBe('a.q');
    expect(container.textContent).toBe('Soru');
  });
});

describe('EditableRich', () => {
  it('temizlenmiş HTML basar', () => {
    const { container } = render(<EditableRich c={makeReader(base)} k="t.body" className="prose" />);
    expect(container.innerHTML).toBe('<div class="prose"><p>Bir <strong>iki</strong></p></div>');
  });
});
```

`apps/web/lib/content/__tests__/testing.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { uncoveredText, sentinelData } from '../testing';

describe('uncoveredText', () => {
  it('slot dışı metni yakalar, sentinel ve rakamları yok sayar', () => {
    const { container } = render(
      <div>
        <h1>⟦home.hero.title⟧</h1>
        <p>Elle yazılmış cümle</p>
        <span aria-hidden="true">dekor</span>
        <span>12 · 3</span>
        <svg><text>ikon</text></svg>
      </div>,
    );
    expect(uncoveredText(container)).toEqual(['Elle yazılmış cümle']);
  });
  it('sentinelData her metni anahtarla doldurur', () => {
    expect(sentinelData(['site.']).values['site.phone']).toBe('⟦site.phone⟧');
  });
});
```

Run: `pnpm --filter @seker/web exec vitest run app/components/edit lib/content/__tests__/testing.test.tsx`
Expected: FAIL — modüller yok.

- [ ] **Step 2: Uygula**

`apps/web/app/components/edit/Editable.tsx`:

```tsx
import type React from 'react';
import type { Reader } from '@/lib/content/types';

type Tag = keyof React.JSX.IntrinsicElements;

export function Editable({
  c,
  k,
  path,
  as = 'span',
  className,
  value,
}: {
  c: Reader;
  k: string;
  path?: string;
  as?: Tag;
  className?: string;
  value?: string;
}) {
  const Comp = as as React.ElementType;
  const text = value ?? c.text(k);
  return (
    <Comp className={className} {...c.attrs(k, path)}>
      {text}
    </Comp>
  );
}

export function EditableRich({
  c,
  k,
  path,
  as = 'div',
  className,
  value,
}: {
  c: Reader;
  k: string;
  path?: string;
  as?: 'div' | 'section';
  className?: string;
  value?: string;
}) {
  const Comp = as;
  // Değer kaydederken ve buildReaderData'da sanitizeRich'ten geçmiştir.
  return <Comp className={className} {...c.attrs(k, path)} dangerouslySetInnerHTML={{ __html: value ?? c.rich(k) }} />;
}

export function editImageAttrs(c: Reader, k: string, path?: string): Record<string, string> {
  return c.attrs(k, path);
}
```

`apps/web/lib/content/testing.ts`:

```ts
import { buildReaderData } from './server';
import { SLOTS } from './registry';
import { pickData } from './reader';
import type { ReaderData } from './types';

export function defaultData(prefixes?: string[]): ReaderData {
  const data = buildReaderData({}, false, new Date().getFullYear());
  return prefixes ? pickData(data, [...prefixes, 'site.']) : data;
}

export function sentinelData(prefixes: string[]): ReaderData {
  const data = defaultData(prefixes);
  const values: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(data.values)) {
    const def = SLOTS[key];
    if (def.kind === 'text') values[key] = `⟦${key}⟧`;
    else if (def.kind === 'rich') values[key] = `<p>⟦${key}⟧</p>`;
    else if (def.kind === 'image') values[key] = { ...(v as object), alt: `⟦${key}⟧` };
    else
      values[key] = (v as Record<string, unknown>[]).map((item) => {
        const out: Record<string, unknown> = { ...item };
        for (const [field, f] of Object.entries(def.fields ?? {})) {
          if (f.kind === 'text') out[field] = `⟦${key}:${item.id}.${field}⟧`;
          if (f.kind === 'rich') out[field] = `<p>⟦${key}:${item.id}.${field}⟧</p>`;
        }
        return out;
      });
  }
  return { ...data, values };
}

const IGNORE = /^[\s\d.,:;·•–—\-+/()%&'"“”‘’!?…]*$/;

/** Görünür metin düğümlerinden slot'tan gelmeyenleri döndürür. */
export function uncoveredText(root: HTMLElement): string[] {
  const out: string[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || el.closest('script,style,svg,[aria-hidden="true"],[data-edit-ignore]')) continue;
    const rest = (node.textContent ?? '').replace(/⟦[^⟧]+⟧/g, '').trim();
    if (rest && !IGNORE.test(rest)) out.push(rest);
  }
  return out;
}
```

`data-edit-ignore`: kasıtlı olarak sabit kalan metinler (ör. yasal "© 2026" satırı veya bileşenin erişilebilirlik için koyduğu `sr-only` etiketleri) bu öznitelikle işaretlenir. Her kullanım sayfa görevinin kod incelemesinde gerekçelendirilir.

`apps/web/app/components/edit/EditLayerGate.tsx`:

```tsx
import { Suspense } from 'react';
import { getEditor } from '@seker/auth/editor';
import { createServerSupabase } from '@seker/auth/server';
import { isEditing } from '@/lib/content/getContent';
import { getReaderData } from '@/lib/content/server';
import EditLayerClient from './EditLayerClient';

/** Ziyaretçide (draft kapalı) hiçbir şey üretmez; prerender'da çerez okunmaz. */
export default async function EditLayerGate() {
  if (!(await isEditing())) return null;
  return (
    <Suspense fallback={null}>
      <EditLayerServer />
    </Suspense>
  );
}

async function EditLayerServer() {
  const [editor, data] = await Promise.all([getEditor(), getReaderData()]);
  let announcements: unknown[] = [];
  if (editor) {
    const supabase = await createServerSupabase();
    const { data: rows } = await supabase
      .from('announcements')
      .select('id, title, body, image_id, starts_on, ends_on, published, sort, updated_at')
      .order('sort');
    announcements = rows ?? [];
  }
  return <EditLayerClient editor={editor} data={data} announcements={announcements} />;
}
```

`apps/web/app/components/edit/EditLayerClient.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import type { Editor } from '@seker/auth/editor';
import type { ReaderData } from '@/lib/content/types';

const EditBar = dynamic(() => import('./EditBar'), { ssr: false });

export default function EditLayerClient(props: { editor: Editor | null; data: ReaderData; announcements: unknown[] }) {
  return <EditBar {...props} />;
}
```

(`EditBar` Task 8'de yazılır; bu görevde geçici olarak `apps/web/app/components/edit/EditBar.tsx` içine `export default function EditBar() { return null; }` koy.)

`app/(site)/layout.tsx` ve `app/(lp)/layout.tsx`: `import EditLayerGate from '../components/edit/EditLayerGate';` ve fragmentin sonuna `<EditLayerGate />`.

- [ ] **Step 3: Testleri ve build'i koştur**

Run: `pnpm --filter @seker/web exec vitest run && pnpm --filter @seker/web build`
Expected: PASS; build'de sayfalar hâlâ prerender (○/◐).

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): Editable ilkelleri, kapsam test yardımcıları ve düzenleme katmanı kapısı"
```

---

### Task 7: Kaydetme, geri alma, geçmiş (Server Actions)

**Files:**
- Create: `apps/web/lib/content/validate.ts`, `apps/web/app/actions/content.ts`
- Create: `apps/web/lib/content/__tests__/validate.test.ts`, `apps/web/app/actions/__tests__/content.test.ts`

**Interfaces:**
- Consumes: `SLOTS`, `countChars`, `sanitizeRich`, `richToText`, `getEditor`, `createServerSupabase`, `save_site_content` RPC.
- Produces:

```ts
// validate.ts
export type NormalizedEdit = { key: string; kind: ContentKind; value: unknown; baseUpdatedAt: string | null };
export function validateEdits(edits: unknown): { ok: true; edits: NormalizedEdit[] } | { ok: false; error: string; key?: string };
// actions/content.ts ('use server')
export type ContentEdit = { key: string; value: unknown; baseUpdatedAt: string | null };
export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string; conflicts?: string[] };
export async function saveContent(edits: ContentEdit[]): Promise<SaveResult>;
export async function revertRevision(revisionId: string): Promise<SaveResult>;
export type RevisionRow = { id: string; key: string; label: string; createdAt: string; editorName: string; before: string; after: string };
export async function listRevisions(limit?: number): Promise<RevisionRow[]>;
```

Kurallar (validate): toplam ≤ 100 düzenleme; anahtar `SLOTS`'ta olmalı (`kind` registry'den alınır, istemciden değil); `value === null` → varsayılana dön (izinli). **text:** string, kontrol karakterleri (`\u0000-\u0008\u000B-\u001F\u007F`) silinir, satır sonları boşluğa çevrilir (`max > 300` ise `\n` korunur), `trim`, boş olamaz, `countChars ≤ max`, `pattern` varsa uymalı. **rich:** `sanitizeRich`, `richToText` boş olamaz, `countChars(richToText) ≤ (max ?? 20000)`. **image:** `{src, alt, width, height, assetId}`; `src` ya `/` ile başlar (koddaki dosya) ya da `NEXT_PUBLIC_MEDIA_BASE_URL + '/site-images/'` ile; `alt` 1–200. **list:** dizi, `≤ maxItems ?? 50`, her öğede benzersiz `id` (`^[a-z0-9-]{1,40}$`), `fields` alanları türüne göre (text/rich yukarıdaki gibi, `flag` boolean, image yukarıdaki gibi); tanımsız alanlar korunur ama string/boolean/number dışı olamaz.

- [ ] **Step 1: Failing testler**

`apps/web/lib/content/__tests__/validate.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../registry', () => ({
  SLOTS: {
    't.title': { kind: 'text', max: 10, default: 'x', label: 'Başlık' },
    't.year': { kind: 'text', max: 4, default: '2011', label: 'Yıl', pattern: '^(19|20)\\d{2}$' },
    't.body': { kind: 'rich', max: 50, default: '<p>x</p>', label: 'Gövde' },
    't.img': { kind: 'image', default: { src: '/a.webp', alt: 'a', width: 1, height: 1, assetId: null }, label: 'F' },
    't.list': {
      kind: 'list', default: [], label: 'L', maxItems: 2,
      fields: { q: { kind: 'text', max: 5, label: 'S' }, on: { kind: 'flag', label: 'Yayında' } },
    },
  },
}));

import { validateEdits } from '../validate';

const e = (key: string, value: unknown) => [{ key, value, baseUpdatedAt: null }];

describe('validateEdits', () => {
  it('bilinmeyen anahtarı reddeder', () => {
    expect(validateEdits(e('yok', 'a'))).toMatchObject({ ok: false, key: 'yok' });
  });
  it('kind istemciden değil registryden gelir', () => {
    const r = validateEdits([{ key: 't.title', value: 'a', baseUpdatedAt: null, kind: 'rich' }]);
    expect(r).toEqual({ ok: true, edits: [{ key: 't.title', kind: 'text', value: 'a', baseUpdatedAt: null }] });
  });
  it('sınırda: 10 grafem kabul, 11 red', () => {
    expect(validateEdits(e('t.title', 'İğüşöçİğüş')).ok).toBe(true);
    expect(validateEdits(e('t.title', 'İğüşöçİğüşö')).ok).toBe(false);
    expect(validateEdits(e('t.title', '👨‍👩‍👧'.repeat(10))).ok).toBe(true);
  });
  it('boş ve yalnız boşluk reddedilir', () => {
    expect(validateEdits(e('t.title', '   ')).ok).toBe(false);
  });
  it('düz metinde satır sonu ve kontrol karakteri temizlenir', () => {
    expect(validateEdits(e('t.title', ' a\nb\u0007 '))).toMatchObject({ ok: true, edits: [{ value: 'a b' }] });
  });
  it('pattern uymazsa red', () => {
    expect(validateEdits(e('t.year', '11')).ok).toBe(false);
  });
  it("Word'den yapıştırılan zengin metin izinli etiketlere iner", () => {
    const word =
      '<p class="MsoNormal"><span style="font-family:Calibri">Merhaba <b>dünya</b></span><o:p></o:p></p><script>alert(1)</script><a href="javascript:x">k</a>';
    const r = validateEdits(e('t.body', word));
    expect(r).toMatchObject({ ok: true, edits: [{ value: '<p>Merhaba <b>dünya</b></p><a>k</a>' }] });
  });
  it('dış görsel adresini reddeder', () => {
    expect(validateEdits(e('t.img', { src: 'https://evil.com/a.png', alt: 'a', width: 1, height: 1, assetId: null })).ok).toBe(false);
  });
  it('liste: tekrarlanan id ve fazla öğe reddedilir', () => {
    expect(validateEdits(e('t.list', [{ id: 'a', q: 'x', on: true }, { id: 'a', q: 'y', on: true }])).ok).toBe(false);
    expect(validateEdits(e('t.list', [{ id: 'a', q: 'x' }, { id: 'b', q: 'y' }, { id: 'c', q: 'z' }])).ok).toBe(false);
    expect(validateEdits(e('t.list', [{ id: 'a', q: 'x', on: 'evet' }])).ok).toBe(false);
  });
  it('null varsayılana dönüş olarak kabul edilir', () => {
    expect(validateEdits(e('t.title', null))).toMatchObject({ ok: true, edits: [{ value: null }] });
  });
});
```

`apps/web/app/actions/__tests__/content.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateTag = vi.fn();
vi.mock('next/cache', () => ({ updateTag }));
const rpc = vi.fn();
const getEditor = vi.fn();
vi.mock('@seker/auth/editor', () => ({ getEditor: () => getEditor() }));
vi.mock('@seker/auth/server', () => ({
  createServerSupabase: async () => ({ rpc }),
}));
vi.mock('@/lib/content/registry', () => ({
  SLOTS: { 't.title': { kind: 'text', max: 20, default: 'x', label: 'Başlık' } },
}));

import { saveContent } from '../content';

beforeEach(() => {
  updateTag.mockReset();
  rpc.mockReset();
  getEditor.mockReset();
});

describe('saveContent', () => {
  it('oturum yoksa yazmaz, anlaşılır mesaj döner', async () => {
    getEditor.mockResolvedValue(null);
    const r = await saveContent([{ key: 't.title', value: 'a', baseUpdatedAt: null }]);
    expect(r).toEqual({ ok: false, error: 'Oturumunuz sona erdi. Panelden tekrar giriş yapın; değişiklikleriniz bu tarayıcıda saklandı.' });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('başarılı kayıtta updateTag çağırır', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    rpc.mockResolvedValue({ data: { conflicts: [], saved_at: '2026-10-14 10:00:00.1+00' }, error: null });
    const r = await saveContent([{ key: 't.title', value: 'Yeni', baseUpdatedAt: '2026-10-14 09:00:00.123456+00' }]);
    expect(rpc).toHaveBeenCalledWith('save_site_content', {
      p_edits: [{ key: 't.title', kind: 'text', value: 'Yeni', baseUpdatedAt: '2026-10-14 09:00:00.123456+00' }],
    });
    expect(updateTag).toHaveBeenCalledWith('site-content');
    expect(r).toEqual({ ok: true, savedAt: '2026-10-14 10:00:00.1+00' });
  });
  it('çakışmada updateTag çağırmaz, anahtarları döner', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    rpc.mockResolvedValue({ data: { conflicts: ['t.title'], saved_at: null }, error: null });
    const r = await saveContent([{ key: 't.title', value: 'Yeni', baseUpdatedAt: null }]);
    expect(r).toEqual({
      ok: false,
      error: 'Bu metin siz düzenlerken başka bir yerden değişti. Sayfayı yenileyip tekrar deneyin.',
      conflicts: ['t.title'],
    });
    expect(updateTag).not.toHaveBeenCalled();
  });
  it('doğrulama hatası RPC çağırmaz', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    const r = await saveContent([{ key: 't.title', value: '', baseUpdatedAt: null }]);
    expect(r.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm --filter @seker/web exec vitest run lib/content/__tests__/validate.test.ts app/actions`
Expected: FAIL — modüller yok.

- [ ] **Step 2: `validate.ts` yaz**

```ts
import { z } from 'zod';
import { SLOTS } from './registry';
import { countChars } from './chars';
import { richToText, sanitizeRich } from './sanitize';
import type { ContentKind, FieldDef } from './types';

export type NormalizedEdit = { key: string; kind: ContentKind; value: unknown; baseUpdatedAt: string | null };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const editSchema = z.array(
  z.object({ key: z.string().max(130), value: z.unknown(), baseUpdatedAt: z.string().max(64).nullable() }),
).max(100);

function checkText(raw: unknown, max: number, label: string, pattern?: string): Result<string> {
  if (typeof raw !== 'string') return { ok: false, error: `${label}: metin olmalı.` };
  let v = raw.replace(CONTROL, '');
  v = max > 300 ? v.replace(/\r\n?/g, '\n') : v.replace(/\s*[\r\n]+\s*/g, ' ');
  v = v.trim();
  if (!v) return { ok: false, error: `${label} boş bırakılamaz.` };
  const n = countChars(v);
  if (n > max) return { ok: false, error: `${label} en fazla ${max} karakter olabilir (şu an ${n}).` };
  if (pattern && !new RegExp(pattern).test(v)) return { ok: false, error: `${label} biçimi uygun değil.` };
  return { ok: true, value: v };
}

function checkRich(raw: unknown, max: number, label: string): Result<string> {
  if (typeof raw !== 'string') return { ok: false, error: `${label}: metin olmalı.` };
  const html = sanitizeRich(raw);
  const n = countChars(richToText(html));
  if (!n) return { ok: false, error: `${label} boş bırakılamaz.` };
  if (n > max) return { ok: false, error: `${label} en fazla ${max} karakter olabilir (şu an ${n}).` };
  return { ok: true, value: html };
}

function checkImage(raw: unknown, label: string): Result<unknown> {
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  const parsed = z
    .object({
      src: z
        .string()
        .refine((s) => (s.startsWith('/') && !s.startsWith('//')) || (!!base && s.startsWith(`${base}/site-images/`))),
      alt: z.string().trim().min(1).max(200),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      assetId: z.string().uuid().nullable(),
    })
    .safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: `${label}: fotoğraf bilgisi geçersiz.` };
}

function checkField(raw: unknown, f: FieldDef): Result<unknown> {
  if (f.kind === 'text') return checkText(raw, f.max ?? 200, f.label);
  if (f.kind === 'rich') return checkRich(raw, f.max ?? 5000, f.label);
  if (f.kind === 'image') return checkImage(raw, f.label);
  return typeof raw === 'boolean' ? { ok: true, value: raw } : { ok: false, error: `${f.label}: evet/hayır olmalı.` };
}

export function validateEdits(
  edits: unknown,
): { ok: true; edits: NormalizedEdit[] } | { ok: false; error: string; key?: string } {
  const parsed = editSchema.safeParse(edits);
  if (!parsed.success) return { ok: false, error: 'Geçersiz istek.' };
  const out: NormalizedEdit[] = [];
  for (const edit of parsed.data) {
    const def = SLOTS[edit.key];
    if (!def) return { ok: false, error: 'Bilinmeyen alan.', key: edit.key };
    if (edit.value === null) {
      out.push({ key: edit.key, kind: def.kind, value: null, baseUpdatedAt: edit.baseUpdatedAt });
      continue;
    }
    let r: Result<unknown>;
    if (def.kind === 'text') r = checkText(edit.value, def.max ?? 200, def.label, def.pattern);
    else if (def.kind === 'rich') r = checkRich(edit.value, def.max ?? 20000, def.label);
    else if (def.kind === 'image') r = checkImage(edit.value, def.label);
    else r = checkList(edit.value, def.fields ?? {}, def.maxItems ?? 50, def.label);
    if (!r.ok) return { ok: false, error: r.error, key: edit.key };
    out.push({ key: edit.key, kind: def.kind, value: r.value, baseUpdatedAt: edit.baseUpdatedAt });
  }
  return { ok: true, edits: out };
}

function checkList(raw: unknown, fields: Record<string, FieldDef>, maxItems: number, label: string): Result<unknown> {
  if (!Array.isArray(raw)) return { ok: false, error: `${label}: liste olmalı.` };
  if (raw.length > maxItems) return { ok: false, error: `${label} en fazla ${maxItems} madde olabilir.` };
  const ids = new Set<string>();
  const items: Record<string, unknown>[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return { ok: false, error: `${label}: madde geçersiz.` };
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(rec.id) || ids.has(rec.id))
      return { ok: false, error: `${label}: madde kimliği geçersiz.` };
    ids.add(rec.id);
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      const f = fields[k];
      if (f) {
        const r = checkField(v, f);
        if (!r.ok) return r;
        next[k] = r.value;
      } else if (['string', 'boolean', 'number'].includes(typeof v)) next[k] = v;
      else return { ok: false, error: `${label}: madde geçersiz.` };
    }
    items.push(next);
  }
  return { ok: true, value: items };
}
```

- [ ] **Step 3: `actions/content.ts` yaz**

```ts
'use server';

import { updateTag } from 'next/cache';
import { createServerSupabase } from '@seker/auth/server';
import { getEditor } from '@seker/auth/editor';
import { validateEdits } from '@/lib/content/validate';
import { SLOTS } from '@/lib/content/registry';
import { richToText } from '@/lib/content/sanitize';

export type ContentEdit = { key: string; value: unknown; baseUpdatedAt: string | null };
export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string; conflicts?: string[] };
export type RevisionRow = {
  id: string; key: string; label: string; createdAt: string; editorName: string; before: string; after: string;
};

const SESSION_ERROR = 'Oturumunuz sona erdi. Panelden tekrar giriş yapın; değişiklikleriniz bu tarayıcıda saklandı.';
const CONFLICT_ERROR = 'Bu metin siz düzenlerken başka bir yerden değişti. Sayfayı yenileyip tekrar deneyin.';

export async function saveContent(edits: ContentEdit[]): Promise<SaveResult> {
  if (!(await getEditor())) return { ok: false, error: SESSION_ERROR };
  const v = validateEdits(edits);
  if (!v.ok) return { ok: false, error: v.error };
  if (v.edits.length === 0) return { ok: false, error: 'Kaydedilecek değişiklik yok.' };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('save_site_content', { p_edits: v.edits });
  if (error) {
    console.error('[content] kayıt hatası', error);
    return { ok: false, error: error.code === '42501' ? SESSION_ERROR : 'Kaydedilemedi, tekrar deneyin.' };
  }
  const result = data as { conflicts: string[]; saved_at: string | null };
  if (result.conflicts.length) return { ok: false, error: CONFLICT_ERROR, conflicts: result.conflicts };
  updateTag('site-content');
  return { ok: true, savedAt: result.saved_at! };
}

export async function revertRevision(revisionId: string): Promise<SaveResult> {
  if (!(await getEditor())) return { ok: false, error: SESSION_ERROR };
  const supabase = await createServerSupabase();
  const { data: rev } = await supabase.from('content_revisions').select('key, old_value').eq('id', revisionId).single();
  if (!rev) return { ok: false, error: 'Bu değişiklik bulunamadı.' };
  const { data: cur } = await supabase.from('site_content').select('updated_at').eq('key', rev.key).maybeSingle();
  return saveContent([{ key: rev.key, value: rev.old_value, baseUpdatedAt: cur?.updated_at ?? null }]);
}

function preview(v: unknown): string {
  if (v === null || v === undefined) return '(sitenin ilk hâli)';
  if (typeof v === 'string') return richToText(v).slice(0, 140);
  if (Array.isArray(v)) return `${v.length} madde`;
  if (typeof v === 'object' && 'alt' in (v as object)) return `Fotoğraf: ${(v as { alt: string }).alt}`;
  return '';
}

export async function listRevisions(limit = 50): Promise<RevisionRow[]> {
  if (!(await getEditor())) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('content_revisions')
    .select('id, key, old_value, new_value, created_at, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 200));
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    label: SLOTS[r.key]?.label ?? r.key,
    createdAt: r.created_at,
    editorName: (r.profiles as { full_name: string } | null)?.full_name ?? '—',
    before: preview(r.old_value),
    after: preview(r.new_value),
  }));
}
```

- [ ] **Step 4: Testleri koştur**

Run: `pnpm --filter @seker/web exec vitest run lib/content app/actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): saveContent, revertRevision, listRevisions ve doğrulama"
```

---

### Task 8: EditBar çekirdeği: çerçeveler, çift tıkla yaz, sayaç, kaydet/vazgeç

**Files:**
- Create: `apps/web/app/components/edit/pending.ts`, `apps/web/app/components/edit/TextEditing.ts`, `apps/web/app/components/edit/Toasts.tsx`, `apps/web/app/components/edit/edit.css`
- Modify: `apps/web/app/components/edit/EditBar.tsx` (geçici sürümün yerine)
- Create: `apps/web/app/components/edit/__tests__/pending.test.ts`, `apps/web/app/components/edit/__tests__/TextEditing.test.ts`

**Interfaces:**
- Consumes: `saveContent`, `ReaderData`, `countChars`, `Editor`.
- Produces:

```ts
// pending.ts
export type Pending = Record<string, { value: unknown; baseUpdatedAt: string | null }>;
export type PendingAction =
  | { type: 'set'; key: string; value: unknown; baseUpdatedAt: string | null }
  | { type: 'clear' }
  | { type: 'drop'; keys: string[] };
export const PENDING_STORAGE_KEY = 'seker-edit-pending';
export function pendingReducer(state: Pending, action: PendingAction): Pending;
export function loadPending(storage: Pick<Storage, 'getItem'> | null): Pending;
export function savePending(storage: Pick<Storage, 'setItem' | 'removeItem'> | null, state: Pending): void;
export function applyListField(list: { id: string }[], path: string, value: unknown): { id: string }[];
// TextEditing.ts
export function plainTextFromPaste(e: Pick<ClipboardEvent, 'clipboardData'>): string;
export function beginTextEdit(el: HTMLElement, opts: { max?: number; onCommit(text: string): void; onCancel(): void; onCount(n: number, max?: number): void }): () => void;
// EditBar.tsx default export: (props: { editor: Editor | null; data: ReaderData; announcements: AnnouncementRow[] }) => JSX.Element
```

Davranış: `body`'ye `seker-editing` sınıfı; `[data-edit-key]` üzerine gelince kesikli mor çerçeve. Çift tık: `data-edit-kind="text"` → `contentEditable="plaintext-only"` (desteklemeyen tarayıcıda `"true"` + yapıştırma işleyicisi), imleç sonda, sayaç baloncuğu `34 / 120` (sınır aşılınca kırmızı ve "Kaydet" pasif). Enter (tek satırlık alanlarda, `max ≤ 300`) veya odak kaybı → onay; Esc → eski metne dön. `image` → Task 10 diyaloğu; `rich` → Task 9 editörü. Bekleyen değişiklikler `sessionStorage`'da (`seker-edit-pending`) tutulur; sayfa yenilense veya oturum düşse de kalır. Kaydet → `saveContent`; başarı: "Yayında" bildirimi, pending temizlenir, `router.refresh()`; çakışma: anahtarların etiketleriyle uyarı, pending korunur; oturum hatası: mesaj + "Panele git" bağlantısı, pending korunur. Kaydedilmemiş değişiklik varken sayfadan çıkışta `beforeunload` uyarısı. `editor === null` (draft açık ama oturum yok) ise çubuk yalnızca "Oturumunuz sona erdi. Panelden giriş yapın · Düzenlemeden çık" gösterir ve düzenleme kapalıdır. Sayfa `iframe` içindeyse (telefon önizlemesi) çubuk render edilmez.

- [ ] **Step 1: Failing testler**

`apps/web/app/components/edit/__tests__/pending.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pendingReducer, loadPending, savePending, applyListField, PENDING_STORAGE_KEY } from '../pending';

describe('pendingReducer', () => {
  it('set/drop/clear', () => {
    let s = pendingReducer({}, { type: 'set', key: 'a', value: 'x', baseUpdatedAt: null });
    s = pendingReducer(s, { type: 'set', key: 'b', value: 'y', baseUpdatedAt: 't' });
    expect(Object.keys(s)).toEqual(['a', 'b']);
    s = pendingReducer(s, { type: 'drop', keys: ['a'] });
    expect(Object.keys(s)).toEqual(['b']);
    expect(pendingReducer(s, { type: 'clear' })).toEqual({});
  });
  it('aynı anahtarda ilk baseUpdatedAt korunur', () => {
    let s = pendingReducer({}, { type: 'set', key: 'a', value: '1', baseUpdatedAt: 'ilk' });
    s = pendingReducer(s, { type: 'set', key: 'a', value: '2', baseUpdatedAt: 'ikinci' });
    expect(s.a).toEqual({ value: '2', baseUpdatedAt: 'ilk' });
  });
});

describe('kalıcılık (oturum düşse de kaybolmaz)', () => {
  it('sessionStorage ile gidip gelir', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
    savePending(storage, { a: { value: 'x', baseUpdatedAt: null } });
    expect(mem.has(PENDING_STORAGE_KEY)).toBe(true);
    expect(loadPending(storage)).toEqual({ a: { value: 'x', baseUpdatedAt: null } });
    savePending(storage, {});
    expect(mem.has(PENDING_STORAGE_KEY)).toBe(false);
  });
  it('bozuk veri ve storage yokluğu boş döner', () => {
    expect(loadPending({ getItem: () => '{bozuk' })).toEqual({});
    expect(loadPending(null)).toEqual({});
  });
});

describe('applyListField', () => {
  it('id ile öğenin alanını değiştirir, diğerlerine dokunmaz', () => {
    const list = [{ id: 'a', q: '1' }, { id: 'b', q: '2' }];
    expect(applyListField(list, 'b.q', 'yeni')).toEqual([{ id: 'a', q: '1' }, { id: 'b', q: 'yeni' }]);
    expect(list[1].q).toBe('2');
  });
});
```

`apps/web/app/components/edit/__tests__/TextEditing.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { plainTextFromPaste, beginTextEdit } from '../TextEditing';

describe('plainTextFromPaste', () => {
  it("Word HTML'i yerine düz metni alır", () => {
    const e = {
      clipboardData: {
        getData: (t: string) => (t === 'text/plain' ? 'Merhaba\r\ndünya' : '<p class="MsoNormal"><b>Merhaba</b></p>'),
      },
    } as unknown as ClipboardEvent;
    expect(plainTextFromPaste(e)).toBe('Merhaba dünya');
  });
});

describe('beginTextEdit', () => {
  it('Esc eski metne döner, Enter onaylar', () => {
    const el = document.createElement('h1');
    el.textContent = 'Eski';
    document.body.append(el);
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const stop = beginTextEdit(el, { max: 20, onCommit, onCancel, onCount: () => {} });
    expect(el.isContentEditable || el.getAttribute('contenteditable')).toBeTruthy();
    el.textContent = 'Yeni metin';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith('Yeni metin');
    stop();

    const stop2 = beginTextEdit(el, { max: 20, onCommit, onCancel, onCount: () => {} });
    el.textContent = 'Vazgeçilecek';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(el.textContent).toBe('Yeni metin');
    expect(onCancel).toHaveBeenCalled();
    stop2();
  });
});
```

Run: `pnpm --filter @seker/web exec vitest run app/components/edit`
Expected: FAIL — modüller yok.

- [ ] **Step 2: `pending.ts` ve `TextEditing.ts` yaz**

`pending.ts`:

```ts
export type Pending = Record<string, { value: unknown; baseUpdatedAt: string | null }>;
export type PendingAction =
  | { type: 'set'; key: string; value: unknown; baseUpdatedAt: string | null }
  | { type: 'clear' }
  | { type: 'drop'; keys: string[] };

export const PENDING_STORAGE_KEY = 'seker-edit-pending';

export function pendingReducer(state: Pending, action: PendingAction): Pending {
  switch (action.type) {
    case 'set':
      return {
        ...state,
        [action.key]: { value: action.value, baseUpdatedAt: state[action.key]?.baseUpdatedAt ?? action.baseUpdatedAt },
      };
    case 'drop':
      return Object.fromEntries(Object.entries(state).filter(([k]) => !action.keys.includes(k)));
    case 'clear':
      return {};
  }
}

export function loadPending(storage: Pick<Storage, 'getItem'> | null): Pending {
  try {
    const raw = storage?.getItem(PENDING_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Pending) : {};
  } catch {
    return {};
  }
}

export function savePending(storage: Pick<Storage, 'setItem' | 'removeItem'> | null, state: Pending): void {
  try {
    if (!storage) return;
    if (Object.keys(state).length) storage.setItem(PENDING_STORAGE_KEY, JSON.stringify(state));
    else storage.removeItem(PENDING_STORAGE_KEY);
  } catch {
    /* gizli sekme: yalnızca bellekte tutulur */
  }
}

export function applyListField(list: { id: string }[], path: string, value: unknown): { id: string }[] {
  const [id, ...rest] = path.split('.');
  const field = rest.join('.');
  return list.map((item) => (item.id === id ? { ...item, [field]: value } : item));
}
```

`TextEditing.ts`:

```ts
import { countChars } from '@/lib/content/chars';

export function plainTextFromPaste(e: Pick<ClipboardEvent, 'clipboardData'>): string {
  return (e.clipboardData?.getData('text/plain') ?? '').replace(/\s*[\r\n]+\s*/g, ' ');
}

export function beginTextEdit(
  el: HTMLElement,
  opts: { max?: number; onCommit(text: string): void; onCancel(): void; onCount(n: number, max?: number): void },
): () => void {
  const original = el.textContent ?? '';
  try {
    el.contentEditable = 'plaintext-only';
  } catch {
    el.contentEditable = 'true';
  }
  if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
  el.classList.add('seker-edit-active');
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);

  const count = () => opts.onCount(countChars(el.textContent ?? ''), opts.max);
  const multiline = (opts.max ?? 0) > 300;
  let done = false;

  const finish = (commit: boolean) => {
    if (done) return;
    done = true;
    if (commit) opts.onCommit((el.textContent ?? '').trim());
    else {
      el.textContent = original;
      opts.onCancel();
    }
    cleanup();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    } else if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      finish(true);
    }
  };
  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault();
    document.execCommand('insertText', false, plainTextFromPaste(e));
  };
  const onBlur = () => finish(true);
  const cleanup = () => {
    el.removeEventListener('keydown', onKey);
    el.removeEventListener('paste', onPaste);
    el.removeEventListener('input', count);
    el.removeEventListener('blur', onBlur);
    el.removeAttribute('contenteditable');
    el.classList.remove('seker-edit-active');
  };

  el.addEventListener('keydown', onKey);
  el.addEventListener('paste', onPaste);
  el.addEventListener('input', count);
  el.addEventListener('blur', onBlur);
  count();
  return () => {
    done = true;
    cleanup();
  };
}
```

- [ ] **Step 3: `edit.css`, `Toasts.tsx`, `EditBar.tsx` yaz**

`edit.css`:

```css
.seker-editing [data-edit-key] { outline: 2px dashed transparent; outline-offset: 3px; cursor: text; transition: outline-color 0.15s; }
.seker-editing [data-edit-key]:hover { outline-color: #6d33b8; }
.seker-editing [data-edit-kind='image'] { cursor: pointer; }
.seker-editing [data-edit-pending='1'] { outline: 2px solid #b4234e; }
.seker-edit-active { outline: 2px solid #6d33b8 !important; background: rgb(109 51 184 / 0.06); }
.seker-editbar { position: fixed; inset-inline: 0; top: 0; z-index: 2147483000; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding: calc(env(safe-area-inset-top, 0px) + 8px) max(16px, env(safe-area-inset-right, 0px)) 8px max(16px, env(safe-area-inset-left, 0px));
  background: #2a1840; color: #fff; font: 600 14px/1.3 system-ui, sans-serif; box-shadow: 0 2px 12px rgb(0 0 0 / 0.25); }
.seker-editbar button, .seker-editbar a { border-radius: 999px; padding: 6px 14px; background: rgb(255 255 255 / 0.12); color: #fff; }
.seker-editbar button:focus-visible, .seker-editbar a:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.seker-editbar .primary { background: #fff; color: #2a1840; }
.seker-editbar button:disabled { opacity: 0.5; cursor: not-allowed; }
.seker-counter { position: absolute; z-index: 2147483001; padding: 2px 8px; border-radius: 6px; background: #2a1840; color: #fff; font: 600 12px system-ui; }
.seker-counter.over { background: #b4234e; }
.seker-toasts { position: fixed; bottom: calc(env(safe-area-inset-bottom, 0px) + 16px); right: max(16px, env(safe-area-inset-right, 0px)); z-index: 2147483002; display: grid; gap: 8px; }
.seker-toast { max-width: 360px; padding: 12px 16px; border-radius: 12px; background: #2a1840; color: #fff; font: 14px/1.4 system-ui; }
.seker-toast.error { background: #b4234e; }
body.seker-editing { padding-top: 56px; }
```

`Toasts.tsx`:

```tsx
'use client';

export type Toast = { id: number; text: string; tone: 'ok' | 'error'; href?: string; hrefLabel?: string };

export function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="seker-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`seker-toast ${t.tone === 'error' ? 'error' : ''}`}>
          {t.text}
          {t.href ? (
            <>
              {' '}
              <a href={t.href} style={{ textDecoration: 'underline' }}>{t.hrefLabel}</a>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
```

`EditBar.tsx`:

```tsx
'use client';

import './edit.css';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Editor } from '@seker/auth/editor';
import type { ReaderData } from '@/lib/content/types';
import { saveContent } from '@/app/actions/content';
import { applyListField, loadPending, pendingReducer, savePending } from './pending';
import { beginTextEdit } from './TextEditing';
import { Toasts, type Toast } from './Toasts';

const storage = () => (typeof window === 'undefined' ? null : window.sessionStorage);

export type EditBarProps = { editor: Editor | null; data: ReaderData; announcements: unknown[] };

export default function EditBar({ editor, data, announcements }: EditBarProps) {
  const router = useRouter();
  const [pending, dispatch] = useReducer(pendingReducer, undefined, () => loadPending(storage()));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [counter, setCounter] = useState<{ n: number; max?: number; top: number; left: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState<null | 'rich' | 'list' | 'settings' | 'history' | 'upload' | 'announcement' | 'preview'>(null);
  const [target, setTarget] = useState<{ key: string; path?: string } | null>(null);
  const stopRef = useRef<null | (() => void)>(null);
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000);
  }, []);

  const currentValue = useCallback((key: string) => (key in pending ? pending[key].value : data.values[key]), [pending, data]);

  const setValue = useCallback(
    (key: string, value: unknown, path?: string) => {
      const next = path ? applyListField(currentValue(key) as { id: string }[], path, value) : value;
      dispatch({ type: 'set', key, value: next, baseUpdatedAt: data.updatedAt[key] ?? null });
    },
    [currentValue, data],
  );

  useEffect(() => savePending(storage(), pending), [pending]);

  // Bekleyen değerleri sayfaya yansıt (yenilemeden sonra da görünsünler).
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-edit-key]').forEach((el) => {
      const key = el.dataset.editKey!;
      const path = el.dataset.editPath;
      const isPending = key in pending;
      el.dataset.editPending = isPending ? '1' : '0';
      if (!isPending || el.dataset.editKind !== 'text' || el.isContentEditable) return;
      const v = pending[key].value;
      if (path) {
        const [id, field] = path.split('.');
        const item = (v as Record<string, unknown>[]).find((i) => i.id === id);
        if (item && typeof item[field] === 'string') el.textContent = item[field] as string;
      } else if (typeof v === 'string') el.textContent = v;
    });
  }, [pending]);

  useEffect(() => {
    if (!editor || inIframe) return;
    document.body.classList.add('seker-editing');
    const onDbl = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-edit-key]');
      if (!el) return;
      e.preventDefault();
      const key = el.dataset.editKey!;
      const path = el.dataset.editPath;
      const kind = el.dataset.editKind;
      if (kind === 'image') return void (setTarget({ key, path }), setPanel('upload'));
      if (kind === 'rich') return void (setTarget({ key, path }), setPanel('rich'));
      if (kind !== 'text') return;
      stopRef.current?.();
      const max = el.dataset.editMax ? Number(el.dataset.editMax) : undefined;
      const rect = el.getBoundingClientRect();
      stopRef.current = beginTextEdit(el, {
        max,
        onCount: (n, m) => setCounter({ n, max: m, top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX }),
        onCommit: (text) => {
          setCounter(null);
          stopRef.current = null;
          if (!text) return toast({ text: 'Boş bırakılamaz; eski metin geri getirildi.', tone: 'error' });
          setValue(key, text, path);
        },
        onCancel: () => {
          setCounter(null);
          stopRef.current = null;
        },
      });
    };
    const onClick = (e: MouseEvent) => {
      // Düzenleme modunda bağlantılar çift tıklamayı bozmasın.
      if ((e.target as HTMLElement).closest('[data-edit-key]') && (e.target as HTMLElement).closest('a')) e.preventDefault();
    };
    document.addEventListener('dblclick', onDbl);
    document.addEventListener('click', onClick, true);
    return () => {
      document.body.classList.remove('seker-editing');
      document.removeEventListener('dblclick', onDbl);
      document.removeEventListener('click', onClick, true);
      stopRef.current?.();
    };
  }, [editor, inIframe, setValue, toast]);

  const count = Object.keys(pending).length;
  useEffect(() => {
    if (!count) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [count]);

  async function save() {
    setSaving(true);
    const res = await saveContent(
      Object.entries(pending).map(([key, p]) => ({ key, value: p.value, baseUpdatedAt: p.baseUpdatedAt })),
    );
    setSaving(false);
    if (res.ok) {
      dispatch({ type: 'clear' });
      toast({ text: 'Yayında. Ziyaretçiler yeni hâlini görüyor.', tone: 'ok' });
      router.refresh();
      return;
    }
    const labels = res.conflicts?.map((k) => data.meta[k]?.label ?? k).join(', ');
    toast({
      text: labels ? `${res.error} (${labels})` : res.error,
      tone: 'error',
      ...(res.error.startsWith('Oturumunuz') ? { href: `${process.env.NEXT_PUBLIC_PANEL_URL ?? ''}/login`, hrefLabel: 'Panele git' } : {}),
    });
  }

  function discard() {
    dispatch({ type: 'clear' });
    window.location.reload();
  }

  if (inIframe) return null;

  if (!editor) {
    return (
      <div className="seker-editbar" role="region" aria-label="Düzenleme çubuğu">
        <span>Oturumunuz sona erdi. Düzenlemek için panelden tekrar giriş yapın.</span>
        <a href={`${process.env.NEXT_PUBLIC_PANEL_URL ?? ''}/login`}>Panele git</a>
        <form method="GET" action="/api/edit/disable"><button type="submit">Düzenlemeden çık</button></form>
      </div>
    );
  }

  return (
    <>
      <div className="seker-editbar" role="region" aria-label="Düzenleme çubuğu">
        <span>✎ Düzenleme modu</span>
        <span aria-live="polite">{count ? `${count} kaydedilmemiş değişiklik` : 'Değişiklik yok'}</span>
        <span style={{ flex: 1 }} />
        <EditBarExtras
          data={data}
          pending={pending}
          announcements={announcements}
          panel={panel}
          setPanel={setPanel}
          target={target}
          setTarget={setTarget}
          setValue={setValue}
          currentValue={currentValue}
          toast={toast}
        />
        <button type="button" onClick={discard} disabled={!count || saving}>Vazgeç</button>
        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={!count || saving || (counter?.max !== undefined && counter.n > counter.max)}
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <form method="GET" action="/api/edit/disable">
          <input type="hidden" name="next" value={typeof window !== 'undefined' ? window.location.pathname : '/'} />
          <button type="submit" disabled={count > 0} title={count ? 'Önce kaydedin veya vazgeçin' : undefined}>Çık</button>
        </form>
      </div>
      {counter ? (
        <div
          className={`seker-counter ${counter.max && counter.n > counter.max ? 'over' : ''}`}
          style={{ top: counter.top, left: counter.left }}
        >
          {counter.max ? `${counter.n} / ${counter.max}` : counter.n}
        </div>
      ) : null}
      <Toasts items={toasts} />
    </>
  );
}

/** Task 9–10 ve 18 bu bileşeni doldurur; bu görevde boş. */
function EditBarExtras(_: Record<string, unknown>) {
  return null;
}
```

`NEXT_PUBLIC_PANEL_URL` yeni bir istemci ortam değişkenidir (`PANEL_URL` ile aynı değer); `infra/` `.env` şablonuna ve GitHub Actions build argümanlarına eklenir (bkz. "Sözleşme notları").

- [ ] **Step 4: Testleri koştur**

Run: `pnpm --filter @seker/web exec vitest run app/components/edit`
Expected: PASS.

- [ ] **Step 5: Elle doğrula**

Run: `pnpm --filter @seker/panel dev` (3001) ve `pnpm --filter @seker/web dev` (3000); panelde `danisman@test.local` ile gir, Ayarlar'dan kendine yetki verdir (yönetici ile), "Siteyi düzenle"ye bas (`SITE_URL=http://localhost:3000`). Henüz sarılmış metin yoksa çubuğun göründüğünü, "Çık"ın draft'ı kapattığını kontrol et. Sarma Task 11'de başlar.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): düzenleme çubuğu çekirdeği (çift tık, sayaç, kaydet, vazgeç, oturum düşmesi)"
```

---

### Task 9: EditBar ekleri: zengin metin, liste paneli, sayfa ayarları, telefon önizleme, geçmiş

**Files:**
- Create: `apps/web/app/components/edit/RichEditor.tsx`, `ListPanel.tsx`, `SettingsPanel.tsx`, `HistoryDrawer.tsx`, `PhonePreview.tsx`, `Drawer.tsx`
- Modify: `apps/web/app/components/edit/EditBar.tsx` (`EditBarExtras`)
- Create: `apps/web/app/components/edit/__tests__/ListPanel.test.tsx`, `SettingsPanel.test.tsx`

**Interfaces:**
- Consumes: `listRevisions`, `revertRevision` (Task 7), `PAGE_IDS` meta anahtar kuralı, `ReaderData.meta`.
- Produces: `EditBarExtras` gerçek sürümü; `ListPanel(props: { listKey: string; meta: SlotMeta; value: ListItem[]; onChange(next: ListItem[]): void; onClose(): void })`; `SettingsPanel(props: { keys: string[]; data: ReaderData; currentValue(k: string): unknown; onChange(k: string, v: string): void; onClose(): void })`; `settingsKeysFor(pathname: string, meta: ReaderData['meta']): string[]`.

`settingsKeysFor`: `/lp/<slug>` → `lp.<slug>.metaTitle`, `lp.<slug>.metaDescription`; diğer sayfalar → `meta.<PAGE_IDS[pathname]>.title`, `.description`; her durumda sonuna tüm `site.*` anahtarları ("Okul bilgileri").

- [ ] **Step 1: Bağımlılıklar**

Run: `pnpm --filter @seker/web add @tiptap/react@3.32.0 @tiptap/starter-kit@3.32.0 @tiptap/pm@3.32.0`
Expected: üçü `dependencies`'te.

- [ ] **Step 2: Failing testler**

`apps/web/app/components/edit/__tests__/ListPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListPanel } from '../ListPanel';

const meta = {
  kind: 'list' as const,
  label: 'Sıkça sorulanlar',
  maxItems: 3,
  fields: {
    question: { kind: 'text' as const, max: 120, label: 'Soru' },
    answer: { kind: 'text' as const, max: 600, label: 'Cevap' },
    featured: { kind: 'flag' as const, label: 'Ana sayfada göster' },
  },
};
const value = [
  { id: 'a', question: 'S1', answer: 'C1', featured: true },
  { id: 'b', question: 'S2', answer: 'C2', featured: false },
];

describe('ListPanel', () => {
  it('aşağı taşır', () => {
    const onChange = vi.fn();
    render(<ListPanel listKey="faq.items" meta={meta} value={value} onChange={onChange} onClose={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Aşağı taşı' })[0]);
    expect(onChange).toHaveBeenCalledWith([value[1], value[0]]);
  });
  it('siler (onaydan sonra)', () => {
    const onChange = vi.fn();
    render(<ListPanel listKey="faq.items" meta={meta} value={value} onChange={onChange} onClose={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));
    expect(onChange).toHaveBeenCalledWith([value[1]]);
  });
  it('ekler; yeni öğe benzersiz id ve boş alanlarla gelir', () => {
    const onChange = vi.fn();
    render(<ListPanel listKey="faq.items" meta={meta} value={value} onChange={onChange} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Madde ekle' }));
    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(3);
    expect(next[2].id).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(next[2]).toMatchObject({ question: '', answer: '', featured: false });
  });
  it('maxItems dolunca ekleme pasif', () => {
    render(
      <ListPanel listKey="faq.items" meta={{ ...meta, maxItems: 2 }} value={value} onChange={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Madde ekle' })).toBeDisabled();
  });
});
```

`apps/web/app/components/edit/__tests__/SettingsPanel.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { settingsKeysFor } from '../SettingsPanel';

const meta = {
  'meta.bultenler.title': { kind: 'text' as const, label: 'Sayfa başlığı' },
  'meta.bultenler.description': { kind: 'text' as const, label: 'Açıklama' },
  'lp.kres-2-yas.metaTitle': { kind: 'text' as const, label: 'LP başlık' },
  'lp.kres-2-yas.metaDescription': { kind: 'text' as const, label: 'LP açıklama' },
  'site.phone': { kind: 'text' as const, label: 'Telefon' },
};

describe('settingsKeysFor', () => {
  it('normal sayfa', () => {
    expect(settingsKeysFor('/bultenler', meta, { '/bultenler': 'bultenler' })).toEqual([
      'meta.bultenler.title',
      'meta.bultenler.description',
      'site.phone',
    ]);
  });
  it('reklam sayfası', () => {
    expect(settingsKeysFor('/lp/kres-2-yas', meta, {})).toEqual([
      'lp.kres-2-yas.metaTitle',
      'lp.kres-2-yas.metaDescription',
      'site.phone',
    ]);
  });
});
```

Run: `pnpm --filter @seker/web exec vitest run app/components/edit`
Expected: FAIL — modüller yok.

- [ ] **Step 3: Uygula**

`Drawer.tsx` (tüm panellerin ortak kabuğu):

```tsx
'use client';

import { useEffect, useRef } from 'react';

export function Drawer({ title, onClose, children }: { title: string; onClose(): void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 2147483003, background: 'rgb(0 0 0 / 0.35)' }} onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 'min(480px, 100%)', overflowY: 'auto', background: '#fff', color: '#2a1840', padding: 20, font: '15px/1.5 system-ui' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ font: '600 18px system-ui', margin: 0 }}>{title}</h2>
          <button type="button" onClick={onClose}>Kapat</button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

`RichEditor.tsx`:

```tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Drawer } from './Drawer';

export function RichEditor({ title, initial, onDone, onClose }: { title: string; initial: string; onDone(html: string): void; onClose(): void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false, codeBlock: false, code: false, blockquote: false, horizontalRule: false, strike: false, underline: false,
        link: { openOnClick: false, autolink: true, protocols: ['mailto', 'tel'] },
      }),
    ],
    content: initial,
  });
  if (!editor) return null;
  const btn = (label: string, run: () => void, active: boolean) => (
    <button type="button" aria-pressed={active} onClick={run} style={{ fontWeight: active ? 700 : 400 }}>{label}</button>
  );
  return (
    <Drawer title={title} onClose={onClose}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {btn('Kalın', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {btn('İtalik', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        {btn('Madde işaretli', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {btn('Numaralı', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        {btn('Bağlantı', () => {
          const url = (document.getElementById('seker-link-input') as HTMLInputElement | null)?.value.trim() ?? '';
          if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          else editor.chain().focus().unsetLink().run();
        }, editor.isActive('link'))}
        <input id="seker-link-input" placeholder="https://… veya tel:…" aria-label="Bağlantı adresi" style={{ flex: 1, minWidth: 160 }} />
      </div>
      <EditorContent editor={editor} style={{ border: '1px solid #e2d7f0', borderRadius: 8, padding: 12, minHeight: 200 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => onDone(editor.getHTML())}>Tamam</button>
        <button type="button" onClick={onClose}>Vazgeç</button>
      </div>
      <p style={{ fontSize: 13, color: '#5f4f75' }}>Yapıştırılan metnin biçimi sadeleştirilir; yalnızca kalın, italik, liste ve bağlantı kalır. Değişiklik &quot;Kaydet&quot;e basınca yayınlanır.</p>
    </Drawer>
  );
}
```

(Bağlantı düğmesi: kullanıcı yanındaki kutuya adres yazar, "Bağlantı"ya basınca seçili metne uygulanır; kutu boşsa bağlantı kaldırılır. `window.prompt` artifact/tarayıcı kısıtlarından bağımsız olsun diye kullanılmaz.)

`ListPanel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { ListItem, SlotMeta } from '@/lib/content/types';
import { countChars } from '@/lib/content/chars';
import { Drawer } from './Drawer';

function newId(existing: string[]): string {
  let id = '';
  do id = `m-${Math.random().toString(36).slice(2, 8)}`;
  while (existing.includes(id));
  return id;
}

export function ListPanel({ listKey, meta, value, onChange, onClose }: {
  listKey: string; meta: SlotMeta; value: ListItem[]; onChange(next: ListItem[]): void; onClose(): void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const fields = Object.entries(meta.fields ?? {});
  const max = meta.maxItems ?? 50;
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const add = () => {
    const blank: ListItem = { id: newId(value.map((v) => v.id)) };
    for (const [name, f] of fields) blank[name] = f.kind === 'flag' ? false : f.kind === 'image' ? undefined : '';
    onChange([...value, blank]);
  };
  return (
    <Drawer title={meta.label} onClose={onClose}>
      <ol style={{ display: 'grid', gap: 12, padding: 0, listStyle: 'none' }} data-list-key={listKey}>
        {value.map((item, i) => (
          <li key={item.id} style={{ border: '1px solid #e2d7f0', borderRadius: 10, padding: 12 }}>
            {fields.map(([name, f]) =>
              f.kind === 'flag' ? (
                <label key={name} style={{ display: 'flex', gap: 6 }}>
                  <input id={`${item.id}-${name}`} type="checkbox" checked={Boolean(item[name])}
                    onChange={(e) => onChange(value.map((v) => (v.id === item.id ? { ...v, [name]: e.target.checked } : v)))} />
                  {f.label}
                </label>
              ) : f.kind === 'text' ? (
                <label key={name} style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
                  <span>{f.label} <small>({countChars(String(item[name] ?? ''))}{f.max ? ` / ${f.max}` : ''})</small></span>
                  <textarea id={`${item.id}-${name}`} rows={(f.max ?? 0) > 150 ? 4 : 1} value={String(item[name] ?? '')}
                    onChange={(e) => onChange(value.map((v) => (v.id === item.id ? { ...v, [name]: e.target.value } : v)))} />
                </label>
              ) : (
                <p key={name} style={{ fontSize: 13 }}>{f.label}: sayfada çift tıklayarak değiştirin.</p>
              ),
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label="Aşağı taşı" disabled={i === value.length - 1} onClick={() => move(i, 1)}>↓</button>
              {confirm === item.id ? (
                <>
                  <button type="button" onClick={() => { onChange(value.filter((v) => v.id !== item.id)); setConfirm(null); }}>Evet, sil</button>
                  <button type="button" onClick={() => setConfirm(null)}>Vazgeç</button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirm(item.id)}>Sil</button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <button type="button" onClick={add} disabled={value.length >= max}>Madde ekle</button>
      <p style={{ fontSize: 13, color: '#5f4f75' }}>Boş bırakılan madde kaydedilmez; &quot;Kaydet&quot; uyarı verir.</p>
    </Drawer>
  );
}
```

`SettingsPanel.tsx`:

```tsx
'use client';

import type { ReaderData } from '@/lib/content/types';
import { countChars } from '@/lib/content/chars';
import { Drawer } from './Drawer';

export function settingsKeysFor(pathname: string, meta: ReaderData['meta'], pageIds: Record<string, string>): string[] {
  const lp = pathname.match(/^\/lp\/([a-z0-9-]+)$/);
  const pageKeys = lp
    ? [`lp.${lp[1]}.metaTitle`, `lp.${lp[1]}.metaDescription`]
    : pageIds[pathname] ? [`meta.${pageIds[pathname]}.title`, `meta.${pageIds[pathname]}.description`] : [];
  return [...pageKeys.filter((k) => k in meta), ...Object.keys(meta).filter((k) => k.startsWith('site.'))];
}

export function SettingsPanel({ keys, data, currentValue, onChange, onClose }: {
  keys: string[]; data: ReaderData; currentValue(k: string): unknown; onChange(k: string, v: string): void; onClose(): void;
}) {
  return (
    <Drawer title="Sayfa ayarları ve okul bilgileri" onClose={onClose}>
      <p style={{ fontSize: 13, color: '#5f4f75' }}>
        Sayfa başlığı ve açıklaması Google sonuçlarında görünür. Okul bilgileri (telefon, adres, saatler) sitenin her yerinde kullanılır.
      </p>
      {keys.map((k) => {
        const m = data.meta[k];
        const v = String(currentValue(k) ?? '');
        const n = countChars(v);
        return (
          <label key={k} style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
            <span>{m.label} <small style={{ color: m.max && n > m.max ? '#b4234e' : undefined }}>({n}{m.max ? ` / ${m.max}` : ''})</small></span>
            <input id={`setting-${k}`} value={v} onChange={(e) => onChange(k, e.target.value)} />
            {m.pattern && v && !new RegExp(m.pattern).test(v) ? <small style={{ color: '#b4234e' }}>Biçim uygun değil.</small> : null}
          </label>
        );
      })}
    </Drawer>
  );
}
```

`HistoryDrawer.tsx`:

```tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { listRevisions, revertRevision, type RevisionRow } from '@/app/actions/content';
import { Drawer } from './Drawer';

export function HistoryDrawer({ onClose, onReverted, onError }: { onClose(): void; onReverted(): void; onError(msg: string): void }) {
  const [rows, setRows] = useState<RevisionRow[] | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => void listRevisions(50).then(setRows), []);
  return (
    <Drawer title="Değişiklik geçmişi" onClose={onClose}>
      {rows === null ? <p>Yükleniyor…</p> : rows.length === 0 ? <p>Henüz değişiklik yok.</p> : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ borderBottom: '1px solid #e2d7f0', paddingBottom: 8 }}>
              <strong>{r.label}</strong>
              <div style={{ fontSize: 13, color: '#5f4f75' }}>
                {new Date(r.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} · {r.editorName}
              </div>
              <div style={{ fontSize: 14 }}>Önce: {r.before}</div>
              <div style={{ fontSize: 14 }}>Sonra: {r.after}</div>
              <button type="button" disabled={busy} onClick={() => start(async () => {
                const res = await revertRevision(r.id);
                if (res.ok) onReverted(); else onError(res.error);
              })}>Bu değişikliği geri al</button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
```

`PhonePreview.tsx`:

```tsx
'use client';

import { Drawer } from './Drawer';

export function PhonePreview({ onClose }: { onClose(): void }) {
  return (
    <Drawer title="Telefon görünümü (kaydedilmiş hâli)" onClose={onClose}>
      <iframe title="Telefon önizlemesi" src={window.location.pathname} style={{ width: 390, maxWidth: '100%', height: 760, border: '8px solid #2a1840', borderRadius: 28 }} />
    </Drawer>
  );
}
```

`EditBar.tsx` içindeki `EditBarExtras`'ı değiştir:

```tsx
import { RichEditor } from './RichEditor';
import { ListPanel } from './ListPanel';
import { SettingsPanel, settingsKeysFor } from './SettingsPanel';
import { HistoryDrawer } from './HistoryDrawer';
import { PhonePreview } from './PhonePreview';
import { PAGE_IDS } from '@/lib/content/pageIds';
import type { ListItem } from '@/lib/content/types';

type ExtrasProps = {
  data: ReaderData;
  pending: Record<string, unknown>;
  announcements: unknown[];
  panel: string | null;
  setPanel(p: null | 'rich' | 'list' | 'settings' | 'history' | 'upload' | 'announcement' | 'preview'): void;
  target: { key: string; path?: string } | null;
  setTarget(t: { key: string; path?: string } | null): void;
  setValue(key: string, value: unknown, path?: string): void;
  currentValue(key: string): unknown;
  toast(t: Omit<Toast, 'id'>): void;
};

function EditBarExtras(p: ExtrasProps) {
  const [lists, setLists] = useState<{ key: string; label: string }[]>([]);
  useEffect(() => {
    const seen = new Map<string, string>();
    document.querySelectorAll<HTMLElement>('[data-edit-list]').forEach((el) => seen.set(el.dataset.editList!, el.dataset.editLabel ?? el.dataset.editList!));
    setLists([...seen].map(([key, label]) => ({ key, label })));
  }, []);
  const richInitial = () => {
    if (!p.target) return '';
    const v = p.currentValue(p.target.key);
    if (!p.target.path) return String(v);
    const [id, field] = p.target.path.split('.');
    return String((v as ListItem[]).find((i) => i.id === id)?.[field] ?? '');
  };
  return (
    <>
      {lists.length ? (
        <select id="seker-list-select" aria-label="Bu sayfadaki listeler" value="" onChange={(e) => { p.setTarget({ key: e.target.value }); p.setPanel('list'); }}>
          <option value="">Listeler…</option>
          {lists.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
        </select>
      ) : null}
      <button type="button" onClick={() => p.setPanel('settings')}>Sayfa ayarları</button>
      <button type="button" onClick={() => p.setPanel('preview')}>Telefon görünümü</button>
      <button type="button" onClick={() => p.setPanel('history')}>Geçmiş</button>
      {p.panel === 'rich' && p.target ? (
        <RichEditor title={p.data.meta[p.target.key].label} initial={richInitial()}
          onDone={(html) => { p.setValue(p.target!.key, html, p.target!.path); p.setPanel(null); }}
          onClose={() => p.setPanel(null)} />
      ) : null}
      {p.panel === 'list' && p.target ? (
        <ListPanel listKey={p.target.key} meta={p.data.meta[p.target.key]} value={p.currentValue(p.target.key) as ListItem[]}
          onChange={(next) => p.setValue(p.target!.key, next)} onClose={() => p.setPanel(null)} />
      ) : null}
      {p.panel === 'settings' ? (
        <SettingsPanel keys={settingsKeysFor(window.location.pathname, p.data.meta, PAGE_IDS)} data={p.data}
          currentValue={p.currentValue} onChange={(k, v) => p.setValue(k, v)} onClose={() => p.setPanel(null)} />
      ) : null}
      {p.panel === 'history' ? (
        <HistoryDrawer onClose={() => p.setPanel(null)}
          onReverted={() => { p.toast({ text: 'Geri alındı ve yayında.', tone: 'ok' }); window.location.reload(); }}
          onError={(text) => p.toast({ text, tone: 'error' })} />
      ) : null}
      {p.panel === 'preview' ? <PhonePreview onClose={() => p.setPanel(null)} /> : null}
    </>
  );
}
```

`PAGE_IDS`'i istemci paketine registry'nin tamamını sokmadan almak için `apps/web/lib/content/pageIds.ts` dosyasına taşı (`export const PAGE_IDS: Record<string, string> = {};`) ve `registry.ts` içinde `export { PAGE_IDS } from './pageIds';` yap. Sayfa görevleri `pageIds.ts`'e satır ekler.

- [ ] **Step 4: Testleri koştur**

Run: `pnpm --filter @seker/web exec vitest run app/components/edit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): zengin metin, liste paneli, sayfa ayarları, geçmiş ve telefon görünümü"
```

---

### Task 10: Fotoğraf yükleme (S3 + sharp + KVKK beyanı)

**Files:**
- Create: `apps/web/lib/media/process.ts`, `apps/web/lib/media/s3.ts`, `apps/web/app/actions/media.ts`, `apps/web/app/components/edit/UploadDialog.tsx`
- Create: `apps/web/lib/media/__tests__/process.test.ts`, `apps/web/app/actions/__tests__/media.test.ts`
- Modify: `apps/web/next.config.ts`, `apps/web/app/components/edit/EditBar.tsx`, `apps/web/package.json`

**Interfaces:**
- Consumes: `getEditor`, `createServerSupabase`, env `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_MEDIA_BASE_URL`.
- Produces:

```ts
// process.ts
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export async function processImage(input: Buffer): Promise<{ data: Buffer; width: number; height: number }>;
// s3.ts
export async function putImage(key: string, body: Buffer): Promise<void>;
export function mediaKey(now: Date, id: string): string; // site-images/YYYY/MM/<id>.webp
// actions/media.ts
export type MediaAsset = { id: string; src: string; alt: string; width: number; height: number };
export async function uploadImage(form: FormData): Promise<{ ok: true; asset: MediaAsset } | { ok: false; error: string }>;
```

FormData alanları: `file` (File), `alt` (string), `faces` (`'yok' | 'bulanik_veya_izinli'`).

- [ ] **Step 1: Bağımlılıklar ve yapılandırma**

Run: `pnpm --filter @seker/web add sharp@0.35.5 @aws-sdk/client-s3@3.1151.0` (sharp devDependencies'ten çıkar).

`apps/web/next.config.ts` içine:

```ts
const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
// nextConfig içinde:
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: mediaBase ? [new URL(`${mediaBase}/site-images/**`)] : [],
  },
  experimental: {
    viewTransition: true,
    serverActions: { bodySizeLimit: '11mb' },
  },
```

S3 bucket'ı için (sahip, AWS konsolunda, bir kez): bucket policy ile yalnızca `site-images/*` herkese okunur:

```json
{
  "Version": "2012-10-17",
  "Statement": [{ "Sid": "PublicReadSiteImages", "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::<S3_BUCKET>/site-images/*" }]
}
```

ve `seker-web-media` IAM kullanıcısına yalnızca `s3:PutObject` on `arn:aws:s3:::<S3_BUCKET>/site-images/*`.

- [ ] **Step 2: Failing testler**

`apps/web/lib/media/__tests__/process.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { processImage } from '../process';
import { mediaKey } from '../s3';

async function jpegWithExif(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#a0f' } })
    .jpeg()
    .withExif({ IFD0: { Copyright: 'test' }, GPS: { GPSLatitudeRef: 'N' } } as never)
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

describe('processImage', () => {
  it('2400 px içine küçültür, WebP yapar, EXIF/GPS siler, yönü uygular', async () => {
    const out = await processImage(await jpegWithExif(4000, 3000));
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    // orientation 6 → 90° döner: 3000x4000 → 1800x2400
    expect([out.width, out.height]).toEqual([1800, 2400]);
  });
  it('küçük görseli büyütmez', async () => {
    const out = await processImage(await sharp({ create: { width: 800, height: 600, channels: 3, background: '#fff' } }).png().toBuffer());
    expect([out.width, out.height]).toEqual([800, 600]);
  });
  it('görsel olmayan veriyi reddeder', async () => {
    await expect(processImage(Buffer.from('merhaba'))).rejects.toThrow();
  });
});

describe('mediaKey', () => {
  it('site-images/YYYY/MM/<id>.webp', () => {
    expect(mediaKey(new Date('2026-10-14T10:00:00Z'), 'abc')).toBe('site-images/2026/10/abc.webp');
  });
});
```

`apps/web/app/actions/__tests__/media.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

const putImage = vi.fn();
vi.mock('@/lib/media/s3', async (orig) => ({ ...(await orig<object>()), putImage: (...a: unknown[]) => putImage(...a) }));
const getEditor = vi.fn();
const insert = vi.fn();
vi.mock('@seker/auth/editor', () => ({ getEditor: () => getEditor() }));
vi.mock('@seker/auth/server', () => ({
  createServerSupabase: async () => ({ from: () => ({ insert: (row: unknown) => ({ select: () => ({ single: () => insert(row) }) }) }) }),
}));

import { uploadImage } from '../media';

const png = async () =>
  new File([await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).png().toBuffer()], 'a.png', { type: 'image/png' });

function form(file: File, alt = 'Bahçede oyun', faces = 'yok') {
  const f = new FormData();
  f.set('file', file);
  f.set('alt', alt);
  f.set('faces', faces);
  return f;
}

beforeEach(() => {
  putImage.mockReset();
  insert.mockReset();
  getEditor.mockReset();
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL = 'https://b.s3.eu-central-1.amazonaws.com';
});

describe('uploadImage', () => {
  it('oturum yoksa yüklemez', async () => {
    getEditor.mockResolvedValue(null);
    expect((await uploadImage(form(await png()))).ok).toBe(false);
    expect(putImage).not.toHaveBeenCalled();
  });
  it('KVKK beyanı olmadan yüklemez', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    const r = await uploadImage(form(await png(), 'x', ''));
    expect(r).toEqual({ ok: false, error: 'Fotoğrafta çocuk yüzü olup olmadığını işaretleyin.' });
  });
  it('açıklama zorunlu', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    expect(await uploadImage(form(await png(), '  '))).toEqual({ ok: false, error: 'Fotoğraf için kısa bir açıklama yazın.' });
  });
  it("HEIC'i anlaşılır mesajla reddeder", async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    const heic = new File([new Uint8Array(10)], 'IMG_1.HEIC', { type: 'image/heic' });
    const r = await uploadImage(form(heic));
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toMatch(/JPEG/);
  });
  it('10 MB üstünü reddeder', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'b.jpg', { type: 'image/jpeg' });
    expect((await uploadImage(form(big))).ok).toBe(false);
  });
  it("S3'e koyar ve media_assets yazar", async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    insert.mockImplementation(async (row: { s3_key: string }) => ({ data: { id: '11111111-1111-4111-8111-111111111111', ...row }, error: null }));
    const r = await uploadImage(form(await png()));
    expect(putImage).toHaveBeenCalledOnce();
    expect(putImage.mock.calls[0][0]).toMatch(/^site-images\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
    expect(r).toMatchObject({ ok: true, asset: { alt: 'Bahçede oyun', width: 10, height: 10 } });
    expect((r as { asset: { src: string } }).asset.src.startsWith('https://b.s3.eu-central-1.amazonaws.com/site-images/')).toBe(true);
  });
});
```

Run: `pnpm --filter @seker/web exec vitest run lib/media app/actions/__tests__/media.test.ts`
Expected: FAIL — modüller yok.

- [ ] **Step 3: Uygula**

`apps/web/lib/media/process.ts`:

```ts
import 'server-only';
import sharp from 'sharp';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Yönü uygular, 2400 px içine sığdırır, WebP yapar. sharp varsayılan olarak EXIF/GPS dahil tüm metadata'yı atar. */
export async function processImage(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input, { failOn: 'error', limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
```

`apps/web/lib/media/s3.ts`:

```ts
import 'server-only';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

let client: S3Client | null = null;

export function mediaKey(now: Date, id: string): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `site-images/${y}/${m}/${id}.webp`;
}

export async function putImage(key: string, body: Buffer): Promise<void> {
  client ??= new S3Client({ region: process.env.S3_REGION });
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}
```

`apps/web/app/actions/media.ts`:

```ts
'use server';

import { randomUUID } from 'node:crypto';
import { createServerSupabase } from '@seker/auth/server';
import { getEditor } from '@seker/auth/editor';
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, processImage } from '@/lib/media/process';
import { mediaKey, putImage } from '@/lib/media/s3';
import { countChars } from '@/lib/content/chars';

export type MediaAsset = { id: string; src: string; alt: string; width: number; height: number };

export async function uploadImage(form: FormData): Promise<{ ok: true; asset: MediaAsset } | { ok: false; error: string }> {
  const editor = await getEditor();
  if (!editor) return { ok: false, error: 'Oturumunuz sona erdi. Panelden tekrar giriş yapın.' };

  const file = form.get('file');
  const alt = String(form.get('alt') ?? '').trim();
  const faces = String(form.get('faces') ?? '');
  if (!(file instanceof File)) return { ok: false, error: 'Bir fotoğraf seçin.' };
  if (faces !== 'yok' && faces !== 'bulanik_veya_izinli') return { ok: false, error: 'Fotoğrafta çocuk yüzü olup olmadığını işaretleyin.' };
  if (!alt) return { ok: false, error: 'Fotoğraf için kısa bir açıklama yazın.' };
  if (countChars(alt) > 200) return { ok: false, error: 'Açıklama en fazla 200 karakter olabilir.' };
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type))
    return { ok: false, error: 'Bu dosya türü desteklenmiyor. JPEG, PNG veya WebP yükleyin (iPhone: Ayarlar › Kamera › Biçimler › En Uyumlu).' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'Fotoğraf 10 MB’tan büyük. Daha küçük bir kopyasını yükleyin.' };

  let processed: Awaited<ReturnType<typeof processImage>>;
  try {
    processed = await processImage(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { ok: false, error: 'Fotoğraf açılamadı. Başka bir dosya deneyin.' };
  }

  const id = randomUUID();
  const key = mediaKey(new Date(), id);
  try {
    await putImage(key, processed.data);
  } catch (err) {
    console.error('[media] S3 yükleme hatası', err);
    return { ok: false, error: 'Fotoğraf yüklenemedi, tekrar deneyin.' };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('media_assets')
    .insert({ id, s3_key: key, width: processed.width, height: processed.height, alt, faces, uploaded_by: editor.id })
    .select('id, s3_key, width, height, alt')
    .single();
  if (error || !data) return { ok: false, error: 'Fotoğraf kaydedilemedi, tekrar deneyin.' };

  return {
    ok: true,
    asset: {
      id: data.id,
      src: `${process.env.NEXT_PUBLIC_MEDIA_BASE_URL}/${data.s3_key}`,
      alt: data.alt,
      width: data.width,
      height: data.height,
    },
  };
}
```

`apps/web/app/components/edit/UploadDialog.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { uploadImage } from '@/app/actions/media';
import type { ImageValue } from '@/lib/content/types';
import { Drawer } from './Drawer';

export function UploadDialog({ title, current, onDone, onClose }: {
  title: string; current: ImageValue; onDone(v: ImageValue): void; onClose(): void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState(current.alt);
  const [faces, setFaces] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const preview = file ? URL.createObjectURL(file) : current.src;

  function submit() {
    setError(null);
    if (!file) return setError('Bir fotoğraf seçin.');
    if (file.size > 10 * 1024 * 1024) return setError('Fotoğraf 10 MB’tan büyük. Daha küçük bir kopyasını yükleyin.');
    const f = new FormData();
    f.set('file', file);
    f.set('alt', alt);
    f.set('faces', faces);
    start(async () => {
      const r = await uploadImage(f);
      if (!r.ok) return setError(r.error);
      onDone({ src: r.asset.src, alt: r.asset.alt, width: r.asset.width, height: r.asset.height, assetId: r.asset.id });
    });
  }

  return (
    <Drawer title={title} onClose={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 12 }} />
      <label style={{ display: 'grid', gap: 4 }}>
        Fotoğraf
        <input id="seker-upload-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <label style={{ display: 'grid', gap: 4, marginTop: 12 }}>
        Kısa açıklama (görme engelli ziyaretçiler ve Google için)
        <input id="seker-upload-alt" value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} />
      </label>
      <fieldset style={{ marginTop: 12 }}>
        <legend>Fotoğrafta çocuk yüzü var mı? (zorunlu)</legend>
        <label style={{ display: 'flex', gap: 6 }}>
          <input id="seker-faces-yok" type="radio" name="faces" value="yok" checked={faces === 'yok'} onChange={() => setFaces('yok')} />
          Fotoğrafta çocuk yüzü yok
        </label>
        <label style={{ display: 'flex', gap: 6 }}>
          <input id="seker-faces-izin" type="radio" name="faces" value="bulanik_veya_izinli" checked={faces === 'bulanik_veya_izinli'} onChange={() => setFaces('bulanik_veya_izinli')} />
          Yüzler bulanıklaştırıldı veya velinin yazılı izni dosyada
        </label>
      </fieldset>
      {error ? <p role="alert" style={{ color: '#b4234e' }}>{error}</p> : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={submit} disabled={busy}>{busy ? 'Yükleniyor…' : 'Yükle'}</button>
        <button type="button" onClick={onClose}>Vazgeç</button>
      </div>
      <p style={{ fontSize: 13, color: '#5f4f75' }}>Konum bilgisi fotoğraftan otomatik silinir. Fotoğraf &quot;Kaydet&quot;e basınca yayınlanır.</p>
    </Drawer>
  );
}
```

`EditBarExtras` içine:

```tsx
{p.panel === 'upload' && p.target ? (
  <UploadDialog
    title={p.data.meta[p.target.key].label}
    current={(p.target.path
      ? (p.currentValue(p.target.key) as ListItem[]).find((i) => i.id === p.target!.path!.split('.')[0])?.[p.target.path.split('.')[1]]
      : p.currentValue(p.target.key)) as ImageValue}
    onDone={(v) => { p.setValue(p.target!.key, v, p.target!.path); p.setPanel(null); p.toast({ text: 'Fotoğraf hazır. Yayınlamak için Kaydet’e basın.', tone: 'ok' }); }}
    onClose={() => p.setPanel(null)}
  />
) : null}
```

Görselin sayfada hemen değişmesi için `EditBar`'daki "bekleyen değerleri yansıt" efektine ekle: `el.dataset.editKind === 'image'` ise elemanın içindeki ilk `img`'nin `src`/`srcset`'ini bekleyen `src` ile değiştir, `srcset`'i kaldır.

- [ ] **Step 4: Testleri koştur**

Run: `pnpm --filter @seker/web exec vitest run lib/media app/actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): fotoğraf yükleme (sharp, S3, KVKK beyanı)"
```

---

## Sayfa sarma görevleri (Task 11–17): ortak yöntem

Her sayfa/bileşen için aynı dört adım uygulanır. Görevler yalnızca dosyaları, anahtar öneklerini ve özel durumları listeler; yöntem burada tektir ve her görevde aynen izlenir.

**Anahtar adlandırma kuralı:** `<sayfa>.<bölüm>.<öğe>` (küçük harf, Türkçe karakter yok, ör. `bultenler.hero.title`, `bultenler.request.body`). Sayfa meta'sı `meta.<sayfa>.title` (max 70) ve `meta.<sayfa>.description` (max 160). Sitenin geneline ait listeler `faq.items`, `testimonials.items`, `day.chapters`, `program.branches`, `ageGroups.items`; fotoğraflar `media.<MEDIA anahtarı>`. Uzunluk sınırı: varsayılan metnin grafem uzunluğunun 1,5 katı, yukarı 10'a yuvarlanmış; başlıklarda (`h1`, `h2`) en çok 120.

**Adım A — Görünür HTML'i dondur (failing değil, kilit testi).** `apps/web/app/__tests__/visitor-html/<sayfa>.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BultenlerView from '@/app/(site)/bultenler/BultenlerView';
import { defaultData } from '@/lib/content/testing';

describe('bultenler ziyaretçi HTML', () => {
  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<BultenlerView data={defaultData(['bultenler.', 'meta.bultenler.', 'media.'])} />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
```

Snapshot **dönüşümden önce** alınır: bu testi ilk yazdığında `BultenlerView` yerine bugünkü bileşeni (`import Page from '@/app/(site)/bultenler/page'` ve `render(await Page())` ya da senkron ise `render(<Page />)`) render et, `pnpm --filter @seker/web exec vitest run app/__tests__/visitor-html/<sayfa>.test.tsx -u` ile snapshot'ı üret ve commit et. Sonra import'u `View` + `defaultData` olarak değiştir; test **dönüşümden sonra da aynı snapshot'la geçmelidir**. Tek kabul edilen fark: yok. (Fark çıkarsa dönüşüm hatalıdır.)

**Adım B — Kapsam testi (failing).** Aynı dosyaya:

```tsx
import { sentinelData, uncoveredText } from '@/lib/content/testing';

it('görünür her metin bir içerik alanından geliyor', () => {
  const { container } = render(<BultenlerView data={sentinelData(['bultenler.', 'meta.bultenler.', 'media.'])} />);
  expect(uncoveredText(container)).toEqual([]);
});
```

Run → FAIL; çıktı, sarılmamış metinlerin tam listesidir. Bu liste görevin yapılacaklar listesidir.

**Adım C — Dönüştür.**
1. `apps/web/lib/content/slots/<sayfa>.ts` oluştur; bugünkü dosyadaki her görünür metni **harfi harfine** varsayılan olarak taşı (kopyala-yapıştır; yeniden yazma yok). Yıl hesaplanan cümlelerde sayının yerine `{yilSayisi}`, kuruluş yılının yerine `{kurulusYili}` yaz. `registry.ts`'e `...<SAYFA>_SLOTS` ekle; `pageIds.ts`'e `'/<yol>': '<sayfa>'` ekle.
2. Sayfayı ikiye böl: `page.tsx` (async; `generateMetadata` + veri) ve `<Ad>View.tsx` (senkron, `data: ReaderData` prop'u alır, `const c = makeReader(data)`).
3. Her metni `Editable`/`EditableRich` ile, her listeyi `c.list()` + öğe alanlarında `Editable path=` ile, liste kabını `{...c.listAttrs(key)}` ile, her `Image`'ı `c.image(key)` + çevreleyen elemanda `{...c.attrs(key)}` ile değiştir. `className`'ler, eleman türleri ve sıralama değişmez.
4. `'use client'` bileşenler: sunucu ebeveyn `pickData(data, [öneki])` geçirir; istemci bileşen `makeReader(data)` kullanır (registry import etmez).
5. Metadata: `export async function generateMetadata() { const c = makeReader(await getReaderData()); return buildMetadata({ title: c.text('meta.<sayfa>.title'), description: c.text('meta.<sayfa>.description'), path: '/<yol>' }); }` — `export const metadata` kaldırılır.

Örnek (bültenler hero):

```tsx
<PageHero
  eyebrow={<Editable c={c} k="bultenler.hero.eyebrow" />}
  title={<Editable c={c} k="bultenler.hero.title" />}
  lead={<Editable c={c} k="bultenler.hero.lead" />}
  tone="grape"
/>
```

Bu, `PageHero`'nun `<p>`/`<h1>`/`<p>` elemanlarının içine bir `<span>` ekler. Ziyaretçi HTML'ini birebir korumak için `PageHero`'ya Task 11'de `c?: Reader` ve `keys?: { eyebrow?: string; title?: string; lead?: string }` prop'ları eklenir; verildiğinde `<h1 className=… {...c.attrs(keys.title)}>{c.text(keys.title)}</h1>` biçiminde basar. Hero kullanan her sayfa bu yolu kullanır:

```tsx
<PageHero c={c} keys={{ eyebrow: 'bultenler.hero.eyebrow', title: 'bultenler.hero.title', lead: 'bultenler.hero.lead' }} tone="grape" />
```

**Adım D — Doğrula ve commit.** Run: `pnpm --filter @seker/web exec vitest run` → PASS (A ve B dahil, mevcut testler dahil; mevcut testler bileşeni eski prop'larla render ediyorsa `defaultData()` ile güncellenir). Run: `pnpm --filter @seker/web build` → PASS. Elle: `pnpm dev`, düzenleme modunda sayfadaki 3 rastgele metni çift tıklayıp değiştir, kaydet, düzenlemeden çık, yeni metni ziyaretçi olarak gör. Commit: `feat(web): <sayfa> sayfasını düzenlenebilir yap`.

---

### Task 11: Ana sayfa ve ortak bileşenler (`PageHero`, `Frame`)

**Files:**
- Create: `apps/web/lib/content/slots/home.ts`, `apps/web/lib/content/slots/lists.ts`, `apps/web/lib/content/slots/media.ts`, `apps/web/app/(site)/HomeView.tsx`, `apps/web/app/__tests__/visitor-html/home.test.tsx`
- Modify: `apps/web/app/(site)/page.tsx`, `apps/web/app/(site)/Anasayfa.tsx` (→ `HomeView.tsx` olur, eski dosya silinir), `apps/web/app/components/HeroSection.tsx`, `GardenSection.tsx`, `FeaturesSection.tsx`, `ActivitiesSection.tsx`, `WeekRhythmSection.tsx`, `FAQSection.tsx` (istemci), `ContactSection.tsx` (istemci), `PageHero.tsx`, `cine/Frame.tsx`, `apps/web/app/__tests__/homepage.test.tsx`, `apps/web/lib/content/registry.ts`, `apps/web/lib/content/pageIds.ts`

**Interfaces:**
- Produces: `PageHero` ek prop'ları `c?: Reader; keys?: { eyebrow?: string; title?: string; lead?: string }`; `Frame` ek prop'u `image?: ImageValue; editAttrs?: Record<string, string>` (verilirse `mediaKey` yerine kullanılır); her ana sayfa bölümü `({ c }: { c: Reader })` (istemci olanlar `({ data }: { data: ReaderData })`).
- Ortak listeler (`slots/lists.ts`) — varsayılanlar mevcut modüllerden gelir, kopyalanmaz:

```ts
import { FAQ_ITEMS } from '@/content/faq';
import { TESTIMONIALS } from '@/content/testimonials';
import { DAY_CHAPTERS } from '@/content/day';
import { BRANCHES } from '@/content/program';
import { AGE_GROUPS_CONTENT } from '@/content/ageGroups';
import type { SlotDef } from '../types';

export const LIST_SLOTS: Record<string, SlotDef> = {
  'faq.items': {
    kind: 'list', label: 'Sıkça sorulan sorular', maxItems: 40, default: FAQ_ITEMS,
    fields: {
      question: { kind: 'text', max: 160, label: 'Soru' },
      answer: { kind: 'text', max: 900, label: 'Cevap' },
      featured: { kind: 'flag', label: 'Ana sayfada göster' },
      ready: { kind: 'flag', label: 'Yayında' },
    },
  },
  'testimonials.items': {
    kind: 'list', label: 'Veli yorumları', maxItems: 40, default: TESTIMONIALS,
    fields: {
      quote: { kind: 'text', max: 600, label: 'Yorum' },
      author: { kind: 'text', max: 40, label: 'Veli' },
      context: { kind: 'text', max: 80, label: 'Açıklama' },
      ready: { kind: 'flag', label: 'Yayında' },
    },
  },
  // 'day.chapters', 'program.branches', 'ageGroups.items': alanlar = ilgili tipin (DayChapter: content/day.ts:4-30,
  // Branch: content/program.ts:47-64, AgeGroup: content/ageGroups.ts:4-22) string alanlarının tamamı, `id`/`slug`,
  // `mediaKey`, `grade`, `season` hariç; max = en uzun varsayılan × 1,5. Bu üçü Task 14'te eklenir.
};
```

`FAQ_ITEMS`'ta `id` alanı zaten var; `TESTIMONIALS`'ta da var. `PUBLISHED_FAQ` / `FEATURED_FAQ` / `PUBLISHED_TESTIMONIALS` türetmeleri artık `c.list('faq.items').filter((i) => i.ready)` biçiminde okuyucudan yapılır.

- Fotoğraflar (`slots/media.ts`): `MEDIA`'daki her anahtar için `'media.<k>': { kind: 'image', label: <alt'ın ilk 40 karakteri>, default: { src, alt, width, height, assetId: null } }`.
- Ana sayfa anahtarları (`slots/home.ts`), önek `home.`: `home.hero.badge` (`"Beykent'in en köklü anaokullarından biri · {kurulusYili}'den beri"`), `home.hero.title`, `home.hero.lead`, `home.hero.ctaPrimary`, `home.hero.ctaWhatsapp`, `home.hero.note`, `home.hero.cornerTitle`, `home.hero.cornerText`, `home.hero.rosterChildren` (`"12"` — `ROSTER_STATUS.childCount`'tan), `home.hero.rosterChildrenLabel`, `home.hero.rosterTeachers`, `home.hero.rosterTeachersLabel`, `home.hero.rosterNote`, `home.hero.programMontessori`, `home.hero.programMontessoriLabel`, `home.hero.programEnglish`, `home.hero.programEnglishLabel`, `home.hero.programNote` (`"… {yilSayisi} yıldır aynı bahçede çalışıyoruz."`), `home.hero.quoteId` yok (alıntı `testimonials.items`'ten `muge-ilkokul-olsa` id'li öğedir, `Editable path`'iyle düzenlenir), `home.day.eyebrow`, `home.day.title`, `home.day.lead`, `home.day.link`; geri kalan bölümler için önekler `home.garden.`, `home.features.`, `home.activities.`, `home.week.`, `home.faq.`, `home.contact.` — içerikleri Adım B'nin çıktısıyla tamamlanır. `meta.home.title` (`SITE.name`), `meta.home.description` (`SITE.description`). `pageIds.ts`: `'/': 'home'`.

- [ ] **Step 1:** Ortak yöntem Adım A (snapshot: bugünkü `Anasayfa` render edilir; `HomeView` yerine `render(await Anasayfa())`).
- [ ] **Step 2:** Adım B (kapsam testi `['home.', 'faq.', 'testimonials.', 'day.', 'media.', 'meta.home.']`); FAIL'i gör.
- [ ] **Step 3:** `PageHero` ve `Frame`'i genişlet (aşağıdaki kod), `slots/lists.ts`, `slots/media.ts`, `slots/home.ts`'i yaz, bölümleri dönüştür.

`PageHero.tsx` değişikliği (yalnızca başlık bloğu):

```tsx
import type { Reader } from '@/lib/content/types';
// imzaya: c, keys
  c?: Reader;
  keys?: { eyebrow?: string; title?: string; lead?: string };
// gövdede:
const eyebrowNode = c && keys?.eyebrow ? c.text(keys.eyebrow) : eyebrow;
const titleNode = c && keys?.title ? c.text(keys.title) : title;
const leadNode = c && keys?.lead ? c.text(keys.lead) : lead;
// …
{eyebrowNode ? <p className="timecode text-white/70" {...(c && keys?.eyebrow ? c.attrs(keys.eyebrow) : {})}>{eyebrowNode}</p> : null}
<h1 className="mt-4 font-display text-3xl text-white md:text-5xl" {...(c && keys?.title ? c.attrs(keys.title) : {})}>{titleNode}</h1>
{leadNode ? <p className="mx-auto mt-5 max-w-2xl text-base text-white/85 md:text-lg" {...(c && keys?.lead ? c.attrs(keys.lead) : {})}>{leadNode}</p> : null}
```

`title` prop'unu zorunluluktan çıkar (`title?: React.ReactNode`).

`Frame.tsx`: mevcut `mediaKey` yolunu koru; `image` verilirse `MEDIA[mediaKey]` yerine onu kullan ve dış kaba `{...editAttrs}` yay.

`HeroSection.tsx` (özet; tüm metinler aynı biçimde):

```tsx
export default function HeroSection({ c }: { c: Reader }) {
  const wide = c.image('media.gardenWide');
  const corner = c.image('media.candyCorner');
  const quote = c.list<{ id: string; quote: string; author: string; context: string; ready: boolean }>('testimonials.items')
    .find((t) => t.id === 'muge-ilkokul-olsa' && t.ready);
  // <div className="relative overflow-hidden" {...c.attrs('media.gardenWide')}> <Image src={wide.src} alt={wide.alt} … /> 
  // <Timecode><span {...c.attrs('home.hero.badge')}>{c.text('home.hero.badge')}</span></Timecode>
  // <Editable c={c} k="home.hero.title" as="h1" className="mt-4 text-3xl text-ink md:mt-5 md:text-5xl lg:text-6xl" />
  // <Editable c={c} k="home.hero.lead" as="p" className="mt-4 max-w-xl text-base text-ink-soft md:text-lg" />
  // TrackedLink çocukları: {c.text('home.hero.ctaPrimary')} — TrackedLink'e {...c.attrs(...)} geçirmek için TrackedLink'e `editAttrs` prop'u eklenir.
  // quote: <blockquote … {...c.attrs('testimonials.items', `${quote.id}.quote`)}>{quote.quote}</blockquote>
}
```

`Timecode`'un içine `span` eklemek HTML'i değiştirir. Bunun yerine `Timecode`'a `editAttrs?: Record<string,string>` prop'u ekle ve kendi kök elemanına yay; `<Timecode editAttrs={c.attrs('home.hero.badge')}>{c.text('home.hero.badge')}</Timecode>`. Aynı desen `TrackedLink` için de (`editAttrs`).

`app/(site)/page.tsx`:

```tsx
import HomeView from './HomeView';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  const c = makeReader(await getReaderData());
  return buildMetadata({ title: c.text('meta.home.title'), description: c.text('meta.home.description'), path: '/' });
}

export default async function Home() {
  return <HomeView data={await getReaderData()} />;
}
```

`HomeView` (eski `Anasayfa` gövdesi, senkron): `const c = makeReader(data)`; istemci bölümlere `pickData(data, ['home.faq.', 'faq.'])` ve `pickData(data, ['home.contact.', 'site.'])` geçir.

`app/layout.tsx`'teki kök `metadata` (`SITE.name`/`SITE.description`) varsayılan olarak kalır; sayfa `generateMetadata` onu ezer.

- [ ] **Step 4:** Adım D. `homepage.test.tsx`'teki `render(<HeroSection … />)` çağrılarını `render(<HeroSection c={makeReader(defaultData())} />)` yap; içerik güvenlik taramaları (yasaklı kelimeler, doğrulanmamış rakamlar) aynı varsayılan metinler üzerinde çalışmaya devam eder.
- [ ] **Step 5:** Commit: `feat(web): ana sayfayı düzenlenebilir yap`.

---

### Task 12: Site geneli: üst menü, alt bilgi, mobil çubuk, WhatsApp, JSON-LD

**Files:**
- Create: `apps/web/lib/content/slots/chrome.ts`, `apps/web/app/__tests__/visitor-html/chrome.test.tsx`, `apps/web/lib/__tests__/schema-from-content.test.ts`
- Modify: `apps/web/app/components/Header.tsx` (istemci), `Footer.tsx`, `MobileActionBar.tsx` (istemci), `WhatsAppButton.tsx` (istemci), `ContactInfo.tsx` (istemci), `lp/LpHeader.tsx`, `lp/LpFooter.tsx`, `apps/web/app/(site)/layout.tsx`, `apps/web/app/(lp)/layout.tsx`, `apps/web/app/layout.tsx`, `apps/web/lib/schema.ts`, `apps/web/lib/site.ts`

**Interfaces:**
- Produces: `buildPreschoolSchema(c: Reader): object` (`lib/schema.ts`; mevcut `preschoolSchema` sabiti bunun `defaultData` ile çağrısına dönüşür ve testler için korunur); `whatsappUrl(c: Reader): string`, `phoneE164(c: Reader): string` (`lib/site.ts`; `normalizeTurkishPhone(c.text('site.phone'))`, geçersizse `SITE.phone.e164`).
- Anahtarlar (`chrome.`): `chrome.nav.items` (list; alanlar `label` max 40; `href` düzenlenemez, öğe `id` = href'in slug'ı; varsayılan `NAV_ITEMS`), `chrome.footer.links` (list; `FOOTER_LINKS`, aynı kural), `chrome.footer.tagline`, `chrome.footer.rights` (`"Şeker Anaokulu. Tüm hakları saklıdır."`; yıl kodda kalır ve `data-edit-ignore` olmadan `© {year} ` ön eki rakam olduğu için kapsam testinden geçer), `chrome.mobile.call`, `chrome.mobile.whatsapp`, `chrome.mobile.book`, `chrome.whatsapp.label`, `chrome.contact.*` (ContactInfo başlıkları), `chrome.lp.header.*`, `chrome.lp.footer.*`.

Kurallar: menü bağlantılarının adresleri ve sırası koddadır (sayfa ekleme/çıkarma öğretmene açık değil); yalnızca etiketler düzenlenir — `ListPanel` bu listede ekle/sil/taşı düğmelerini göstermez: `SlotDef`'e `fixedItems: true` eklenir ve `ListPanel` bu bayrakta yalnızca alanları gösterir. `validateEdits` `fixedItems` listelerinde öğe kümesinin (id'ler ve sıra) varsayılanla aynı olmasını şart koşar; testi Task 7'nin test dosyasına ekle:

```ts
it('fixedItems listesinde öğe eklenemez/taşınamaz', () => {
  // registry mock'una: 't.fixed': { kind:'list', label:'Menü', fixedItems:true, default:[{id:'a',label:'A'},{id:'b',label:'B'}], fields:{label:{kind:'text',max:20,label:'Etiket'}} }
  expect(validateEdits(e('t.fixed', [{ id: 'b', label: 'B' }, { id: 'a', label: 'A' }])).ok).toBe(false);
  expect(validateEdits(e('t.fixed', [{ id: 'a', label: 'Yeni' }, { id: 'b', label: 'B' }])).ok).toBe(true);
});
```

`types.ts` `SlotDef` ve `SlotMeta`'ya `fixedItems?: boolean` eklenir; `validate.ts` `checkList`'e `fixedIds?: string[]` parametresi eklenir.

JSON-LD testi (`schema-from-content.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { buildPreschoolSchema } from '@/lib/schema';
import { makeReader } from '@/lib/content/reader';
import { defaultData } from '@/lib/content/testing';

describe('buildPreschoolSchema', () => {
  it('telefon ve adresi içerikten alır, yapıyı korur', () => {
    const data = defaultData();
    data.values['site.phone'] = '0532 111 22 33';
    const s = buildPreschoolSchema(makeReader(data)) as Record<string, unknown>;
    expect(s['@type']).toBe('Preschool');
    expect(s.telephone).toBe('+905321112233');
  });
});
```

`app/layout.tsx` async olur: `const c = makeReader(await getReaderData())`, `<JsonLd data={buildPreschoolSchema(c)} />`. Kök layout'ta `getReaderData()` çağrısı draft mode'u okur (`isEditing` `"use cache"` içinde) — prerender'ı bozmaz.

- [ ] **Step 1–5:** Ortak yöntem A→D (görünür HTML snapshot'ı `Header`, `Footer`, `MobileActionBar`, `LpHeader`, `LpFooter` için ayrı `it`'ler), JSON-LD testi, `fixedItems` testi. Commit: `feat(web): menü, alt bilgi ve okul bilgilerini düzenlenebilir yap`.

---

### Task 13: Hakkımızda, Eğitim yaklaşımımız, Güvenlik

**Files:**
- Create: `apps/web/lib/content/slots/hakkimizda.ts`, `egitim.ts`, `guvenlik.ts`; `HakkimizdaView.tsx`, `EgitimView.tsx`, `GuvenlikView.tsx` (ilgili `app/(site)/<yol>/` klasörlerinde); `apps/web/app/__tests__/visitor-html/{hakkimizda,egitim,guvenlik}.test.tsx`
- Modify: `app/(site)/hakkimizda/page.tsx`, `app/(site)/egitim-yaklasimimiz/page.tsx`, `app/(site)/guvenlik/page.tsx`, `app/components/AboutSection.tsx` (istemci), `app/components/TrustBar.tsx`, `lib/content/registry.ts`, `lib/content/pageIds.ts`

**Anahtar önekleri:** `hakkimizda.` (hero, `hakkimizda.values` listesi — `VALUES`'tan; alanlar `title` max 30, `description` max 200; `chip`/`path` düzenlenemez, `fixedItems: true`; `hakkimizda.facts` — `value`/`label` listesi, `fixedItems: true`, `"{yilSayisi} yıl"` belirteciyle), `about.` (`AboutSection`), `trust.` (`TrustBar`), `egitim.`, `guvenlik.`; meta `meta.hakkimizda.*`, `meta.egitim.*`, `meta.guvenlik.*`. `pageIds`: `'/hakkimizda': 'hakkimizda'`, `'/egitim-yaklasimimiz': 'egitim'`, `'/guvenlik': 'guvenlik'`.

Özel durumlar: `hakkimizda/page.tsx:13-17` meta açıklaması `${SITE.foundingYear}` içerir → varsayılan `"…{kurulusYili}'den beri…"`; `buildMetadata`'ya giden metin `c.text()` ile doldurulmuş hâlidir. `CAMPUS.buildings` gibi rakamlar `hakkimizda.facts` öğesinin `value` alanıdır (string). `LeadForm` ve `JsonLd` (breadcrumb) değişmez.

- [ ] **Step 1–4:** Ortak yöntem A→D, her sayfa için. Commit (sayfa başına bir): `feat(web): hakkimizda sayfasını düzenlenebilir yap` vb.

---

### Task 14: Yaş grupları (liste + 4 alt sayfa), Günlük akış, Branş dersleri

**Files:**
- Modify: `app/(site)/yas-gruplari/page.tsx`, `app/(site)/yas-gruplari/[slug]/page.tsx`, `app/(site)/gunluk-akis/page.tsx`, `app/(site)/aktiviteler/page.tsx`, `app/(site)/aktiviteler/BranchExplorer.tsx` (istemci), `app/components/cine/DayChapters.tsx`, `cine/TimeSpine.tsx` (istemci), `cine/Roster.tsx`, `WeekRhythmSection.tsx`, `YemekList.tsx`, `lib/content/slots/lists.ts`, `registry.ts`, `pageIds.ts`, `app/sitemap.ts`
- Create: `lib/content/slots/yasgruplari.ts`, `gunlukakis.ts`, `aktiviteler.ts`; `*View.tsx` dosyaları; `app/__tests__/visitor-html/{yasgruplari,yasgrubu,gunlukakis,aktiviteler}.test.tsx`

**Anahtarlar:** ortak listeler `ageGroups.items` (`AGE_GROUPS_CONTENT`, `id` = `slug`, `fixedItems: true` — alt sayfa URL'leri sabittir), `day.chapters` (`DAY_CHAPTERS`, `fixedItems: true` — bağlantılar `#id` kullanır), `program.branches` (`BRANCHES`, `fixedItems: true` — `getBranch(slug)` URL'leri), `program.englishTracks` (`ENGLISH_TRACKS`), `program.weekDays` (`WEEK_DAYS`); sayfa önekleri `yasgruplari.`, `yasgrubu.` (alt sayfa ortak etiketleri), `gunlukakis.`, `aktiviteler.`, `week.`, `yemek.`. Her listenin `fields`'ı, ilgili tipin string alanlarının tamamıdır (bkz. Task 11 `lists.ts` notu); alanları yazmadan önce tipleri oku: `sed -n 4,30p apps/web/content/day.ts`, `sed -n 47,64p apps/web/content/program.ts`, `sed -n 4,22p apps/web/content/ageGroups.ts`.

Özel durumlar:
- `yas-gruplari/[slug]/page.tsx`: `generateStaticParams` `AGE_GROUPS_CONTENT`'ten kalır (URL'ler sabit). Sayfa `c.list('ageGroups.items').find((g) => g.id === slug)` ile okur; bulunamazsa `notFound()`.
- `sitemap.ts` yaş grubu yollarını `AGE_GROUPS_CONTENT`'ten üretmeye devam eder (URL sabit).
- `day.ts`'teki `SCHEDULE_READY`, `ROSTER_STATUS.ready`, `ENGLISH_COVERAGE_READY` bayrakları kodda kalır (yayın kararları okul yönetiminindir).
- `TimeSpine`/`BranchExplorer` istemci bileşenleri `pickData(data, ['day.', 'gunlukakis.'])` / `pickData(data, ['program.', 'aktiviteler.', 'media.'])` alır.

- [ ] **Step 1–4:** Ortak yöntem A→D; yaş grubu alt sayfası için snapshot ve kapsam testleri 4 slug'ın her biri için `it.each`. Commit (sayfa başına).

---

### Task 15: Kayıt, İletişim, Teşekkürler, Veli yorumları, SSS, Bültenler

**Files:**
- Modify: `app/(site)/kayit/page.tsx`, `iletisim/page.tsx`, `tesekkurler/page.tsx`, `veli-yorumlari/page.tsx`, `sss/page.tsx`, `sss/SSS.tsx` (istemci), `bultenler/page.tsx`, `app/components/FAQSection.tsx`, `ContactSection.tsx`, `LeadForm.tsx` (istemci; yalnızca görünür etiketler)
- Create: `lib/content/slots/{kayit,iletisim,tesekkurler,yorumlar,sss,bultenler,form}.ts`, `*View.tsx`, `app/__tests__/visitor-html/{kayit,iletisim,tesekkurler,yorumlar,sss,bultenler}.test.tsx`

**Anahtarlar:** `kayit.`, `iletisim.`, `tesekkurler.`, `yorumlar.` (+ `testimonials.items`), `sss.` (+ `faq.items`), `bultenler.` (`bultenler.channels` listesi `CHANNELS`'tan, alanlar `title` max 40, `body` max 300, `band` düzenlenemez, `fixedItems: false` → öğretmen kanal ekleyebilir; yeni öğenin `band`'i `'band-grape'` olur — `ListPanel` yeni öğe şablonuna `SlotDef.newItem?: Record<string, unknown>` ile varsayılan verir; `types.ts`'e `newItem?` eklenir), `form.` (LeadForm etiketleri: `form.parentName.label`, `form.phone.label`, `form.kvkk.text` (rich, bağlantılı), `form.submit`, `form.success`, `form.error`).

Kurallar: `LeadForm`'un alan adları (`name`), doğrulama şeması (`lib/leadSchema.ts`), gizli `AttributionFields`, gönderim adresi ve `trackLead` olayları **değişmez**; yalnızca etiket ve yardım metinleri `form.` anahtarlarından gelir. Zod hata mesajları (`leadSchema.ts`) kodda kalır.

`bultenler` örneği tam olarak "Ortak yöntem"deki gibidir; anahtar listesi: `bultenler.hero.eyebrow` ("Veli İletişimi"), `bultenler.hero.title`, `bultenler.hero.lead`, `bultenler.channels`, `bultenler.request.title` ("Belgeyi doğrudan isteyebilirsiniz."), `bultenler.request.body`, `bultenler.request.ctaWhatsapp` ("WhatsApp'tan İsteyin"), fotoğraf `media.gardenWorkshops`, telefon `site.phone`; meta `meta.bultenler.title` ("Bültenler ve Veli İletişimi"), `meta.bultenler.description`. Duyuru bölümü Task 18'de eklenir.

- [ ] **Step 1–4:** Ortak yöntem A→D, sayfa başına. Commit (sayfa başına).

---

### Task 16: Yasal sayfalar (Gizlilik, Kullanım, Çerez)

Bu üç sayfa bugün gereksiz yere `"use client"` (etkileşim yok). Sunucu bileşenine çevrilir ve gövde zengin metin olur.

**Files:**
- Modify: `app/(site)/gizlilik/page.tsx`, `kullanim/page.tsx`, `cerez/page.tsx`
- Create: `lib/content/slots/legal.ts`, `app/(site)/LegalView.tsx`, `app/__tests__/visitor-html/legal.test.tsx`

**Anahtarlar:** `legal.<sayfa>.title` (text, max 80), `legal.<sayfa>.body` (rich, max 20000; varsayılan bugünkü `<p>` metni, ör. gizlilik için `<p>Bu sayfa şu anda hazırlanmaktadır. Gizlilik politikamız hakkında bilgi almak için bizimle iletişime geçebilirsiniz.</p>`), `legal.common.contactCta` ("İletişim"); meta `meta.gizlilik.*`, `meta.kullanim.*`, `meta.cerez.*` (bugün bu sayfaların metadata'sı yok; varsayılan başlık = sayfa başlığı, açıklama = gövdenin ilk 150 karakteri). `<sayfa>` ∈ `gizlilik`, `kullanim`, `cerez`.

**Gizlilik istisnası (Faz 1 Task 6a'ya bağlı):** Faz 1 Task 6a `/gizlilik`'i tam KVKK aydınlatma metniyle değiştirir ve metni `apps/web/content/kvkk.ts`'te yapılandırılmış veri (`KVKK_TEXT`) olarak tutar. Bu görev Faz 1 Task 6a'dan **sonra** yapılır; Faz 1 henüz bitmediyse önce o görevi tamamla. Gizlilik için:

- `legal.gizlilik.title` varsayılanı `'KVKK Aydınlatma Metni'`.
- `legal.gizlilik.body` varsayılanı yer tutucu `<p>` değil, `kvkkToHtml(KVKK_TEXT)` çıktısıdır (aşağıda). `max` 20000 yeterlidir (metin ~6.500 karakter).
- `legal.gizlilik.updatedOn` (text, max 40, varsayılan `KVKK_TEXT.updatedOn`) başlığın altında "Son güncelleme: …" satırında gösterilir.
- Gizlilik sayfasında `legal.common.contactCta` düğmesi gösterilmez (metin iletişim yollarını zaten içerir).
- `KVKK_CONSENT_LABEL` (formdaki onay cümlesi) **slot yapılmaz, kodda kalır**: Google'a gönderilen `CONSENT_GRANTED` beyanının dayanağıdır; öğretmenin değiştirebileceği bir metin olmamalı. Task 14'teki `form.` anahtarları bu cümleyi kapsamaz.

`apps/web/lib/content/slots/legal.ts` içine:

```ts
import { KVKK_TEXT } from '@/content/kvkk';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function kvkkToHtml(text: typeof KVKK_TEXT): string {
  return text.sections
    .map((sec) =>
      [
        `<h2>${esc(sec.title)}</h2>`,
        ...sec.paragraphs.map((para) => `<p>${esc(para)}</p>`),
        sec.items ? `<ul>${sec.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '',
      ].join(''),
    )
    .join('');
}
```

Rich metin temizleme izin listesine (Task 8) `h2` eklenir; yalnızca `legal.*` anahtarlarında kabul edilir (`SLOTS[key].allowHeadings: true`). `legal.test.tsx`'e şu test eklenir:

```tsx
it('gizlilik varsayılanı tam KVKK metnidir, yer tutucu değil', () => {
  const html = kvkkToHtml(KVKK_TEXT);
  expect(html).not.toContain('hazırlanmaktadır');
  expect(html).toContain('<h2>KVKK md. 11 kapsamındaki haklarınız</h2>');
  expect(html).toContain('Google');
});
```

Gizlilik sayfasının snapshot'ı Faz 1 Task 6a'daki çıktıya göre alınır; `<h1>` + "Son güncelleme" satırı + bölümler yapısı korunur, yalnızca bölümler tek bir zengin metin kabına girer.

`LegalView`:

```tsx
import { Editable, EditableRich } from '@/app/components/edit/Editable';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

export default function LegalView({ data, page }: { data: ReaderData; page: 'gizlilik' | 'kullanim' | 'cerez' }) {
  const c = makeReader(data);
  return (
    <div className="min-h-screen bg-paper">
      <div className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <Editable c={c} k={`legal.${page}.title`} as="h1" className="mb-8 font-display text-3xl text-ink md:text-4xl" />
            <div className="prose prose-lg">
              <EditableRich c={c} k={`legal.${page}.body`} className="mb-6 text-ink-soft" />
              <a href="/iletisim" className="inline-block rounded-full bg-grape px-6 py-3 font-semibold text-white shadow-lg shadow-grape/30 transition-colors duration-200 hover:bg-ink" {...c.attrs('legal.common.contactCta')}>
                {c.text('legal.common.contactCta')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Snapshot farkı: bugünkü gövde `<p className="mb-6 text-ink-soft">…</p>`; yeni yapı `<div class="mb-6 text-ink-soft"><p>…</p></div>`. Bu, ortak yöntemdeki "fark yok" kuralının **tek** bilinçli istisnasıdır (zengin metin kabı gerekir); snapshot bu görevde `-u` ile yeniden üretilir ve commit mesajında belirtilir.

Uyarı: Yasal metinlerde değişiklik hukuki sonuç doğurur. `legal.*` anahtarlarına `warn: 'Yasal metin: değişiklikten önce yöneticiye danışın.'` konur; `EditBar` çift tıklamada `data.meta[key].warn` varsa düzenleyiciyi açmadan önce bu uyarıyı bildirim olarak gösterir.

- [ ] **Step 1–4:** Ortak yöntem A→D. Commit: `feat(web): yasal sayfaları düzenlenebilir yap`.

---

### Task 17: Reklam sayfaları (5 LP)

**Files:**
- Create: `apps/web/lib/content/slots/lp.ts`, `apps/web/app/(lp)/lp/[slug]/LandingView.tsx`, `apps/web/app/__tests__/visitor-html/lp.test.tsx`
- Modify: `apps/web/app/(lp)/lp/[slug]/page.tsx`, `apps/web/app/components/lp/ProofStrip.tsx`, `apps/web/app/__tests__/adTargets.test.ts`, `apps/web/lib/content/registry.ts`

**Anahtarlar** (`slots/lp.ts`, `LANDING_PAGES`'ten programla üretilir; `<s>` ∈ `beykent-anaokulu`, `beylikduzu-anaokulu`, `az-mevcutlu-anaokulu`, `kres-2-yas`, `anaokulu-ucret`):

```ts
import { LANDING_PAGES } from '@/content/landingPages';
import { MEDIA } from '@/content/media';
import type { SlotDef } from '../types';

const H1_WARN = 'Bu başlık Google Ads reklamının başlığıyla aynı anlamda olmalı. Değiştirirseniz reklamı da kontrol edin.';

export const LP_SLOTS: Record<string, SlotDef> = {
  'lp.common.ctaPrimary': { kind: 'text', max: 40, default: 'Ön Görüşme Randevusu', label: 'Reklam sayfası ana düğme' },
  'lp.common.ctaWhatsapp': { kind: 'text', max: 40, default: "WhatsApp'tan Yazın", label: 'Reklam sayfası WhatsApp düğmesi' },
  'lp.common.faqTitle': { kind: 'text', max: 60, default: 'Sıkça Sorulanlar', label: 'Reklam sayfası SSS başlığı' },
  'lp.common.visitTitle': { kind: 'text', max: 80, default: 'Okulu gezin, sonra karar verin', label: 'Reklam sayfası kapanış başlığı' },
  'lp.common.mapsCta': { kind: 'text', max: 30, default: 'Haritada Gör', label: 'Harita düğmesi' },
  ...Object.fromEntries(
    LANDING_PAGES.flatMap((p) => {
      const k = (f: string) => `lp.${p.slug}.${f}`;
      const m = MEDIA[p.mediaKey];
      return [
        [k('metaTitle'), { kind: 'text', max: 70, default: p.metaTitle, label: `${p.slug}: Google başlığı` }],
        [k('metaDescription'), { kind: 'text', max: 160, default: p.metaDescription, label: `${p.slug}: Google açıklaması` }],
        [k('h1'), { kind: 'text', max: 90, default: p.h1, label: `${p.slug}: ana başlık`, warn: H1_WARN }],
        [k('subhead'), { kind: 'text', max: 300, default: p.subhead, label: `${p.slug}: alt başlık` }],
        [k('formHeading'), { kind: 'text', max: 80, default: p.formHeading, label: `${p.slug}: form başlığı` }],
        [k('formIntro'), { kind: 'text', max: 200, default: p.formIntro, label: `${p.slug}: form açıklaması` }],
        [k('media'), { kind: 'image', label: `${p.slug}: fotoğraf`, default: { src: m.src, alt: m.alt, width: m.width, height: m.height, assetId: null } }],
        [k('proofPoints'), {
          kind: 'list', label: `${p.slug}: rakamlar şeridi`, maxItems: 4,
          default: p.proofPoints.map((x, i) => ({ id: `p${i + 1}`, ...x })),
          fields: { value: { kind: 'text', max: 14, label: 'Rakam' }, label: { kind: 'text', max: 40, label: 'Açıklama' } },
        }],
        [k('bodyBlocks'), {
          kind: 'list', label: `${p.slug}: içerik blokları`, maxItems: 8,
          default: p.bodyBlocks.map((x, i) => ({ id: `b${i + 1}`, ...x })),
          fields: { heading: { kind: 'text', max: 90, label: 'Başlık' }, text: { kind: 'text', max: 700, label: 'Metin' } },
        }],
        [k('faq'), {
          kind: 'list', label: `${p.slug}: sorular`, maxItems: 10,
          default: p.faq.map((x, i) => ({ id: `f${i + 1}`, ...x })),
          fields: { question: { kind: 'text', max: 140, label: 'Soru' }, answer: { kind: 'text', max: 600, label: 'Cevap' } },
        }],
      ] as [string, SlotDef][];
    }),
  ),
};
```

`page.tsx`:

```tsx
export function generateStaticParams() {
  return LANDING_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getLandingPage(slug)) return {};
  const c = makeReader(await getReaderData());
  return buildMetadata({ title: c.text(`lp.${slug}.metaTitle`), description: c.text(`lp.${slug}.metaDescription`), path: `/lp/${slug}`, noindex: true });
}

export default async function LandingPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getLandingPage(slug)) notFound();
  return <LandingView slug={slug} data={await getReaderData()} />;
}
```

`LandingView` bugünkü JSX'i korur; değişen satırlar: `page.h1` → `<Editable c={c} k={`lp.${slug}.h1`} as="h1" className="text-4xl text-ink md:text-5xl" />`, `bodyBlocks.map` → `c.list(`lp.${slug}.bodyBlocks`).map((b) => …<Editable … path={`${b.id}.heading`} value={b.heading} as="h2" …/>)` ve kap `section`'a `{...c.listAttrs(`lp.${slug}.bodyBlocks`)}`, FAQ JSON-LD `buildFaqSchema` içerikten (`c.list(...faq)`) üretilir — **yapısı aynı kalır**. Form bölümü (`id="form"`, `LeadForm`), `WHATSAPP_URL` (artık `whatsappUrl(c)`), `tel:` bağlantısı (`phoneE164(c)`), `noindex` değişmez. `ProofStrip` `key={point.label}` → `key={point.id}`, `dt`/`dd`'ye `editAttrs` (prop: `c: Reader; listKey: string`).

`adTargets.test.ts`: LP başlığı ↔ kampanya eşleşmesini test eden mevcut kontroller `LANDING_PAGES` (varsayılanlar) üzerinde çalışmaya devam eder; ek olarak:

```ts
it('her LP h1 alanı reklam uyarısı taşır', () => {
  for (const slug of LANDING_SLUGS) expect(SLOTS[`lp.${slug}.h1`].warn).toMatch(/Google Ads/);
});
```

- [ ] **Step 1–4:** Ortak yöntem A→D, 5 slug için `it.each` (snapshot + kapsam). Ayrıca: `pnpm --filter @seker/web build` sonrası `pnpm --filter @seker/web start` ve `curl -s localhost:3000/lp/beykent-anaokulu | grep -c 'name="gclid"'` → `1` (gizli alan duruyor), `grep -c 'noindex'` ≥ 1. Commit: `feat(web): reklam sayfalarını düzenlenebilir yap`.

---

### Task 18: Duyurular

**Files:**
- Create: `apps/web/app/actions/announcements.ts`, `apps/web/app/components/AnnouncementsSection.tsx`, `apps/web/app/components/edit/AnnouncementDialog.tsx`
- Create: `apps/web/app/actions/__tests__/announcements.test.ts`, `apps/web/app/components/__tests__/AnnouncementsSection.test.tsx`
- Modify: `apps/web/lib/content/getContent.ts` (`getAnnouncements`), `apps/web/app/(site)/bultenler/page.tsx`, `BultenlerView.tsx`, `apps/web/app/components/edit/EditBar.tsx`, `apps/web/lib/content/slots/bultenler.ts`

**Interfaces:**
- Produces:

```ts
// getContent.ts
export type PublicAnnouncement = { id: string; title: string; body: string; imageSrc: string | null; imageAlt: string | null; startsOn: string; endsOn: string | null };
export async function getAnnouncements(): Promise<PublicAnnouncement[]>; // "use cache", cacheTag('site-content'), cacheLife('hours')
// actions/announcements.ts
export type AnnouncementInput = { title: string; body: string; imageId: string | null; startsOn: string; endsOn: string | null; published: boolean };
export type AnnouncementRow = AnnouncementInput & { id: string; sort: number; updatedAt: string };
export async function createAnnouncement(input: AnnouncementInput): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<{ ok: true } | { ok: false; error: string }>;
export async function deleteAnnouncement(id: string): Promise<{ ok: true } | { ok: false; error: string }>;
export async function moveAnnouncement(id: string, direction: -1 | 1): Promise<{ ok: true } | { ok: false; error: string }>;
```

Doğrulama (zod): `title` trim 1–120 grafem; `body` → `sanitizeRich`, düz metni 1–5000; `startsOn`/`endsOn` `YYYY-MM-DD`, `endsOn ≥ startsOn`; `imageId` uuid veya null. Her action: `getEditor()` yoksa oturum mesajı; başarıda `updateTag('site-content')`. Liste sırası `sort` artan; yeni duyuru en üste (`sort = min(sort) - 1`). Bitiş tarihi geçen duyuru view (`active_announcements`) sayesinde ziyaretçiden kalkar; önbellek `'hours'` olduğundan en geç bir saat içinde. Anahtarlar: `bultenler.announcements.title` ("Duyurular"), `bultenler.announcements.empty` (düzenleme modunda boş liste için "Henüz duyuru yok. Çubuktaki ‘Yeni duyuru’ ile ekleyin."; ziyaretçide bölüm hiç render edilmez).

- [ ] **Step 1: Failing testler**

`apps/web/app/actions/__tests__/announcements.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateTag = vi.fn();
vi.mock('next/cache', () => ({ updateTag }));
const getEditor = vi.fn();
const insert = vi.fn();
const minSort = vi.fn();
vi.mock('@seker/auth/editor', () => ({ getEditor: () => getEditor() }));
vi.mock('@seker/auth/server', () => ({
  createServerSupabase: async () => ({
    from: () => ({
      select: () => ({ order: () => ({ limit: () => ({ maybeSingle: minSort }) }) }),
      insert: (row: unknown) => ({ select: () => ({ single: () => insert(row) }) }),
    }),
  }),
}));

import { createAnnouncement } from '../announcements';

const valid = { title: 'Kermes', body: '<p>Cumartesi <b>10:00</b></p><script>x</script>', imageId: null, startsOn: '2026-10-20', endsOn: '2026-10-25', published: true };

beforeEach(() => {
  updateTag.mockReset();
  insert.mockReset();
  getEditor.mockReset();
  minSort.mockResolvedValue({ data: { sort: 0 }, error: null });
});

describe('createAnnouncement', () => {
  it('oturumsuz reddeder', async () => {
    getEditor.mockResolvedValue(null);
    expect((await createAnnouncement(valid)).ok).toBe(false);
  });
  it('bitiş başlangıçtan önceyse reddeder', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    expect(await createAnnouncement({ ...valid, endsOn: '2026-10-19' })).toEqual({ ok: false, error: 'Bitiş tarihi başlangıçtan önce olamaz.' });
  });
  it('gövdeyi temizler, en üste ekler, yayınlar', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    insert.mockResolvedValue({ data: { id: 'a1' }, error: null });
    const r = await createAnnouncement(valid);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ body: '<p>Cumartesi <b>10:00</b></p>', sort: -1, updated_by: 'u' }));
    expect(updateTag).toHaveBeenCalledWith('site-content');
    expect(r).toEqual({ ok: true, id: 'a1' });
  });
});
```

`apps/web/app/components/__tests__/AnnouncementsSection.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AnnouncementsSection from '../AnnouncementsSection';
import { makeReader } from '@/lib/content/reader';
import { defaultData } from '@/lib/content/testing';

describe('AnnouncementsSection', () => {
  it('ziyaretçide boşsa hiçbir şey basmaz', () => {
    const { container } = render(<AnnouncementsSection c={makeReader(defaultData(['bultenler.']))} items={[]} />);
    expect(container.innerHTML).toBe('');
  });
  it('düzenlemede boşsa yönlendirme metni', () => {
    const { container } = render(<AnnouncementsSection c={makeReader({ ...defaultData(['bultenler.']), editing: true })} items={[]} />);
    expect(container.textContent).toContain('Yeni duyuru');
  });
  it('duyuruyu başlık ve temiz gövdeyle basar, kartı düzenleme için işaretler', () => {
    const { container } = render(
      <AnnouncementsSection
        c={makeReader({ ...defaultData(['bultenler.']), editing: true })}
        items={[{ id: 'a1', title: 'Kermes', body: '<p>Cumartesi</p>', imageSrc: null, imageAlt: null, startsOn: '2026-10-20', endsOn: null }]}
      />,
    );
    expect(container.querySelector('[data-edit-announcement="a1"] h3')!.textContent).toBe('Kermes');
  });
});
```

Run: `pnpm --filter @seker/web exec vitest run app/actions/__tests__/announcements.test.ts app/components/__tests__/AnnouncementsSection.test.tsx`
Expected: FAIL — modüller yok.

- [ ] **Step 2: Uygula**

`getContent.ts`'e:

```ts
export type PublicAnnouncement = {
  id: string; title: string; body: string; imageSrc: string | null; imageAlt: string | null; startsOn: string; endsOn: string | null;
};

export async function getAnnouncements(): Promise<PublicAnnouncement[]> {
  'use cache';
  cacheTag('site-content');
  try {
    const { data, error } = await createPublicSupabase()
      .from('active_announcements')
      .select('id, title, body, starts_on, ends_on, sort, media_assets(s3_key, alt)')
      .order('sort');
    if (error || !data) throw new Error(error?.message ?? 'veri yok');
    cacheLife('hours');
    return data.map((r) => {
      const m = r.media_assets as { s3_key: string; alt: string } | null;
      return {
        id: r.id, title: r.title, body: r.body, startsOn: r.starts_on, endsOn: r.ends_on,
        imageSrc: m ? `${process.env.NEXT_PUBLIC_MEDIA_BASE_URL}/${m.s3_key}` : null, imageAlt: m?.alt ?? null,
      };
    });
  } catch (err) {
    console.error('[content] duyurular okunamadı', err);
    cacheLife('minutes');
    return [];
  }
}
```

(`active_announcements` view'unda `image_id` FK'si yoksa PostgREST ilişkiyi bulamaz; bu durumda migration'a `comment on column public.active_announcements.image_id is E'@foreignKey (image_id) references public.media_assets (id)'` eklenmez — PostgREST view ilişkilerini kaynak tablodan çıkarır. Çıkaramazsa `select('id, title, body, starts_on, ends_on, sort, image_id')` + ikinci sorgu `media_assets.in('id', ids)` ile birleştir; Step 4 testi hangisinin gerektiğini gösterir.)

`actions/announcements.ts`:

```ts
'use server';

import { updateTag } from 'next/cache';
import { z } from 'zod';
import { createServerSupabase } from '@seker/auth/server';
import { getEditor } from '@seker/auth/editor';
import { sanitizeRich, richToText } from '@/lib/content/sanitize';
import { countChars } from '@/lib/content/chars';

export type AnnouncementInput = { title: string; body: string; imageId: string | null; startsOn: string; endsOn: string | null; published: boolean };
export type AnnouncementRow = AnnouncementInput & { id: string; sort: number; updatedAt: string };
type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const SESSION = 'Oturumunuz sona erdi. Panelden tekrar giriş yapın.';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z.object({
  title: z.string().trim().min(1).refine((s) => countChars(s) <= 120, 'Başlık en fazla 120 karakter olabilir.'),
  body: z.string(),
  imageId: z.string().uuid().nullable(),
  startsOn: date,
  endsOn: date.nullable(),
  published: z.boolean(),
});

function clean(input: AnnouncementInput): R<{ row: Record<string, unknown> }> {
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Bilgiler eksik.' };
  if (p.data.endsOn && p.data.endsOn < p.data.startsOn) return { ok: false, error: 'Bitiş tarihi başlangıçtan önce olamaz.' };
  const body = sanitizeRich(p.data.body);
  const n = countChars(richToText(body));
  if (!n) return { ok: false, error: 'Duyuru metni boş olamaz.' };
  if (n > 5000) return { ok: false, error: 'Duyuru metni en fazla 5000 karakter olabilir.' };
  return {
    ok: true,
    row: { title: p.data.title, body, image_id: p.data.imageId, starts_on: p.data.startsOn, ends_on: p.data.endsOn, published: p.data.published },
  };
}

export async function createAnnouncement(input: AnnouncementInput): Promise<R<{ id: string }>> {
  const editor = await getEditor();
  if (!editor) return { ok: false, error: SESSION };
  const c = clean(input);
  if (!c.ok) return c;
  const supabase = await createServerSupabase();
  const { data: top } = await supabase.from('announcements').select('sort').order('sort').limit(1).maybeSingle();
  const { data, error } = await supabase
    .from('announcements')
    .insert({ ...c.row, sort: (top?.sort ?? 0) - 1, updated_by: editor.id })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: 'Duyuru kaydedilemedi.' };
  updateTag('site-content');
  return { ok: true, id: data.id };
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<R> {
  const editor = await getEditor();
  if (!editor) return { ok: false, error: SESSION };
  const c = clean(input);
  if (!c.ok) return c;
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('announcements')
    .update({ ...c.row, updated_by: editor.id, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: 'Duyuru kaydedilemedi.' };
  updateTag('site-content');
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<R> {
  if (!(await getEditor())) return { ok: false, error: SESSION };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) return { ok: false, error: 'Duyuru silinemedi.' };
  updateTag('site-content');
  return { ok: true };
}

export async function moveAnnouncement(id: string, direction: -1 | 1): Promise<R> {
  if (!(await getEditor())) return { ok: false, error: SESSION };
  const supabase = await createServerSupabase();
  const { data: rows } = await supabase.from('announcements').select('id, sort').order('sort');
  const list = rows ?? [];
  const i = list.findIndex((r) => r.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  await supabase.from('announcements').update({ sort: list[j].sort }).eq('id', list[i].id);
  await supabase.from('announcements').update({ sort: list[i].sort }).eq('id', list[j].id);
  updateTag('site-content');
  return { ok: true };
}
```

`AnnouncementsSection.tsx` (bültenler hero'sunun hemen altına):

```tsx
import Image from 'next/image';
import type { PublicAnnouncement } from '@/lib/content/getContent';
import type { Reader } from '@/lib/content/types';

export default function AnnouncementsSection({ c, items }: { c: Reader; items: PublicAnnouncement[] }) {
  if (!items.length && !c.editing) return null;
  return (
    <section className="py-12">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-2xl text-ink md:text-3xl" {...c.attrs('bultenler.announcements.title')}>{c.text('bultenler.announcements.title')}</h2>
        {!items.length ? (
          <p className="mt-4 text-ink-soft" {...c.attrs('bultenler.announcements.empty')}>{c.text('bultenler.announcements.empty')}</p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {items.map((a) => (
              <article key={a.id} className="card-lift overflow-hidden rounded-3xl bg-white shadow-sm" {...(c.editing ? { 'data-edit-announcement': a.id } : {})}>
                {a.imageSrc ? (
                  <div className="relative aspect-[16/9]">
                    <Image src={a.imageSrc} alt={a.imageAlt ?? ''} fill sizes="(max-width: 768px) 100vw, 560px" className="object-cover" />
                  </div>
                ) : null}
                <div className="p-5">
                  <h3 className="font-display text-xl text-ink">{a.title}</h3>
                  <div className="prose mt-2 text-sm text-ink-soft" dangerouslySetInnerHTML={{ __html: a.body }} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

`bultenler/page.tsx`: `const [data, announcements] = await Promise.all([getReaderData(), getAnnouncements()]);` → `<BultenlerView data={data} announcements={announcements} />`; `BultenlerView` hero'dan sonra `<AnnouncementsSection c={c} items={announcements} />`.

`AnnouncementDialog.tsx`: `Drawer` içinde başlık (`input`), gövde (Task 9'daki Tiptap kurulumunun aynısı, `RichEditor`'dan `useRichEditor(initial)` hook'u olarak çıkarılıp paylaşılır), fotoğraf (Task 10'daki `UploadDialog` → dönen `assetId`), başlangıç/bitiş (`input type="date"`), "Yayında" onay kutusu, "Kaydet" (`createAnnouncement`/`updateAnnouncement`), "Sil" (iki adımlı onay, `deleteAnnouncement`), "Yukarı/Aşağı" (`moveAnnouncement`), sol tarafta taslaklar dahil tüm duyuruların listesi (`EditBar`'a gelen `announcements` prop'u). Başarıda `window.location.reload()`. `EditBar`: `[data-edit-announcement]` üzerinde çift tık → o duyuru ile diyalog; çubukta yalnızca `/bultenler` yolundayken "Yeni duyuru" düğmesi.

- [ ] **Step 3: Testleri koştur**

Run: `pnpm --filter @seker/web exec vitest run app/actions app/components`
Expected: PASS.

- [ ] **Step 4: Gerçek veritabanıyla doğrula**

Run: `pnpm --filter @seker/db exec supabase start && pnpm --filter @seker/web dev`; panel üzerinden editörle bir duyuru ekle (fotoğraflı), yayınla; düzenleme modundan çık; `/bultenler`'de ziyaretçi olarak duyuruyu ve fotoğrafı gör. Fotoğraf görünmüyorsa Step 2'deki ikinci-sorgu yolunu uygula.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): duyurular (ekle, yayınla, bitiş tarihi, sırala)"
```

---

### Task 19: Regresyon, yayına alma, öğretmen kılavuzu

**Files:**
- Create: `apps/web/app/__tests__/editing-seo.test.ts`, `docs/ogretmen-kilavuzu.md`, `docs/superpowers/plans/faz2-canli-kontrol.md`
- Modify: `apps/web/app/__tests__/sitemap.test.ts`, `apps/web/app/__tests__/routes.test.ts`, `infra/docker-compose.yml`, `infra/env.example`, `infra/Dockerfile.web`, `.github/workflows/deploy.yml`

- [ ] **Step 1: SEO/rota regresyon testleri**

`apps/web/app/__tests__/editing-seo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import sitemap from '../sitemap';
import robots from '../robots';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('düzenleme katmanı SEO ve paket sınırları', () => {
  it('sitemap düzenleme uçlarını içermez ve 21 URL üretir', async () => {
    const urls = (await sitemap()).map((u) => u.url);
    expect(urls.some((u) => u.includes('/api/'))).toBe(false);
    expect(urls).toHaveLength(21); // 17 rota + 4 yaş grubu alt sayfası; Faz 2 öncesiyle aynı
  });
  it('robots /api/ taramasını kapatır', () => {
    expect((robots().rules as { disallow: string[] }).disallow).toContain('/api/');
  });
  it('ziyaretçi bileşenleri Tiptap veya EditBar import etmez', () => {
    const files = walk(path.join(process.cwd(), 'app')).filter(
      (f) => /\.(tsx?|mts)$/.test(f) && !f.includes(`${path.sep}edit${path.sep}`) && !f.includes('__tests__'),
    );
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/@tiptap|components\/edit\/EditBar/);
    }
  });
  it('istemci bileşenleri registry import etmez (paket şişmesin)', () => {
    const files = walk(path.join(process.cwd(), 'app')).filter((f) => /\.tsx$/.test(f) && !f.includes('__tests__'));
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (/^['"]use client['"]/.test(src.trimStart())) expect(src, f).not.toMatch(/lib\/content\/(registry|server|getContent)/);
    }
  });
});
```

(Sitemap'in bugünkü URL sayısını önce `pnpm --filter @seker/web exec vitest run app/__tests__/sitemap.test.ts` çıktısından veya `ROUTES.length + AGE_GROUPS_CONTENT.length` ile doğrula; 21 değilse testteki sayıyı o değerle değiştir — amaç sayının Faz 2 ile **değişmemesi**.)

Run: `pnpm --filter @seker/web exec vitest run` → PASS (tüm paket).

- [ ] **Step 2: Ziyaretçi JS'inde düzenleme kodu yok (build çıktısı)**

Run:
```bash
pnpm --filter @seker/web build && pnpm --filter @seker/web start &
sleep 5
for p in / /bultenler /lp/beykent-anaokulu; do
  curl -s "http://localhost:3000$p" | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u | while read c; do curl -s "http://localhost:3000$c"; done | grep -c -i 'tiptap\|seker-editbar'
done
```
Expected: üç satır da `0`.

- [ ] **Step 3: Öğretmen kılavuzu**

`docs/ogretmen-kilavuzu.md` — tek sayfa, Türkçe, ekran görüntüsü yer tutucusu yok (görüntüler eğitim oturumunda gerçek ekrandan alınıp `docs/kilavuz-gorseller/` altına konur ve dosyaya eklenir). Bölümler ve tam metin:

```markdown
# Siteyi düzenleme kılavuzu

## Başlamak
1. panel.sekeranaokulu.com'a girin.
2. Sol menüde **Siteyi düzenle**'ye basın. Site açılır, üstte mor bir çubuk görünür. Bu çubuğu yalnızca siz görürsünüz.

## Yazı değiştirmek
1. Değiştirmek istediğiniz yazının üzerine gelin; etrafında kesikli bir çerçeve çıkar.
2. **Çift tıklayın**, yazın. Altta kaç karakter kullandığınızı gösteren sayaç çıkar (ör. 34 / 120). Sayaç kırmızıysa yazı kutudan taşar; kısaltın.
3. Bitirince **Enter**'a basın ya da boş bir yere tıklayın. Vazgeçmek için **Esc**.
4. Üstteki **Kaydet**'e basın. "Yayında" yazısı çıktığında veliler yeni hâlini görür.

## Kalın yazı, liste, bağlantı (duyurular, yasal metinler)
Çift tıklayınca sağda bir düzenleyici açılır. Kalın, italik, madde işaretli liste ve bağlantı ekleyebilirsiniz. Word'den yapıştırdığınız yazının yazı tipi ve renkleri silinir; bu bilinçlidir.

## Listeler (sorular, yorumlar, kanallar)
Çubuktaki **Listeler…** menüsünden listeyi seçin. Madde ekleyebilir, silebilir, ↑ ↓ ile sırasını değiştirebilirsiniz. Menü ve yaş grupları gibi bazı listelerin maddeleri sabittir; yalnızca yazıları değişir.

## Fotoğraf değiştirmek
1. Fotoğrafa çift tıklayın.
2. Yeni fotoğrafı seçin, kısa bir açıklama yazın ("Bahçede su oyunu" gibi).
3. **Çocuk yüzü** sorusunu mutlaka cevaplayın. Yüz varsa ve bulanıklaştırılmadıysa, velinin yazılı izni olmadan yüklemeyin.
4. **Yükle**, sonra **Kaydet**.
Not: Aynı fotoğraf sitede birden çok yerde kullanılıyorsa hepsinde değişir. iPhone fotoğrafı yüklenmiyorsa: Ayarlar › Kamera › Biçimler › En Uyumlu.

## Duyurular
Bültenler sayfasında çubuktaki **Yeni duyuru**'ya basın. Başlık, metin, istersen fotoğraf, başlangıç ve bitiş tarihi girin; **Yayında** kutusunu işaretleyip kaydedin. Bitiş tarihi geçen duyuru kendiliğinden kalkar.

## Sayfa ayarları ve okul bilgileri
Çubuktaki **Sayfa ayarları**: Google'da görünen sayfa başlığı/açıklaması, telefon, adres, çalışma saatleri, kuruluş yılı. Telefonu burada değiştirince sitedeki tüm "Ara" düğmeleri ve WhatsApp bağlantısı da değişir.
Metinlerde `{yilSayisi}` görürseniz silmeyin: sitede otomatik olarak "15" gibi okulun yaşına dönüşür.

## Reklam sayfaları
/lp/ ile başlayan sayfalar Google reklamlarının açtığı sayfalardır. Ana başlığı değiştirirseniz Google Ads'teki reklam başlığıyla anlamının aynı kaldığından emin olun; çubuk sizi uyarır. Formlar ve ölçüm kodları değiştirilemez.

## Yanlış bir şey yaptıysam
- Henüz kaydetmediyseniz: **Vazgeç**.
- Kaydettiyseniz: **Geçmiş** › ilgili değişiklik › **Bu değişikliği geri al**.
- "Bu metin siz düzenlerken değişti" uyarısı: biri (veya başka bir sekmeniz) aynı yazıyı değiştirmiş. Sayfayı yenileyin, son hâline bakıp tekrar düzenleyin.
- "Oturumunuz sona erdi": değişiklikleriniz bu tarayıcıda saklı. Panelden tekrar giriş yapın, **Siteyi düzenle**'ye basın; bekleyen değişiklikler geri gelir, **Kaydet**'e basın.

## Bitirmek
Çubuktaki **Çık**. Kaydedilmemiş değişiklik varken çıkış kapalıdır.
```

- [ ] **Step 4: Canlı kontrol listesi**

`docs/superpowers/plans/faz2-canli-kontrol.md`:

```markdown
# Faz 2 canlıya alma kontrol listesi

- [ ] Yerel tam test: `pnpm -r test` PASS, `pnpm --filter @seker/web build` PASS
- [ ] Canlı Supabase'e migration (elle onaylı): `pnpm --filter @seker/db exec supabase db push` → `0007_site_content` uygulandı
- [ ] S3 bucket policy (`site-images/*` herkese okuma) ve `seker-web-media` IAM izni uygulandı
- [ ] Sunucu `/opt/seker/.env`: `S3_BUCKET`, `S3_REGION`, `MEDIA_AWS_ACCESS_KEY_ID`, `MEDIA_AWS_SECRET_ACCESS_KEY` (compose bunları web'e `AWS_*` olarak geçirir; cron'un `AWS_*` yedek anahtarlarıyla karışmaz). `NEXT_PUBLIC_MEDIA_BASE_URL` ve `NEXT_PUBLIC_PANEL_URL` derleme zamanı değerleridir: GitHub → Settings → Variables'a eklendi (sunucu `.env`'inde etkisiz)
- [ ] Deploy sonrası ziyaretçi: `/`, `/bultenler`, `/lp/beykent-anaokulu` 200, HTML'de `data-edit-` yok: `curl -s https://sekeranaokulu.com/ | grep -c data-edit-` → 0
- [ ] Yönetici panelde editöre yetki verdi; editör "Siteyi düzenle" ile çubuğu gördü
- [ ] Ana sayfa başlığı değiştirildi → Kaydet → gizli pencerede (ziyaretçi) 5 sn içinde yeni başlık
- [ ] Geçmiş › Geri al → gizli pencerede eski başlık
- [ ] Telefon fotoğrafı (≥ 5 MB) yüklendi; S3'te `site-images/YYYY/MM/*.webp`, `exiftool` ile GPS yok
- [ ] İki sekmede aynı metin: ikinci kayıtta çakışma uyarısı
- [ ] Supabase kapalı simülasyonu (staging'de `NEXT_PUBLIC_SUPABASE_URL` geçici olarak yanlış): site varsayılan metinlerle açılıyor, hata sayfası yok; düzeltilince ≤ 1 dk içinde gerçek içerik
- [ ] Lighthouse mobil `/lp/beykent-anaokulu`: performans skoru Faz 2 öncesine göre ≥ −2 puan
- [ ] Editörle 45 dk eğitim: kılavuzdaki her başlık gerçek ekranda yapıldı; ekran görüntüleri `docs/kilavuz-gorseller/`'e eklendi
- [ ] İlk iki hafta: haftada bir `content_revisions` gözden geçirildi, sorunlar kılavuza eklendi
```

- [ ] **Step 4b: Altyapı: web ortamı ve derleme argümanları**

`infra/docker-compose.yml` → `web` servisinin `environment:` bölümüne ekle:
```yaml
      AWS_ACCESS_KEY_ID: ${MEDIA_AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${MEDIA_AWS_SECRET_ACCESS_KEY}
      S3_BUCKET: ${S3_BUCKET}
      S3_REGION: ${S3_REGION}
      AWS_REGION: ${S3_REGION}
```
`infra/env.example`'a `S3_BUCKET`, `S3_REGION`, `MEDIA_AWS_ACCESS_KEY_ID`, `MEDIA_AWS_SECRET_ACCESS_KEY` satırlarını ekle.

`infra/Dockerfile.web` builder aşamasında `NEXT_PUBLIC_GTM_ID` bloğunun yanına:
```dockerfile
ARG NEXT_PUBLIC_PANEL_URL
ARG NEXT_PUBLIC_MEDIA_BASE_URL
ENV NEXT_PUBLIC_PANEL_URL=$NEXT_PUBLIC_PANEL_URL \
    NEXT_PUBLIC_MEDIA_BASE_URL=$NEXT_PUBLIC_MEDIA_BASE_URL
```
`.github/workflows/deploy.yml` → `build-args:` listesine ekle:
```yaml
            NEXT_PUBLIC_PANEL_URL=${{ vars.NEXT_PUBLIC_PANEL_URL }}
            NEXT_PUBLIC_MEDIA_BASE_URL=${{ vars.NEXT_PUBLIC_MEDIA_BASE_URL }}
```
Panel imajı bu argümanları kullanmaz; aynı `build-args` iki uygulama için ortak olduğundan Dockerfile.panel'de tanımsız ARG uyarısı çıkabilir, zararsızdır.

- [ ] **Step 5: Commit**

```bash
git add apps/web docs infra .github/workflows/deploy.yml
git commit -m "docs: öğretmen kılavuzu, Faz 2 canlı kontrol listesi ve regresyon testleri"
```

---

## Sözleşme notları (indeks dosyasına işlenmesi gereken eklemeler)

Bu plan indeks sözleşmesini değiştirmez, ama şu **eklemeleri** yapar; uygulamadan önce indeks güncellenmelidir:

1. `SlotDef` ek alanları: `label` (zorunlu), `pattern?`, `fields?` (`FieldDef` türleri `text | rich | image | flag`), `maxItems?`, `fixedItems?`, `newItem?`, `warn?`.
2. Yeni SQL fonksiyonları: `public.set_can_edit_site(uuid, boolean)`, `public.save_site_content(jsonb)`; yeni view `public.active_announcements`; `profiles` üzerinde `guard_profiles_can_edit_site` trigger'ı.
3. `content_revisions.new_value` null olabilir (varsayılana dönüş kaydı); `site_content.key` için regex CHECK.
4. Web'e yeni yardımcılar: `isEditing()`, `getReaderData()`, `getAnnouncements()`; `getContent()` imzası aynı.
5. Yeni ortam değişkeni: `NEXT_PUBLIC_PANEL_URL` (web, istemci tarafı; `PANEL_URL` ile aynı değer).
6. `cacheComponents: true` + `partialPrefetching: true` (web). Task 1 başarısız olursa geri dönüş `unstable_cache` + `updateTag` (bu durumda indeksteki "use cache" ifadesi değişir).
