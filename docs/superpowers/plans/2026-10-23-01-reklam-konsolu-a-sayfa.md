# Reklam Konsolu · Paket A · Sayfa yayını + İçeriğim — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Özet (5 satır)**
1. Yeni reklam sayfaları koddan çıkar, `landing_pages` tablosuna girer (0024); web `/lp/<slug>` kodda olmayan slug için veritabanına bakar, arşivlenmiş slug 302 ile `/lp/az-mevcutlu-anaokulu`'na gider.
2. Gizli önizleme `/lp/onizleme/<preview_token>` (noindex, form gönderilmez) hem öğretmene hem yöneticiye panelden iframe ile açılır.
3. Yönetici içerik kartında "Sayfayı önizle ve yayınla" penceresinde (Z3) adresi düzeltir, kontrolleri görür, "Sayfayı yayınla"ya basar; panel web'in `/api/revalidate` ucunu `WEB_REVALIDATE_SECRET` ile çağırır, sayfa 30 sn içinde canlıdır. Yayından sonra düzenleme Z3 "Düzenle" → yeniden yayınla (site düzenleyici değil, B9).
4. Öğretmenin sayfa görevine reklam cümlesi (≤125), reklam başlığı (≤40), görsel seçimi (MediaKey) ve "Sayfayı önizle" eklenir (O2).
5. Öğretmen Görevim'de "İçeriğim" sekmesinde içeriklerinin zaman çizelgesini ve veli/randevu/kayıt sayılarını `content_owner_summary()` ile görür; para yok (O3, D1).

**Dal / worktree / migration:** `feat/reklam-konsolu-a` · `../seker-platform-rk-a` · `packages/db/supabase/migrations/0024_landing_pages.sql` (numara koordinatörce ayrıldı).

**Bağımlılıklar:** Dış bağımlılık yok (Meta/Instagram anahtarı gerekmez). Paket C bu paketten `landing_pages.status` kolonunu okur ve `apps/panel/lib/pages/store.ts`'ten `getLandingPageByContent(contentId)` fonksiyonunu import eder; ikisinin adı ve dönüş tipi bu plandaki gibi sabittir. Paket B ile ortak dosya: `apps/panel/components/content-task-form.tsx` (A yalnız sayfa dalına, B yalnız Reels dalına dokunur; ikinci birleşen rebase eder).

**Goal:** Yönetici öğretmenin sayfa görevini panelden önizleyip tek tıkla canlı adrese yayınlar; öğretmen reklam metinlerini ve görseli görevinde doldurur, teslim ettiklerinin sonucunu "İçeriğim"de görür.

**Architecture:** Saf kurallar (slug, alan eşlemesi, görsel listesi, sınırlar) tek yerde `packages/shared/src/landing.ts`'tedir; panel (yayın) ve web (önizleme, sayfa) aynı eşlemeyi kullanır. Web `landing_pages`'i servis rolüyle okur (`@seker/auth/admin` `createAdminSupabase`, env `SUPABASE_SECRET_KEY` web konteynerinde zaten var); yayındaki sayfa `'use cache'` + `cacheTag('lp:<slug>')` ile önbelleklenir, panel yayında `/api/revalidate` ile etiketi düşürür. `proxy.ts` kodda olmayan slug için 30 sn TTL'li durum sorgusu yapar: `yayinda` → geç, `arsiv` → 302, yok → 404 (bugünkü gerçek 404 davranışı korunur). Panel eylemleri `apps/panel/actions/pages.ts`'te, gizli anahtarlı istemciyle ve önce `requireRole` ile yazar; `actions/content.ts`'e dokunulmaz, `ad_change_log`'a yazılmaz, aşama değiştirilmez (B3: sayfa onayda zaten `test`).

**Tech Stack:** Next.js 16.2 (panel + web, `cacheComponents: true`, `output: 'standalone'`), Supabase Postgres + RLS, Vitest (birim + `apps/panel/tests/rls`), Tailwind v4 token'ları, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-23-reklam-konsolu-design.md` — §2 G1, G4 (yalnız D1); §4 (önizleme adresi); K12, K13, K14, K24, K26, K27; §8 Z3, O2, O3; §9 "Paket A"; §11 paylaşılan dosya kuralı ve env; §14 (A'ya düşenler); **§15 B3, B9, B10, B11 (bağlayıcı, K13/K14'ün önüne geçer)**. Ekran tasarımları: `Z3-Sayfa.dc.html`, `O2-Sayfa.dc.html`, `O3-Durum.dc.html` (tuval https://claude.ai/artifact/G37pQjW7qanRXmTMxxe3FR). Ad ve stil için önceki plan `docs/superpowers/plans/2026-10-19-03-icerik.md`.

**Web nasıl yayında (doğrulandı):** `apps/web/next.config.ts` `output: 'standalone'`, `infra/Dockerfile.web` ile GHCR imajı, Lightsail'de `infra/docker-compose.yml` `web` servisi (Node sunucusu, Caddy arkasında). Yani dinamik, veritabanından okunan `/lp/[slug]` ve route handler'lar çalışır; statik dışa aktarım yok. Web konteynerinde `SUPABASE_SECRET_KEY` ve `NEXT_PUBLIC_SUPABASE_URL` zaten tanımlı; web'in bugünkü okuma istemcisi `apps/web/lib/supabase/public.ts` (anon, `site_content` için), servis istemcisi `@seker/auth/admin` (`transpilePackages`'ta var).

## Global Constraints

- Migration yalnız `packages/db/supabase/migrations/0024_landing_pages.sql`; sonra `pnpm --filter @seker/db gen:types`. Push, `supabase db push`, deploy, prod SQL **yok** (CLAUDE.md işçi kuralları).
- `apps/panel/actions/content.ts`'e dokunulmaz. Yeni eylemler `apps/panel/actions/pages.ts`'te. İçerik kartına (`apps/panel/components/content-card-detail.tsx`) **tek satır** eklenir. `infra/docker-compose.yml` yalnız ekleme.
- Paket A `ad_change_log`'a hiç yazmaz; `content_items.stage` değiştirmez (B3).
- Slug: `^[a-z0-9-]{3,60}$`; kod slug'ları `beykent-anaokulu`, `beylikduzu-anaokulu`, `az-mevcutlu-anaokulu`, `kres-2-yas`, `anaokulu-ucret` ve ayrılmış `onizleme` yasak (DB check + uygulama). Başlıktan Türkçe karaktersiz önerilir, yayından sonra değişmez (DB tetikleyicisi).
- Arşivlenmiş slug → **302** `/lp/az-mevcutlu-anaokulu` (B10).
- Önizleme: `preview_token` = `randomBytes(32).toString("base64url")` (43 karakter, ≥32 bayt), adres `/lp/onizleme/<token>`, `robots: { index: false, follow: false }`; token yoksa ya da eşleşmezse 404. Önizlemede form gönderilmez.
- Reklam alanları: `adPrimaryText` ≤ 125, `adHeadline` ≤ 40 (karakter, `String.length`). Görsel yalnız `LP_MEDIA_OPTIONS` listesinden (yeni görsel yükleme yok, K13).
- Env: `WEB_REVALIDATE_SECRET` (web + panel, yeni). Panel web adresini mevcut `SITE_PUBLIC_URL`'den alır (yeni `WEB_PUBLIC_URL` eklenmez, §11 "mevcut varsa o"); boşsa `https://yeni.sekeranaokulu.com` (cron ile aynı varsayılan).
- `content_owner_summary()` para alanı döndürmez; `leads.content_code = content_items.code`, randevu `appointments` üzerinden, kayıt `leads.status = 'kazanildi'` (B11).
- Sunucu bileşeninde `new Date()` / `Date.now()` yok: web'de `lib/time`, panelde sayfa düzeyinde mevcut desen (`force-dynamic` sayfalar `new Date()` kullanıyor; web'de kullanma).
- Arayüz Türkçe; renkler yalnız `apps/panel/app/globals.css` token'ları; dokunma hedefi ≥ 44 px, ana düğme `min-h-14`. Z3 1280 px masaüstünde, O2/O3 390 px telefonda artboard'la karşılaştırılır.
- Panel metin yazmaz/önermez; yalnız kontrol eder (önceki spec). Slug önerisi metin değil adres olduğu için istisnadır (K14).

## Review Focus

1. **Önizlemeden sahte veli:** Öğretmen önizlemede formu doldurup gönderirse gerçek aday ve WhatsApp grup mesajı oluşmamalı. Test: Task 5 (`formDisabled` iken form `fieldset disabled` ve banner).
2. **Taslak önizleme güncel değil:** Öğretmen yazıp hemen "Sayfayı önizle"ye basınca son yazdığı görünmeli. Taslak önizleme `content_items.page_fields`'i canlı okur ve düğme önce kaydediciyi boşaltır. Test: Task 5 (taslakta `page_fields` kullanılır), Task 10 (önizle önce `flush`).
3. **Yayındaki sayfada site düzenleme modu:** Draft mode açık bir yönetici DB sayfasını açınca `reader.attrs` meta bulamayıp çökmemeli. Test: Task 3 (`landingReaderData` her zaman `editing:false`).
4. **Aynı slug iki sayfada / kod slug'ı:** Eşzamanlı iki yayın aynı adresi alırsa ikincisi Türkçe hata almalı (DB unique `23505` → "Bu adres başka bir sayfada kullanılıyor"). Test: Task 8.
5. **Revalidate ulaşmazsa:** Web kapalı ya da sır yanlışsa yayın yine kaydedilmeli ve ekran "birkaç dakika içinde açılır" demeli, hata vermemeli. Test: Task 7 (istemci), Task 8 (eylem uyarı döner).

---

### Task 0: Hazırlık (worktree)

- [ ] **Step 1:** `git -C ../seker-platform fetch origin && git -C ../seker-platform worktree add ../seker-platform-rk-a -b feat/reklam-konsolu-a origin/main && git -C ../seker-platform-rk-a branch --unset-upstream`.
- [ ] **Step 2:** Spec ve bu plan `origin/main`'de değilse `docs/superpowers/specs/2026-10-23-reklam-konsolu-design.md` ve bu dosyayı `../seker-platform-reklam-konsolu`'dan kopyala (commit'leme; koordinatörün `docs/reklam-konsolu` dalı getirir).
- [ ] **Step 3:** `pnpm install`, `pnpm --filter @seker/db exec supabase start` (çalışmıyorsa), `apps/panel/.env.local` RLS testleri için mevcut.
- [ ] **Step 4:** `pnpm turbo run test` → mevcut testler PASS (başlangıç çizgisi).

### Task 1: Ortak saf modül — slug, alan eşlemesi, görsel listesi

**Files:**
- Create: `packages/shared/src/landing.ts`
- Modify: `packages/shared/package.json` (`exports` içine `"./landing": "./src/landing.ts"`)
- Test: `packages/shared/tests/landing.test.ts`, `apps/web/content/__tests__/landingPages.test.ts` (ekleme)

**Interfaces:**
- Produces (hepsi `@seker/shared/landing`):
  - `CODE_LP_SLUGS: readonly ["beykent-anaokulu","beylikduzu-anaokulu","az-mevcutlu-anaokulu","kres-2-yas","anaokulu-ucret"]`
  - `RESERVED_LP_SLUGS: readonly string[]` = kod slug'ları + `"onizleme"`
  - `LP_SLUG_RE = /^[a-z0-9-]{3,60}$/`, `ARCHIVE_REDIRECT_PATH = "/lp/az-mevcutlu-anaokulu"`
  - `AD_PRIMARY_TEXT_MAX = 125`, `AD_HEADLINE_MAX = 40`
  - `type LpMediaKey = "gardenWide" | "gardenWorkshops" | "mudKitchen"`; `LP_MEDIA_OPTIONS: { key: LpMediaKey; label: string; src: string }[]` = `gardenWide` "Bahçe, geniş açı" `/bahce-genis.webp`; `gardenWorkshops` "Bahçe atölyeleri" `/bahce-atolyeler.webp`; `mudKitchen` "Mutfak atölyesi" `/mutfak-atolyesi.webp`. `isLpMediaKey(v: unknown): v is LpMediaKey`.
  - `type LandingFields = { h1: string; subhead: string; bodyBlocks: { heading: string; text: string }[]; mediaKey: LpMediaKey | null; adPrimaryText: string; adHeadline: string; metaTitle: string; metaDescription: string }`
  - `pageFieldsToLandingFields(pf: Record<string, unknown>): LandingFields` — `h1 = baslik`, `subhead = alt_baslik`, `bodyBlocks` = `blok{1..3}_baslik/_metin` çiftlerinden en az biri dolu olanlar (sıra korunur), `mediaKey` = `pf.mediaKey` geçerliyse yoksa `null`, `adPrimaryText`, `adHeadline`, `metaTitle = baslik`, `metaDescription` = `alt_baslik`'ın ilk 160 karakteri (kelime sınırında kesilir, sonunda boşluk yok). Tüm değerler `trim()`'li; metin olmayan değer boş metin sayılır.
  - `parseLandingFields(json: unknown): LandingFields` — DB'den gelen jsonb'yi savunmacı okur (eksik alan boş, bozuk liste boş dizi, geçersiz `mediaKey` null).
  - `slugify(text: string): string` — `toLocaleLowerCase("tr")`, ı/ş/ç/ğ/ö/ü → i/s/c/g/o/u, NFD işaretleri silinir, `[^a-z0-9]+` → `-`, baş/son tire silinir, en çok 5 kelime ve 40 karakter (kelime sınırında).
  - `suggestSlug(title: string, fallbackCode: string, taken: ReadonlySet<string>): string` — `slugify(title)`; 3 karakterden kısaysa `sayfa-<code küçük harf>` (`S-2644-I` → `sayfa-s-2644-i`); ayrılmış ya da alınmışsa `-2`, `-3`… eklenir.
  - `slugError(slug: string): string | null` — kurala uymuyorsa `"Adres 3–60 karakter olmalı; yalnız küçük harf, rakam ve tire"`, ayrılmışsa `"Bu adres sitede zaten var"`, yoksa `null`.

- [ ] **Step 1: Write the failing tests** `packages/shared/tests/landing.test.ts`:
  - `slugify("İlk hafta ağlarsa ne olur? Uyum programımız")` → `"ilk-hafta-aglarsa-ne-olur"`; `slugify("ÇOCUĞUNUZ İÇİN Güvenli Bahçe")` → `"cocugunuz-icin-guvenli-bahce"`.
  - `suggestSlug("Az mevcutlu anaokulu", "S-2644-I", new Set())` → `"az-mevcutlu-anaokulu-2"` (kod slug'ı ayrılmış); `suggestSlug("?!", "S-2644-I", new Set())` → `"sayfa-s-2644-i"`; `suggestSlug("İlk hafta uyum", "S-2644-I", new Set(["ilk-hafta-uyum"]))` → `"ilk-hafta-uyum-2"`.
  - `slugError("ab")`, `slugError("Ilk-Hafta")`, `slugError("a".repeat(61))` → kural mesajı; `slugError("onizleme")`, `slugError("kres-2-yas")` → `"Bu adres sitede zaten var"`; `slugError("ilk-hafta-uyum")` → `null`.
  - `pageFieldsToLandingFields({ baslik: " Başlık ", alt_baslik: "Alt", blok1_baslik: "B1", blok1_metin: "M1", blok2_baslik: "", blok2_metin: "", blok3_metin: "M3", mediaKey: "mudKitchen", adPrimaryText: "Cümle", adHeadline: "Baş" })` → `h1 "Başlık"`, `bodyBlocks [{heading:"B1",text:"M1"},{heading:"",text:"M3"}]`, `mediaKey "mudKitchen"`, `metaTitle "Başlık"`.
  - `mediaKey: "giraffesGarden"` → `null` (çocuk yüzlü kare listede yok); 200 karakterlik alt başlıkta `metaDescription.length <= 160` ve kelime ortasında bitmez.
  - `parseLandingFields(null)` → bütün metinler `""`, `bodyBlocks []`, `mediaKey null`; `parseLandingFields({ bodyBlocks: "x" })` → `bodyBlocks []`.
- [ ] **Step 2:** Web tutarlılık testi ekle (`apps/web/content/__tests__/landingPages.test.ts`): `CODE_LP_SLUGS` ile `LANDING_SLUGS` aynı küme; her `LP_MEDIA_OPTIONS` öğesi `MEDIA[key]` olarak var, `src` aynı ve `hasChildFaces` değil.
- [ ] **Step 3:** `pnpm --filter @seker/shared test` ve `pnpm --filter @seker/web exec vitest run content/__tests__/landingPages.test.ts` → FAIL (modül yok).
- [ ] **Step 4:** `landing.ts`'i yaz, `exports` satırını ekle.
- [ ] **Step 5:** İki komut → PASS.
- [ ] **Step 6: Commit** `feat(shared): reklam sayfası slug ve alan eşlemesi`

Ruling: Görsel listesi çocuk yüzlü (bulanıklaştırılmış da olsa) kareleri dışarıda bırakır; 3 seçenek kalır — yanlışsa maliyet: okul daha fazla görsel ister, listeye bir satır eklenir.
Ruling: Eşleme `packages/shared`'de, çünkü web önizlemesi taslakta `page_fields`'i aynı kurala göre çizer — yanlışsa maliyet: yok denecek kadar az (iki uygulama zaten `@seker/shared`'i transpile ediyor).

### Task 2: Migration 0024 — `landing_pages`, `content_owner_summary()`

**Files:**
- Create: `packages/db/supabase/migrations/0024_landing_pages.sql`
- Modify: `packages/db/src/database.types.ts` (üretilir)
- Test: `apps/panel/tests/rls/landing-pages.test.ts`

**Interfaces:**
- Produces (DB), §9 adlarıyla:

```sql
create table public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique
    check (slug ~ '^[a-z0-9-]{3,60}$' and slug not in
      ('beykent-anaokulu','beylikduzu-anaokulu','az-mevcutlu-anaokulu','kres-2-yas','anaokulu-ucret','onizleme')),
  content_id uuid not null unique references public.content_items(id) on delete cascade,
  status text not null default 'taslak' check (status in ('taslak','yayinda','arsiv')),
  fields jsonb not null default '{}'::jsonb,
  preview_token text not null unique check (length(preview_token) >= 43),
  published_at timestamptz,
  published_by uuid references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint landing_pages_slug_live check (status = 'taslak' or slug is not null)
);
-- touch_updated_at tetikleyicisi (0001 deseni)
-- landing_pages_guard (before update, plpgsql, search_path=''):
--   old.published_at is not null and new.slug is distinct from old.slug
--   → raise 'Yayından sonra adres değişmez' using errcode = '23514'
-- RLS: enable; sel_landing_pages_yonetici (select using public.is_yonetici());
--   sel_landing_pages_owner (select using exists (select 1 from public.content_items c
--     where c.id = landing_pages.content_id and c.owner_id = auth.uid()));
-- revoke all from anon, public, authenticated; grant select to authenticated; grant all to service_role.
create index if not exists idx_leads_content_code on public.leads (content_code) where content_code is not null;

create or replace function public.content_owner_summary()
returns table (content_id uuid, code text, leads int, appointments int, enrolled int,
               last_sync_at timestamptz, approved_by_name text)
language sql stable security definer set search_path = public as $$
  -- leads: content_code eşleşen veli; appointments: iptal olmayan randevusu olan veli (distinct);
  -- enrolled: status='kazanildi'; last_sync_at: max(ad_objects.synced_at);
  -- approved_by_name: onaylayanın ilk adı. Yalnız c.owner_id = auth.uid().
$$;
revoke all on function public.content_owner_summary() from public, anon;
grant execute on function public.content_owner_summary() to authenticated, service_role;
```

- Consumes: `is_yonetici()` (0001), `content_items` (0017), `leads.content_code` (0014), `appointments`, `ad_objects.synced_at` (0018), `touch_updated_at()` (0001).

- [ ] **Step 1: Write the failing test** `tests/rls/landing-pages.test.ts` (kimlikler `icerik.test.ts`'teki gibi, kodlar `S-99xx-I`, temizlik `like('code','_-99%')`, sayfa satırları `content_id` cascade ile silinir):
  - `öğretmen kendi içeriğinin sayfa satırını okur, başkasınınkini okuyamaz` (ogr `...0004` 1 satır görür; `...0005`'in satırı görünmez).
  - `öğretmen sayfa satırı ekleyemez ve güncelleyemez` (insert hata; update 0 satır ya da hata).
  - `danışman ve anonim sayfa satırını okuyamaz`; `yönetici hepsini okur`.
  - `kod slug'ı ve onizleme yasak` (admin insert `slug:'beykent-anaokulu'` ve `'onizleme'` → `23514`); `'AB'` → `23514`.
  - `yayında satırın slug'ı boş olamaz` (`status:'yayinda', slug:null` → hata).
  - `yayından sonra slug değişmez` (admin `published_at` dolu satırda slug update → `23514`; `published_at` boşken değişir).
  - `aynı slug ikinci satırda 23505`.
  - `content_owner_summary sayıları döner`: admin, ogr'nin içeriği için `content_code=<kod>` 3 veli ekler (biri `status:'kazanildi'`), birine iki randevu (`outcome:'bekliyor'`), birine `iptal` randevu → ogr `rpc('content_owner_summary')` satırı `{ leads: 3, appointments: 1, enrolled: 1 }`; `approved_by_name` onaylayanın ilk adı.
  - `content_owner_summary başkasının içeriğini döndürmez` (ogretmen2 o kodu görmez); `anonim çağıramaz` (hata).
  - `para alanı yok`: dönen satırın anahtarları tam olarak `["content_id","code","leads","appointments","enrolled","last_sync_at","approved_by_name"]`.
- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/rls/landing-pages.test.ts` → FAIL.
- [ ] **Step 3:** Migration'ı yaz.
- [ ] **Step 4:** `pnpm --filter @seker/db exec supabase db reset`, `pnpm --filter @seker/db gen:types`, test → PASS; `cd apps/panel && npx vitest run --project rls` → hepsi PASS.
- [ ] **Step 5: Commit** `feat(db): landing_pages ve content_owner_summary (0024)`

Ruling: `slug` taslakta boş olabilir (önizleme satırı adres seçilmeden açılır), `fields` taslakta `{}` — yanlışsa maliyet: §9'daki `slug unique` "not null" diye okunursa küçük bir migration düzeltmesi.
Ruling: "yonetici tam" okuma RLS ile, yazma yalnız servis rolü (0018 deseni) — yanlışsa maliyet: yok; yönetici zaten yalnız sunucu eylemiyle yazar.
Ruling: `last_sync_at` = `max(ad_objects.synced_at)` (spec kaynağı yazmıyor) — yanlışsa maliyet: tek alt sorgu değişir.
Ruling: `approved_by_name` K24 şekline eklendi; O3 artboard'u "Zehra Hanım onayladı" diyor ve öğretmen diğer profilleri okuyamıyor — yanlışsa maliyet: alan kaldırılır, metin "Onaylandı" olur.

### Task 3: Web — veritabanı sayfası okuma ve okuyucu verisi

**Files:**
- Create: `apps/web/lib/landing/db.ts`, `apps/web/lib/landing/readerData.ts`
- Modify: `apps/web/content/landingPages.ts` (yalnız ekleme: `DB_PAGE_DEFAULTS` dışa aktarımı)
- Test: `apps/web/lib/landing/__tests__/readerData.test.ts`, `apps/web/lib/landing/__tests__/db.test.ts`

**Interfaces:**
- Consumes: Task 1 `LandingFields`, `parseLandingFields`, `pageFieldsToLandingFields`; `MEDIA`; `createAdminSupabase` (`@seker/auth/admin`); `ReaderData`.
- Produces:
  - `DB_PAGE_DEFAULTS: { proofPoints: {value,label}[]; faq: {question,answer}[]; formHeading: string; formIntro: string }` = `proofPoints: [YEARS_ACTIVE_POINT, ...rosterProof(), AGE_RANGE_POINT]`, `faq: [FAQ_AGES, FAQ_PRICE, FAQ_VISIT]`, `formHeading: "Okulu gezin, sonra karar verin"`, `formIntro: FORM_INTRO_STANDARD` (mevcut sabitler; yeni metin yazılmaz).
  - `landingReaderData(base: ReaderData, slug: string, fields: LandingFields): ReaderData` — `base.values`'a `lp.<slug>.{metaTitle,metaDescription,h1,subhead,formHeading,formIntro,media,proofPoints,bodyBlocks,faq}` ekler (listeler `withIds` deseniyle `p1`, `b1`, `f1` kimlikli; `media` = `MEDIA[fields.mediaKey ?? "gardenWorkshops"]`'dan `{src,alt,width,height,assetId:null}`); sonuç **her zaman** `editing: false`, `meta: {}`, `updatedAt: {}`.
  - `type DbLandingPage = { slug: string; status: "yayinda"; fields: LandingFields }`
  - `getPublishedLandingPage(slug: string): Promise<DbLandingPage | null>` — `'use cache'`, `cacheTag(\`lp:${slug}\`)`; bulunursa `cacheLife('max')`, yoksa ya da hata olursa `cacheLife('minutes')` ve `null` (hata `console.error('[lp] …', code)`).
  - `getPreviewLandingPage(token: string): Promise<{ status: string; fields: LandingFields } | null>` — önbelleksiz (`await connection()`); token `^[A-Za-z0-9_-]{43,}$` değilse sorgusuz `null`; `status='taslak'` ise alanlar `content_items.page_fields`'ten `pageFieldsToLandingFields` ile, değilse `landing_pages.fields`'ten.
- [ ] **Step 1: Write the failing tests:**
  - `readerData`: `landingReaderData(defaultData([...]), "ilk-hafta-uyum", fields)` ile `makeReader(...).text("lp.ilk-hafta-uyum.h1") === fields.h1`; `list("lp.ilk-hafta-uyum.bodyBlocks")` iki öğe, kimlikler `b1,b2`; `proofPoints` `DB_PAGE_DEFAULTS.proofPoints` uzunluğunda; `mediaKey:null` iken `image(...).src === "/bahce-atolyeler.webp"`.
  - `editing:true` taban verisiyle bile sonuç `editing === false` ve `render(<LandingView slug="ilk-hafta-uyum" data={...} />)` hata vermez, HTML'de `data-edit-` yok (Review Focus 3).
  - `db`: `createAdminSupabase` sahte; `getPublishedLandingPage` yalnız `status='yayinda'` süzgeciyle sorgular, satır yoksa `null`, Supabase hata dönerse `null`; `getPreviewLandingPage("kisa")` sorgu yapmadan `null`; taslak satırda `page_fields.baslik` `fields.h1` olur (Review Focus 2); yayında satırda `landing_pages.fields` kullanılır.
- [ ] **Step 2:** `pnpm --filter @seker/web exec vitest run lib/landing` → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS; `pnpm --filter @seker/web exec vitest run content` → mevcut LP testleri değişmeden PASS.
- [ ] **Step 5: Commit** `feat(web): veritabanı reklam sayfası okuma`

Ruling: Öğretmenin doldurmadığı rakam şeridi, SSS ve form başlığı mevcut kod sabitlerinden gelir (§14 builder'a bırakılan eşleme) — yanlışsa maliyet: Zehra Z3 "Düzenle"de değiştiremez; sonraki turda alanlar `fields`'e eklenir.

### Task 4: Web — `/lp/[slug]` veritabanına düşer, proxy 404/302 verir

**Files:**
- Modify: `apps/web/app/(lp)/lp/[slug]/page.tsx`, `apps/web/proxy.ts`
- Create: `apps/web/lib/landing/status.ts`
- Test: `apps/web/app/(lp)/lp/[slug]/__tests__/page.test.tsx` (ekleme), `apps/web/lib/landing/__tests__/status.test.ts`

**Interfaces:**
- Consumes: Task 3 `getPublishedLandingPage`, `landingReaderData`; Task 1 `LP_SLUG_RE`, `ARCHIVE_REDIRECT_PATH`.
- Produces:
  - `type LpStatus = "yayinda" | "arsiv" | "yok" | "hata"`
  - `lpProxyDecision(slug: string, codeSlugs: ReadonlySet<string>, status: LpStatus | null): { kind: "next" } | { kind: "notFound" } | { kind: "redirect"; to: string }` — kod slug'ı → next (status bakılmaz, `null` verilir); `LP_SLUG_RE`'ye uymayan → notFound; `yayinda` → next; `arsiv` → redirect `ARCHIVE_REDIRECT_PATH`; `yok` (taslak dahil) → notFound; `hata` → next (sayfa karar verir).
  - `lookupLpStatus(slug: string, deps?: { fetchFn?: typeof fetch; now?: () => number }): Promise<LpStatus>` — `fetch(\`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/landing_pages?slug=eq.${slug}&select=status\`, { headers: { apikey, Authorization: \`Bearer ${SUPABASE_SECRET_KEY}\` }, signal: AbortSignal.timeout(1500) })`; `taslak` → `yok`; modül içi `Map` önbelleği 30 sn (`now()` ile); env yoksa `hata`.
  - `proxy.ts`: `lp` bölümünde kod slug'ı değilse `lookupLpStatus` → `lpProxyDecision`; redirect `NextResponse.redirect(new URL(to, request.url), 302)`; notFound mevcut rewrite (`/_not-found-slug`, 404). `yas-gruplari` davranışı aynen.
  - `page.tsx`: `generateStaticParams` aynen (5 kod slug'ı ön üretimli); kod slug'ı değilse `getPublishedLandingPage(slug)` → yoksa `notFound()`; varsa `<LandingView slug={slug} data={landingReaderData(await getReaderData(), slug, page.fields)} year={await currentYear()} />`. `generateMetadata`: DB sayfasında `buildMetadata({ title: fields.metaTitle, description: fields.metaDescription, path: \`/lp/${slug}\`, noindex: true })`.
- [ ] **Step 1: Write the failing tests:**
  - `status.test.ts`: `lpProxyDecision("beykent-anaokulu", CODE, null)` → next; `("Kotu_Slug", CODE, null)` → notFound; `("ilk-hafta-uyum", CODE, "arsiv")` → `{ kind:"redirect", to:"/lp/az-mevcutlu-anaokulu" }`; `"yok"` → notFound; `"hata"` → next. `lookupLpStatus`: `[{status:"yayinda"}]` → `yayinda`; `[]` → `yok`; `[{status:"taslak"}]` → `yok`; fetch reddederse `hata`; 30 sn içinde ikinci çağrı fetch'i yeniden çağırmaz, 31. saniyede çağırır.
  - `page.test.tsx` (mevcut dosyaya, `@/lib/landing/db` sahte): DB slug'ında `getPublishedLandingPage` dönen alanla `h1` render edilir; `null` dönünce `notFound` çağrılır; kod slug'ında DB fonksiyonu çağrılmaz; `generateMetadata` DB sayfası için `robots.index === false`.
- [ ] **Step 2:** `pnpm --filter @seker/web exec vitest run lib/landing "app/(lp)"` → FAIL.
- [ ] **Step 3:** Uygula. Next 16'da `proxy` varsayılan Node çalışma zamanıdır; `node_modules/next/dist/docs` içinde `proxy` ve `cacheComponents` notlarını okuyup doğrula, URL'yi yoruma yaz.
- [ ] **Step 4:** Test → PASS; `pnpm --filter @seker/web test` → PASS (lp ziyaretçi HTML snapshot'ları değişmez).
- [ ] **Step 5: Commit** `feat(web): veritabanından reklam sayfası ve arşiv yönlendirmesi`

Ruling: 302 ve gerçek 404 proxy'de yapılır, çünkü `cacheComponents` kabuğu akış başladıktan sonra sayfadaki `redirect()`/`notFound()` durum kodunu değiştiremez (proxy.ts'teki mevcut yorum) — yanlışsa maliyet: kod slug'ı olmayan her `/lp/` isteğine ≤30 sn'de bir küçük REST sorgusu; sorgu düşerse sayfa açılır (fail-open).

### Task 5: Web — gizli önizleme `/lp/onizleme/[token]`

**Files:**
- Create: `apps/web/app/(lp)/lp/onizleme/[token]/page.tsx`
- Modify: `apps/web/app/(lp)/lp/[slug]/LandingView.tsx` (isteğe bağlı `formDisabled?: boolean` prop)
- Test: `apps/web/app/(lp)/lp/onizleme/[token]/__tests__/page.test.tsx`, `apps/web/app/__tests__/visitor-html/lp.test.tsx` (değişmeden PASS)

**Interfaces:**
- Consumes: Task 3 `getPreviewLandingPage`, `landingReaderData`.
- Produces:
  - Sayfa: `generateMetadata` → `{ title: "Önizleme", robots: { index: false, follow: false } }`; token geçersiz ya da satır yok → `notFound()`. Görünüm: `landingReaderData(base, "onizleme", fields)` + `<LandingView slug="onizleme" … formDisabled />`. `generateStaticParams` yok (her istek dinamik).
  - `LandingView` `formDisabled` true iken form alanı `<fieldset disabled>` içine alınır ve form başlığının üstünde `role="note"` banner: "Önizleme · bu form gönderilmez". Varsayılan `false`: mevcut HTML bit bit aynı (snapshot).
- [ ] **Step 1: Write the failing tests:** geçerli token → banner metni ve `fieldset[disabled]` var, `h1` alanı render edilir (Review Focus 1); bozuk token → `notFound` çağrılır; `generateMetadata().robots.index === false`; `formDisabled` verilmeyen `LandingView` HTML'inde banner yok.
- [ ] **Step 2:** `pnpm --filter @seker/web exec vitest run "app/(lp)" app/__tests__/visitor-html/lp.test.tsx` → FAIL.
- [ ] **Step 3:** Uygula. Ayrılmış `onizleme` slug'ı (Task 1) `[slug]` ile çakışmayı önler; `/lp/onizleme/<token>` proxy eşleştiricisine (`/lp/:slug`) girmez.
- [ ] **Step 4:** Test → PASS (snapshot'lar güncellenmez).
- [ ] **Step 5: Commit** `feat(web): reklam sayfası gizli önizleme`

### Task 6: Web — `/api/revalidate`

**Files:**
- Create: `apps/web/app/api/revalidate/route.ts`
- Modify: `infra/docker-compose.yml` (`web.environment`'a `WEB_REVALIDATE_SECRET: ${WEB_REVALIDATE_SECRET:-}`; `panel.environment`'a aynı satır — yalnız ekleme), `infra/env.example` (`WEB_REVALIDATE_SECRET=` ve "web ile panel aynı değer; `openssl rand -hex 32`" yorumu)
- Test: `apps/web/app/api/revalidate/__tests__/route.test.ts`

**Interfaces:**
- Produces: `POST(request: Request): Promise<Response>` — gövde `{ slug: string }`, başlık `Authorization: Bearer <WEB_REVALIDATE_SECRET>`. Env boş → 503 `{ ok:false }`; sır yanlış/eksik → 401 (karşılaştırma `crypto.timingSafeEqual`, uzunluk farkı da 401); slug `LP_SLUG_RE`'ye uymuyor → 400; aksi hâlde `revalidateTag(\`lp:${slug}\`, { expire: 0 })` → 200 `{ ok: true }`. Yanıtlarda `Cache-Control: no-store`.
- [ ] **Step 1: Write the failing tests** (`vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))`): 503 env yok; 401 yanlış sır; 401 başlık yok; 400 `slug:"Kotu Slug"`; 200 doğru sır ve `revalidateTag` `("lp:ilk-hafta-uyum", { expire: 0 })` ile çağrıldı; 401'de `revalidateTag` çağrılmadı.
- [ ] **Step 2:** `pnpm --filter @seker/web exec vitest run app/api/revalidate` → FAIL.
- [ ] **Step 3:** Uygula; `revalidateTag` ikinci argüman biçimini Next 16.2 dokümanından doğrula (`node_modules/next/dist/docs`), gerekirse `{ expire: 0 }` yerine dokümandaki anında süre dolumu biçimini kullan ve testi ona göre düzelt.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(web): reklam sayfası yeniden doğrulama ucu`

### Task 7: Panel — sayfa deposu, web yenileme istemcisi, yayın ön kontrolü

**Files:**
- Create: `apps/panel/lib/pages/store.ts`, `apps/panel/lib/pages/revalidate.ts`, `apps/panel/lib/pages/preflight.ts`
- Test: `apps/panel/tests/unit/pages-store.test.ts`, `apps/panel/tests/unit/pages-revalidate.test.ts`, `apps/panel/tests/unit/pages-preflight.test.ts`

**Interfaces:**
- Consumes: Task 1 (`@seker/shared/landing`), Task 2 tablosu, `checkText` (`lib/content/checks.ts`), `createAdminSupabase`.
- Produces:
  - `store.ts`:
    - `type LandingPageStatus = "taslak" | "yayinda" | "arsiv"`
    - `type LandingPageRow = { id: string; slug: string | null; contentId: string; status: LandingPageStatus; fields: LandingFields; previewToken: string; publishedAt: string | null; publishedBy: string | null; archivedAt: string | null; updatedAt: string }`
    - `getLandingPageByContent(contentId: string, client?: SupabaseClient): Promise<LandingPageRow | null>` — varsayılan istemci `createAdminSupabase()`; UUID değilse sorgusuz `null`; hata fırlatır (`Sayfa okunamadı: <mesaj>`). **Paket C bu imzayı import eder.**
    - `ensureLandingDraft(admin: SupabaseClient, contentId: string): Promise<LandingPageRow>` — satır varsa onu döner; yoksa `status:'taslak'`, `preview_token = randomBytes(32).toString("base64url")` ile ekler (`23505` gelirse yeniden okur).
    - `isSlugTaken(admin: SupabaseClient, slug: string, exceptContentId: string): Promise<boolean>`
    - `siteBaseUrl(): string` — `SITE_PUBLIC_URL` (sondaki `/` silinir) ya da `https://yeni.sekeranaokulu.com`.
    - `previewUrl(token: string): string` = `${siteBaseUrl()}/lp/onizleme/${token}`; `liveUrl(slug: string): string` = `${siteBaseUrl()}/lp/${slug}`.
  - `revalidate.ts`: `revalidateWebPage(slug: string, deps?: { fetchFn?: typeof fetch; env?: NodeJS.ProcessEnv }): Promise<{ ok: true } | { ok: false; reason: "ayar-yok" | "ulasilamadi" | "reddedildi" }>` — `WEB_REVALIDATE_SECRET` boşsa `ayar-yok` (istek yok); `POST ${siteBaseUrl()}/api/revalidate`, 5 sn zaman aşımı; ağ hatası `ulasilamadi`; 2xx olmayan `reddedildi`. Sır günlüğe yazılmaz.
  - `preflight.ts`:
    - `type FieldCheck = { label: string; summary: string; count: string | null; ok: boolean; message: string }`
    - `pageFieldChecks(fields: LandingFields, opts: { banned: string[]; pageTitleMax: number }): FieldCheck[]` — sırayla Z3 satırları: "Başlık" (`checkText` max `pageTitleMax`, min 10; sayaç `28 / 30`), "Alt başlık" (yasaklı ifade), "Bloklar" (özet `"<n> blok"`, her blok yasaklı ifade), "Reklam cümlesi" (max 125, boşsa `ok:true`, mesaj "Boş · Instagram reklamı için gerekir"), "Reklam başlığı" (max 40, aynı boş kuralı), "Görsel" (`mediaKey` yoksa `ok:false` "Görsel seçilmedi"; varsa seçeneğin `label`'ı), "Yasaklı ifade" (hepsi temizse "yok"), "Form, çerez bandı, ölçüm kodları" (her zaman `ok:true`, özet "şablondan hazır").
    - `pagePublishBlockers(input: { kind: string; status: string; slug: string; current: Pick<LandingPageRow, "slug" | "publishedAt"> | null; slugTaken: boolean; fieldChecks: FieldCheck[] }): string[]` — mesajlar: `kind !== "sayfa"` → "Bu içerik sayfa değil"; `status !== "onaylandi"` → "Önce içerik onaylanmalı"; `slugError(slug)`; `current?.publishedAt && current.slug !== slug` → "Yayından sonra adres değişmez"; `slugTaken` → "Bu adres başka bir sayfada kullanılıyor"; `ok:false` her alan kontrolü → `"<label>: <message>"`.
- [ ] **Step 1: Write the failing tests:**
  - `pages-store`: sahte istemciyle `getLandingPageByContent` satırı camelCase'e çevirir ve `fields`'i `parseLandingFields`'ten geçirir; `"x"` için sorgu yok `null`; `ensureLandingDraft` yeni satırda 43 karakterlik token yazar; `siteBaseUrl()` `SITE_PUBLIC_URL="https://a.b/"` → `"https://a.b"`, boş → varsayılan.
  - `pages-revalidate`: env yokken fetch çağrılmaz, `ayar-yok`; 200 → ok; 401 → `reddedildi`; fetch reddi → `ulasilamadi` (Review Focus 5); istek gövdesi `{"slug":"ilk-hafta-uyum"}`, başlık `Authorization: Bearer <sır>`.
  - `pages-preflight`: 31 karakterlik başlık → "Başlık: 30 karakteri aştı"; `adPrimaryText` 126 karakter → "Reklam cümlesi: 125 karakteri aştı"; `adHeadline` "En iyi okul" → `"Reklam başlığı: \"en iyi\" kanıt ister, kullanılamaz"`; `mediaKey:null` → "Görsel: Görsel seçilmedi"; `status:"teslim"` → "Önce içerik onaylanmalı"; yayınlanmış `ilk-hafta-uyum` için `slug:"baska"` → "Yayından sonra adres değişmez"; temiz girdi → `[]`.
- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/unit/pages-` → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): reklam sayfası deposu ve yayın kontrolü`

Ruling: Reklam cümlesi ve başlığı yayın için zorunlu değil (Google sayfasında anlamsız); Instagram reklamı için zorunluluğu Paket C ön kontrolü #7 uygular — yanlışsa maliyet: boş reklam metniyle yayınlanmış sayfa C'de "Düzenle"ye döner.

### Task 8: Panel — `actions/pages.ts` sunucu eylemleri

**Files:**
- Create: `apps/panel/actions/pages.ts`
- Test: `apps/panel/tests/unit/pages-actions.test.ts` (sahte istemci deseni `tests/unit/content-actions.test.ts`'ten)

**Interfaces:**
- Consumes: Task 7 tümü; `requireRole` (`@/lib/auth`), `createAdminSupabase`, `getContentRules` (`lib/content/settings.ts`), Task 1 `pageFieldsToLandingFields`, `suggestSlug`.
- Produces (`"use server"`; her biri önce `requireRole`; içerik `content_items`'tan admin istemciyle `id, code, kind, platform, status, stage, owner_id, page_fields, topic` okunur):
  - `openPagePreview(contentId: string): Promise<{ url: string } | { error: string }>` — `requireRole("ogretmen", "yonetici")`; öğretmense `owner_id === profile.id` olmalı (değilse "İçerik bulunamadı"); `kind='sayfa'`; `ensureLandingDraft` → `{ url: previewUrl(token) }`.
  - `type PagePanelData = { code: string; topic: string; platform: "google" | "instagram"; status: string; previewUrl: string; siteBase: string; slugSuggestion: string; page: { slug: string | null; status: LandingPageStatus; publishedAt: string | null } | null; fields: LandingFields; checks: FieldCheck[]; canPublish: boolean }`
  - `loadPagePanel(contentId: string): Promise<PagePanelData | { error: string }>` — `requireRole("yonetici")`; alanlar: sayfa yayınlanmışsa `landing_pages.fields`, değilse `pageFieldsToLandingFields(page_fields)`; `slugSuggestion` = mevcut slug ya da `suggestSlug(fields.h1, code, alınmış slug'lar)`; `canPublish = status==='onaylandi'`.
  - `publishLandingPage(contentId: string, slug: string): Promise<{ ok: true; url: string; warning: string | null } | { error: string; blockers?: string[] }>` — `requireRole("yonetici")`; `pagePublishBlockers` boş değilse `{ error: "Yayın için eksikleri tamamla", blockers }`; ilk yayında `fields = pageFieldsToLandingFields(page_fields)`, sonraki yayında mevcut `fields` korunur; `update`/`upsert` `{ slug, status:'yayinda', fields, published_at: now, published_by: profile.id, archived_at: null }` (`onConflict: content_id`); `23505` → "Bu adres başka bir sayfada kullanılıyor"; `23514` → "Yayından sonra adres değişmez"; sonra `revalidateWebPage(slug)`: başarısızsa `warning: "Sayfa kaydedildi; site yenilemesi gecikti, birkaç dakika içinde açılır."`; `revalidatePath("/reklam/icerik")`. Aşama ve `ad_change_log`'a dokunmaz.
  - `updateLandingPageFields(contentId: string, fields: LandingFields): Promise<{ ok: true; warning: string | null } | { error: string; blockers?: string[] }>` — `requireRole("yonetici")`; satır yoksa "Önce sayfayı yayınlayın"; `pageFieldChecks` hatalıysa blockers; `fields` yazılır; `status='yayinda'` ise `revalidateWebPage`. (Z3 "Düzenle" → "Kaydet ve yeniden yayınla", B9.)
  - `archiveLandingPage(contentId: string): Promise<{ ok: true; warning: string | null } | { error: string }>` — `requireRole("yonetici")`; yalnız `yayinda` → `{ status:'arsiv', archived_at: now }`, `revalidateWebPage(slug)`.
  - Yeniden yayın: arşivdeki satır için `publishLandingPage(contentId, aynı slug)` geçerlidir.
- [ ] **Step 1: Write the failing tests:**
  - `öğretmen başkasının sayfasının önizlemesini açamaz` → "İçerik bulunamadı"; `danışman yayınlayamaz` → `requireRole` redirect fırlatır.
  - `onaysız içerik yayınlanmaz` (`status:"teslim"`) → blockers içinde "Önce içerik onaylanmalı", hiçbir `landing_pages` yazımı yok.
  - `ilk yayın page_fields'i kopyalar ve status yayinda yazar`: admin yazımı `fields.h1 === page_fields.baslik`, `status:"yayinda"`, `published_by` = yönetici.
  - `ikinci yayın fields'i ezmez` (mevcut `fields.h1:"Düzenlenmiş"` korunur).
  - `aynı slug yarışı`: upsert `23505` → "Bu adres başka bir sayfada kullanılıyor" (Review Focus 4).
  - `revalidate başarısızsa yayın yine ok döner ve uyarı verir` (Review Focus 5).
  - `ad_change_log ve content_items'a yazılmaz`: bütün testlerde `ops` içinde `ad_change_log` tablosu ve `content_items` `update` yok.
  - `arşiv yalnız yayındaki sayfada` ve `revalidateWebPage` slug ile çağrılır.
- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/unit/pages-actions.test.ts` → FAIL.
- [ ] **Step 3:** Uygula (`@/lib/pages/revalidate` testte `vi.mock`).
- [ ] **Step 4:** Test → PASS; `npx vitest run --project unit` → hepsi PASS.
- [ ] **Step 5: Commit** `feat(panel): sayfa önizleme, yayın, düzenleme ve arşiv eylemleri`

Ruling: Yayın içerik aşamasını değiştirmez — görev metnindeki "aşama `moveContentStage` ile" maddesi B3'le gereksizleşti (sayfa onayda zaten `test`) — yanlışsa maliyet: yok.
Ruling: İçerik `arsiv` aşamasına alınınca sayfa kendiliğinden arşivlenmez (bu `actions/content.ts`'e dokunmayı gerektirir); Z3'te "Sayfayı arşivle" düğmesi var — yanlışsa maliyet: C ya da küçük bir işle `moveContentStage` sonrası `archiveLandingPage` çağrısı eklenir.

### Task 9: Panel — Z3 `PagePublishPanel` ve karta tek satır

**Files:**
- Create: `apps/panel/components/page-publish-panel.tsx` (istemci)
- Modify: `apps/panel/components/content-card-detail.tsx` (**tek satır**, `{item.stage === "kontrol" ? <ReviewBlock …/> : null}` satırının hemen altına)
- Test: `apps/panel/tests/unit/page-publish-view.test.ts` (saf görünüm yardımcıları)

**Interfaces:**
- Consumes: Task 8 eylemleri ve `PagePanelData`; `Sheet` (`components/sheet.tsx`), `useToast`, Task 1 `LP_MEDIA_OPTIONS`, `slugError`.
- Produces:
  - Kart satırı: `{item.kind === "sayfa" && (item.status === "teslim" || item.status === "onaylandi") ? <PagePublishPanel contentId={item.id} /> : null}`
  - `PagePublishPanel({ contentId }: { contentId: string })` — kartta ikincil düğme: yayınlanmamışsa "Sayfayı önizle ve yayınla", yayındaysa durum satırı `Yayında · <siteBase host>/lp/<slug>` + "Düzenle" + "Sayfayı arşivle", arşivdeyse `Arşivde · adres /lp/az-mevcutlu-anaokulu'ya yönleniyor` + "Yeniden yayınla". Düğme `Sheet`'i (başlık "Sayfa önizleme ve yayın", açıklama `<kod> · Sayfa · <Google|Instagram>`) açar, açılışta `loadPagePanel` çağrılır.
  - Sheet içeriği (Z3 yerleşimi): solda "Sitede böyle görünecek" + `Telefon` / `Masaüstü` segmenti (`role="group"`, `aria-label="Önizleme görünümü"`); iframe `previewUrl`, telefon 390×780, masaüstü 1280 genişlik `transform: scale(<kap genişliği>/1280)`; `title="Sayfa önizlemesi"`. Sağda "Sayfa adresi" (`<siteBase host>/lp/` öneki + metin kutusu, yayından sonra `readOnly`), açıklama "Başlıktan önerildi, değiştirilebilir. Yayından sonra adres değişmez (reklam bağlantısı buna bağlanır)."; anlık `slugError`; `checks` listesi satır satır (`<b>label</b> · summary` + sağda `count ✓` ya da kırmızı mesaj); ana düğme "Sayfayı yayınla" (`min-h-14`, `canPublish` değilse pasif ve altında "Önce içeriği onaylayın"); yayın sonrası yeşil kutu "Yayından sonra" · `Yayında` rozeti · adres · `formatDayTime(publishedAt)` · "Düzenle", altında "Sayfa 30 saniye içinde açılır." (uyarı varsa uyarı metni).
  - "Düzenle": aynı Sheet'te alan formu — "Sayfa başlığı" (sayaç `pageTitleMax`), "Alt başlık", 3 blok (başlık/metin), "Reklam cümlesi (Instagram'da görünür)" (125), "Reklam başlığı" (40), görsel seçimi (radyo, `LP_MEDIA_OPTIONS` etiketleri); "Kaydet ve yeniden yayınla" → `updateLandingPageFields`, sonra iframe yeniden yüklenir.
  - Saf yardımcılar (`page-publish-panel.tsx`'ten dışa aktarılır ya da `lib/pages/view.ts`): `publishStateLine(page: PagePanelData["page"], siteBase: string): string`, `hostOf(url: string): string`.
- [ ] **Step 1: Write the failing tests:** `hostOf("https://yeni.sekeranaokulu.com")` → `"yeni.sekeranaokulu.com"`; `publishStateLine({slug:"ilk-hafta-uyum",status:"yayinda",publishedAt:"2026-10-23T06:42:00Z"}, base)` → `"Yayında · yeni.sekeranaokulu.com/lp/ilk-hafta-uyum"`; arşiv → `"Arşivde · adres /lp/az-mevcutlu-anaokulu'ya yönleniyor"`; `null` → `"Yayınlanmadı"`.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula; karttaki tek satırı ekle (başka satır değişmez: `git diff --stat components/content-card-detail.tsx` → `1 insertion`, import satırı dahil en çok 2).
- [ ] **Step 4:** Test → PASS; `pnpm --filter @seker/panel typecheck` temiz. Kontrolcü 1280 px'te Z3 artboard'uyla karşılaştırır (yerel `pnpm dev` yalnız kontrolcünün işi; bu plan dev sunucusu çalıştırmaz).
- [ ] **Step 5: Commit** `feat(panel): içerik kartında sayfa önizleme ve yayın (Z3)`

Ruling: Panel Kontrol aşamasında (`status='teslim'`) da açılır ama yalnız önizleme ve kontroller gösterir, yayın düğmesi onaydan sonra açılır; B3 "yayın paneli `test`'teki yayınlanmamış kartlarda" der — yanlışsa maliyet: koşul tek satırda `onaylandi`'ye daraltılır.
Ruling: Z3 artboard'undaki "Düzeltme iste" düğmesi eklenmez: onaydan sonra `requestRevision` çalışmaz (`status='teslim'` ister) ve `actions/content.ts`'e dokunulmaz; Kontrol'de kartın kendi "Düzeltme iste"si var, onaydan sonra düzeltme "Düzenle" ile yapılır (B9). Artboard'daki "Site düzenleyicide aç" bağlantısı B9 gereği "Düzenle" olur — yanlışsa maliyet: küçük UI işi.

### Task 10: Öğretmen O2 — reklam alanları, görsel seçimi, "Sayfayı önizle"

**Files:**
- Modify: `apps/panel/lib/content/store.ts` (`PAGE_AD_FIELDS`, `isPageFieldKey`, `contentBlockers` sayfa dalı), `apps/panel/components/content-task-form.tsx` (yalnız sayfa dalı ve `FormTask.platform`), `apps/panel/app/(app)/gorevim/page.tsx` (`toFormTask`'a `platform: t.platform`)
- Create: `apps/panel/components/page-media-select.tsx`, `apps/panel/components/page-preview-button.tsx`
- Test: `apps/panel/tests/unit/content-checks.test.ts` (ekleme), `apps/panel/tests/unit/page-preview-button.test.ts`

**Interfaces:**
- Consumes: Task 1 `AD_PRIMARY_TEXT_MAX`, `AD_HEADLINE_MAX`, `LP_MEDIA_OPTIONS`, `isLpMediaKey`; Task 8 `openPagePreview`; `createDraftSaver` (`lib/content/draft-saver.ts`).
- Produces:
  - `store.ts`: `PAGE_AD_FIELDS = [{ key: "adPrimaryText", label: "Reklam cümlesi (Instagram'da görünür)", max: 125 }, { key: "adHeadline", label: "Reklam başlığı", max: 40 }]`; `isPageFieldKey(key)` ayrıca `adPrimaryText`, `adHeadline`, `mediaKey` kabul eder (`PAGE_FIELDS` dizisi ve onu dolaşan pano/kart kodu değişmez). `contentBlockers` sayfa dalına: `mediaKey` geçerli değilse `"Görsel seç"`; dolu `adPrimaryText` → `checkText(max 125, min 0)` hatası `"Reklam cümlesi: <mesaj>"`; dolu `adHeadline` → `"Reklam başlığı: <mesaj>"`. (Sunucu `submitContent` aynı fonksiyonu çağırdığı için `actions/content.ts` değişmeden kural sunucuda da geçerli olur; `saveContentDraft` yeni anahtarları `isPageFieldKey` üzerinden kabul eder.)
  - `FormTask.platform: "google" | "instagram"`.
  - Form sayfa dalında `PAGE_FIELDS` döngüsünün altına: `platform === "instagram"` ise `PAGE_AD_FIELDS` için mevcut `TextBlock` (sayaçlı, `max` ile); sonra `<PageMediaSelect value={draft.pageFields.mediaKey ?? null} onChange={(k) => setField("mediaKey", k)} disabled={submitting} />`; sonra `<PagePreviewButton contentId={task.id} flush={() => saver(task.id).flush()} />`. Alt not (O2): "Önizleme sitedeki gerçek görünümdür; adres ve yayın yöneticide."
  - `PageMediaSelect` — `fieldset` + `legend` "Sayfanın fotoğrafı", `LP_MEDIA_OPTIONS` radyo kartları (≥44 px), seçilmemişken yardım "Okulun hazır fotoğraflarından birini seç. Yeni fotoğraf yüklenmez."
  - `PagePreviewButton` — "Sayfayı önizle" (göz ikonu, `min-h-14`, ikincil); basınca önce `await flush()`, sonra `openPagePreview`, sonra `Sheet` içinde 390 px iframe (`title="Sayfa önizlemesi"`); hata metni `role="alert"`.
  - Saf yardımcı `runPreview(flush: () => Promise<unknown>, open: () => Promise<{ url: string } | { error: string }>): Promise<{ url: string } | { error: string }>` (aynı dosyadan dışa aktarılır).
- [ ] **Step 1: Write the failing tests:**
  - `content-checks.test.ts`: sayfa `mediaKey` yokken blockers `"Görsel seç"` içerir; `mediaKey:"gardenWide"` ile içermez; 126 karakterlik `adPrimaryText` → `"Reklam cümlesi: 125 karakteri aştı"`; `adHeadline:"Garanti yer"` → `"Reklam başlığı: \"garanti\" kanıt ister, kullanılamaz"`; boş reklam alanları engellemez; `isPageFieldKey("mediaKey") === true`, `isPageFieldKey("baska") === false`.
  - `page-preview-button.test.ts`: `runPreview` `flush`'ı `open`'dan önce çağırır (çağrı sırası dizisi); `flush` reddederse `open` çağrılmaz ve `{ error: "Kaydedilemedi, tekrar dene" }` (Review Focus 2).
- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/unit/content-checks.test.ts tests/unit/page-preview-button.test.ts` → FAIL.
- [ ] **Step 3:** Uygula. Reels dalına ve `ReviewBlock`'a dokunma.
- [ ] **Step 4:** Test → PASS; `tests/unit/content-actions.test.ts`, `content-board.test.ts`, `content-task-view.test.ts` değişmeden PASS.
- [ ] **Step 5: Commit** `feat(panel): sayfa görevine reklam metni, görsel ve önizleme (O2)`

Ruling: Görsel seçimi teslim için zorunlu (Google ve Instagram sayfası ikisi de görsel basar, §10 #8); reklam alanları teslimde zorunlu değil, çünkü sunucu teslim kontrolü (`actions/content.ts` `ITEM_COLUMNS`) platformu okumuyor — yanlışsa maliyet: Instagram sayfası reklam metni boş teslim edilir, Zehra Z3'te "Düzenle" ile doldurur ya da düzeltme ister.
Ruling: O2 artboard'undaki "3 madde (satır satır)" alanı eklenmez; spec "mevcut alanlar"ı korur (3 blok başlık/metin) — yanlışsa maliyet: `PAGE_FIELDS` ve eşleme değişir, eski taslaklar göç ister.

### Task 11: Öğretmen O3 — "İçeriğim" sekmesi

**Files:**
- Create: `apps/panel/lib/queries/my-content.ts`, `apps/panel/app/(app)/gorevim/icerigim/page.tsx`, `apps/panel/components/gorevim-tabs.tsx`
- Modify: `apps/panel/app/(app)/gorevim/page.tsx` (üstte `<GorevimTabs active="gorevler" />`)
- Test: `apps/panel/tests/unit/my-content.test.ts`

**Interfaces:**
- Consumes: Task 2 `content_owner_summary()` ve `landing_pages` öğretmen okuması; `content_items` (öğretmen RLS'i); `formatDayTime` (`lib/lead-flow/business-hours.ts`).
- Produces:
  - `type OwnerSummary = { contentId: string; leads: number; appointments: number; enrolled: number; lastSyncAt: string | null; approvedByName: string | null }`
  - `type MyContentItem = { id; code; kind: "reels" | "sayfa"; platform; topic; status; stage; submittedAt; approvedAt; igPublishedAt; stageChangedAt; learnedNote: string | null; page: { slug: string | null; status: string; publishedAt: string | null } | null; summary: OwnerSummary | null }`
  - `loadMyContent(supabase: SupabaseClient, me: string): Promise<MyContentItem[]>` — kendi `content_items` (`status <> 'taslak'`, `submitted_at desc`, en çok 20), `rpc("content_owner_summary")`, kendi `landing_pages` (`content_id in`); RPC hata verirse `summary: null` (sayfa açılır).
  - `type TimelineEvent = { title: string; detail: string | null; tone: "done" | "now" | "todo" }`
  - `buildTimeline(item: MyContentItem, now: Date): TimelineEvent[]` — sırayla, yalnız olmuş olanlar: `submittedAt` → "Teslim ettin"; `approvedAt` → `"<ad> onayladı"` (`approvedByName` yoksa "Onaylandı"); `igPublishedAt` → "Instagram'da yayınlandı"; `page.publishedAt` → "Sayfa yayına girdi" (detay `/lp/<slug>`); Reels `stage === "test"` → "Reklam testine girdi" (`stageChangedAt`); `stage === "kazanan"` → "Büyütmeye taşındı"; `stage === "arsiv"` → "Arşive alındı"; son olarak `summary` varsa ve aşama `test|kazanan|arsiv` ya da `leads > 0` ise `tone:"now"` satırı: `"<leads> veli aradı, <appointments> randevu verdi"` (+ `enrolled > 0` ise `", <enrolled> kayıt oldu"`; `leads === 0` → "Henüz bu içerikten veli gelmedi"), detay `"Reklamdan senin içeriğinle gelenler. Güncellendi: <formatDayTime(lastSyncAt)>"` (`lastSyncAt` yoksa yalnız ilk cümle). Saatler `formatDayTime` ile ("Cuma 09:31").
  - `statusPill(item: MyContentItem): { text: string; tone: "ok" | "warn" | "muted" }` — `teslim` → "Onay bekliyor" (warn); `duzeltme` → "Düzeltme istendi" (warn); `organik` → "Instagram'da" (ok); sayfa `test` + sayfa yayında değil → "Yayın bekliyor" (warn); `test` → "Reklam testinde" (ok); `kazanan` → "Büyütmede" (ok); `arsiv` → "Arşivde" (muted); diğer → "Onaylandı" (ok).
  - Sayfa (`/gorevim/icerigim`, `requireRole("ogretmen")`, `force-dynamic`): başlık "Görevim", sekmeler; açıklama "Teslim ettiklerin ne oldu. Para ve reklam bütçesi burada görünmez; veli sayıları panelde gerçek arananlardır."; her içerik bir kart (kod rozeti `<kod> · Reels|Sayfa`, `statusPill`, konu, zaman çizelgesi); arşiv kartında zaman çizelgesi yerine özet ve `learnedNote` varsa `Öğrenilen not: "<not>"`; boşsa "Henüz teslim ettiğin içerik yok."; alt not "Bir sorun olursa yöneticine yaz; panelde sana düşen başka iş yok."
  - `GorevimTabs({ active }: { active: "gorevler" | "icerigim" })` — iki bağlantı "Görevler" (`/gorevim`) ve "İçeriğim" (`/gorevim/icerigim`), `aria-current="page"`, ≥44 px. (`canOpen` `/gorevim/*`'i zaten açıyor; `role-access.ts` değişmez.)
- [ ] **Step 1: Write the failing tests:** onaylanmış ve testteki Reels için olaylar sırası `["Teslim ettin","Zehra onayladı","Instagram'da yayınlandı","Reklam testine girdi","7 veli aradı, 2 randevu verdi"]`; `enrolled:1` → son satır `", 1 kayıt oldu"` ile biter; `summary:null` → sayı satırı yok; `approvedByName:null` → "Onaylandı"; sayfa yayında → "Sayfa yayına girdi" detayı `/lp/ilk-hafta-uyum`; `statusPill` teslim/duzeltme/sayfa yayın bekliyor/arsiv; hiçbir olay metni `TL` ya da `₺` içermez.
- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/unit/my-content.test.ts` → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS; `tests/unit/role-access.test.ts` değişmeden PASS.
- [ ] **Step 5: Commit** `feat(panel): öğretmen İçeriğim ekranı (O3)`

Ruling: Sayılar içeriğin toplamıdır, artboard'daki "Bu hafta 7 veli" değil; K24/B11 dönem vermiyor — yanlışsa maliyet: fonksiyona hafta başı parametresi eklenir.
Ruling: Artboard'daki "72 saatte 1.840 izlenme" gösterilmez; öğretmen `content_organic_stats`'ı okuyamaz ve K24 bunu kapsamıyor — yanlışsa maliyet: `content_owner_summary()`'ye `views` eklenir.
Ruling: İlk sekme adı "Görevler" (artboard o anki göreve göre "Sayfa görevi"/"Reels görevi" diyor; birden çok görev olabilir) — yanlışsa maliyet: tek etiket değişir.

### Task 12: Kılavuzlar ve son kontroller, teslim

**Files:**
- Modify: `docs/ogretmen-gorev-kilavuzu.md` (yeni bölüm "Sayfa görevi: reklam metni, fotoğraf ve önizleme" ve "İçeriğim"), `docs/yonetici-reklam-kilavuzu.md` (yeni bölüm "Sayfayı yayınlama")
- Create: `../seker-platform-ledgers/teslim/feat-reklam-konsolu-a.md` (repo dışı)

- [ ] **Step 1:** Öğretmen kılavuzuna 2 kısa bölüm (3–5 madde): reklam cümlesi ≤125 ve başlık ≤40 yalnız Instagram sayfasında; fotoğraf hazır listeden, yeni yükleme yok; "Sayfayı önizle" sitedeki gerçek görünüm, form gönderilmez; "İçeriğim"de ne görünür (para görünmez).
- [ ] **Step 2:** Yönetici kılavuzuna "Sayfayı yayınlama" (4–6 madde): onaydan sonra kartta "Sayfayı önizle ve yayınla"; adres önerisi ve yayından sonra değişmezlik; 30 sn; "Düzenle → Kaydet ve yeniden yayınla"; "Sayfayı arşivle" adresi `/lp/az-mevcutlu-anaokulu`'na yönlendirir; site düzenleyici yeni sayfaları düzenlemez.
- [ ] **Step 3:** `pnpm turbo run lint typecheck test` → PASS.
- [ ] **Step 4:** `pnpm --filter @seker/web build` → başarılı (build sırasında DB'ye gidilmez: yalnız 5 kod slug'ı ön üretilir).
- [ ] **Step 5:** `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sahte pnpm --filter @seker/panel build` → başarılı.
- [ ] **Step 6:** `superpowers:requesting-code-review` ile dal farkı; bulgular düzeltilir, testler yeniden yeşil.
- [ ] **Step 7: Commit** `docs: sayfa yayını ve İçeriğim kılavuzları`
- [ ] **Step 8:** Teslim: aşağıdaki şablonu koordinatöre SendMessage ile gönder ve aynısını `../seker-platform-ledgers/teslim/feat-reklam-konsolu-a.md`'ye yaz.

```
dal: feat/reklam-konsolu-a            sha: <git rev-parse HEAD>
worktree: ../seker-platform-rk-a
dokunulan: packages/shared/src/landing.ts, packages/shared/package.json, packages/db/supabase/migrations/0024_landing_pages.sql,
  packages/db/src/database.types.ts, apps/web/{proxy.ts, app/(lp)/lp/[slug]/*, app/(lp)/lp/onizleme/[token]/*, app/api/revalidate/*,
  lib/landing/*, content/landingPages.ts}, apps/panel/{actions/pages.ts, lib/pages/*, lib/queries/my-content.ts, lib/content/store.ts,
  components/{page-publish-panel,page-media-select,page-preview-button,gorevim-tabs}.tsx, components/content-card-detail.tsx (1 satır),
  components/content-task-form.tsx (sayfa dalı), app/(app)/gorevim/**, tests/**}, infra/docker-compose.yml, infra/env.example, docs/*kilavuzu.md
migration: 0024 (dosya: packages/db/supabase/migrations/0024_landing_pages.sql) — main push'tan ÖNCE prod'a uygulanmalı (web /lp proxy ve panel yeni tabloya dayanır)
kontroller: lint ✓ typecheck ✓ test ✓ web build ✓ panel build ✓
env / crontab değişikliği: WEB_REVALIDATE_SECRET (web + panel, aynı değer, `openssl rand -hex 32`); SITE_PUBLIC_URL panelde dolu olmalı; crontab yok
riskler: proxy kod dışı /lp/ isteklerinde ≤30 sn'de bir REST sorgusu (fail-open); content-task-form.tsx Paket B ile ortak (sayfa dalı / Reels dalı)
Mert'ten beklenen karar: yok (açık sorular plan başındaki listede)
```

---

## Spec ile çelişkiler ve açık sorular (koordinatöre)

1. **K13 "mevcut `lp.*` slot yapısı":** `page_fields` bugün `lp.*` anahtarları değil, düz anahtarlar taşıyor (`baslik`, `alt_baslik`, `blok{1..3}_baslik/_metin`, `apps/panel/lib/content/store.ts` `PAGE_FIELDS`). Plan bu anahtarları `pageFieldsToLandingFields` ile `LandingView` alanlarına eşler ve yeni anahtarları (`adPrimaryText`, `adHeadline`, `mediaKey`) aynı düz yapıya ekler.
2. **O2 artboard "3 madde (satır satır)":** Mevcut formda 3 blok (başlık + metin) var; plan spec'teki "mevcut alanlar"ı korur, "3 madde" alanı eklemez.
3. **Z3 "Düzeltme iste" ve "Site düzenleyicide aç":** Onaydan sonra `requestRevision` çalışmıyor ve `actions/content.ts`'e dokunulmuyor; plan Z3'te bu düğmeyi koymaz. "Site düzenleyicide aç" B9 gereği "Düzenle" olur.
4. **Görev metnindeki "aşama `moveContentStage` ile":** B3'e göre sayfa onayda zaten `test`; yayın aşama değiştirmez.
5. **B10 302:** Gerçek 302 (ve kod dışı slug'da gerçek 404) için proxy'nin veritabanına bakması gerekiyor (30 sn TTL, düşerse sayfa açılır). Kabul edilmezse sayfa içi `redirect()` 307/istemci yönlendirmesi verir.
6. **O3 sayıları:** Artboard "Bu hafta" ve izlenme sayısı gösteriyor; K24/B11 toplam veli/randevu/kayıt ve `lastSyncAt` veriyor. Plan toplamları gösterir, izlenmeyi göstermez; `lastSyncAt` kaynağı `max(ad_objects.synced_at)`; onaylayanın ilk adı için `approved_by_name` K24 şekline eklendi.
7. **Reklam alanlarının zorunluluğu:** Teslimde zorunlu değil (sunucu teslim kontrolü platformu bilmiyor, `actions/content.ts` yasak); Instagram reklamı için zorunluluk Paket C #7'de. Görsel seçimi teslimde zorunlu.
8. **Görsel listesi:** Yalnız çocuk yüzü olmayan 3 okul fotoğrafı (`gardenWide`, `gardenWorkshops`, `mudKitchen`). Okul daha fazlasını isterse listeye satır eklenir.
9. **İçerik arşivi → sayfa arşivi:** Otomatik bağlanmadı (`actions/content.ts`); Z3'te "Sayfayı arşivle" var.
10. **`WEB_PUBLIC_URL`:** Eklenmedi; panelde mevcut `SITE_PUBLIC_URL` kullanılır (§11 izin veriyor). Koordinatör prod `.env`'de dolu olduğunu teyit etmeli.
