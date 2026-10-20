# Meta / Google API notları (20.10.2026 araştırması)

Araç: Composio Perplexity (ilk tarama) + resmi sayfalar WebFetch/WebSearch ile teyit. "TEYİTSİZ" yazanlar resmi sayfada görülemedi; ilk gerçek hesapla kontrol edilecek.

## Sürüm
- Graph API en yeni **v26.0** (29.07.2026). Marketing API sayfaları v24.0 bitişi için iki ayrı tarih veriyor (6.10.2026 / 10.11.2026), v25.0 bitişi 23.02.2027. Kod **v26.0** kullanır. https://developers.facebook.com/docs/graph-api/changelog/versions/ · https://developers.facebook.com/docs/marketing-api/marketing-api-changelog
- Google Ads API güncel sürüm **v26** (14.10.2026). Paneldeki kod v25'te kalır (Aşama 2 Google'a dokunmaz; yükseltme ayrı iş, sabah sorusu). Geliştirici belirteci 9.9.2026'da kaldırıldı, başlık gönderilmez. https://developers.google.com/google-ads/api/docs/release-notes · https://developers.google.com/google-ads/api/docs/api-policy/developer-token

## Insights (harcama)
- `GET https://graph.facebook.com/v26.0/act_<id>/insights` · `level=ad` · `time_increment=1` · `time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}` · `action_attribution_windows=["7d_click","1d_view"]` (açıkça verilir; varsayılan sayfada çelişkili). https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/
- Alanlar: `date_start,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,frequency,clicks,inline_link_clicks,actions`.
- `spend` sayısal metin, hesap para biriminde tam birim (TRY) — TEYİTSİZ, ilk hesapta Reklam Yöneticisi ile karşılaştırılacak.
- `actions`: `[{action_type, value}]`, `value` metin. Web formu başvurusu `offsite_conversion.fb_pixel_lead`; yoksa toplam `lead`. Çift saymamak için ilki varsa o, yoksa `lead` (TEYİTSİZ anlamlar).
- Sayfalama: yanıt `{data, paging:{next?}}`, `paging.next` tam URL.
- Hata: `{"error":{"message","type","code","error_subcode","fbtrace_id"}}`; kısıtlama kodları 4, 17, 341. https://developers.facebook.com/docs/graph-api/guides/error-handling/
- `appsecret_proof` = HMAC-SHA256(anahtar = app secret, ileti = access token), küçük harf hex. https://developers.facebook.com/docs/graph-api/securing-requests/

## Conversions API
- `POST https://graph.facebook.com/v26.0/<pixel_id>/events` gövde `{data:[...], test_event_code?}`. https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event
- Zorunlu: `event_name` (özel ad serbest, `Enrolled` olur), `event_time` (Unix saniye, **en çok 7 gün eski; topluda tek eski olay tüm isteği düşürür**), `action_source` ∈ email, website, app, phone_call, chat, physical_store, **system_generated**, business_messaging, other (`crm` yok).
- `website` olayında `event_source_url` zorunlu.
- Tekilleştirme: aynı `event_name` + `event_id`, 48 saat içinde piksel ve sunucu.
- CRM aşama olayları: `action_source:"system_generated"`, `custom_data:{event_source:"crm", lead_event_source:"Seker Panel"}`; aşama zamanı başvurudan sonra olmalı. https://developers.facebook.com/docs/marketing-api/conversions-api/guides/conversions-api-for-crm
- `user_data`: `ph` = ülke kodlu, `+`'sız rakamların SHA-256'sı; `external_id` SHA-256 önerilir; `fbc`, `fbp`, `client_ip_address`, `client_user_agent` **hash'lenmez**.
- `custom_data:{value, currency:"TRY"}`. Yanıt `{events_received, messages, fbtrace_id}` — TEYİTSİZ.

## fbc / fbp
- `fbc = fb.1.<ilk görülme ms>.<fbclid>`, `fbp = fb.1.<ms>.<rastgele>`. fbclid büyük/küçük harf duyarlı, değiştirilmez. Sunucu ya da istemci tarafında fbclid'den kurmak resmen destekleniyor. https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc

## Instagram Reels organik sayılar (Aşama 3)
- `GET /<ig-media-id>/insights?metric=views,reach,saved,shares,total_interactions,likes,comments,ig_reels_avg_watch_time,ig_reels_video_view_total_time`. `plays` v22'de kaldırıldı (yerine `views`), `impressions` yeni medyada yok. https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights
- İzinler (Facebook girişi): `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement` (+ İşletme rolüyle `ads_read`).
- Medya listesi `GET /<ig-user-id>/media?fields=id,caption,media_type,media_product_type,permalink,timestamp` (TEYİTSİZ bu oturumda).

## Yazma (Aşama 4)
- Meta durum: `POST /<campaign|adset|ad id>` `status=PAUSED|ACTIVE` → `{success:true}`. Bütçe `daily_budget` int64, kampanyada ya da reklam setinde (ikisinde değil); TRY alt birim çarpanı 100 (kuruş) — bütçe için TEYİTSİZ, önce GET ile okunur. https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/ · https://developers.facebook.com/docs/marketing-api/currencies
- Google durum: `POST https://googleads.googleapis.com/<ver>/customers/<cid>/campaigns:mutate` `{"operations":[{"update":{"resourceName":"customers/<cid>/campaigns/<id>","status":"PAUSED"},"updateMask":"status"}]}`. Bütçe `campaignBudgets:mutate` `{update:{resourceName, amountMicros}, updateMask:"amount_micros"}` (TEYİTSİZ, aynı desen). https://developers.google.com/google-ads/api/rest/common/mutate

## KVKK
- KVKK Çerez Rehberi: pazarlama/reklam çerezleri önceden, açık ve belirli onay ister; reddetmek kabul etmek kadar kolay olmalı. Piksel ve tarayıcı kimlikleri (fbc, fbp) onaydan sonra. https://kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber
