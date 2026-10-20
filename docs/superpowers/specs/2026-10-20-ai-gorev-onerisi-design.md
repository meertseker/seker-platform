# AI görev önerisi — tasarım (2026-10-20)

Mert'in onayladığı tasarım ve uygulamada verilen kararlar. Dal: `feat/ai-gorev-onerisi`.

## Amaç

Görevi veren kişi (Zehra, danışman; yönetici de verebilir) her hafta "öğretmene ne çektireyim, ne yazdırayım" diye düşünmesin.
AI **yalnız konu** önerir: başlık, 2–3 cümlelik açıklama (ne anlatılacak, neden bu hafta) ve hangi okul artısına dayandığı.
Video, metin ya da reklam sayfası yazısını AI yazmaz; içerik yine öğretmende. AI'ın yazdığı hiçbir şey veliye ya da reklama
doğrudan gitmez: öneri yalnız görevi verenin ekranında görünür, seçilirse konu ve öğretmene not olarak görev kaydına geçer.

## Ekranlar

### Ayarlar → Okul bilgileri (yönetici)
- `/ayarlar` sayfasında yeni "Okul bilgileri" bölümü: tek büyük metin alanı (en fazla 20.000 karakter).
- Mehtap Hanım tanıtım yazılarını, artıları, broşür metinlerini bir kez yapıştırır, sonra düzenler.
- Saklama: `app_settings` anahtarı `okul_bilgileri`, değer `{ "metin": "…" }`. Migration gerekmez.
  Yazma mevcut `write_app_settings` politikasıyla yalnız yöneticide. Danışman `sel_app_settings` ile okuyabilir (sorun değil);
  AI için sunucu service_role ile okur.

### Görev ver (`/reklam/gorev-ver`, danışman + yönetici)
- Danışman için ayrı sayfa seçildi: "Bu hafta" ekranı para ve kapı verisi içerdiği için yöneticide kalır;
  İçerik panosu reklam sayılarını (harcama) gösterdiği için danışmana açılmaz.
- `lib/role-access.ts`: `/reklam` yalnız yönetici, **istisna** `/reklam/gorev-ver` yönetici + danışman. Middleware ve
  `(app)/layout.tsx` zaten `canOpen` kullanır; öğretmen kapısı değişmez.
- Menü (`nav.tsx`, küçük değişiklik): yöneticinin "Reklam" grubuna "Görev ver"; danışmanın ana menüsüne (kenar çubuğu ve
  telefon menüsü) tek bağlantı "Görev ver".
- Hafta: bu hafta (varsayılan) ya da gelecek hafta (`?hafta=YYYY-MM-DD`, yalnız bu iki Pazartesi kabul edilir).
- 4 yuva (mevcut kodla aynı): Reels A, Reels B, Sayfa · Google, Sayfa · Instagram.
  - Yuvada o hafta görev açıksa "R-2643-A açık · öğretmen" yazar; ikinci görev açılmaz (mevcut koruma).
  - Boş yuvada: 2–3 AI önerisi (kart), "Kendi konum" seçeneği, konu alanı (seçilen öneriyle dolar, düzeltilebilir),
    öğretmene not (önerinin açıklamasıyla dolar, düzeltilebilir), öğretmen ve teslim zamanı.
  - Her yuvada "Gönder" ve "Yeniden öner"; altta "Dördünü birden gönder" (öğretmeni seçilmiş ve konusu yazılmış yuvalar).
  - Gönderim sonrası her öğretmen için "WhatsApp'tan haber ver" bağlantısı (mevcut `createContentTask` döndürür).

## Akış ve yeniden kullanım

- Görev, mevcut `createContentTask` (actions/content.ts) ile açılır; kopyalama yok. Yetkisi `requireRole("yonetici","danisman")`
  olur. Böylece görev `content_items` akışıyla öğretmenin "Görevim" ekranına düşer ve `icerik_gorev` bildirimi gider.
- Yeni eylem `assignContentTasks` (actions/task-assign.ts) yalnız yuva → tür/harf eşlemesini yapar, haftayı denetler ve
  her yuva için `createContentTask` çağırır. Yuva tanımları `actions/weekly.ts`'ten `lib/content/slots.ts`'e taşınır (iki yer de
  aynısını kullanır).
- Öneriye para girmez, danışman para görmez: AI'a harcama tutarı gönderilmez; öneride para ifadesi (TL, ₺, lira, bütçe,
  harcama, maliyet) geçerse öneri atılır.

## Önerilerin hazırlanması

- Cron'a dokunulmaz. Sayfa açılınca istemci bileşeni, o hafta için eksik yuva varsa `POST /api/ai/gorev-onerileri`
  çağırır. Route handler seçildi çünkü Next Server Action'ları istemci başına sırayla çalışır: üretim sürerken "Gönder"
  beklemesin. Arayüz donmaz; elle girme her an çalışır, öneri alanı "Öneriler hazırlanıyor…" der.
- Saklama: yeni tablo `ai_gorev_onerileri` (migration **0020**). Satır = (hafta, yuva). Durum: `hazirlaniyor | hazir | hata`.
  - Üretimden önce satırlar `hazirlaniyor` olarak alınır (ekleme çakışırsa başka bir istek üretiyordur); 3 dakikadan eski
    `hazirlaniyor` ve 1 saatten eski `hata` yeniden denenir. Böylece iki sekme aynı haftayı iki kez üretmez.
  - "Yeniden öner" (`force`) o yuvayı yeniden üretir.
  - RLS: personel (`is_staff()`) okur; yazma yalnız service_role. Öğretmen göremez.
- Anahtar yoksa (`ANTHROPIC_API_KEY` boş): hiçbir satır yazılmaz, öneri alanı "AI önerileri kapalı (anahtar girilmedi)" der.
- Hata (ağ, API, ret, şema dışı çıktı): `console.error` ile loglanır, satır `hata` olur, ekranda kısa "Öneri alınamadı; konuyu
  elle yazın." görünür; elle girme etkilenmez.

## AI sağlayıcı

- Claude API, `@anthropic-ai/sdk` (panel package.json'da sabit sürüm). Model `claude-sonnet-5-5`, `ANTHROPIC_MODEL` ile değişir.
- `client.beta.messages.parse` + `betaZodOutputFormat` ile yapılandırılmış çıktı; sonuç ayrıca kendi zod şemamızla
  (uzunluklar, yuva başına sayı) yeniden doğrulanır. `stop_reason: "refusal"` ya da çözülemeyen çıktı hata sayılır.
- Sunucu tarafı yedek model: `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`).
- Env: `ANTHROPIC_API_KEY` (infra/docker-compose.yml panel servisi `${ANTHROPIC_API_KEY:-}`, infra/env.example),
  isteğe bağlı `ANTHROPIC_MODEL`.

## AI'ın girdileri (kişisel veri yok)

Saf modül `lib/ai/gorev-girdi.ts` derler; veri yokken de çalışır ("henüz veri yok" yazar).
- Okul bilgileri metni (boşsa "girilmedi" denir; öneriler genel kalır).
- Son 12 haftada verilmiş görevlerin konuları (tekrar etmesin).
- `content_code`'u olan adayların aşama sayıları (koda göre; konu adıyla). Veli adı, telefonu, notu seçilmez.
- `leads.utm_term`: arama kelimesi başına aday / randevu ve sonrası / kayıt sayısı (en çok 20 kelime).
- `ad_spend_daily`: kampanya adları, tıklama ve gösterim. **Tutar gönderilmez.**
- Kampanyalar henüz kapalı: prompt az ya da sıfır veriyi bekler ve o durumda okul bilgileri ve mevsime dayanır.

## Kurallar

- `app_settings.yasakli_ifadeler` öneride de denetlenir (`lib/content/checks.ts` `checkText` ile aynı eşleşme): yasaklı ifade
  içeren öneri **atılır**. Prompt'a da liste yazılır.
- MEB: öğrenci yüzü ya da adı gerektiren konu önerilmez (prompt). Çekim kuralları öğretmen ekranında zaten var.
- "en iyi", "garanti" gibi kanıt isteyen ifadeler kullanılmaz (prompt + filtre).
- Para ifadesi içeren öneri atılır (danışman para görmez).

## Test (TDD)

- `lib/ai/gorev-oneri.ts`: çıktı doğrulama (uzunluk, sayı, yuva), yasaklı ifade ve para filtresi.
- `lib/ai/gorev-girdi.ts`: prompt girdisi derleme; boş veriyle; kişisel veri alanlarının girmediği.
- `lib/role-access.ts`: danışman `/reklam/gorev-ver` açar, diğer `/reklam` yollarını açamaz.
- `actions/task-assign.ts` ve `createContentTask`: danışman görev açar, öğretmen açamaz; hafta denetimi.
- Route handler: anahtar yokken `kapali`, öğretmene 403.
- RLS (0020 yerelde uygulanmış): personel okur, öğretmen boş görür, oturum istemcisi yazamaz.
