# Okul Cevabı: Veri Düzeltmeleri, "Kesinleşmedi" Durumu ve Toplu Zam — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Okulun 19.10.2026 cevabına göre prod verisini düzeltmek, Ocak–Haziran aidatlarını "kesinleşmedi" diye işaretlemek ve zammı bir kere girip ilgili öğrencilere uygulayan ekranı kurmak.

**Architecture:** "Kesinleşmedi" bilgisi taksit satırında değil **plan** düzeyinde tutulur: `payment_plans.tentative_from date`. Bir taksit, bekliyorsa ve vadesi bu tarihten sonraysa kesinleşmemiş sayılır. Böylece ödeme bölme, taksitlendirme ve kalan taksit oluşturma gibi satır üreten akışlar bayrağı taşımak zorunda kalmaz. Zam hesabı saf bir fonksiyondur (`lib/price-increase.ts`). Uygulama tek bir SQL fonksiyonuyla (RPC) plan başına atomik yapılır.

**Tech Stack:** Next.js 16 (panel), Supabase (Postgres + RLS), Vitest, tsx betikleri.

**Spec:** Bu planın kaynağı okulun cevabıdır (aşağıda). Ayrı bir spec dosyası yok.
- **Okulun cevabı Excel'den önce gelir.** Excel'le çelişen bir noktada okulun söylediği uygulanır; Excel'e göre "düzeltme" yapılmaz.
- Zam Ocak'ta asgari ücret açıklanınca belli olur ve **tüm öğrencilere eşit oranda** uygulanır. O zamana kadar Aralık tutarıyla devam edilir.
- Kardeş indirimi %10. Personel indirimi kişiye özel (Ege Gökdeniz: 19.000 × 1,30 = 24.700).
- Kırtasiye kalan taksitleri okulun verdiği aylara göre işlenir (tablo Task 1'de).
- Kıvanç Gök: aidat Ocak'a kadar 16.000 TL, Ocak'tan itibaren 18.000 TL.
- Liana Kaplan: ayrılış kesinleşene kadar mevcut rakamlar (Eylül–Aralık) aynen kalır. **Değişiklik yok.**
- Öneri onaylandı: Ocak–Haziran "henüz kesinleşmedi" olarak işaretlenir. Zam olunca oran bir kere girilir, sistem kalan aylara ve ilgili öğrencilere kendisi uygular.

## Prod'un bugünkü durumu (19.10, salt-okunur sorgu)

- 63 aktif öğrenci var. 54'ünün 2026-2027 aidat planında Ocak–Haziran'da toplam 324 bekleyen taksit duruyor. Hepsi Aralık tutarının kopyası. Peşin ödeyen 8 öğrencinin ve Liana'nın 2027 taksiti yok.
- Kırtasiye taksitleri 16.10'da `fix-kitap-taksit.ts` ile tahmini aylara bölünmüştü (vade günü 05). Okulun verdiği tarihler bazılarında farklı.
- Kıvanç Gök'ün aidatı şu an Ekim 8.000, Kasım–Haziran 22.000 TL. Bu 22.000, 16.10'daki `reconcile-2026-10.ts` betiğinin tahmini; personel girmedi (event geçmişinde yalnızca `seed_import` var).
- Liva Hamidoğlu ve İnci Ada Zeren'de okulun planı Excel'deki kalandan **5.000 TL az**:
  - Liva: bekleyen 15.000 + 15.000 = 30.000. Okulun planı 15.000 + 10.000 = 25.000.
  - İnci: bekleyen 15.000 + 15.000 = 30.000. Okulun planı 15.000 + 10.000 = 25.000.
  - **Okulun planı uygulanır.** İkisinin kırtasiye planı toplamı 45.000 → 40.000 olur (15.000 ödenmiş + 25.000 bekleyen). Okula Task 7'de bilgi olarak iletilir.
- Prod bağlantısı: `annem/anaokulcrm` klasöründen `npx vercel env pull "<scratchpad>/prod.env" --environment=production --yes`. Dosyada `SUPABASE_SERVICE_ROLE_KEY` var, değerler tırnaklı. Betikler tırnakları soyar ve `SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY` kullanır (bkz. `scripts/seed/out/fix-liana-aidat.ts`).

## Global Constraints

- Prod'a yazan her betik önce dry-run çalışır. `--apply` ile çalışınca `scripts/seed/out/backup-*.json` yedeği yazar. Beklenen durum tutmazsa o öğrenciyi atlar ve nedenini yazar; asla tahmin yapmaz.
- Para hesabı kuruş tamsayıyla yapılır (`tlToKurus` / `kurusToTl`, `lib/money.ts`).
- Planın `total_amount` değeri her zaman taksitlerinin toplamına eşit olmalı (`updateInstallment` bunu zorunlu tutuyor).
- Zam yalnızca `item_type = 'aidat'` planlarına uygulanır. Kırtasiye, servis vb. etkilenmez.
- Zam ekranı ve RPC yalnız `yonetici` rolüne açık. RPC `service_role` dışında çağrılamaz.
- Arayüz metinleri Türkçe: "Kesinleşmedi", "Toplu zam", "Zam yok, tutarları kesinleştir".
- Yuvarlama: zamlı aylık tutar en yakın **100 TL**'ye yuvarlanır (okulun bütün tutarları 100'ün katı). Okula Task 7'de teyit ettirilir.
- Migration'lar `packages/db/supabase/migrations/NNNN_ad.sql` olarak eklenir. Canlıya `supabase db push` elle onaylı iştir.

## Review Focus

1. **Bölünmüş ödenmiş ay:** Veli Ocak'ın 15.000'ini ödemiş, 7.000'i bekliyor. Zam ayın toplamı (22.000) üzerinden hesaplanmalı ve farkın tamamı bekleyen satıra eklenmeli. Sadece 7.000'e zam yapılmamalı. Bu durumun testi Task 3'te.
2. **Tamamen ödenmiş gelecek ay:** Veli Ocak'ı zamdan önce tamamen ödemişse o ay değişmez ve önizlemede "ödendiği için atlandı" diye görünür. Testi Task 3'te.
3. **İki kez uygulama:** "Uygula"ya iki kez basılırsa ya da eski önizlemeyle uygulanırsa ikinci seferde hiçbir şey değişmemeli. Bunu sağlayan iki şey var: sunucu hesabı yeniden yapar, uygulama sonrası `tentative_from = null` olur. Testi Task 4'te.
4. **Ayrılmış öğrenci:** `status <> 'aktif'` öğrenci önizlemeye gelmez. Testi Task 4'te.
5. **Kişiye özel tutarlar:** Kıvanç'ın 18.000'i gibi önceden kararlaştırılmış tutarlar önizlemede tek tek görünür, tik kaldırılarak zamdan hariç tutulabilir. Kontrolü Task 6'da (manuel).

---

### Task 1: Kırtasiye taksitleri ve Kıvanç Gök aidatı (prod veri, migration gerektirmez)

**Files:**
- Create: `apps/panel/scripts/seed/out/fix-okul-cevap-2026-10.ts`

**Interfaces:**
- Consumes: `applyPaymentDay`, `inferPaymentDay` (`apps/panel/lib/payment-day.ts`)
- Produces: `npx tsx scripts/seed/out/fix-okul-cevap-2026-10.ts <env> --step=kitap|kivanc|tentative [--apply]`. `tentative` adımının içi Task 7'de doldurulur. Bu task'ta "migration bekleniyor" deyip çıkar.

- [ ] **Step 1: `--step=kitap` adımını yaz.** `fix-kitap-taksit.ts`'deki yapı kullanılacak: öğrenci adıyla eşleştir, 2026-2027 kitap planı, bekleyenleri sil, yenilerini ekle. Değerler okulun cevabından alındı. Kasım ve sonrası için vade günü, öğrencinin bekleyen aidat vadelerinden `inferPaymentDay` ile bulunur ve `applyPaymentDay(\`${ay}-01\`, gün)` ile uygulanır. **`2026-10` taksitlerinin vadesi `2026-10-31`'dir.** Okul "Ekim'de ödenecek" dedi; ayın 5'i gibi geçmiş bir güne konursa taksit eklendiği anda gecikmiş görünür.

```ts
const SCHEDULE: Record<string, [string, number][]> = {
  "ATLAS TEKİN": [["2026-10", 20000]],
  "ADA KARADAĞ": [["2026-10", 17000], ["2026-11", 16000]],
  "CAN ATA YILMAZ": [["2026-10", 15000], ["2026-11", 20000]],
  "HALİT ENSAR AKÇELİK": [["2026-11", 10000], ["2026-12", 10000]],
  "GÖKTUĞ AKSOY": [["2026-11", 25000]],
  "BARTU EMRE BOZSEKİ": [["2026-11", 15000]],
  "MİLA YIKARBABA": [["2026-11", 13900]],
  "EREN ULAŞ ATA": [["2026-11", 9000]],
  "ZEHRA KARABIÇAK": [["2026-10", 15500]],
  "LİVA HAMİDOĞLU": [["2026-10", 15000], ["2026-11", 10000]],
  "İNCİ ADA ZEREN": [["2026-10", 15000], ["2026-11", 10000]],
};
// Okulun planı Excel'deki kalandan farklıysa izin verilen fark (TL). Plan total_amount'u bu kadar değişir.
const EXPECTED_DIFF: Record<string, number> = {
  "LİVA HAMİDOĞLU": -5000, // bekleyen 30.000 → 25.000, plan 45.000 → 40.000
  "İNCİ ADA ZEREN": -5000,
};
```

Koruma kuralları:
- `yeni toplam - bekleyen toplam` farkı `EXPECTED_DIFF[ad] ?? 0` değilse öğrenci atlanır. Fark sıfır değilse plan `total_amount`'u aynı farkla güncellenir (toplam = taksitler toplamı kuralı korunur).
- Bekleyen satırlardan biri `2026-10-19T00:00:00Z`'den sonra güncellenmişse (personel dokunmuş) öğrenci atlanır.

- [ ] **Step 2: `--step=kivanc` adımını yaz.**
- Hedef plan: KIVANÇ GÖK'ün 2026-2027 aidat planı.
- Beklenen durum: tam olarak 9 bekleyen taksit olmalı. Ekim 8.000; Kasım–Haziran 22.000 (vadeler `2026-10-31` … `2027-06-30`). Tutmazsa betik durur.
- Yeni tutarlar: Ekim 8.000 aynı kalır, `2026-11` ve `2026-12` 16.000, `2027-01`…`2027-06` 18.000.
- `total_amount = 148000` olur, `installment_count` değişmez.
- Satırlar silinmez, yalnızca `amount` güncellenir.

- [ ] **Step 3: Dry-run.** Prod env'i çek (bkz. "Prod'un bugünkü durumu"). Sonra:

Run: `cd apps/panel && npx tsx scripts/seed/out/fix-okul-cevap-2026-10.ts "<scratchpad>/prod.env" --step=kitap`
Expected: 11 satır `AD: eski vadeler → yeni vadeler`, sonda `11 öğrenci (dry-run)`. Hiç `ATLA` satırı olmamalı. Örnek: `ATLAS TEKİN: 2026-11-05=20000 → 2026-10-31=20000`. Liva ve İnci satırlarında ayrıca `plan 45000 → 40000` yazar.

Run: `... --step=kivanc`
Expected: `KIVANÇ GÖK: 184000 → 148000`, 8 taksitin eski ve yeni tutarı.

- [ ] **Step 4: Kullanıcıya dry-run çıktısını göster, onay al, sonra `--apply` ile iki adımı çalıştır.** Kontrol: `scratchpad/q.cjs` sorgusu tekrar çalıştırılınca yeni değerler görünür ve `backup-okul-cevap-*.json` oluşur.

- [ ] **Step 5: Commit**

```bash
git add apps/panel/scripts/seed/out/fix-okul-cevap-2026-10.ts apps/panel/scripts/seed/out/backup-okul-cevap-*.json
git commit -m "fix(veri): okul cevabına göre kırtasiye taksitleri ve Kıvanç Gök aidatı"
```

---

### Task 2: Migration — `tentative_from` ve atomik zam fonksiyonu

**Files:**
- Create: `packages/db/supabase/migrations/0012_aidat_tentative.sql`
- Modify: `packages/db/src/database.types.ts` (`pnpm --filter @seker/db gen:types` ile yeniden üretilir)
- Test: `apps/panel/tests/rls/price-increase.test.ts`

**Interfaces:**
- Produces:
  - `payment_plans.tentative_from date null`.
  - `public.apply_plan_amounts(p_plan_id uuid, p_changes jsonb, p_clear_tentative boolean) returns void`. `p_changes` biçimi: `[{"id": uuid, "amount": numeric}]`.
  - Fonksiyon ne yapar: verilen taksitleri günceller. Güncellenecek satır `bekliyor` değilse ya da plana ait değilse exception atar. `total_amount`'u taksit toplamına eşitler. `p_clear_tentative` true ise `tentative_from = null` yapar. Hepsi tek işlem içinde olur.
  - Yetki: `security definer`. `revoke execute on function ... from public, anon, authenticated` ile yalnız `service_role` çağırabilir.

- [ ] **Step 1: Failing test yaz** (`tests/rls/price-increase.test.ts`, `tests/rls/overdue.test.ts` kalıbıyla: `admin` ile öğrenci, plan ve 3 taksit kur).
  - `it("tutarları günceller, toplamı eşitler, tentative_from'u temizler")`: Plan 66.000 ve `tentative_from = '2027-01-01'`; taksitler 22.000 / 22.000 / 22.000. Değişiklik `[{id: t2, amount: 27500}, {id: t3, amount: 27500}]`. Sonuç: plan `total_amount = 77000`, `tentative_from = null`.
  - `it("ödenmiş taksit değiştirilmek istenirse hiçbir şeyi değiştirmez")`: Değişikliklerden biri `odendi` satır. RPC hata döner, diğer taksit ve plan toplamı eski hâlinde kalır.
  - `it("danışman ve yönetici oturumu RPC'yi çağıramaz")`: `clientFor("danisman@test.local").rpc(...)` hata verir.

- [ ] **Step 2:** `pnpm db:start` ardından `cd apps/panel && npx vitest run tests/rls/price-increase.test.ts` → FAIL (kolon ya da fonksiyon yok).

- [ ] **Step 3:** Migration'ı yaz, `supabase db reset` ile yerel veritabanına uygula, tipleri üret.

- [ ] **Step 4:** Aynı test → PASS. `pnpm --filter @seker/panel typecheck` → hatasız.

- [ ] **Step 5: Commit** `feat(db): aidat planında kesinleşmedi tarihi ve atomik tutar güncelleme`

---

### Task 3: Zam hesabı (saf fonksiyon)

**Files:**
- Create: `apps/panel/lib/price-increase.ts`
- Test: `apps/panel/tests/unit/price-increase.test.ts`

**Interfaces:**
- Produces:

```ts
export function isTentative(tentativeFrom: string | null, dueDate: string, status: InstallmentStatus): boolean
// status === "bekliyor" && tentativeFrom !== null && dueDate >= tentativeFrom

export interface IncreaseInstallment { id: string; dueDate: string; amountKurus: number; status: InstallmentStatus }
export interface IncreasePlanInput { planId: string; studentId: string; fullName: string; tentativeFrom: string | null; totalKurus: number; installments: IncreaseInstallment[] }
export interface IncreaseChange { installmentId: string; dueDate: string; fromKurus: number; toKurus: number }
export interface PlanIncrease {
  planId: string; studentId: string; fullName: string;
  monthlyFromKurus: number | null; monthlyToKurus: number | null; // önizlemede "22.000 → 27.500"
  changes: IncreaseChange[]; skippedPaidMonths: string[]; // "2027-01"
  newTotalKurus: number;
}
export function computeIncrease(plan: IncreasePlanInput, percent: number, fromMonth: string /* "YYYY-MM" */): PlanIncrease
```

Algoritma (fonksiyon imzası ve testler bunu belirlemiyor, o yüzden burada yazılı):
- `iptal` satırlar yok sayılır.
- Kalan satırlar vade ayına göre gruplanır (`dueDate.slice(0, 7)`).
- Yalnızca hem `>= fromMonth` hem `>= tentativeFrom.slice(0, 7)` olan aylar işlenir. `tentativeFrom` null ise hiçbir ay işlenmez.
- Her ay için:
  - `ayToplamı` = ayın bütün satırları (ödenmiş + bekleyen).
  - `hedef = Math.round(ayToplamı * (1 + percent / 100) / 10000) * 10000` (kuruş cinsinden, en yakın 100 TL).
  - `fark = hedef - ayToplamı`.
  - Ayda bekleyen satır yoksa ay `skippedPaidMonths`'a eklenir.
  - Bekleyen satır varsa fark, vadesi en son olan bekleyen satıra eklenir.
- `monthlyFromKurus` / `monthlyToKurus`: işlenen ilk ayın toplamı ve hedefi.

- [ ] **Step 1: Failing testler**
  - `"22.000'lik Ocak–Haziran %25 → her ay 27.500, toplam +33.000"`: 6 bekleyen ay. `changes.length === 6`, hepsinde `toKurus === 2_750_000`. `newTotalKurus === totalKurus + 3_300_000`.
  - `"indirimli 24.300 %25 → 30.400 (100 TL'ye yuvarlar)"`.
  - `"kişiye özel 19.000 %30 → 24.700"`.
  - `"bölünmüş ay: 15.000 ödendi + 7.000 bekliyor, %25 → bekleyen 12.500"`.
  - `"tamamen ödenmiş Ocak atlanır ve skippedPaidMonths'ta görünür"`: `skippedPaidMonths` değeri `["2027-01"]`, Şubat yine değişir.
  - `"fromMonth öncesi ve tentativeFrom öncesi aylara dokunmaz"`: `tentativeFrom` `2027-01-01`, `fromMonth` `2026-12` → Aralık değişmez. `fromMonth` `2027-02` → Ocak değişmez.
  - `"tentativeFrom null ise hiçbir değişiklik yok"`.
  - `"iptal satırları yok sayar"`.
  - `isTentative`: bekliyor ve tarih sonra → true; odendi → false; null → false.

- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/unit/price-increase.test.ts` → FAIL
- [ ] **Step 3:** `lib/price-increase.ts`'i yaz.
- [ ] **Step 4:** Aynı komut → PASS
- [ ] **Step 5: Commit** `feat(panel): zam hesabı — ay toplamı üzerinden, 100 TL yuvarlama`

---

### Task 4: Sunucu aksiyonları — önizle, uygula, kesinleştir

**Files:**
- Create: `apps/panel/actions/price-increase.ts`
- Test: `apps/panel/tests/unit/price-increase-actions.test.ts` (mock kalıbı `tests/unit/feedback-actions.test.ts` ile aynı)

**Interfaces:**
- Consumes: `computeIncrease` (Task 3), RPC `apply_plan_amounts` (Task 2), `logEvent` (`lib/events.ts`), `createAdminSupabase`, `getSessionProfile`.
- Produces:

```ts
export interface IncreaseRequest { season: string; percent: number; fromMonth: string }
export async function previewPriceIncrease(req: IncreaseRequest): Promise<{ error: string } | { plans: PlanIncrease[] }>
export async function applyPriceIncrease(req: IncreaseRequest & { planIds: string[] }): Promise<{ error: string } | { applied: number; failed: string[] }>
export async function finalizeAmounts(planIds: string[]): Promise<{ error: string } | { finalized: number }>
```

Davranış:
- Üçü de `yonetici` değilse `{ error: "Bu işlem için yönetici yetkisi gerekir" }` döner.
- Girdi doğrulama:
  - `0 < percent <= 100`, aksi hâlde `"Zam oranı 0 ile 100 arasında olmalı"`.
  - `fromMonth` sezonun Eylül–Haziran aylarından biri olmalı.
- `previewPriceIncrease` şu planları getirir: `item_type = 'aidat'`, `season = req.season`, `tentative_from is not null`, öğrencisi `status = 'aktif'`. `changes` boş olan planlar listeden çıkar. Liste ada göre sıralanır.
- `applyPriceIncrease` istemcideki önizlemeye güvenmez:
  - Seçili planları yeniden okur ve `computeIncrease` ile yeniden hesaplar.
  - Her plan için `apply_plan_amounts(planId, changes, true)` çağırır.
  - Her plan için event yazar: `logEvent` → `eventType: "zam_uygulandi"`, `entityType: "student"`, payload `{ percent, fromMonth, changes: [{ id, fromTl, toTl }], skippedPaidMonths }`.
  - Hata veren plan `failed` listesine (öğrenci adı) eklenir, diğerleri devam eder.
- `finalizeAmounts` seçili planlarda yalnızca `tentative_from = null` yapar. Event: `"tutar_kesinlesti"`.
- Hepsi şu yolları tazeler: `/odemeler`, `/odemeler/zam`, `/odemeler/gecikenler`, `/bugun`, `/ogrenciler`.

- [ ] **Step 1: Failing testler**
  - `"danışman reddedilir"`.
  - `"oran 0 ya da 150 reddedilir"`.
  - `"önizleme ayrılmış öğrenciyi getirmez"`: sorguya `students.status = aktif` filtresi gider. Mock'ta `eq("student.status", "aktif")` çağrısı beklenir.
  - `"uygula sunucuda yeniden hesaplar"`: önizlemeden sonra taksit değişmiş olsa bile RPC'ye yeni hesap gider.
  - `"tentative_from null olan plan uygulanmaz"`: RPC çağrılmaz ve `applied === 0` (iki kez basma senaryosu).
  - `"bir planın RPC hatası diğerlerini durdurmaz"`: `failed` değeri `["ADI"]`, `applied === 1`.

- [ ] **Step 2:** `npx vitest run tests/unit/price-increase-actions.test.ts` → FAIL
- [ ] **Step 3:** Aksiyonları yaz.
- [ ] **Step 4:** → PASS
- [ ] **Step 5: Commit** `feat(panel): toplu zam önizleme/uygulama ve tutar kesinleştirme aksiyonları`

- [ ] **Step 6: Yeni oluşturulan aidat planları da "kesinleşmedi" başlasın.** Aksi hâlde Task 7'den sonra kaydedilen öğrenci (ör. Kasım'da yeni kayıt) zam ekranına hiç gelmez ve sessizce zamsız kalır.
  - Modify: `apps/panel/actions/payments.ts`. Plan ekleyen iki yer: `createPaymentPlan` (`:98` civarı `.insert`) ve kayıt akışı (`:624` civarı `.insert`).
  - Kural: `item_type = 'aidat'` ve planın son vadesi `tentativeStart(season)` (sezonun Ocak'ının 1'i, ör. `2027-01-01`) ya da sonrasıysa, **ve** aynı sezonda `tentative_from is not null` olan en az bir aktif aidat planı varsa (yani zam henüz girilmemiş), yeni plana `tentative_from = tentativeStart(season)` yazılır. Zam uygulandıktan / kesinleştirildikten sonra açılan planlar işaretsiz açılır.
  - Test (`tests/unit/payments-actions.test.ts` ya da mevcut kayıt testi): `"zam bekleyen sezonda yeni aidat planı tentative_from alır"`, `"kesinleşmiş sezonda almaz"`, `"kırtasiye planı almaz"`.
  - Commit: `feat(panel): zam bekleyen sezonda yeni aidat planları kesinleşmedi açılır`

---

### Task 5: "Kesinleşmedi" görünümü (Ödemeler tablosu ve öğrenci sayfası)

**Files:**
- Modify: `apps/panel/lib/payment-matrix.ts`. `MatrixPlanInput`'a `tentative_from?: string | null`, `MatrixCellItem`'a `tentative: boolean`, `MatrixCell`'e `tentative: boolean` eklenir. Hücredeki bekleyen öğelerden biri kesinleşmemişse hücre de kesinleşmemiş sayılır.
- Modify: `apps/panel/components/payment-matrix-cell.tsx`. Kesinleşmemiş hücrede tutarın yanında küçük bir "~" işareti olur, tooltip ve `aria-label` "Kesinleşmedi" olur. Renk durumu (bekliyor/gecikti) değişmez.
- Modify: `apps/panel/app/(app)/odemeler/page.tsx`. Plan sorgusuna `tentative_from` eklenir. Üst köşeye yalnız yönetici için "Toplu zam" bağlantısı (`/odemeler/zam`) konur.
- Modify: `apps/panel/components/installment-table.tsx`. `InstallmentTableItem`'a `tentative?: boolean` eklenir, tutarın yanında "Kesinleşmedi" etiketi gösterilir.
- Modify: `apps/panel/app/(app)/ogrenciler/[id]/page.tsx:198`. Sorguya `tentative_from` eklenir, `isTentative` ile öğelere aktarılır.
- Test: `apps/panel/tests/unit/payment-matrix.test.ts` (yoksa oluşturulur).

**Interfaces:**
- Consumes: `isTentative` (Task 3).

- [ ] **Step 1: Failing test:** `"tentative_from sonrası bekleyen hücre tentative, ödenmiş ve öncesi değil"`. Plan `tentative_from = '2027-01-01'` ve Aralık/Ocak bekliyor, Şubat ödendi. Sonuç: `cells["2027-01"].tentative === true`, `cells["2026-12"].tentative === false`, `cells["2027-02"].tentative === false`.
- [ ] **Step 2:** `npx vitest run tests/unit/payment-matrix.test.ts` → FAIL
- [ ] **Step 3:** Matrix ve bileşen değişikliklerini yap.
- [ ] **Step 4:** Test → PASS. `pnpm --filter @seker/panel typecheck && pnpm --filter @seker/panel lint` → hatasız.
- [ ] **Step 5:** Yerelde `pnpm dev` aç ve kontrol et: tentative'i doldurulmuş seed verisinde Ödemeler tablosunda Ocak–Haziran hücrelerinde "~" görünür, öğrenci sayfasında "Kesinleşmedi" etiketi görünür (telefon genişliğinde de).
- [ ] **Step 6: Commit** `feat(panel): kesinleşmemiş aidatları tabloda ve öğrenci sayfasında göster`

---

### Task 6: Toplu zam ekranı

**Files:**
- Create: `apps/panel/app/(app)/odemeler/zam/page.tsx`. Sunucu bileşenidir. Yönetici değilse `/odemeler`'e yönlendirir. Aktif sezonu okuyup forma verir.
- Create: `apps/panel/components/price-increase-form.tsx` (istemci bileşeni)

**Interfaces:**
- Consumes: `previewPriceIncrease`, `applyPriceIncrease`, `finalizeAmounts` (Task 4).

Ekran:
1. **Alanlar:** "Zam oranı (%)" sayısı ve "Hangi aydan itibaren" seçimi (sezon ayları, varsayılan Ocak 2027). Altında "Önizle" düğmesi.
2. **Önizleme tablosu:**
   - Sütunlar: tik kutusu (varsayılan işaretli), öğrenci, şu anki aylık, yeni aylık, değişen ay sayısı, toplam fark.
   - `skippedPaidMonths` doluysa satırda "Ocak ödendiği için değişmeyecek" notu çıkar.
   - Altta seçili öğrencilerin toplam farkı yazar.
3. **"Uygula":** Onay penceresi açar: "N öğrencinin M taksiti değişecek. Bu işlem geri alınamaz." Sonuçta uygulanan sayı ve varsa hata veren öğrenciler gösterilir.
4. **"Zam yok, tutarları kesinleştir":** Seçili planlarda `finalizeAmounts` çağırır, aynı onay penceresiyle çalışır.

- [ ] **Step 1:** Sayfayı ve formu yaz. Mevcut panel bileşen kalıbı (Liquid Glass) kullanılacak.
- [ ] **Step 2:** `pnpm --filter @seker/panel typecheck && pnpm --filter @seker/panel lint` → hatasız.
- [ ] **Step 3:** Yerelde manuel kontrol:
  - %25 ve Ocak ile önizleme: 22.000 → 27.500 gösterir.
  - Bir öğrencinin tiki kaldırılıp uygulanınca o öğrenci "kesinleşmedi" kalır, diğerleri değişir.
  - Sayfa yenilenip tekrar önizlenince uygulananlar listede olmaz.
  - Danışman hesabıyla `/odemeler/zam` yönlendirir.
- [ ] **Step 4: Commit** `feat(panel): toplu zam ekranı`

---

### Task 7: Canlıya alma, Ocak–Haziran'ı işaretleme, okula dönüş

**Files:**
- Modify: `apps/panel/scripts/seed/out/fix-okul-cevap-2026-10.ts`, `--step=tentative` adımı.

- [ ] **Step 1: `--step=tentative` adımını yaz.** Hedef: aktif öğrencilerin 2026-2027 aidat planlarından, `2027-01-01` ve sonrasında bekleyen taksiti olanlar. Bunlarda `tentative_from = '2027-01-01'` yapılır. Zaten değeri olan plan atlanır.
- [ ] **Step 2: Migration'ı canlıya uygula (kullanıcı onayıyla).**
  - Önce `pnpm --filter @seker/db exec supabase migration list` ile bekleyenleri gör.
  - Sonra `supabase db push --dry-run`: yalnızca `0012_aidat_tentative.sql` listelenmeli.
  - Sonra `supabase db push`.
- [ ] **Step 3: Dry-run.** `--step=tentative` → `54 plan (dry-run)`. Liana ve peşin ödeyen 8 öğrenci listede olmamalı. Kullanıcı onay verince `--apply`.
- [ ] **Step 4: Paneli canlıya al** (mevcut deploy akışı, kullanıcı onayıyla). `panel-yeni.sekeranaokulu.com/odemeler`'de Ocak–Haziran hücrelerinde "~" işareti görülmeli.
- [ ] **Step 5: Okula dönüş maili taslağını kullanıcıya ver.** Mail şunları sorar:
  1. **Bilgi, Liva Hamidoğlu ve İnci Ada Zeren:** Kırtasiyeyi bildirdiğiniz plana göre girdik (Ekim 15.000, Kasım 10.000). Excel'de toplam 45.000 yazdığı için sistemde artık toplam 40.000 TL görünüyor. Farklıysa haber verin.
  2. **Kıvanç Gök'ün kırtasiyesi (35.000 TL):** Notta "yarısı hemen, yarısı Ocak'tan sonra" yazıyor. Hangi ay ne kadar ödenecek?
  3. **Kıvanç Gök'ün Ocak'taki 2.000 TL artışı:** Genel zamdan ayrı bir artış mı (yani Ocak'ta 18.000'e genel zam da eklenecek mi), yoksa Kıvanç için zam bu mu? (Okul "zam tüm öğrencilere eşit" dedi; Ege Gökdeniz dahil diğerleri için ayrıca sorulmaz.)
  4. **Yuvarlama:** Zamlı tutarları en yakın 100 TL'ye yuvarlamamız uygun mu? Örneğin 24.300 TL'ye %25 zam 30.375 TL ediyor, sistem bunu 30.400 TL yapar.
  5. **Bilgi:** Ocak–Haziran sistemde "kesinleşmedi" olarak işaretlendi. Zam belli olunca "Toplu zam" ekranından oranı bir kere girmeniz yeterli.
- [ ] **Step 6:** Okul ikinci maile (28 soru) cevap verince ayrı bir veri düzeltme planı yazılır. O cevap da Excel'den önce gelir.
