-- 0026 · Reklam Konsolu Paket C: panelden reklam kurulumu ve takip.
-- 0025 (Paket B) ig_yayin ekler; bu dosya B değerleri dahil action ve source check'lerini yeniden kurar.
-- Tekrar çalıştırmak güvenlidir (drop if exists / add column if not exists / on conflict do nothing).
-- RLS değişmez: ad_change_log ve ad_objects okuma is_yonetici(), yazma service_role (0018).

-- === Değişiklik kaydı: eylem ve kaynak listeleri ===
alter table public.ad_change_log drop constraint if exists ad_change_log_action_check;
alter table public.ad_change_log add constraint ad_change_log_action_check
  check (action in ('pause','resume','budget','ig_yayin','kampanya_kur','reklam_kur',
                    'buyutmeye_tasi','kitle_guncelle','sablon'));

alter table public.ad_change_log drop constraint if exists ad_change_log_source_check;
alter table public.ad_change_log add constraint ad_change_log_source_check
  check (source in ('kampanyalar','oneri','icerik','ayarlar','cron'));

-- Haftalık "en çok 4 yeni reklam" sayımı (action='reklam_kur', created_at >= Pazartesi).
create index if not exists idx_ad_change_log_action_created
  on public.ad_change_log (action, created_at desc);

-- === Reklam inceleme durumu (Meta effective_status, ad_review_feedback) ===
alter table public.ad_objects add column if not exists effective_status text;
alter table public.ad_objects add column if not exists review_feedback text;

-- === Ayar tohumları ===
insert into public.app_settings (key, value) values
  ('reklam_sablonu', '{"okulAdres":"","lat":null,"lng":null,"yaricapKm":8,"yasMin":25,"yasMax":45,"testGunlukTl":200,"buyutmeGunlukTl":400,"mevcutVelileriHaricTut":true,"haftalikYeniReklam":4,"updatedBy":null,"updatedAt":null}'::jsonb),
  ('reklam_kurulum', '{}'::jsonb)
on conflict (key) do nothing;
