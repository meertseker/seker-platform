# Faz 2 canlıya alma kontrol listesi

Aşağıdaki adımlar site sahibine aittir; geliştirme ortamında üretime hiçbir işlem yapılmamıştır.

## Yerelde doğrulananlar
- [x] Web ve panel test paketleri, `npx tsc --noEmit`, `npx next build`
- [x] Ziyaretçi JS'inde `tiptap|seker-editbar|prosemirror` yok; ziyaretçi HTML'inde `data-edit-` yok
- [x] `docker build -f infra/Dockerfile.web .` yerelde çalışıyor ve imajda `sharp` yüklenebiliyor (ayrıntı: task-19 raporu)

## Sahip adımları
- [ ] Canlı Supabase migration: önce `supabase migration list` ile uygulananları gör. `0007_site_content` ismen, zaten uygulanmış `0009`'dan önce sıralandığı için düz `db push` reddeder: `npx supabase db push --include-all` kullan. Sonra `migration list` ile `0007` ve sonraki bekleyenlerin uygulandığını doğrula
- [ ] S3: `sekeranaokulu-media` kovasına `infra/aws/media-bucket-policy.json` (`site-images/*` herkese okuma) ve `seker-web-media` IAM kullanıcısına `infra/aws/iam-web-media.json` uygulandı; bir `site-images/` nesnesi anonim GET ile açılıyor. Sunucudaki `S3_BUCKET` değeri IAM politikasındaki kova adıyla (`sekeranaokulu-media`) birebir aynı
- [ ] Sunucu `/opt/seker/.env`: `S3_BUCKET`, `S3_REGION`, `MEDIA_AWS_ACCESS_KEY_ID`, `MEDIA_AWS_SECRET_ACCESS_KEY` (compose bunları web'e `AWS_*` olarak geçirir; cron'un `BACKUP_AWS_*` anahtarlarıyla karışmaz), `PANEL_URL`
- [ ] GitHub → Settings → Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_PANEL_URL`, `NEXT_PUBLIC_MEDIA_BASE_URL` tanımlı (derleme zamanı değerleri; sunucu `.env`'inde etkisiz). `deploy.yml` bunları build-arg olarak geçirir, `Dockerfile.web` derlemeye gömer
- [ ] Caddy: `/api/edit/enable` ve `/api/edit/disable` yanıtlarındaki `Location` başlığı göreli kalıyor (reverse proxy iç adresi sızdırmıyor): `curl -sI https://sekeranaokulu.com/api/edit/enable` yanıtında `Location` site/panel alan adını gösteriyor, `web:3000` gibi iç adres yok
- [ ] Deploy sonrası ziyaretçi: `/`, `/bultenler`, `/lp/beykent-anaokulu` 200; `curl -s https://sekeranaokulu.com/ | grep -c data-edit-` → 0
- [ ] Sitemap 19 URL: `curl -s https://sekeranaokulu.com/sitemap.xml | grep -o "<loc>" | wc -l` → 19
- [ ] Yönetici panelde editöre yetki verdi; editör "Siteyi düzenle" ile çubuğu gördü
- [ ] Ana sayfa başlığı değiştirildi → Kaydet → gizli pencerede (ziyaretçi) yeni başlık görünüyor (ISR yüzünden en çok ~60 sn)
- [ ] Geçmiş › Geri al → gizli pencerede eski başlık
- [ ] Telefon fotoğrafı (≥ 5 MB) yüklendi; S3'te `site-images/YYYY/MM/*.webp`, `exiftool` ile GPS yok
- [ ] İki sekmede aynı metin: ikinci kayıtta çakışma uyarısı
- [ ] Supabase kapalı simülasyonu (staging'de `NEXT_PUBLIC_SUPABASE_URL` geçici olarak yanlış): site varsayılan metinlerle açılıyor, hata sayfası yok; düzeltilince ≤ 1 dk içinde gerçek içerik
- [ ] Lighthouse mobil `/lp/beykent-anaokulu`: performans skoru Faz 2 öncesine göre ≥ -2 puan
- [ ] `kvkk.ts` değiştiyse: Geçmiş'ten gizlilik metninin ilk değişikliğini geri al (kılavuzdaki not)
- [ ] KVKK dört TEYİT değeri hâlâ bekliyor (Faz 1 kapısı): onaylanmadan canlıya alma tamamlanmış sayılmaz
- [ ] Editörle 45 dk eğitim: `docs/ogretmen-kilavuzu.md` içindeki her başlık gerçek ekranda yapıldı; ekran görüntüleri `docs/kilavuz-gorseller/`'e eklendi
- [ ] İlk iki hafta: haftada bir `content_revisions` gözden geçirildi, sorunlar kılavuza eklendi
- [ ] Belirteçli cümle (ör. `{yilSayisi}` içeren): çift tıkla, hiçbir şey değiştirmeden dışarı tıkla → "Değişiklik yok", bekleyen değişiklik sayacı artmıyor; düzenlerken `{yilSayisi}` görünüyor, kaydedince sayfada sayı
- [ ] GTM Preview (Tag Assistant): düzenleme modunda bir CTA/WhatsApp/telefon bağlantısı düzenlenirken olay tetiklenmiyor; düzenleme modunda GTM hiç yüklenmiyor; ziyaretçide olaylar normal
- [ ] Geri alma veya konteyner yeniden oluşturma (yeniden derleme olmadan) sonrası bir kez Kaydet yap ya da yeniden deploy et: içerik önbelleği 1 güne kadar eski kalabilir
- [ ] Kaydet → değişiklik gizli pencerede birkaç saniye içinde görünüyor
