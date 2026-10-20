# Notifications rebuild: rulings ledger

Overnight session, no questions to the owner. Each ruling records what was decided and what it costs if it is wrong.

- Ruling: no migration (0019 stays unused). Dedupe stays as the existing "check then insert" in cron code; prod shows no duplicate rows and crons are single-instance. — cost if wrong: two parallel cron runs could insert a duplicate daily row; fix is a partial unique index in 0019.
- Ruling: live badge by polling a tiny `/api/notifications/summary` endpoint every 20 s (only while the tab is visible, plus on focus), and `router.refresh()` only when something changed. No Supabase realtime: prod has no table in the `supabase_realtime` publication, and turning it on needs a migration plus a prod change. — cost if wrong: up to 20 s delay and one cheap request per open tab every 20 s.
- Ruling: keep the existing 60 s `router.refresh()` in the bell; it also keeps the call-queue banner fresh. — cost if wrong: extra page work every minute, which already happens today.
- Ruling: opening the menu no longer marks everything read. Clicking a notification marks that one; "Tümünü okundu say" marks all. — cost if wrong: the badge feels sticky for staff who only glance; one click on "Tümünü okundu say" clears it.
- Ruling: lead names are added at read time (one `leads` query for the visible rows), not stored in payloads. Old rows get names too. — cost if wrong: one extra small query per page load.
- Ruling: `randevu_bugun` payload also stores `parentName` going forward (cheap, already joined). Link: today's → `/bugun#ziyaretler`, older → the lead page.
- Ruling: `geciken_ozet` text counts installments ("13 taksit"), because the payload `count` is installments, not parents. — cost if wrong: Mert may prefer "veli" wording; changing needs a distinct-student count in the cron.
- Ruling: stale noise is auto-read by `cron/daily`: older unread `geciken_ozet` when a new weekly one arrives, and unread `randevu_bugun` from earlier days. Rows are never deleted. — cost if wrong: someone who wanted last week's summary unread sees it read; it is still listed.
- Ruling: recipients unchanged. Every type already goes to people who can act on it (yonetici-only screens → yonetici; offer outcomes → offer creator; `randevu_bugun` → creator + yonetici). Danışmans cannot open `/teklifler`, `/pazarlama`, `/ayarlar`, and they never receive those types. — cost if wrong: none found.
- Ruling: add a full `/bildirimler` page (filter Tümü/Okunmamış, 100 rows). The menu shows 20. — cost if wrong: one extra small page.
- Ruling: pre-register `cevapsiz_arama` and `santral_senkron_hata` texts from the `feat/santral` plan so that branch's merge becomes additive. — cost if wrong: two unused cases until santral lands.
- Ruling: unknown types render "Yeni bir sistem bildirimi (tür adı)", link to `/bildirimler`, and log a server warning. — cost if wrong: a cosmetic fallback; the producer test should prevent it from ever showing.
- Ruling: fixed `/ayarlar#whatsapp` (anchor did not exist) and gave each feedback item an anchor so links land on the item. Small additive edits.
- Ruling: TS producers go through one typed helper `insertNotifications`; a source-scan test fails if any producer (TS or SQL) uses a type without text. — cost if wrong: other branches adding a raw insert will fail this test after merge, which is intended.
- Ruling: the summary endpoint keeps going through the auth middleware, because it refreshes expired access tokens. The bell fetches with `redirect: "manual"` and stops polling for good on a redirect or a 401. — cost if wrong: a tab whose session died stops updating the live badge until reload; it would have to reload anyway.
- Ruling: the `randevu_bugun` text no longer says "Bugün" ("17:19 randevu: Ayşe Yılmaz"), because the day heading already shows the date. — cost if wrong: wording only.
- Ruling: `/bugun#ziyaretler` may not auto-scroll on a direct mobile load while the page is still streaming. This is the same as the existing `#takip` anchor and was left as is. — cost if wrong: the user scrolls once.
- Ruling: the `/geri-bildirim` item anchors go on the "all" list for yönetici and on "mine" for everyone else, so no id is ever duplicated. — cost if wrong: none.
- Ruling: the optimistic read logic is duplicated between the bell and `/bildirimler` (about 20 lines) instead of being shared as a hook. — cost if wrong: two places to change later.
