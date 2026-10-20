# Reklam Suiti — Aşama Dizini

**Spec:** `docs/superpowers/specs/2026-10-19-reklam-suiti-design.md` (bağlayıcı). Arayüz referansı: https://claude.ai/artifact/XW3PqbxYLpt45VVhRVcnbB

Spec dört bağımsız parçaya ayrılıyor. Her aşama kendi başına canlıya çıkabilir ve kendi planına sahiptir. Sadece Aşama 1'in planı hazır. Sonraki her aşamanın planı, o aşamaya başlanırken `superpowers:writing-plans` ile spec'ten yazılır. Planı yazan ajan bir önceki aşamada gerçekte oluşan isimleri (tablo, fonksiyon) koddan okur.

| Aşama | Plan | Ne çıkar | Dışa bağımlılık |
|---|---|---|---|
| 1 · Ön büro akışı | `2026-10-19-01-on-buro-akisi.md` | Formda 4 nitelik sorusu, Bugün "Şimdi ara" (ortak liste, sayaç), Arama ekranı, Mesajdan veli ekle, 7 günlük takip sırası, ziyaret hatırlatmaları, Aday hattı ayarları, personel kılavuzu | Okulun metinleri (konuşma sırası, fiyat cevabı, WhatsApp şablonları, semt listesi). Kod varsayılan metinlerle çıkar. |
| 2 · Çok platformlu veri + Meta | `2026-10-19-02-cok-platform-meta.md` (API notları: `2026-10-19-02-meta-api-notlari.md`) | `ad_spend_daily`/`conversion_uploads` platformlu hale gelir, Meta harcama senkronu (reklam seviyesi, kod addan), Conversions API (`META_CAPI_ENABLED` kapalı gelir), web `fbclid`/`_fbc`/`_fbp`, onaylı piksel, onay metni v2 (K9), `ad_platform` (K10), Claude için `Desktop\seker-reklam-araclar\meta-*.mjs` | Mert'in Meta hesap düzeni, hukuk onayı (piksel ve CAPI açılışı), sunucuya `META_*` ve 7 `GOOGLE_ADS_*` değeri |
| 3 · İçerik | `2026-10-19-03-icerik.md` | `ogretmen` rolü (K1), Görevim (Reels yükleme, sayfa metni, canlı kontroller, tek onay), İçerik panosu, Reels organik sayıları (72 saat karşılaştırması) | Aşama 2'nin Meta bağlantısı (organik sayılar için `instagram_manage_insights`) |
| 4 · Yönetici | yazılacak | Bu hafta (kapılar, öneriler, huni, ekip karnesi, görev atama), Kampanyalar (iki mercek, durdur/başlat/bütçe, `ad_change_log`, kırmızı kapıda gerekçe), Ayarlar ve hedefler | Aşama 1–3 |

## Her aşama için ortak kurallar

- Aşama 1 dalı `feat/reklam-suiti` (klasör `Desktop\seker-platform-reklam-suiti`, 1f291de'de donduruldu). Aşama 2–4 dalı `feat/reklam-suiti-2` (klasör `Desktop\seker-platform-reklam-suiti-2`), migration 0016'dan. main'e push, prod migration ve deploy **yapılmaz**. Aşama bitince canlıya alma koordinatörü oturumuna (ListAgents ile bulunur, adı `seker-platform-cd` benzeri) dal, SHA, dokunulan dosyalar ve migration numaraları bildirilir.
- Migration numarası 0014'ten başlar (0013 `feat/wa-grup`'ta). Her yeni numara koordinatörle teyit edilir.
- Her aşamanın sonunda: `pnpm turbo run lint typecheck test` yeşil (yerel Supabase açık), `superpowers:requesting-code-review`, ardından Mert'e Türkçe kısa özet.
