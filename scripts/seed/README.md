# Seed script'leri (tek seferlik)

Bu klasördeki script'ler, okulun geçmiş WhatsApp "Kayıt Randevuları" grup sohbetini ve
"DATA KAYIT" Excel dosyasını CRM'e taşımak için **tek seferlik** kullanılır. Üretilen
CSV'ler gerçek isim/telefon içerir; `out/` klasörü **gitignore'dadır** ve asla commit
edilmez. Script'lerin kendisi (bu dosyalar) commit edilir, veri edilmez.

Akış: **parse → insan onayı → upload**. CSV'ler insan tarafından gözden geçirilip
onaylanmadan `upload.ts` üretim/hiçbir ortama çalıştırılmaz (spec §9.3).

## 1) WhatsApp sohbetini leads adaylarına çevir

```bash
npx tsx scripts/seed/parse-whatsapp.ts --input "<path>/_chat.txt"
# çıktı: scripts/seed/out/leads.csv
```

Mantık (kısaca):
- `[YYYY-MM-DD, HH:MM:SS] gönderen: mesaj` desenine uymayan satırlar, önceki mesajın
  devamı sayılır (çok satırlı WhatsApp mesajları böyle görünür).
- Telefon regex'i (`/(\+90|0)?\s*5\d{2}[\s\d]{7,}/`) her SATIR için ayrı denenir
  (bloğun tamamına uygulanırsa, telefon satırından sonra gelen "2019 doğumlu" gibi
  bir yıl yanlışlıkla numaraya karışabilir).
- Aynı normalize telefonla ilgili tüm bloklar (kronolojik sırayla) birleştirilir;
  alan çıkarımı bu birleşik metin üzerinden yapılır. `parent_name` yalnızca EN ERKEN
  bloğun ilk satırından alınır (veli adı genelde ilk temasta paylaşılır).
- Kaynak: "referans" → `referans`; "instagram" → `instagram`; "reklam" → `reklam`;
  yoksa `telefon`.
- Statü: "kayıt oldu / kayda geldi" → `kazanildi`; "randevu / görüşme" →
  `gorusme_yapildi`; aksi halde `kaybedildi` + not öneki `seed: durum belirsiz`
  (bu durumda `lost_reason` metinden anahtar kelimeyle bulunamazsa `diger` atanır —
  DB'deki `lost_reason_required` constraint'i karşılamak için).
- `child_name` için brief'te bir heuristik tanımlanmadığından bu kolon **boş**
  bırakılır; insan onayı sırasında elle doldurulabilir.
- `note`: birleşik metnin ilk 500 karakteri.

Konsola özet basılır: toplam blok, telefon adayı blok, benzersiz numara, statü
dağılımı.

## 2) Excel'i öğrenci adaylarına çevir

```bash
npx tsx scripts/seed/parse-excel.ts --input "<path>/00000727-DATA KAYIT 2024-2025.xlsx"
# çıktı: scripts/seed/out/students.csv
```

**Kolon eşlemesi** (gerçek dosya açılıp başlıklar görüldükten sonra sabitlendi;
her iki kopyada — Temmuz 2024 ve Ağustos 2024 — birebir aynı yapı: `Sayfa1`,
başlık satırı 4, veri 5. satırdan başlıyor):

| Excel kolonu     | CSV alanı          | Not |
|------------------|--------------------|----|
| ÖĞRENCİ ADI      | `full_name`        | çoğu satırda boş (aşağıya bkz.) |
| DOĞUM TARİHİ     | `birth_month`/`birth_year` | serbest metin/serial karışık, bkz. `parseDob` |
| YAŞ              | `age_recorded`     | yalnızca bilgi amaçlı |
| ANNE ADI         | `parent_name` (öncelik) | anne adı varsa o kullanılır |
| BABA ADI         | `parent_name` (yedek)   | anne boşsa baba adı kullanılır |
| TELEFON          | `phone`            | `normalizeTurkishPhone` ile E.164 |
| ARAMA 1/2/3      | `note` içine `arama_tarihleri: ...` | bilgi amaçlı |
| SONUÇ            | `note` içine `sonuc: ...`   | serbest metin |
| —                | `program`, `season`, `start_date`, `status` | **kaynak veride YOK, boş çıkar** |

**Önemli bulgu:** Bu Excel, kayıt olmuş öğrencilerin temiz bir kütüğü değil; okulun
tüm arama/ilgi takibini tutan bir çağrı log'u. 230 veri satırından yalnızca küçük bir
kısmında ÖĞRENCİ ADI dolu — geri kalanı henüz karar vermemiş/ulaşılan ama sonuçlanmamış
aramalar. Dosyada program/sezon/ücret bilgisini tutan ayrı bir kolon yok (yalnızca
SONUÇ serbest metninde bazen ücret geçiyor). Bu yüzden:

- `students.csv`'deki `program`, `season`, `start_date`, `status` kolonları **boş**
  çıkar. `upload.ts`, bu alanlar dolu olmayan satırları (DB NOT NULL/CHECK kısıtları
  gereği) otomatik **atlar ve raporlar** — insan onaylayıcı, gerçekten kayıt olmuş
  öğrenciler için bu kolonları CSV'de elle doldurmalı (program: `tam_gun` /
  `yarim_gun` / `uc_gun` / `play_grup`; season: örn. `2024-2025`).
- `full_name` veya geçerli `phone` boş olan satırlar da `upload.ts` tarafından atlanır.

Konsola özet basılır: toplam veri satırı, ÖĞRENCİ ADI dolu sayısı, geçerli telefon
sayısı, doğum ay/yıl çözülebilen sayısı.

## 3) CSV'leri Supabase'e yükle

```bash
# Önce her zaman dry-run ile kontrol et:
npx tsx scripts/seed/upload.ts --dry-run --assigned-to <danisman-uuid>

# Onaylandıktan sonra gerçek yükleme:
npx tsx scripts/seed/upload.ts --assigned-to <danisman-uuid>

# Yalnızca birini yüklemek için:
npx tsx scripts/seed/upload.ts --assigned-to <uuid> --skip-students   # yalnızca leads
npx tsx scripts/seed/upload.ts --skip-leads                            # yalnızca students
```

Argümanlar:
- `--dry-run`: DB'ye hiçbir şey yazmaz, yalnızca yüklenecek/atlanacak satır sayılarını
  ve atlama nedenlerini gösterir.
- `--assigned-to <uuid>`: leads yüklerken zorunlu — tüm leadler bu danışmana atanır.
- `--leads <path>` / `--students <path>`: varsayılan `out/leads.csv` / `out/students.csv`.
- `--skip-leads` / `--skip-students`: yalnızca birini yüklemek için.

Ortam değişkenleri (kodda asla hardcode edilmez): `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`. `.env.local` varsa otomatik yüklenir (repo'daki diğer
script'lerle — `tests/rls/helpers.ts` — aynı desen).

Telefonlar CSV'de zaten E.164 olmalı; yine de `upload.ts` her satırı
`normalizeTurkishPhone` ile yeniden doğrular — geçersiz/boş telefon, boş isim,
tanımsız enum değeri (`source`/`status`/`lost_reason`/`program`/`status`) veya
DB kısıtlarına (ay 1-12, yıl 2010-2035) uymayan satırlar **atlanır ve raporlanır**,
script crash etmez.

**Event kaydı:** Bu tarihi veri olduğu için satır başına event YAZILMAZ. Başarılı
her toplu yüklemeden sonra tek bir işaret event'i yazılır:
`entity_type: 'lead'|'student'`, `event_type: 'seed_import'`,
`payload: { seed: true, count, source }`.

**leads tablosunda ayrı bir "note" kolonu yoktur** (yalnızca insan notu için olan
`lead_notes` tablosu var, `author_id not null` gerektirir — seed script'i buraya
yazmaz). Bu yüzden WhatsApp'tan çıkarılan ham metin, leadin `source_detail`
kolonuna yazılır; bu tasarım kararı burada belgelenmiştir.

## Gizlilik

- `out/*.csv` gerçek ad/telefon içerir — **asla commit edilmez** (`.gitignore`'da
  `scripts/seed/out/`).
- Bu script'ler ve bu README'de gerçek isim/telefon **bulunmaz**.
