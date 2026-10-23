-- 0025 ig_yayin — Reklam Konsolu Paket B: Instagram'a yayın (spec 2026-10-23 K16, K21, §15 B2/B5/B6).
-- content_items'a yayın durumu kolonları; ad_change_log'a ig_yayin eylemi ve yeni kaynaklar.
-- Kolon yetkisine dokunulmaz: 0017'deki authenticated update grant'i (caption, page_fields, media_path,
-- media_meta, face_answer, updated_at) yeni kolonları kapsamaz; ig_* alanlarını yalnız servis rolü yazar.

alter table public.content_items
  add column if not exists ig_publish_status text not null default 'yok',
  add column if not exists ig_container_id text,
  add column if not exists ig_publish_error text,
  add column if not exists ig_publish_scheduled_at timestamptz,
  add column if not exists ig_publish_requested_by uuid references public.profiles(id),
  add column if not exists ig_publish_requested_at timestamptz;

alter table public.content_items drop constraint if exists content_items_ig_publish_status_check;
alter table public.content_items add constraint content_items_ig_publish_status_check
  check (ig_publish_status in ('yok','kuyruk','isleniyor','yayinda','hata'));

-- Cron kuyruğu: yalnız bekleyen/işlenen satırlar.
create index if not exists idx_content_items_ig_queue
  on public.content_items (ig_publish_status, ig_publish_scheduled_at)
  where ig_publish_status in ('kuyruk','isleniyor');

-- Elle bağlanmış ve sayıları gelmiş eski Reels "yayında" görünür.
update public.content_items
   set ig_publish_status = 'yayinda'
 where ig_media_id is not null and ig_published_at is not null and ig_publish_status = 'yok';

-- ad_change_log: 0026 (Paket C) iki kısıtı bu değerleri de içererek yeniden kurar.
alter table public.ad_change_log drop constraint if exists ad_change_log_action_check;
alter table public.ad_change_log add constraint ad_change_log_action_check
  check (action in ('pause','resume','budget','ig_yayin'));
alter table public.ad_change_log drop constraint if exists ad_change_log_source_check;
alter table public.ad_change_log add constraint ad_change_log_source_check
  check (source in ('kampanyalar','oneri','icerik','ayarlar','cron'));
