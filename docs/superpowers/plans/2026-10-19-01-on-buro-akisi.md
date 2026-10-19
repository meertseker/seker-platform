# Aşama 1 · Ön Büro Akışı — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reklamdan, formdan ya da mesajdan gelen her veli panelde kayıt olsun, ortak listeden 5 dakikada aransın, ulaşılamazsa 7 günlük takip sırasına girsin, randevusu hatırlatılsın. Bunların hepsi prototipteki ekranlarla olsun.

**Architecture:** Kurallar saf TS modüllerinde (`apps/panel/lib/lead-flow/*`) durur ve birim testlidir: mesai saati, sayaç rengi, takip sırası, randevu görevleri. Sunucu eylemleri bu modülleri çağırıp Supabase'e yazar. Otomatik işler mevcut `tasks.rule_key` deseniyle tekilleştirilir. Görevler artık saat taşır (`tasks.due_at`). 15 dakika uyarısı 5 dakikada bir çalışan yeni bir cron uç noktasıyla verilir.

**Tech Stack:** Next.js 16 (panel ve web), Supabase Postgres + RLS, Vitest (birim testler ve `tests/rls` yerel Supabase testleri), Tailwind v4 token'ları (`apps/panel/app/globals.css`), lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-19-reklam-suiti-design.md`. Bölüm 6 (kararlar, K2–K6, "Kullanıcı kararları") ve Bölüm 8, ekran 1–4. Arayüz referansı: https://claude.ai/artifact/XW3PqbxYLpt45VVhRVcnbB (ekran 1–4: yerleşim, metin tonu ve adımlar bağlayıcı).

## Global Constraints

- Arayüz metinleri Türkçe. Prototipteki ifadeler kullanılır: "Şimdi ara", "Takip aramaları", "Bugünkü ziyaretler", "Instagram / WhatsApp mesajını ekle", "Ne söyleyeceğim", "Uygun mu?", "Sonuç", "Panel şunları yaptı", "Sıradaki işe geç".
- Dokunma hedefleri en az 44 px, ana eylem 56 px (`min-h-14`). Renkler yalnız `globals.css` token'larından (`bg-primary`, `text-accent`, `bg-warning-soft`…). Ham hex yok.
- Sayaç renkleri: 5 dakikaya kadar yeşil, 5–15 dakika sarı, 15 dakikanın üstü kırmızı.
- Mesai varsayılanı: hafta içi 08:30–18:00 (Europe/Istanbul, sabit +03:00). Ayarlar'dan değişir (K2).
- Nitelikli veli = `q_age_ok && q_area_ok && q_timing_ok && q_reached`.
- Takip sırası ilk denemeye göre (mesaiye kaydırılmış): +3 saat, ertesi gün 10:00, ertesi gün 18:30, 3. gün 10:00 (arama + iki ziyaret saati mesajı), 7. gün 10:00 (son deneme). 7. günde de açmazsa veli `kaybedildi` / `ulasilamadi` olur. Saat mesai dışına düşerse sonraki mesai başlangıcına kayar. Tek istisna 18:30 akşam araması: mesai bitişinden sonra olsa da kalır.
- Ziyaret görevleri: randevudan 1 gün önce 10:00 hatırlatma, randevu günü 09:00 hatırlatma. "Geldi" sonrası +1 gün teşekkür mesajı, +2 gün arama, +7 gün son arama. "Gelmedi" aynı gün tekrar arama (bugünkü yarın kuralı değişir).
- Ortak liste: "Ara"ya basan veliyi üstlenir (`assigned_to`, `claimed_at`). Üstlenilen veli 15 dakikada ilk temas almazsa herkese yeniden açılır.
- Rol kontrolleri bugünkü gibi: eylemler `getSessionProfile()`. Ayarlar yalnız `yonetici`.
- Reklam platformlarına hiçbir yeni veri gönderilmez (Aşama 2'nin işi). Onay metni bu aşamada değişmez.
- Migration `packages/db/supabase/migrations/0014_on_buro_akisi.sql` (numara koordinatörle teyit edilir). Sonrasında `pnpm --filter @seker/db gen:types`.
- main'e push, `supabase db push` ve deploy yok. Bitince koordinatöre bildirim.

## Review Focus

1. **Mesai dışı gelen veli:** 22:40'ta gelen form veliyi gece kırmızıya çevirmemeli. Sayaç ertesi gün 08:30'da 0'dan başlar. Test: Task 2.
2. **Aynı veliye iki kişinin aynı anda basması:** İkisi de "Ara"ya basarsa yalnız biri üstlenir. Diğeri "Zehra bu veliyi aradı" görür, takip görevi çiftlenmez. Test: Task 4.
3. **Aynı telefonla tekrar başvuru / mesaj:** Açık bir veli varsa yeni kayıt açılmaz. Mevcut veli öne çıkar, yeni kanal ve kod not olarak eklenir (bugünkü `create_web_lead` mükerrer yolu gibi). Test: Task 6.
4. **Takip sırası ortasında veli kendisi dönerse:** Ulaşıldığı an açık `takip:*` görevlerinin hepsi kapanır, sıra durur. Test: Task 4.
5. **Randevu saati değişirse / iptal olursa:** Eski hatırlatma görevleri kapanır, yenisi kurulur. Gelmeyen bir randevu için ertesi gün hatırlatma kalmamalı. Test: Task 5.

---

### Task 1: Migration — alanlar, ayarlar, görev saati

**Files:**
- Create: `packages/db/supabase/migrations/0014_on_buro_akisi.sql`
- Modify: `packages/db/src/database.types.ts` (üretilir)
- Test: `apps/panel/tests/rls/on-buro-akisi.test.ts`

**Interfaces:**
- Produces (DB):
  - `leads`: `channel text check in ('form','ig_dm','ig_yorum','whatsapp','telefon')`, `content_code text`, `district text`, `start_window text check in ('hemen','1_3_ay','3_6_ay','gelecek_yil')`, `wants_whatsapp bool`, `first_contact_at timestamptz`, `claimed_at timestamptz`, `q_age_ok bool`, `q_area_ok bool`, `q_timing_ok bool`, `q_reached bool` (hepsi null olabilir), `is_qualified bool generated always as (coalesce(q_age_ok,false) and coalesce(q_area_ok,false) and coalesce(q_timing_ok,false) and coalesce(q_reached,false)) stored`, `contact_note text`.
  - `leads_source_check` listesine `whatsapp` eklenir. `lost_reason` listesine `yas_uymuyor`, `gelecek_yil` eklenir.
  - `tasks.due_at timestamptz` eklenir (null olabilir; eski kayıtlar için `due_date` geçerli).
  - `app_settings` tohumları: `mesai = {"days":[1,2,3,4,5],"start":"08:30","end":"18:00"}`, `servis_semtleri = ["Beykent","Beylikdüzü","Büyükçekmece","Esenyurt","Gürpınar","Yakuplu"]`, `arama_metni` (prototipteki 4 adım, `{veli}` `{danisman}` `{cocuk_yasi}` `{semt}` yer tutucularıyla), `fiyat_cevabi` (`"[ARALIK]"` yer tutuculu metin), `wa_sablonlari` = `[{key,label,text}]` (`ulasilamadi`, `ziyaret_saatleri`, `randevu_onay`, `ziyaret_tesekkur`, `kontenjan`), `ustlenme_dk = 15`.
  - `create_web_lead` imzası değişmez. `p_meta` içinden şu anahtarlar okunur: `child_birth_month`, `child_birth_year`, `district`, `start_window`, `wants_whatsapp`. Ayrıca `channel='form'` yazılır ve `content_code = p_utm->>'utm_content'` (yalnız `^[RS]-\d{4}-[A-Z]$` ise). Mükerrer yolda boş alanlar `coalesce` ile doldurulur.
- Consumes: mevcut `create_web_lead` (`0006`), `app_settings` (`0001`), `tasks` (`0001`).

- [ ] **Step 1: Write the failing test** `tests/rls/on-buro-akisi.test.ts`:
  - `create_web_lead p_meta ile nitelik alanlarını yazar`: `admin.rpc('create_web_lead', {..., p_utm: {utm_content:'R-2645-A'}, p_meta: {child_birth_month:3, child_birth_year:2023, district:'Beykent', start_window:'hemen', wants_whatsapp:true}})`, ardından lead satırında `channel='form'`, `content_code='R-2645-A'`, `district='Beykent'`, `start_window='hemen'`, `is_qualified=false`.
  - `utm_content kod biçiminde değilse content_code boş kalır` (`utm_content:'kis_kampanyasi'`).
  - `is_qualified dört işaret true olunca true`: `admin.from('leads').update({q_age_ok:true,q_area_ok:true,q_timing_ok:true,q_reached:true})`, sonra `is_qualified === true`.
  - `danışman app_settings mesai okur ama yazamaz`: `clientFor('danisman@test.local')` ile select başarılı, update hata.
  - `whatsapp kaynağı ve yeni kayıp nedenleri kabul edilir`.
- [ ] **Step 2:** `pnpm db:start` sonra `pnpm --filter @seker/panel test tests/rls/on-buro-akisi.test.ts` → FAIL (kolon yok).
- [ ] **Step 3:** Migration'ı yaz. `create or replace function create_web_lead` mevcut gövdeyi korur, yalnız yukarıdaki alanları ekler. Yetkiler 0006'daki gibi (yalnız service_role).
- [ ] **Step 4:** `pnpm --filter @seker/db exec supabase db reset`, sonra `pnpm --filter @seker/db gen:types`, ardından test → PASS. `pnpm --filter @seker/panel test` hepsi PASS (mevcut testler kırılmamalı).
- [ ] **Step 5: Commit** `feat(db): ön büro akışı alanları, mesai ve şablon ayarları`

### Task 2: Mesai saati ve sayaç (saf modül)

**Files:**
- Create: `apps/panel/lib/lead-flow/business-hours.ts`
- Test: `apps/panel/tests/unit/business-hours.test.ts`

**Interfaces:**
- Produces:
  - `type BusinessHours = { days: number[]; start: string; end: string }` (gün: 1=Pazartesi … 7=Pazar, saat `"HH:MM"` İstanbul)
  - `DEFAULT_BUSINESS_HOURS: BusinessHours`
  - `clockStart(createdAt: Date, hours: BusinessHours): Date`: mesai içindeyse kendisi, değilse sonraki mesai başlangıcı.
  - `nextBusinessMoment(at: Date, hours: BusinessHours): Date` (aynı mantık, takip için)
  - `elapsedMinutes(start: Date, now: Date): number` (negatifse 0)
  - `timerTone(minutes: number): "ok" | "warn" | "late"` (≤5 ok, ≤15 warn, >15 late)
  - `istanbulAt(dateString: string, hhmm: string): Date` (`"2026-11-04"`, `"10:00"` → `2026-11-04T10:00:00+03:00`)

- [ ] **Step 1: Write the failing tests:**
  - `mesai içindeki form hemen başlar`: Salı 10:12 → 10:12.
  - `akşam gelen form ertesi sabah başlar`: Salı 22:40 → Çarşamba 08:30.
  - `cuma akşamı gelen form pazartesi başlar`: Cuma 18:05 → Pazartesi 08:30.
  - `timerTone sınırları`: 5 → ok, 6 → warn, 15 → warn, 16 → late.
  - `başlangıç gelecekteyse geçen süre 0`: `elapsedMinutes(Çarşamba 08:30, Salı 23:00) === 0`.
- [ ] **Step 2:** `pnpm --filter @seker/panel test tests/unit/business-hours.test.ts` → FAIL.
- [ ] **Step 3:** Uygula. Saat hesabı UTC üzerinden, sabit +03:00 (projedeki diğer yardımcılarla aynı varsayım).
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): mesai saati ve aday sayacı kuralları`

### Task 3: Takip sırası ve ziyaret görevleri (saf modül)

**Files:**
- Create: `apps/panel/lib/lead-flow/followups.ts`
- Test: `apps/panel/tests/unit/followups.test.ts`

**Interfaces:**
- Consumes: `BusinessHours`, `nextBusinessMoment`, `istanbulAt` (Task 2)
- Produces:
  - `type PlannedTask = { ruleKey: string; title: string; dueAt: Date; kind: "arama" | "whatsapp"; templateKey?: string }`
  - `FOLLOWUP_STEPS = 5`
  - `followupAfterAttempt(leadId: string, leadName: string, attempt: number, attemptAt: Date, firstAttemptAt: Date, hours: BusinessHours): PlannedTask | null`. `attempt` başarısız denemenin sırası (1 = ilk arama). Gün sayımı `firstAttemptAt`'in takvim gününe göre yapılır. 1→`attemptAt`+3 saat, 2→ertesi gün 10:00, 3→ertesi gün 18:30, 4→3. gün 10:00 (`templateKey:"ziyaret_saatleri"`), 5→7. gün 10:00, 6→`null` (sıra bitti). `ruleKey = takip:<leadId>:<attempt+1>`.
  - `appointmentTasks(apptId: string, leadName: string, scheduledAt: Date, now: Date): PlannedTask[]`: `hatirlat:<apptId>:once` (1 gün önce 10:00, `templateKey:"randevu_onay"`) ve `hatirlat:<apptId>:sabah` (aynı gün 09:00). `now`'dan önce kalan atlanır.
  - `afterVisitTasks(apptId: string, leadName: string, visitedAt: Date, hours: BusinessHours): PlannedTask[]`: `ziyaret:<apptId>:1` (+1 gün 10:00, whatsapp, `ziyaret_tesekkur`), `ziyaret:<apptId>:2` (+2 gün 10:00 arama), `ziyaret:<apptId>:3` (+7 gün 10:00 arama).
  - `noShowTask(apptId: string, leadName: string, now: Date, hours: BusinessHours): PlannedTask` (`noshow:<apptId>`, `nextBusinessMoment(now)`)
  - Başlıklar prototipteki gibi: `"2. deneme · <ad>"`, `"Ziyaret hatırlatması · <ad>"`, `"Ziyaret sonrası arama · <ad>"`.

- [ ] **Step 1: Write the failing tests:**
  - `ilk arama açılmazsa 3 saat sonra`: Salı 10:00 deneme 1 → Salı 13:00, `takip:L1:2`.
  - `+3 saat mesai dışına taşarsa sabaha kayar`: Salı 16:30 → Çarşamba 08:30.
  - `ertesi gün akşam 18:30 mesai dışı olsa da kalır`: deneme 3 → ilk denemenin ertesi günü 18:30.
  - `5. denemeden sonra sıra biter`: deneme 6 → `null`.
  - `cumartesiye düşen 3. gün pazartesiye kayar`: ilk deneme Perşembe, deneme 4 → Pazartesi 10:00.
  - `randevu hatırlatmaları`: Perşembe 16:30 randevu, now Salı → Çarşamba 10:00 ve Perşembe 09:00. now Çarşamba 11:00 → yalnız Perşembe 09:00.
  - `gelmedi görevi aynı gün`: Salı 11:00 → Salı 11:00 (`noshow:A1`).
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): takip sırası ve ziyaret görevleri kuralları`

### Task 4: Üstlenme ve arama kaydı (sunucu eylemleri)

**Files:**
- Create: `apps/panel/actions/lead-flow.ts`
- Create: `apps/panel/lib/lead-flow/settings.ts`
- Create: `apps/panel/lib/lead-flow/tasks-store.ts`
- Test: `apps/panel/tests/unit/lead-flow-actions.test.ts`, `apps/panel/tests/rls/lead-flow.test.ts`

**Interfaces:**
- Consumes: Task 2 ve 3 modülleri, `createAppointment` (`actions/appointments.ts`), `updateLeadStatus` (`actions/leads.ts`), `logEvent` (`lib/events.ts`), `getSessionProfile`.
- Produces:
  - `getLeadFlowSettings(supabase): Promise<{ hours: BusinessHours; districts: string[]; callScript: string[]; priceAnswer: string; templates: {key:string;label:string;text:string}[]; claimMinutes: number }>` (eksik anahtarda varsayılan)
  - `upsertPlannedTasks(supabase, leadId: string | null, assignedTo: string, tasks: PlannedTask[]): Promise<void>`: `rule_key` ile; `due_at` ve `due_date` (İstanbul günü) birlikte yazılır, 23505 yok sayılır.
  - `closeTasksByPrefix(supabase, prefix: string): Promise<void>` (`rule_key like prefix%`, açık olanlar `tamamlandi`)
  - `claimLead(leadId: string): Promise<{ ok: true } | { ok: false; claimedBy: string }>`: koşullu güncelleme (`first_contact_at is null and (assigned_to is null or assigned_to = me or claimed_at < now() - claimMinutes)`). Etkilenen satır yoksa sahibin adını döner.
  - `type CallResult = "randevu" | "geri_ara" | "ulasilamadi" | "uygun_degil"`
  - `recordCall(input: { leadId: string; result: CallResult; quals: { age: boolean; area: boolean; timing: boolean; reached: boolean }; note?: string; appointmentAt?: string; callbackAt?: string; notFitReason?: "yas_uymuyor" | "uzaklik" | "gelecek_yil" | "baska_okul" }): Promise<{ done: string[] } | { error: string }>`
    - Her sonuçta: `first_contact_at` boşsa doldur, `assigned_to` = çağıran, nitelik alanları ve `contact_note` yazılır, `lead_notes` satırı ve `arama_kaydi` olayı yazılır.
    - `randevu`: `q_reached` true. Açık `takip:<id>:*` görevleri kapanır. `createAppointment(leadId, appointmentAt, "okul_ziyareti")`, sonra `appointmentTasks`. `done` = `["Ziyaret takvime yazıldı: <gün saat>", "WhatsApp onay mesajı hazır · veli kartından gönder", "1 gün önce ve aynı sabah hatırlatma kuruldu"]`.
    - `geri_ara`: `q_reached` true, `takip:*` kapanır. `callbackAt` için tek görev (`geri:<id>`). Durum `yeni` ise `ulasildi`.
    - `ulasilamadi`: Deneme sırası açık `takip:<id>:n` görevinden ya da yoksa 1 alınır. O görev kapanır, `followupAfterAttempt` ile sonraki kurulur. `null` dönerse durum `kaybedildi`/`ulasilamadi`. `done` sonraki adımı söyler ("3 saat sonra tekrar arama görevi açıldı").
    - `uygun_degil`: Durum `kaybedildi`, `lost_reason = notFitReason`, `takip:*` kapanır.
  - Yeni olay türü `arama_kaydi`: `EVENT_LABELS` içine "Arama kaydedildi" eklenir.

- [ ] **Step 1: Write the failing unit tests** (`feedback-actions.test.ts` desenindeki gibi `@/lib/auth`, `@/lib/supabase/server`, `next/cache` mock'lanır):
  - `ulaşılamadı ilk denemede +3 saat görevi kurar`: `done[0]` "3 saat sonra" içerir. `upsert` çağrısında `rule_key: "takip:L1:2"`.
  - `randevu takip görevlerini kapatır ve hatırlatmaları kurar`.
  - `5. başarısız denemeden sonra veli ulaşılamadı olarak kapanır`.
  - `uygun değil nedeni kayıp nedenine yazılır`.
- [ ] **Step 2: Write the failing RLS tests** (`tests/rls/lead-flow.test.ts`, gerçek DB):
  - `iki danışman aynı anda üstlenirse yalnız biri kazanır`: `Promise.all([claim(A), claim(B)])`, tam olarak bir `ok: true`. (Bu test için seed'e ikinci danışman `danisman2@test.local` eklenir: `packages/db/supabase/seed.sql`.)
  - `15 dakikayı geçmiş üstlenme başkasına açılır`: `claimed_at` 16 dk geriye çekilir, B kazanır.
  - `ulaşıldığında açık takip görevleri kapanır` (Review Focus 4).
- [ ] **Step 3:** Testler → FAIL.
- [ ] **Step 4:** Uygula. `claimLead` tek `update ... returning` ile yapılır, okuma-sonra-yazma yok.
- [ ] **Step 5:** Testler → PASS.
- [ ] **Step 6: Commit** `feat(panel): veli üstlenme ve arama kaydı akışı`

### Task 5: Randevu görevlerini mevcut akışa bağla

**Files:**
- Modify: `apps/panel/actions/appointments.ts` (`createAppointment`, `setAppointmentOutcome`, randevu tarihi değiştirme varsa o da)
- Test: `apps/panel/tests/unit/appointments-tasks.test.ts`

**Interfaces:**
- Consumes: `appointmentTasks`, `afterVisitTasks`, `noShowTask` (Task 3), `upsertPlannedTasks`, `closeTasksByPrefix` (Task 4)
- Produces: Panelin her yerinden kurulan randevu artık hatırlatma görevlerini kurar. `gelmedi` görevi aynı gün olur (ertesi gün değil).

- [ ] **Step 1: Write the failing tests:**
  - `randevu oluşunca iki hatırlatma görevi kurulur`.
  - `geldi işaretlenince hatırlatmalar kapanır, ziyaret sonrası 3 görev kurulur`.
  - `gelmedi işaretlenince hatırlatmalar kapanır, aynı gün noshow görevi kurulur`.
  - `iptal ya da ertelendi olunca hatırlatmalar kapanır` (Review Focus 5).
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula. Bugünkü `noshow` görev kodunu `noShowTask` ile değiştir.
- [ ] **Step 4:** `pnpm --filter @seker/panel test` → PASS (mevcut randevu testleri dahil).
- [ ] **Step 5: Commit** `feat(panel): randevu hatırlatma ve ziyaret sonrası görevleri`

### Task 6: Mesajdan veli ekle

**Files:**
- Modify: `apps/panel/actions/lead-flow.ts`
- Create: `apps/panel/app/(app)/leads/mesaj/page.tsx`, `apps/panel/components/message-lead-form.tsx`
- Modify: `apps/panel/components/nav.tsx` (ortadaki "+" bu ekrana gider, eski `/leads/new` "Elle veli ekle" bağlantısı olarak ekranın altında kalır)
- Test: `apps/panel/tests/unit/message-lead.test.ts`

**Interfaces:**
- Produces:
  - `type MessageChannel = "ig_dm" | "ig_yorum" | "whatsapp" | "telefon"`
  - `createMessageLead(input: { channel: MessageChannel; phone: string; parentName?: string; contentCode?: string; messageAt?: string }): Promise<{ id: string; duplicate: boolean } | { error: string }>`
    - Telefon `normalizeTurkishPhone` (`@seker/shared`) ile. Açık bir veli varsa yeni kayıt açılmaz: `content_code` boşsa doldurulur, not ve `mesaj_tekrar` olayı eklenir, `duplicate: true` döner.
    - Yeni velide `source`: `ig_*` → `instagram`, `whatsapp` → `whatsapp`, `telefon` → `telefon`. `channel` yazılır. `parent_name` boşsa `"Instagram velisi"` / `"WhatsApp velisi"`. `created_at = messageAt ?? now`. `assigned_to` boş (ortak liste).
  - `recentContentCodes(): Promise<{ code: string; count: number }[]>` (son 28 gündeki `leads.content_code`, çoktan aza)
- Ekran prototipteki 3 adım. Telefon zorunlu. "Numara vermediyse" mesajı kopyalanabilir. Kayıt sonrası özet ve "Şimdi ara" (Arama ekranına gider).

- [ ] **Step 1: Write the failing tests:**
  - `instagram mesajı instagram kaynağıyla ve boş sahipli açılır`.
  - `aynı telefonla açık veli varsa mükerrer döner ve kod eklenir` (Review Focus 3).
  - `geçersiz telefon hata döner`.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Eylemi ve ekranı uygula.
- [ ] **Step 4:** Test → PASS. `pnpm --filter @seker/panel dev` ile ekranı telefon genişliğinde (390 px) aç, prototipteki ekran 3 ile karşılaştır.
- [ ] **Step 5: Commit** `feat(panel): mesajdan veli ekleme ekranı`

### Task 7: Bugün ekranı — Şimdi ara, Takip, Ziyaretler

**Files:**
- Create: `apps/panel/lib/queries/call-queue.ts`, `apps/panel/components/call-queue-card.tsx` (istemci, sayaç her 30 sn), `apps/panel/components/today-help.tsx`
- Modify: `apps/panel/app/(app)/bugun/page.tsx`
- Test: `apps/panel/tests/unit/call-queue.test.ts`

**Interfaces:**
- Consumes: `clockStart`, `elapsedMinutes`, `timerTone` (Task 2), `getLeadFlowSettings`, `claimLead` (Task 4)
- Produces:
  - `type QueueLead = { id; parentName; phone; source; channel; contentCode; childAge: number | null; district; startWindow; startedAt: string; claimedByName: string | null }`
  - `loadCallQueue(supabase, me: string, now: Date): Promise<QueueLead[]>`: `first_contact_at is null`, durum `yeni`, kaynak `reklam | web_sitesi | instagram | whatsapp` ya da `channel` dolu. Başkasının 15 dakikadan yeni üstlendiği veli listede "Zehra arıyor" etiketiyle kalır ama "Ara" düğmesi pasiftir. En eski üstte.
  - `loadFollowupTasks(supabase, me: string, role, today: string)`: bugün vadeli açık görevler, `due_at`'e göre. Danışman yalnız kendininkini görür (bugünkü kural).
- Ekran düzeni (prototip ekran 1): başlık ve "?" yardımı (ilk açılışta açık, kapatılınca `localStorage` `seker_bugun_yardim=0`), "Instagram / WhatsApp mesajını ekle" düğmesi, "Şimdi ara", "Takip aramaları", "Bugünkü ziyaretler" (Geldi/Gelmedi mevcut `setAppointmentOutcome`), sonra bugünkü diğer bölümler (tahsilat, onaylar, bu ay) aşağıda kalır. Bugünkü "Sıradaki iş" kartı kaldırılır, yerini "Şimdi ara" alır. Kart "Ara"ya basınca önce `claimLead`, sonra `/leads/<id>/ara`.

- [ ] **Step 1: Write the failing tests** (`loadCallQueue` için sorgu oluşturucu mock'u ya da saf sıralama/etiketleme yardımcısı `labelQueue(rows, me, now, claimMinutes)`):
  - `başkasının taze üstlendiği veli pasif görünür`.
  - `15 dakikayı geçmiş üstlenme aktif görünür`.
  - `mesai dışı gelen velinin sayacı mesai başında başlar` (Review Focus 1).
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS. Dev sunucuda danışman hesabıyla 390 px'te prototip ekran 1 ile karşılaştır.
- [ ] **Step 5: Commit** `feat(panel): Bugün ekranında ortak arama listesi ve sayaç`

### Task 8: Arama ekranı

**Files:**
- Create: `apps/panel/app/(app)/leads/[id]/ara/page.tsx`, `apps/panel/components/call-screen.tsx`, `apps/panel/lib/lead-flow/script.ts`
- Test: `apps/panel/tests/unit/call-script.test.ts`

**Interfaces:**
- Consumes: `recordCall`, `getLeadFlowSettings` (Task 4), `waMeUrl` (`lib/whatsapp.ts`), randevu çakışma kontrolü (`createAppointment` içindeki)
- Produces:
  - `fillScript(lines: string[], vars: { veli: string; danisman: string; cocukYasi: string; semt: string }): string[]` (bilinmeyen yer tutucu olduğu gibi kalır)
  - `ageFromBirth(month: number | null, year: number | null, now: Date): number | null`
  - `suggestSlots(existing: { scheduled_at: string }[], now: Date, hours: BusinessHours, count = 3): string[]` (önümüzdeki 5 iş gününde, 10:00 / 11:00 / 16:30 adaylarından `cakisma_dakika` ile çakışmayan ilk 3)
- Ekran prototip ekran 2: üstte ad, sayaç, kaynak ve form cevapları. "1 · Ne söyleyeceğim" (`fillScript`), "Fiyat sorarsa ne diyeceğim?" açılır kutusu. "2 · Uygun mu?" 4 işaret: form cevaplarından ön doldurulur (yaş 2–6 → `age`, semt servis listesinde → `area`, `start_window` `hemen`/`1_3_ay`/`3_6_ay` → `timing`), `reached` varsayılan true. Not alanı. "3 · Sonuç" 4 seçenek, randevuda `suggestSlots` + "Başka saat" (tarih-saat girişi). "Uygun değil"de neden seçimi zorunlu. Altta sabit kaydet düğmesi. Kayıttan sonra `done` listesi, "WhatsApp mesajını gönder" (`randevu_onay` şablonu, `waMeUrl`) ve "Sıradaki işe geç" (`/bugun`).

- [ ] **Step 1: Write the failing tests:**
  - `fillScript yer tutucuları doldurur`.
  - `ageFromBirth Mart 2023 doğumluya Kasım 2026'da 3 der`.
  - `suggestSlots dolu saati atlar` (10:00'da randevu varsa ilk öneri 11:00).
  - `suggestSlots hafta sonunu atlar`.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS. Dev sunucuda dört sonucun hepsini dene, prototip ekran 2 ile karşılaştır.
- [ ] **Step 5: Commit** `feat(panel): adım adım arama ekranı`

### Task 9: Veli kartı — Nereden geldi, takip sırası, hazır mesajlar

**Files:**
- Create: `apps/panel/components/lead-origin-card.tsx`, `apps/panel/components/followup-timeline.tsx`, `apps/panel/components/message-templates.tsx`
- Modify: `apps/panel/app/(app)/leads/[id]/page.tsx`, `apps/panel/lib/lead-attribution.ts`
- Test: `apps/panel/tests/unit/lead-origin.test.ts`

**Interfaces:**
- Consumes: `FOLLOWUP_STEPS` (Task 3), `getLeadFlowSettings`, `waMeUrl`, `recordCall` (Task 4, "Açmadı" düğmesi `result:"ulasilamadi"` ile)
- Produces:
  - `originLines(lead): { channelLabel: string; codeLabel: string | null; answers: string[] }` (`attributionLines`'ın yanına; kanal etiketleri: "Sayfa formu", "Instagram mesajı", "Instagram yorumu", "WhatsApp", "Telefon"; kaynak Google ise "Google · <landing_path>")
  - `fillTemplate(text: string, vars: { veli: string; danisman: string }): string`
- Kartta: aşama çubuğu (mevcut `StageStepper`), "Nereden geldi", takip zaman çizelgesi (`takip:<id>:*` görevlerinden: yapıldı / şimdi / sırada), "Ara · açtı" (Arama ekranı) ve "Açmadı", hazır mesajlar (dokununca `wa.me`).

- [ ] **Step 1: Write the failing tests:** `originLines` Instagram mesajı + kod için doğru etiketleri döner; Google veli için landing path'i yazar; `fillTemplate` yer tutucuları doldurur.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS. Dev sunucuda prototip ekran 4 ile karşılaştır.
- [ ] **Step 5: Commit** `feat(panel): veli kartında kaynak, takip sırası ve hazır mesajlar`

### Task 10: Web formunda 4 nitelik sorusu

**Files:**
- Modify: `apps/web/lib/leadSchema.ts`, `apps/web/app/components/LeadForm.tsx`, `apps/web/lib/websiteLeads.ts`, `apps/web/app/(lp)/lp/[slug]/LandingView.tsx`
- Modify: `apps/web/lib/content/slots/form.ts` (yeni etiket slotları)
- Test: `apps/web/lib/__tests__/leadSchema.test.ts`, `apps/web/app/components/__tests__/LeadForm.test.tsx`

**Interfaces:**
- Consumes: `create_web_lead` `p_meta` anahtarları (Task 1)
- Produces:
  - `LeadForm` yeni prop `qualify?: boolean` (yalnız `/lp/*` sayfalarında `true`)
  - Şema alanları (yalnız `qualify` iken zorunlu): `childBirthMonth` 1–12, `childBirthYear` (bu yıl −7 … bu yıl), `district` (servis semtleri + "Diğer"), `startWindow` (`hemen` | `1_3_ay` | `3_6_ay` | `gelecek_yil`), `wantsWhatsapp` boolean
  - `createWebLead` bunları `p_meta` olarak geçer.
- Etiketler: "Çocuğunuzun doğum ayı ve yılı", "Oturduğunuz semt", "Ne zaman başlamayı düşünüyorsunuz?" (Hemen / 1–3 ay içinde / 3–6 ay içinde / Gelecek eğitim yılı), "WhatsApp'tan yazmamızı ister misiniz?". Semt listesi web tarafında sabit (`apps/web/content/districts.ts`), panel ayarıyla aynı 6 semt + "Diğer".

- [ ] **Step 1: Write the failing tests:**
  - `qualify açıkken semt eksikse şema reddeder`.
  - `qualify kapalıyken eski form değişmeden geçer` (ana sayfa formu bozulmamalı).
  - `LeadForm qualify ile 4 alanı gösterir`.
- [ ] **Step 2:** `pnpm --filter @seker/web test` → FAIL.
- [ ] **Step 3:** Uygula. `/api/lead` rotası `qualify` alanlarını şemadan alıp `createWebLead`'e geçirir.
- [ ] **Step 4:** Test → PASS. `apps/web/app/__tests__/adTargets.test.ts` hâlâ PASS.
- [ ] **Step 5: Commit** `feat(web): reklam sayfası formunda 4 nitelik sorusu`

### Task 11: 15 dakika uyarısı (cron)

**Files:**
- Create: `apps/panel/app/api/cron/leads/route.ts`
- Modify: `infra/cron/crontab` (`*/5 8-18 * * 1-5`, mevcut satırlar gibi `curl` + `CRON_SECRET`), `apps/panel/lib/notification-text.ts`, `apps/panel/actions/notifications.ts` (`NotificationType`'a `veli_bekliyor`), `apps/panel/components/notification-bell.tsx` (bağlantı `/leads/<id>`)
- Test: `apps/panel/tests/unit/leads-cron-route.test.ts` (`ads-cron-route.test.ts` deseni)

**Interfaces:**
- Consumes: `clockStart`, `elapsedMinutes` (Task 2), `getLeadFlowSettings`
- Produces: `GET /api/cron/leads`. İlk teması olmayan ve sayacı 15 dakikayı geçen her veli için tüm yöneticilere bir kez `veli_bekliyor` bildirimi (`payload: {leadId, minutes}`), tekrar etmez (mevcut `notificationExists` deseni). Metin: "<ad> 15 dakikadır aranmadı".

- [ ] **Step 1: Write the failing tests:** yetkisiz istek 401; 16 dakikalık veli için bildirim; aynı veli ikinci çalışmada tekrar bildirilmez; mesai dışında hiçbir şey göndermez.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): 15 dakikadır aranmayan veli uyarısı`

### Task 12: Ayarlar · Aday hattı

**Files:**
- Create: `apps/panel/components/lead-line-settings.tsx`, `apps/panel/actions/settings.ts`
- Modify: `apps/panel/app/(app)/ayarlar/page.tsx`
- Test: `apps/panel/tests/unit/lead-line-settings.test.ts`

**Interfaces:**
- Consumes: `getLeadFlowSettings` (Task 4)
- Produces: `saveLeadLineSettings(input: { hours: BusinessHours; districts: string[]; callScript: string[]; priceAnswer: string; templates: {key,label,text}[] }): Promise<{ ok: true } | { error: string }>` (yalnız `yonetici`, `app_settings` upsert)
- Ekran: mesai günleri ve saatleri, servis semtleri listesi, konuşma sırası (satır satır, yer tutucu yardımı), fiyat cevabı, WhatsApp şablonları. Kaydet → "Kaydedildi".

- [ ] **Step 1: Write the failing tests:** danışman çağırınca hata; geçersiz saat (`"25:00"`) reddedilir; başlangıç bitişten sonraysa reddedilir; geçerli girdi upsert eder.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): aday hattı ayarları`

### Task 13: Personel kılavuzu ve bitiriş

**Files:**
- Create: `docs/on-buro-kilavuzu.md`
- Modify: `docs/ogretmen-kilavuzu.md` yalnız gerekirse (bağlantı)

- [ ] **Step 1:** Kılavuzu yaz: tek sayfa, Türkçe, ön büro için. Bölümler: "Güne nasıl başlarım" (Bugün ekranı), "Veli aradığımda" (Arama ekranının 3 adımı), "Mesajla gelen veli" (30 saniyede ekleme), "Açmazsa ne olur" (takip sırası), "Randevu ve ziyaret", "Kırmızı sayaç ne demek". Her bölüm 3–5 madde. Spec Bölüm 1'deki kural cümleleri aynen kullanılır.
- [ ] **Step 2:** `pnpm turbo run lint typecheck test` (yerel Supabase açık) → hepsi PASS.
- [ ] **Step 3:** `superpowers:requesting-code-review` ile tüm dalı inceletin. Bulguları düzelt.
- [ ] **Step 4: Commit** `docs: ön büro kılavuzu`
- [ ] **Step 5:** Koordinatör oturumuna bildir: dal `feat/reklam-suiti`, son SHA, migration `0014_on_buro_akisi.sql`, yeni crontab satırı, dokunulan dosyalar. Mert'e Türkçe özet: neler çalışıyor, okulun hangi metinleri vermesi gerekiyor (konuşma sırası, fiyat aralığı, şablonlar, semt listesi), personel eğitimi için kılavuz yolu.
