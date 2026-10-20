# AI görev önerisi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Danışman ve yönetici, haftanın 4 içerik yuvası için AI konu önerilerinden seçip (ya da elle yazıp) öğretmene görev verir.

**Architecture:** Saf modüller (`lib/ai/*`) girdi derler ve çıktıyı doğrular/filtreler; `lib/ai/gorev-uret.ts` Claude'u çağırır ve
`ai_gorev_onerileri` tablosuna service_role ile yazar; `POST /api/ai/gorev-onerileri` istemciden tetiklenir; görev açma
`assignContentTasks` → mevcut `createContentTask`.

**Tech Stack:** Next 16.2 (panel), Supabase, `@anthropic-ai/sdk@0.133.0`, zod 4, vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-ai-gorev-onerisi-design.md`

## Global Constraints

- Model `claude-sonnet-5-5`, `ANTHROPIC_MODEL` ile değişir; anahtar `ANTHROPIC_API_KEY`; yoksa metin tam olarak "AI önerileri kapalı (anahtar girilmedi)".
- AI'a veli adı/telefonu/notu ve harcama tutarı gitmez.
- Yasaklı ifade ya da para ifadesi içeren öneri atılır.
- Yuva başına en çok 3 öneri; başlık ≤ 80, açıklama ≤ 400, dayanak ≤ 120 karakter.
- Migration 0020, RLS: `is_staff()` okur, yazma service_role.
- Sunucu bileşeninde `new Date()` / `Date.now()` yok.

## Review Focus

- Okul bilgileri boş, hiç görev ve aday yokken prompt derlenir ve üretim çalışır → girdi testinde boş veri.
- AI bir yuvayı atlar ya da 5 öneri döndürür → doğrulama eksik yuvayı boş, fazlayı 3'e keser.
- İki sekme aynı anda sayfayı açar → `hazirlaniyor` satırı ikinci üretimi engeller (claim testi).
- Danışman `/reklam/hafta`'yı adresle açmaya çalışır → `canOpen` false.
- Seçilen hafta dışı (`?hafta=` geçmiş) → eylem "Hafta geçersiz" döner.

---

### Task 1: Saf modüller — doğrulama, filtre, prompt girdisi
**Files:** Create `apps/panel/lib/ai/gorev-oneri.ts`, `apps/panel/lib/ai/gorev-girdi.ts`, `apps/panel/lib/content/slots.ts`; Test `tests/unit/ai-gorev-oneri.test.ts`, `tests/unit/ai-gorev-girdi.test.ts`.
**Produces:** `SLOT_ORDER`, `SLOTS`, `slotOfCode` (slots.ts); `aiOutputSchema` (API'ye giden zod), `cleanSuggestions(raw, banned) → Record<WeeklySlot, Suggestion[]>`, `suggestionProblem(s, banned) → string|null`; `buildPromptInput(data: PromptData) → string`, `SYSTEM_PROMPT`.
- [ ] Testler: yasaklı ("garantili") atılır, "500 TL" atılır, uzun başlık atılır, 5 öneri → 3, eksik yuva → [], boş veriyle prompt "henüz veri yok" içerir, prompt'ta telefon/ad yok.
- [ ] Uygula, testler geçer, commit.

### Task 2: Yetki ve görev açma
**Files:** Modify `lib/role-access.ts`, `actions/content.ts` (requireRole yonetici+danisman, revalidate `/reklam/gorev-ver`), `actions/weekly.ts` (slots.ts'i kullan); Create `actions/task-assign.ts`; Tests `role-access.test.ts`, `content-actions.test.ts`, `tests/unit/task-assign.test.ts`.
**Produces:** `assignContentTasks({ weekStart, tasks: {slot, ownerId, topic, brief?, dueAt}[] }) → { ok, created: {slot, code, owner, waLink}[] , errors: {slot, error}[] } | { error }`; `allowedTaskWeeks(now) → [string, string]`.
- [ ] Testler, uygula, commit.

### Task 3: Migration 0020 + tipler + RLS testi
**Files:** `packages/db/supabase/migrations/0020_ai_gorev_onerisi.sql`, `packages/db/src/database.types.ts`, `tests/rls/ai-gorev-onerisi.test.ts`.
- [ ] SQL yaz, yerelde uygula + schema_migrations '0020', RLS testi geçer, commit.

### Task 4: Üretici + route handler + env
**Files:** `lib/ai/gorev-veri.ts` (veri okuma), `lib/ai/gorev-uret.ts` (claim, Claude çağrısı, kayıt), `app/api/ai/gorev-onerileri/route.ts`, `infra/docker-compose.yml`, `infra/env.example`; Test `tests/unit/ai-gorev-uret.test.ts`.
**Produces:** `generateWeekSuggestions(admin, { weekStart, slots, force, now }) → WeekSuggestionsState`; `aiEnabled()`.
- [ ] Testler (anahtarsız kapalı, hata → `hata` satırı, claim çakışması üretmez), uygula, commit.

### Task 5: Arayüz
**Files:** `app/(app)/reklam/gorev-ver/page.tsx`, `components/task-assign-board.tsx`, `components/school-info-settings.tsx`, `actions/school-info.ts`, `app/(app)/ayarlar/page.tsx`, `components/nav.tsx`, `docs/yonetici-reklam-kilavuzu.md`.
- [ ] Uygula, lint/typecheck/test/build, commit.
