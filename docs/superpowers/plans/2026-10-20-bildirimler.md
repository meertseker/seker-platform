# Panel Notifications Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every panel notification explains itself in Turkish, links to the place where the user acts, and the bell menu is clear, quiet and live.

**Architecture:** One registry of notification types drives text, hint, link and icon. All TypeScript producers write through one typed insert helper; SQL producers are checked by a source-scanning test. A server loader enriches rows with the lead's name so old rows read well without a payload migration. The bell polls a tiny summary endpoint and refreshes the route only when something changed.

**Tech Stack:** Next.js 16 (app router, server actions), React 19, Supabase JS, Tailwind v4 tokens from `apps/panel/app/globals.css`, lucide-react, Vitest.

**Spec:** `C:\Users\meert\Desktop\seker-bildirimler-gece-prompt.md` (owner brief) + `docs/notifications-inventory.md`. Rulings: `docs/superpowers/plans/2026-10-20-bildirimler-ledger.md`.

## Global Constraints

- All UI copy Turkish; code, commits, plans English.
- No raw hex in components; only tokens (`text-primary`, `bg-warning-soft`, …).
- No notification may ever render "Yeni bildirim var.".
- Touch targets ≥ 44 px (`min-h-11`); works at 390 px and 1440 px.
- No migration unless needed; if needed, number 0019 only. (Ruling: none needed.)
- Do not change what goes to the WhatsApp group (`lib/wa/*` messages).
- Shared files (`lib/constants.ts`, `notification-text.ts`, `layout.tsx`, `cron/leads`) get minimal, additive edits.
- Never `supabase db reset` / `db stop`; no push, prod writes or deploy.

## Review Focus

1. A row whose `type` is unknown (new type from another branch) → readable fallback, link `/bildirimler`, server log, no crash.
2. Payload fields missing or of the wrong type (old rows: `randevu_bugun` without `parentName`, `geciken_ozet` without `totalFormatted`) → text still complete, no "undefined"/"NaN".
3. Lead deleted / `leadId` not a uuid → enrichment skips it, text falls back to generic name, link still valid.
4. Clicking a notification while offline / action fails → navigation still happens; badge restores on next poll.
5. Midnight boundary in Istanbul (UTC+3) → "Bugün"/"Dün" grouping and `randevu_bugun` link use the Istanbul date, not UTC.

---

### Task 1: Type registry, texts, hints, links

**Files:**
- Create: `apps/panel/lib/notifications/types.ts`, `apps/panel/lib/notifications/link.ts`
- Modify: `apps/panel/lib/notification-text.ts`, `apps/panel/actions/notifications.ts` (re-export type)
- Test: `apps/panel/tests/unit/notification-text.test.ts`, `apps/panel/tests/unit/notification-link.test.ts`

**Interfaces:**
- Produces: `NOTIFICATION_TYPES` (readonly tuple of all 14 types incl. pre-registered `cevapsiz_arama`, `santral_senkron_hata`), `type NotificationType`, `isNotificationType(t: string): t is NotificationType`.
- Produces: `interface NotificationLike { type: string; payload: Record<string, unknown>; leadName?: string | null }`.
- Produces: `notificationText(n: NotificationLike): string`, `notificationHint(n: NotificationLike): string | null` (both in `notification-text.ts`).
- Produces: `notificationHref(n: NotificationLike & { created_at?: string }, today: string): string` where `today` is the Istanbul `YYYY-MM-DD`.

- [ ] Step 1: Tests. For every type in `NOTIFICATION_TYPES`: text with an empty payload is non-empty, ≠ "Yeni bildirim var.", has no "undefined"/"NaN"/"null". Exact texts:
  - `geciken_ozet` `{count:13,totalFormatted:"302.250,00 ₺"}` → `"Ödemesi geciken 13 taksit var (toplam 302.250,00 ₺)"`; `{count:13,totalKurus:30225000}` → same; `{}` → `"Ödemesi geciken taksitler var"`. Hint `"Gecikenler listesinden velileri arayın."`
  - `randevu_bugun` `{at:"2026-10-20T14:19:00+00:00", parentName:"Ayşe Yılmaz"}` → `"Bugün 17:19 randevu: Ayşe Yılmaz"`; `leadName` used when `parentName` absent; `{}` → `"Bugün bir randevunuz var"`.
  - `teklif_onay_bekliyor` `{offered:21000}, leadName:"Ayşe Yılmaz"` → `"Ayşe Yılmaz için teklif onay bekliyor: 21.000,00 ₺"`; without name → `"Onay bekleyen yeni teklif: 21.000,00 ₺"` (unchanged). Hint `"Onaylayın, reddedin ya da karşı rakam girin."`
  - `teklifiniz_onaylandi` with name → `"Ayşe Yılmaz için teklifiniz onaylandı"`; without → `"Teklifiniz onaylandı."` (unchanged). Same pattern for `teklif_reddedildi`.
  - `cevapsiz_arama` `{parentName:"Ayşe"}` → `"Cevapsız arama: Ayşe"`, `{number:"0532…"}` → number; `santral_senkron_hata` → `"Santral senkronu başarısız oldu."`.
  - unknown `kayit_yenileme` → `"Yeni bir sistem bildirimi (kayit yenileme)"`.
  - Existing assertions in the file stay green.
- [ ] Step 2: Link tests: `geciken_ozet`→`/odemeler/gecikenler`; `teklif_onay_bekliyor`→`/teklifler`; `randevu_bugun` with `tarih===today`→`/bugun#ziyaretler`, older with leadId→`/leads/{id}`; `geri_bildirim` `{feedbackId:"f1"}`→`/geri-bildirim#gb-f1`; `wa_baglanti_koptu`→`/ayarlar#whatsapp`; `ads_senkron_hata`/`santral_senkron_hata`→`/pazarlama`, `/ayarlar`; lead types with leadId→`/leads/{id}`, without→`/bildirimler`; unknown→`/bildirimler`.
- [ ] Step 3: Implement; run `pnpm --filter @seker/panel exec vitest run tests/unit/notification-text.test.ts tests/unit/notification-link.test.ts` → PASS. Commit.

### Task 2: Producer coverage guard and typed insert helper

**Files:**
- Create: `apps/panel/lib/notifications/insert.ts`, `apps/panel/tests/unit/notification-producers.test.ts`
- Modify: `actions/notifications.ts` (`notify` uses helper), `app/api/cron/daily/route.ts`, `app/api/cron/ads/route.ts`, `app/api/cron/leads/route.ts`, `lib/wa/run.ts` (insert call only)

**Interfaces:**
- Produces: `insertNotifications(db: SupabaseClient, rows: { user_id: string; type: NotificationType; payload: Record<string, unknown> }[]): Promise<{ error: { message: string } | null }>`.

- [ ] Step 1: Test scans `apps/panel/{app,actions,lib,components}/**/*.{ts,tsx}`: no `from("notifications").insert(` / `from("notifications")\n.insert(` outside `lib/notifications/insert.ts`. Scans `packages/db/supabase/migrations/*.sql`: every `insert into public.notifications … select …, '<type>'` literal ∈ `NOTIFICATION_TYPES`. Scans TS for `type: "<x>"` inside `insertNotifications(` calls and `notify(…, "<x>"` → ∈ registry. Fails today on `geciken_ozet`/`randevu_bugun` texts only if registry lacks them (sanity: first run before Task 1 merged would fail).
- [ ] Step 2: Route the 5 producers through the helper. Existing route tests (`leads-cron-route`, `ads-cron-route`) stay green. Commit.

### Task 3: Daily cron payload + noise control

**Files:** Modify `app/api/cron/daily/route.ts`; Test: create `tests/unit/daily-cron-route.test.ts`.

- [ ] Tests (mock like `leads-cron-route.test.ts`): (a) `randevu_bugun` payload includes `parentName`; (b) rerun same day inserts nothing new (dedupe); (c) on Monday with overdue, after inserting today's `geciken_ozet`, older unread `geciken_ozet` of that user get `read_at` (update filtered `type=geciken_ozet`, `read_at is null`, `payload->>tarih < today`); (d) unread `randevu_bugun` with `payload->>tarih < today` get `read_at` every run; (e) 401 without secret.
- [ ] Implement, run, commit.

### Task 4: Loader, mark-one-read action, summary endpoint

**Files:**
- Create: `apps/panel/lib/queries/notifications.ts`, `apps/panel/app/api/notifications/summary/route.ts`
- Modify: `actions/notifications.ts` (add `markNotificationRead`), `app/(app)/layout.tsx` (use loader)
- Test: `tests/unit/notifications-loader.test.ts`

**Interfaces:**
- Produces: `interface NotificationItem { id; type: string; payload; read_at: string|null; created_at: string; leadName: string|null }` (moved here; `components/notification-bell.tsx` re-exports for `nav.tsx`).
- Produces: `loadNotifications(supabase, userId, opts: { limit: number; unreadOnly?: boolean }): Promise<NotificationItem[]>` — one extra `leads.select("id, parent_name").in("id", uuids)` query; `console.warn("[bildirim] tanımsız tür", type)` for unknown types.
- Produces: `countUnread(supabase, userId): Promise<number>`.
- Produces: `markNotificationRead(id: string): Promise<{ error?: string }>`; `markNotificationsRead()` unchanged signature.
- Produces: `GET /api/notifications/summary` → `{ unread: number, latestId: string | null }`, 401 JSON when no session, `Cache-Control: no-store`.

- [ ] Tests: enrichment attaches `leadName`, ignores non-uuid leadIds, single leads query; unknown type warns once. Implement, commit.

### Task 5: Bell redesign + list component

**Files:**
- Create: `apps/panel/components/notification-list.tsx`, `apps/panel/lib/notifications/group.ts`, `apps/panel/components/notification-icon.tsx`
- Rewrite: `apps/panel/components/notification-bell.tsx`
- Test: `tests/unit/notification-group.test.ts`

**Interfaces:**
- Produces: `groupNotificationsByDay(items, now: Date): { label: "Bugün" | "Dün" | "Daha eski"; items }[]` (Istanbul dates, empty groups dropped, order kept).
- Produces: `<NotificationList items onOpen(item) />`, `<NotificationIcon type />`.

Behaviour: opening the menu no longer marks everything read; clicking an item marks that one read (optimistic) and navigates via `<Link>`; header button "Tümünü okundu say" (disabled when 0). Unread rows: bold text + `bg-primary-soft` + dot with sr-only "okunmamış". Badge `bg-primary` capped "99+". Popover `role="dialog"`, `aria-label="Bildirimler"`; Escape and outside click close and return focus to the bell. Mobile: fixed panel `inset-x-3 top-[4.25rem]`, max height `70dvh`; ≥ md: absolute `w-96`. Footer link "Tüm bildirimler" → `/bildirimler`. Empty state: bell-off icon + "Her şey yolunda" + "Yeni bir gelişme olduğunda burada görünür.". Live: poll summary every 20 s while visible + on focus/visibilitychange; `router.refresh()` when `unread` or `latestId` differs. Existing 60 s `router.refresh()` kept (it also refreshes the call-queue banner).

- [ ] Group tests (Istanbul midnight edge), implement, verify at 390 and 1440 px in dev, commit.

### Task 6: `/bildirimler` page + anchors

**Files:** Create `app/(app)/bildirimler/page.tsx`. Modify `app/(app)/ayarlar/page.tsx` (wrap WA block `id="whatsapp" className="scroll-mt-20"`), `app/(app)/bugun/page.tsx` (`id="ziyaretler"` on visits section), `app/(app)/geri-bildirim/page.tsx` (`id="gb-{id}"` + `scroll-mt-20` on each item).

- Page: title "Bildirimler", segmented filter `?filtre=okunmamis|tumu` (default tumu), up to 100 rows, grouped list, "Tümünü okundu say". Verify in dev, commit.

### Task 7: Full verification + review

- [ ] `pnpm turbo run lint typecheck test` (allowed failure: `tests/rls/ads-store.test.ts`).
- [ ] `next build` for web and panel (panel with dummy Supabase env).
- [ ] `superpowers:requesting-code-review` on the whole branch; fix findings; re-run checks.
