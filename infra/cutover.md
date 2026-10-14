# Canlıya geçiş

| Adım | Ne zaman | Yapan | Tamam |
|---|---|---|---|
| DNS TTL'lerini 300 sn'ye düşür (@, www, panel) | Geçişten ≥ 24 saat önce | Sahip | |
| Personeli bilgilendir: panel adresi panel.sekeranaokulu.com olacak, bir kez yeniden giriş gerekecek | Geçişten 1 gün önce | Sahip | |
| `.env`'de SITE_HOST/PANEL_HOST canlı adlara | Geçiş anı | Geliştirici | |
| A kayıtları → Lightsail sabit IP | Geçiş anı | Sahip | |
| Eski AAAA/ALIAS kayıtlarını kaldır, CAA kaydı Let's Encrypt'e izin veriyor mu kontrol et | Geçişten ≥ 24 saat önce | Sahip | |
| Canlı kontroller (aşağıda) | Geçişten hemen sonra | Geliştirici | |
| Vercel'de CRON_SECRET'ı sil (eski günlük işi etkisizleştirir) | Geçişten hemen sonra | Geliştirici | |
| Amplify ve Vercel'e dokunma (geri dönüş için) | 7 gün | — | |
| Amplify uygulamasını ve Vercel projelerini sil, eski anahtarları kapat | Geçiş + 7 gün | Sahip | |

Geri dönüş (7 gün içinde): A kayıtlarını eski değerlere al (aşağıya not edildi), Vercel'de CRON_SECRET'ı geri ekle.
Eski DNS değerleri: @ → ……  www → ……  panel → …… (geçişten önce DNS panelinden kopyala)

## Canlı kontroller

```bash
dig +short sekeranaokulu.com panel.sekeranaokulu.com
curl -s https://sekeranaokulu.com/api/health
curl -s https://panel.sekeranaokulu.com/api/health
curl -sI https://www.sekeranaokulu.com | grep -i location
curl -sI https://panel.sekeranaokulu.com | grep -i x-robots-tag
```
Beklenen: iki IP de Lightsail sabit IP'si; `{"ok":true}` iki kez; `location: https://sekeranaokulu.com/`; `x-robots-tag: noindex, nofollow`.

Elle: `https://sekeranaokulu.com/lp/beylikduzu-anaokulu?gclid=TESTCUTOVER` → formu "TEST geçiş" / `05000000000` ile gönder → e-posta gelir ve eski `/admin`'de `gclid=TESTCUTOVER` ile görünür (reklam atfının bozulmadığını gösterir). Sonra kaydı sil. Google Tag Assistant ile GTM'in yüklendiğini kontrol et.
UptimeRobot monitörlerini canlı adreslere çevir.
