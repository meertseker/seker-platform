# Canlıya geçiş

| Adım | Ne zaman | Yapan | Tamam |
|---|---|---|---|
| DNS TTL'lerini 300 sn'ye düşür (@, www, panel) | Geçişten ≥ 24 saat önce | Sahip | |
| Personeli bilgilendir: panel adresi panel.sekeranaokulu.com olacak, bir kez yeniden giriş gerekecek | Geçişten 1 gün önce | Sahip | |
| `.env`'de SITE_HOST/PANEL_HOST canlı adlara | Geçiş anı | Geliştirici | |
| A kayıtları → Lightsail sabit IP | Geçiş anı | Sahip | |
| Canlı kontroller (aşağıda) | Geçişten hemen sonra | Geliştirici | |
| Vercel'de CRON_SECRET'ı sil (eski günlük işi etkisizleştirir) | Geçişten hemen sonra | Geliştirici | |
| Amplify ve Vercel'e dokunma (geri dönüş için) | 7 gün | — | |
| Amplify uygulamasını ve Vercel projelerini sil, eski anahtarları kapat | Geçiş + 7 gün | Sahip | |

Geri dönüş (7 gün içinde): A kayıtlarını eski değerlere al (aşağıya not edildi), Vercel'de CRON_SECRET'ı geri ekle.
Eski DNS değerleri: @ → ……  www → ……  panel → …… (geçişten önce DNS panelinden kopyala)
