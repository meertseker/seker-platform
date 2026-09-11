# Ödeme Matrisi (Herkes × Her Ay) — Tasarım

**Tarih:** 2026-09-11
**Durum:** Onaylandı (tasarım), uygulama planı bekliyor
**Tetikleyen:** Zehra Hanım'ın (birincil kullanıcı, yönetici) sunum geri bildirimi

## 1. Amaç

Zehra Hanım projeyi gördükten sonra şunu söyledi: *"Ben normalde Excel'den tek
bakışta herkesi görüyorum, burada öyle bir ekran lazım — teker teker bakılıyor
herkesin ödeme planına."*

Bugün CRM'de ödeme bilgisi iki yerde duruyor: `/ogrenciler` listesinde öğrenci
başına tek satırlık "ödenen / toplam" özeti, ve `/ogrenciler/[id]` detayında o
öğrencinin taksit takvimi. İkisi de tek öğrenciyle çalışmak için doğru; ama
"tüm okulun Kasım ayı nasıl?" sorusunu yanıtlamıyor. Bu tasarım o boşluğu
kapatan **öğrenci × ay matrisini** tanımlar.

## 2. Kaynak akış: Zehra Hanım'ın Excel'i

Referans, okulun aidat defteri (`… DÖNEMİ AİDAT LİSTESİ.xlsx`). Yapısı
(bkz. `2026-07-28-aidat-2026-2027-importer-design.md` §3):

| Sütun | Başlık | Rol |
|---|---|---|
| A | ÖĞRENCİ ADI VE SOYADI | satır kimliği |
| B | ANNE & BABA ADI | ikincil kimlik |
| C | KİTAP - KIRTASİYE | sabit referans tutarı |
| D | AİDAT TUTARI | sabit referans tutarı (aylık ya da yıllık) |
| F | SERVİS TUTARI | sabit referans tutarı |
| G–R | TEMMUZ … HAZİRAN | 12 aylık tahsilat defteri |

İki davranış önemli:

1. Sol tarafta **sabit referans sütunları**, sağ tarafta **ay defteri** var.
2. Ay hücreleri kalem ayrımı yapmıyor — importer spec'inin notuyla, hücreler
   *"aidat/servis karışık"*. Yani Zehra Hanım'ın kafasında ay hücresi
   **"bu aile bu ay ne ödedi"** demek, "bu ailenin aidatı ne oldu" değil.

Tasarım bu iki davranışı birebir korur.

## 3. Veri gerçekliği (local Supabase, 2026-09-11)

| Ölçüm | Değer |
|---|---|
| Öğrenci | 16 (hepsi `aktif`) |
| Programı girilmiş | 9 (6 tam_gün, 3 yarım_gün) — **7 öğrencide program yok** |
| `payment_plans` | 18: 9 × `aidat`, 9 × `kitap` |
| `servis` planı | 0 |
| `installments` | 99, tamamı `bekliyor` |
| Vade aralığı | 2026-09 → 2027-06 (aidat 10 taksit; kitap tek çekim, Eylül) |
| Sezon | tek: `2026-2027` |

Tasarım kararlarına etkisi:

- **16 satır × 10 ay** bir masaüstü ekranına rahat sığar; sanallaştırma,
  sayfalama, grid kütüphanesi gerekmez.
- **Kalem filtresi bugün boşa gider** — pratikte yalnız aidat ve Eylül'deki
  kitap var. Bu yüzden hücre tüm kalemleri toplar (§6).
- **7 plansız öğrenci** matriste boş satır üretecek. Bunlar gizlenmez;
  görünür bir eksiklik sinyali olarak en üstte tutulur (§8).
- Ay sütunları sabit 12 ay varsayılmaz, veriden türetilir (§5.2).

## 4. Bilgi mimarisi kararı

`docs/research/2026-07-14-ia-sadelestirme-sentezi.md` "Ödemeler ayrı sekme
olmaktan çıksın, öğrenci detayına gömülsün; toplu görünüm ana ekranın tahsilat
bloğunda kalsın" demişti. Zehra Hanım'ın geri bildirimi bu kararın tam karşı
tarafı ve gerçek kullanıcıdan geldiği için ağır basıyor. Karar revize ediliyor:

- `/odemeler` **nav'a dördüncü sekme olarak geri gelir**:
  `Bugün · Veliler · Öğrenciler · Ödemeler`.
- `/odemeler` içeriği matrisle değişir. Üstteki üç özet kartı (bu ay beklenen /
  bu ay tahsil edilen / toplam geciken) **aynen kalır**. Altındaki
  "Geciken / Bu hafta vadesi gelen / Bu ay beklenen" listeleri **kaldırılır** —
  matrisin renk kodlaması ve "gecikeni olanlar" filtresi aynı bilgiyi daha az
  kaydırmayla veriyor, üç ayrı liste artık tekrar.
- Öğrenci detayındaki taksit takvimi (`InstallmentTable`) **değişmez**. Tek
  öğrenciyle derinlemesine çalışırken hâlâ doğru ekran.
- Ana ekrandaki tahsilat bloğu **değişmez**.

## 5. Ekran anatomisi

Tek bir `<table>`. Sol sütunlar yatay kaydırmada sabit (`sticky left-0`),
başlık satırı dikey kaydırmada sabit (`sticky top-0`), toplam satırı altta
sabit (`sticky bottom-0`).

### 5.1 Sabit sol sütunlar

| Sütun | İçerik | Türetme |
|---|---|---|
| Öğrenci | ad (detaya link) + altında veli adı | `students.full_name`, `parent_name` |
| Aidat/ay | aylık aidat | `aidat` planı `total_amount ÷ installment_count` |
| Kitap | tek çekim tutarı | `kitap` planı `total_amount` |
| Servis | aylık servis | `servis` planı `total_amount ÷ installment_count` |

Excel'in C/D/F sütunlarının karşılığı. Üç sütun da **seçili sezonun** planından
okunur (§8); başka sezonun planı bu sütunlara girmez. İlgili plan yoksa `—`. `yemek`,
`kayit_ucreti`, `diger` kalemlerinin ayrı referans sütunu yok; bunlar ay
hücrelerine ve hücre paneline girer (§6, §7).

Referans tutarları plandaki sözleşme rakamıdır (`total_amount ÷
installment_count`), fiili taksit satırlarından değil — kısmi ödeme taksitleri
böldüğü için (§6) fiili satırlardan hesaplamak yanıltıcı olurdu.

### 5.2 Ay sütunları

Seçili sezondaki **iptal olmayan taksitlerin `due_date` değerlerinden**
türetilir: benzersiz `YYYY-MM` kümesi, artan sıralı. Bugünkü veriyle
Eylül 2026 → Haziran 2027, 10 sütun. Biri Temmuz'a taksit eklerse sütun
kendiliğinden belirir; boş aylar sütun açmaz. Başlık `Eyl 26` biçiminde kısa,
`title` ile tam ay adı.

### 5.3 Sağ özet sütunları

`Toplam` (sezondaki tüm plan tutarları), `Ödenen`, `Kalan`. `Kalan`, gecikeni
olan satırda kırmızı.

### 5.4 Toplam satırı

Her ay sütununun altında iki satırlık hücre: **beklenen** (o ayın tüm
taksitleri) ve **tahsil edilen**. Sağ özet sütunlarının altında genel toplam.
Excel'deki toplam satırının karşılığı; "bu ay ne bekliyorum, ne geldi"
sorusunun tek bakışta yanıtı.

## 6. Hücre durum makinesi

Bir hücre = **bir öğrencinin bir aydaki bütün taksitleri** (aidat + kitap +
servis + varsa diğer kalemler). Kalem ayrımı yapılmaz; §2'deki Excel davranışı.

`iptal` taksitler hiçbir toplama girmez; hücrede yalnız küçük gri bir sayaçla
belirtilir.

| Durum | Koşul | Görünüm | Hücre içeriği |
|---|---|---|---|
| `bos` | iptal olmayan taksit yok | nötr | `—` |
| `odendi` | tümü `odendi` | `accent-soft` zemin, `accent` metin | ödenen tutar |
| `kismi` | en az bir `odendi` **ve** en az bir `bekliyor` | `warning-soft` zemin | `ödenen / toplam` |
| `gecikti` | hiç `odendi` yok **ve** bekleyenlerden birinin vadesi geçmiş | `destructive-soft` zemin, `destructive` metin | toplam tutar |
| `bekliyor` | hiç `odendi` yok, vadesi gelmemiş | `surface`, `muted-foreground` metin | toplam tutar |

Ek bayrak: `overdue` (hücrede vadesi geçmiş bekleyen taksit var mı). `kismi` +
`overdue` birleşimi — örneğin aidat ödenmiş, kitap gecikmiş — amber zemin +
kırmızı sol kenarlık ile gösterilir; durumu `gecikti`ye çevirmek ödenmiş parayı
gizlerdi.

Ödenen tutar `paid_amount` üzerinden toplanır; `null` ise `amount`'a düşülür.
Tüm aritmetik `lib/money.ts` ile **kuruş** cinsinden yapılır, biçimlendirme
sınırında TL'ye çevrilir.

**Kısmi ödemenin taksitleri böldüğüne dikkat:** `markInstallmentPaid` kısmi
tahsilatta taksiti ödenen tutara indirip aynı vadeye yeni bir `bekliyor`
taksit ekliyor (`actions/payments.ts`, `remainderInstallment`). Yani `kismi`
durumu tek kalemli aylarda da doğal olarak oluşur; matris bunu ayrıca
modellemek zorunda değil, aynı aydaki iki satırı toplaması yeter.

## 7. Hücre paneli ve yetkiler

Her hücre bir `<button>`. Tıklayınca üzerinde küçük bir panel açılır:

```
Ekim 2026 · Ayşe Yılmaz
─────────────────────────
Aidat        23.000 ₺   Bekliyor   [Ödendi işaretle]
Kitap         8.500 ₺   Ödendi · Havale · 5 Eki
─────────────────────────
Toplam       31.500 ₺   Ödenen 8.500 ₺
```

- **Ödendi işaretle** → tutar / yöntem / tarih alanları, mevcut
  `InstallmentTable` modalindeki alanların aynısı ve aynı doğrulamalar
  (`lib/tl-input.ts`).
- **Yönetici** ayrıca kalem başına `Düzenle` ve ödenmiş kalemde `Geri Al`
  görür. **Danışman** yalnız `Ödendi işaretle` görür — mevcut rol kuralı
  (`InstallmentTable` `role` prop'u, RLS ve `guard_installments_danisman`
  trigger'ı) birebir korunur.
- Sunucu eylemleri yeniden yazılmaz: `markInstallmentPaid`, `updateInstallment`,
  `revertInstallment` aynen çağrılır. Başarıdan sonra `router.refresh()`;
  16 satırlık tabloda maliyeti önemsiz.
- Boş hücre tıklanamaz. Plansız satırda hücre yerine "Plan oluştur" bağlantısı
  öğrenci detayına gider.

## 8. Satırlar, filtreler, sıralama

**Satır kümesi:** seçili sezonda planı olan **veya** `students.season` değeri o
sezon olan öğrenciler. İkinci koşul, planı henüz girilmemiş öğrencilerin
görünür kalmasını sağlar — asıl amaç bu.

**Varsayılan sıralama:** plansızlar en üstte (`Plan yok` rozetiyle, satır
`warning-soft` zeminli), ardından ad alfabetik (`localeCompare("tr")`).

**Üst şerit kontrolleri** (hepsi URL search param, `/ogrenciler` sayfasındaki
form deseniyle aynı):

| Kontrol | Param | Davranış |
|---|---|---|
| Sezon | `sezon` | `payment_plans.season` ∪ `students.season` içindeki değerler; varsayılan en yenisi |
| Arama | `q` | ad / veli / telefon `ilike` — `/ogrenciler` ile aynı sorgu |
| Filtre çipleri | `filtre` | `tumu` (varsayılan) · `geciken` (gecikeni olan satırlar) · `plansiz` |
| Ayrılan-mezun dahil | `gecmis=1` | kapalıyken yalnız `aktif` |

`q` ve durum filtresi Supabase sorgusunda, `geciken`/`plansiz` çipleri pivot
sonrası satır süzmesiyle uygulanır (türetilmiş alanlar oldukları için).

## 9. Veri katmanı

Tek sorgu, `/ogrenciler` sayfasındaki iç içe select deseninin genişletilmişi:

```
students(
  id, full_name, parent_name, phone, season, program, status,
  payment_plans(
    id, item_type, season, total_amount, installment_count,
    installments(id, due_date, amount, status, paid_at, paid_amount, payment_method)
  )
)
```

~180 satır döner. Özet kartları için mevcut "bu ay tahsil edilen" sorgusu
korunur.

Pivot **saf bir fonksiyonda** yapılır — DB, React, `Date.now()` yok; bugün
parametre olarak geçilir (İstanbul saatiyle, mevcut `istanbulTodayAsUtcDate`
yardımcısıyla):

```ts
export function buildPaymentMatrix(
  students: MatrixStudentInput[],
  today: string,           // "YYYY-MM-DD", Europe/Istanbul
  season: string,
): PaymentMatrix;

interface PaymentMatrix {
  months: string[];                    // sıralı "YYYY-MM"
  rows: MatrixRow[];
  columnTotals: { monthKey: string; expectedKurus: number; paidKurus: number }[];
  grandTotal: { totalKurus: number; paidKurus: number; remainingKurus: number };
}

interface MatrixRow {
  studentId: string;
  fullName: string;
  parentName: string | null;
  status: "aktif" | "ayrildi" | "mezun";
  hasPlan: boolean;
  aidatMonthlyKurus: number | null;
  kitapKurus: number | null;
  servisMonthlyKurus: number | null;
  cells: Record<string, MatrixCell>;   // monthKey → hücre
  totalKurus: number;
  paidKurus: number;
  remainingKurus: number;
  hasOverdue: boolean;
}

interface MatrixCell {
  state: "bos" | "odendi" | "kismi" | "gecikti" | "bekliyor";
  overdue: boolean;
  totalKurus: number;
  paidKurus: number;
  items: {
    installmentId: string;
    itemType: ItemType;
    dueDate: string;
    amountKurus: number;
    status: InstallmentStatus;
    paidAmountKurus: number | null;
    paymentMethod: PaymentMethod | null;
    overdue: boolean;
  }[];
  cancelledCount: number;
}
```

## 10. Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `lib/payment-matrix.ts` | saf pivot + hücre durum makinesi. Yeni. Test edilen tek mantık burada. |
| `app/(app)/odemeler/page.tsx` | server component: sorgu, filtre, pivot çağrısı, tablo iskeleti. Mevcut dosya yeniden yazılır; özet kartları korunur. |
| `components/payment-matrix-cell.tsx` | client: hücre butonu + panel + ödeme formu. Yeni. |
| `components/nav.tsx` | `mainItems`'a `/odemeler` eklenir (mobil alt bar `grid-cols-4` → `grid-cols-5`). |
| `actions/payments.ts` | yalnız `revalidatePath` eklemeleri (§11). |
| `tests/payment-matrix.test.ts` | vitest. Yeni. |

`page.tsx` büyümesin diye tablo iskeleti tek dosyada kalır ama satır/hücre
render'ı `payment-matrix-cell.tsx`e taşınır; pivot mantığı sayfaya sızmaz.

## 11. Backend değişikliği

`actions/payments.ts` içindeki dört fonksiyon şu an yalnız `/ogrenciler` ve
öğrenci detay yolunu `revalidatePath` ediyor. Matris sayfası bayat kalmasın
diye her birine `revalidatePath("/odemeler")` eklenir:

- `createPaymentPlan`
- `markInstallmentPaid`
- `revertInstallment`
- `updateInstallment`

Şema değişikliği, yeni migration, yeni RLS politikası **yok**.

## 12. Mobil ve erişilebilirlik

Mobilde kart görünümüne düşülmez — "tek bakış" isteğinin kendisi matrisin
korunmasını gerektiriyor. Bunun yerine: ilk sütun `sticky left-0`, kapsayıcı
yatay kaydırmalı, ay sütunları `min-w-24`. Özet kartları üstte kalır.

- Gerçek `<table>`: aylar `<th scope="col">`, öğrenci `<th scope="row">`.
- Hücre butonu `aria-label`: `"Ayşe Yılmaz, Ekim 2026, 23.000 ₺, gecikti"`.
- Durum **yalnız renkle** anlatılmaz; hücrede metin, gecikmede ayrıca ikon.
- Panel `role="dialog"` + `aria-modal`, Esc ile kapanır, odak panele girer ve
  kapanınca tetikleyen hücreye döner.
- Dokunma hedefleri `min-h-11` — `docs/a11y-checklist.md` ile uyumlu.

## 13. Test planı

`tests/payment-matrix.test.ts` (vitest, canlı DB yok) — saf fonksiyon:

- **Ay türetme:** taksit tarihlerinden sıralı benzersiz aylar; taksit yoksa boş
  dizi; boş aylar sütun açmaz.
- **Hücre halleri:** `bos`, `odendi`, `kismi`, `gecikti`, `bekliyor` her biri.
- **`kismi` + `overdue`:** ödenmiş aidat + gecikmiş kitap → `kismi`,
  `overdue: true`.
- **İptal taksit:** toplamlara girmez, `cancelledCount` artar, tek taksit
  iptalse hücre `bos`.
- **Bölünmüş kısmi ödeme:** aynı vadede `odendi` + `bekliyor` çifti → `kismi`,
  `paidKurus` yalnız ödeneni sayar.
- **Referans sütunları:** aidat `total ÷ count`, kitap tek çekim, servis
  `total ÷ count`; plan yoksa `null`.
- **Satır sıralaması:** plansızlar üstte, sonra Türkçe alfabetik (Ç/İ/Ö/Ş/Ü).
- **Toplamlar:** sütun toplamları ve genel toplam satır toplamlarıyla tutarlı.
- **Para:** kuruşta toplanır, yuvarlama kaybı yok (25.000 TL ÷ 10 gibi kalanlı
  bölmelerde).

Mevcut testler bozulmamalı; `InstallmentTable` ve `actions/payments.ts`
davranışı değişmiyor.

## 14. Kapsam dışı

Sonraki adım adayları, bu işte yapılmayacaklar:

- **Excel dışa aktarma.** Zehra Hanım'ın Excel'i bırakması için güçlü bir
  argüman ama önce matrisi kullanmasını görelim.
- **Toplu işaretleme modu** (bir ay sütununu seçip çoklu işaretleme).
- **Hücreye doğrudan klavyeyle rakam yazma.** Excel'e en yakın etkileşim ama
  ödeme yöntemi/tarihi alanları zorunlu olduğu için panel gerekiyor.
- **Sezonlar arası karşılaştırma** ve geçmiş sezon defterinin içe aktarımı.
- Servis planı akışı — veride hiç servis planı yok; sütun ve hücre desteği
  hazır, veri girişi ayrı iş.
