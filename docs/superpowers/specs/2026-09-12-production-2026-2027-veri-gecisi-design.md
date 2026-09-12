# Production 2026-2027 Veri Geçişi — Tasarım

Tarih: 2026-09-12
Hedef: `https://uozpghnilwmkjaxjuwox.supabase.co` (Vercel projesi `merts-projects-e6cc4d27/anaokulcrm`)

## Amaç

Production veritabanındaki yarım/test verisini temizleyip, `2026 - 2027 DÖNEMİ AİDAT LİSTESİ.xlsx`
dosyasının `2026 - 2027` sayfasından 56 öğrencinin tamamını, ödeme planlarını ve Eylül
tahsilatlarını gerçek veri olarak yüklemek.

## Kaynak veri

`2026 - 2027` sayfası, 0-indeksli kolonlar:

| # | Başlık | Kullanım |
|---|---|---|
| 0 | ÖĞRENCİ ADI VE SOYADI | `students.full_name` (zorunlu) |
| 1 | ANNE & BABA ADI | `students.parent_name` |
| 2 | KİTAP - KIRTASİYE | `kitap` planı, tek taksit |
| 3 | AİDAT TUTARI | Yıllık peşin tutar (yalnız 8 satırda dolu) |
| 4 | (boş) | — |
| 5 | SERVİS TUTARI | Tamamen boş → servis planı üretilmez |
| 6–17 | TEMMUZ … HAZİRAN | Aylık aidat defteri |

Tespit edilen dağılım: 56 öğrenci; 8'i yıllık peşin, 47'si aylık, 1'i karma (ÖMER GÜNEŞ).
Aylık kolonlarda yalnız EYLÜL–ARALIK dolu (48 satır), OCAK–HAZİRAN tamamen boş.
Telefon ve program bilgisi dosyada yok.

## Kararlar

1. **Aylık kolonların anlamı** — Girilen tutarlar beklenen aylık aidattır; EYLÜL hücresi o ayın
   gerçekleşmiş tahsilatıdır. Dolayısıyla Eylül taksiti `odendi`, Ekim–Haziran `bekliyor`.
2. **Eksik aylar** — Plan 10 taksittir (Eylül–Haziran). OCAK–HAZİRAN tutarı ARALIK hücresinin
   tutarı kabul edilir.
3. **Yıllık peşin 8 öğrenci** — Tek taksitli `aidat` planı, `bekliyor`.
4. **Kitap-kırtasiye** — Tek taksitli `kitap` planı, vade 2026-09-05, `bekliyor`.
5. **Yaz okulu** — `2026 TEMMUZ-AĞUSTOS` sayfası içeri alınmaz.
6. **Temizlik kapsamı** — `students`, `leads`, `notifications`, `events` silinir (bağlı kayıtlar
   FK cascade ile gider). `profiles`, `price_lists`, `price_list_items`, `app_settings` korunur.
7. **Telefon / program** — Silme öncesi mevcut öğrencilerin telefonu ada göre snapshot alınır ve
   yeni kayda taşınır. Program, mevcut kayıtta varsa korunur; yoksa aylık tutardan tahmin edilir
   (≥25.000 → `tam_gun`, altı → `yarim_gun`) ve tahmin olduğu nota yazılır.

## Dönüşüm kuralları

### Aidat planı — aylık öğrenciler

Aylık tutar dizisi 10 elemana genişletilir:

```
[EYLÜL, EKİM, KASIM, ARALIK, ARALIK, ARALIK, ARALIK, ARALIK, ARALIK, ARALIK]
         └── OCAK…HAZİRAN için ARALIK tutarı tekrarlanır ──┘
```

Vadeler `2026-09-05`'ten başlayıp aylık ilerler (`lib/installments.addMonthsClamped` ile aynı
mantık). `payment_plans.total_amount` = taksitlerin toplamı, `installment_count` = üretilen
taksit sayısı.

Eylül hücresi 0 ise o ay için taksit üretilmez (şema `amount > 0` şartı koyar); plan 9 taksitle
kurulur ve öğrenci notuna "Eylül ücretsiz/tahsilat yok" yazılır.

Eylül taksiti `status='odendi'`, `paid_amount` = taksit tutarı, `paid_at` = `2026-09-05`,
`payment_method='diger'` (Excel yöntem bilgisi taşımıyor), `marked_by` = yönetici profili.

### Aidat planı — yıllık peşin öğrenciler

Tek taksit: `amount` = kolon 3 tutarı, vade `2026-09-05`, `status='bekliyor'`.
`installment_count = 1`.

### Kitap planı

Tek taksit: `amount` = kolon 2 tutarı, vade `2026-09-05`, `status='bekliyor'`.
Hücre sayısal değilse (`?`, `ÜCRET ALINMADI` vb.) plan üretilmez, ham metin nota taşınır.

### Program tahmini

Aylık öğrencide referans tutar ARALIK hücresi; yıllık öğrencide `yıllık / 10`.
≥25.000 → `tam_gun`, aksi halde `yarim_gun`. Mevcut DB kaydında program varsa o kazanır.

## Bileşenler

| Dosya | Sorumluluk |
|---|---|
| `scripts/seed/lib/aidat-2026.ts` | Saf dönüşüm: Excel satırı → öğrenci + plan taslağı. DB/dosya erişimi yok. |
| `scripts/seed/parse-aidat-2026.ts` | Excel oku → `out/students-2026-2027.csv` (insan onayı için) + konsol raporu. |
| `scripts/seed/migrate-production.ts` | Snapshot → temizlik → import → doğrulama. Varsayılan dry-run. |
| `tests/unit/aidat-2026.test.ts` | Dönüşüm kurallarının testleri. |

`scripts/seed/inspect-db.ts` salt-okunur durum raporu için kalır.

## Veri akışı

```
Excel ──parse-aidat-2026──> out/students-2026-2027.csv ──┐
                                                          ├──migrate-production──> Supabase
Mevcut DB (telefon/program snapshot) ─────────────────────┘
```

`migrate-production.ts` adımları:

1. Hedef URL'yi ve satır sayılarını yazdır; `--env` ile ortam dosyası seçilir.
2. Mevcut `students` tablosundan ad → {telefon, program} snapshot al.
3. CSV'yi plana çevir; Excel'de olmayıp DB'de olan öğrencileri **uyarı** olarak listele.
4. Silinecek tabloların tamamını `out/backup-<zaman>.json` dosyasına yaz.
5. `tasks`, `notifications`, `events`, `leads`, `students` sil (bağlı kayıtlar FK cascade).
6. Öğrenci → plan → taksit sırasıyla ekle; her öğrenci için kaynak satır/not/program kaynağını
   taşıyan bir `seed_import` event'i yaz (`students` tablosunda not alanı yok).
7. `inspect-db` ile aynı özeti yazdırıp satır sayılarını ve tahsilat toplamlarını doğrula.

### Silme sırası — FK döngüsü

`students` ile `leads` arasında cascade'siz, iki yönlü bir bağımlılık var:

```
leads.converted_student_id ──> students          (ON DELETE yok)
payment_plans.source_offer_id ──> offers ──cascade── leads
```

Bu yüzden hiçbir sıra tek başına çalışmaz: `students` önce silinirse `leads` FK'sı, `leads` önce
silinirse cascade ile giden `offers` üzerinden `payment_plans` FK'sı patlar. Döngü, silmeden önce
`payment_plans.source_offer_id` boşaltılarak kırılır — bu kolonun update guard'ı yoktur
(`0002_offer_lead_guards.sql` içindeki tüm guard'lar `before update on offers/leads/installments`).

Uygulanan sıra: `source_offer_id = null` → `tasks` → `notifications` → `events` → `leads` →
`students`.

## Hata yönetimi

- Ortam dosyasında `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` yoksa çık.
- `profiles` içinde `yonetici` yoksa çık (ödenmiş taksit `marked_by` zorunlu).
- Herhangi bir insert hatasında satır numarasıyla fırlat ve dur — kısmi yüklemeyi kullanıcı
  `inspect-db` ile görüp scripti yeniden çalıştırabilir (temizlik adımı idempotent).
- Silme işlemi yalnız `--confirm-wipe` bayrağıyla çalışır; dry-run varsayılandır.

## Çalıştırma

Production service-role anahtarı repoda tutulmaz; gerektiğinde Vercel'den çekilir ve iş
bitince silinir:

```bash
npx vercel env pull .env.production.pull --environment=production
npx tsx scripts/seed/parse-aidat-2026.ts --input "<xlsx yolu>"
npx tsx scripts/seed/migrate-production.ts --env .env.production.pull            # dry-run
npx tsx scripts/seed/migrate-production.ts --env .env.production.pull --apply --confirm-wipe
npx tsx scripts/seed/inspect-db.ts --env .env.production.pull                   # doğrulama
rm .env.production.pull
```

`scripts/seed/out/` gerçek isim ve telefon içerir; `.gitignore` ile dışlanmıştır.

## Test

- `tests/unit/aidat-2026.test.ts`: 10 aya genişletme, Eylül=0 durumu, yıllık peşin, `?` hücreler,
  program tahmini, toplam tutarın taksit toplamına eşitliği.
- Dry-run çıktısı kullanıcı onayına sunulur; onay sonrası gerçek yükleme yapılır.
- Yükleme sonrası `inspect-db.ts` ile satır sayıları ve sezon/plan toplamları doğrulanır.

## Kapsam dışı

Servis planları (kaynak veri boş), yaz okulu sezonu, geçmiş sezonlar (2025, 2024-2025),
lead/WhatsApp verisi, RLS politikası değişikliği.
