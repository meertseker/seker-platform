# Panel notification inventory

Snapshot taken 2026-10-20 on `origin/main` (2ecf12e) plus a read-only look at prod.
Table: `public.notifications (id, user_id, type, payload jsonb, read_at, created_at)`.
RLS: a user selects/updates only their own rows; any active staff may insert.

## Producers and types

| Type | Created in | Recipients | Payload | Text before this branch | Click target before |
|---|---|---|---|---|---|
| `teklif_onay_bekliyor` | `actions/offers.ts` `notifyManagers` (via `notify`) | active `yonetici` | `leadId, offerId, offered` (TL number) | "Onay bekleyen yeni teklif: 21.000,00 ₺" | `/teklifler` |
| `teklifiniz_onaylandi` | `actions/offers.ts` `decideOffer` | offer creator | `leadId, offerId` | "Teklifiniz onaylandı." | `/leads/{leadId}` |
| `teklif_reddedildi` | `actions/offers.ts` `decideOffer` | offer creator | `leadId, offerId` | "Teklifiniz reddedildi." | `/leads/{leadId}` |
| `teklif_revize_edildi` | `actions/offers.ts` `decideOffer` (counter price) | offer creator | `leadId, offerId, counterPrice` | "Teklif için karşı rakam girildi: …" | `/leads/{leadId}` |
| `teklif_karsi_onaylandi` | `actions/offers.ts` (counter accepted) | offer creator | `leadId, offerId, counterPrice` | "Teklif karşı rakamla onaylandı: …" | `/leads/{leadId}` |
| `web_basvuru` | SQL `create_web_lead` (0006, redefined 0014; 0016 on `feat/reklam-suiti-2` keeps it) | active `yonetici` + web lead assignee | `leadId, parentName, source, landingPath, duplicate` | "Yeni web başvurusu: Ayşe (/lp/…)" / "Ayşe siteden tekrar başvurdu" | `/leads/{leadId}` |
| `geri_bildirim` | SQL trigger `notify_feedback` (0010) | active `yonetici` | `feedbackId, kind, title, by` | "Mert hata bildirdi: …" | `/geri-bildirim` |
| `veli_bekliyor` | `app/api/cron/leads` (every 5 min, business hours) | active `yonetici` | `leadId, parentName, minutes` | "Ayşe 15 dakikadır aranmadı" | `/leads/{leadId}` |
| `ads_senkron_hata` | `app/api/cron/ads` | active `yonetici`, once per day | `message, tarih` | "Google Ads senkronu bu sabah başarısız oldu…" | `/pazarlama` |
| `wa_baglanti_koptu` | `lib/wa/run.ts` `notifyDisconnected` | active `yonetici`, once per day | `tarih` | "WhatsApp bağlantısı koptu…" | `/ayarlar#whatsapp` (anchor did not exist) |
| `randevu_bugun` | `app/api/cron/daily` rule 2 (03:00) | appointment creator + active `yonetici`, once per appointment per day | `appointmentId, leadId, at, tarih` | **"Yeni bildirim var."** | `/leads/{leadId}` |
| `geciken_ozet` | `app/api/cron/daily` rule 5 (Mondays) | active `yonetici`, once per day | `count` (installments), `totalKurus, totalFormatted, tarih` | **"Yeni bildirim var."** | `/` |

Added by `feat/reklam-suiti-2` (content tasks, `actions/content.ts` via `notify` → `insertNotifications`, service role):

| Type | Recipients | Payload | Text | Click target |
|---|---|---|---|---|
| `icerik_gorev` | task owner (`ogretmen`) | `contentId, code` | "Yeni içerik görevi: R-2643-A" | `/gorevim` |
| `icerik_teslim` | active `yonetici` | `contentId, code` | "R-2643-A teslim edildi, onayını bekliyor" | `/reklam/icerik?kod=…` |
| `icerik_duzeltme` | task owner | `contentId, code, note` | "R-2643-A için düzeltme istendi: …" | `/gorevim` |
| `icerik_onay` | task owner | `contentId, code` | "R-2643-A onaylandı" | `/gorevim` |

Teachers only open `/gorevim`; their bell sends every row there (`fixedHref`).

Planned on other branches (not produced on main yet): `cevapsiz_arama`, `santral_senkron_hata`
(`feat/santral` plan). Texts for them are pre-registered on this branch so that merge is additive.

## Prod (read-only, 2026-10-20)

- Rows: `geciken_ozet` 6 (weekly, 2026-09-14 → 2026-10-19), `randevu_bugun` 1, `teklif_onay_bekliyor` 1. All already read.
- Profiles: 1 active `yonetici`, 4 active `danisman`. No other roles.
- No table is in the `supabase_realtime` publication.

## Dedupe as found

- `cron/daily`: `notificationExists(user, type, {tarih[, appointmentId]})` before each insert. Works for a
  same-day rerun. It does not stop weekly `geciken_ozet` rows from piling up (each Monday is a new `tarih`),
  and yesterday's unread `randevu_bugun` stays unread forever.
- `cron/ads`, `lib/wa/run.ts`: one row per user per `tarih`.
- `cron/leads`: one `veli_bekliyor` per lead, ever.
- SQL producers: `web_basvuru` duplicate is suppressed when a recent activity exists (`v_recent`).
