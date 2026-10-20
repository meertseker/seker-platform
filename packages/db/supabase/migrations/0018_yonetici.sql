-- 0018_yonetici.sql — Yönetici ekranı: değişiklik kaydı, öneriler, haftalık toplantı,
-- kampanya nesne durumu ve elle içerik bağlama.
-- Okuma yalnız yönetici (is_yonetici()); yazma yalnız service_role (sunucu eylemleri ve cron).

-- === Reklam nesneleri (platformdan senkronlanan durum ve bütçe) ===
create table public.ad_objects (
  platform text not null check (platform in ('google','meta')),
  level text not null check (level in ('campaign','adset','ad')),
  object_id text not null,
  parent_id text,
  campaign_id text,
  name text not null,
  -- Platformun ham durumu: ENABLED / PAUSED / ACTIVE ...
  status text,
  daily_budget_micros bigint,
  -- Google: campaignBudgets/… kaynak adı; Meta: bütçenin durduğu nesne kimliği
  budget_resource text,
  content_code text,
  synced_at timestamptz not null default now(),
  primary key (platform, level, object_id)
);

-- === Elle içerik bağlama (K11) ===
create table public.ad_content_links (
  platform text not null,
  ad_id text not null,
  content_code text not null check (content_code ~ '^[RS]-\d{4}-[A-Z]$'),
  linked_by uuid references public.profiles(id),
  linked_at timestamptz not null default now(),
  primary key (platform, ad_id)
);

-- === Değişiklik kaydı ===
create table public.ad_change_log (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  level text not null,
  object_id text not null,
  object_name text,
  action text not null check (action in ('pause','resume','budget')),
  old_value jsonb,
  new_value jsonb,
  reason text,
  -- İşlem anında bir kapı kırmızıydı
  gate_red boolean not null default false,
  source text not null check (source in ('kampanyalar','oneri')),
  recommendation_id uuid,
  status text not null check (status in ('uygulandi','uygulanmadi_kapali','hata')),
  error text,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_ad_change_log_created on public.ad_change_log (created_at desc);
create index idx_ad_change_log_object on public.ad_change_log (platform, object_id);

-- === Öneriler ===
create table public.ad_recommendations (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  rule_key text not null check (rule_key in ('durdur','buyut','teste_al','butce_artir','yorgunluk','sonucsuz')),
  -- İçerik kodu ya da <platform>:<object_id>
  object_key text not null,
  platform text,
  title text not null,
  why text not null,
  -- Uygulanacak değişiklik
  action jsonb,
  -- Ör. kapı kırmızı
  blocked_reason text,
  status text not null default 'acik' check (status in ('acik','onaylandi','bekletildi','gecersiz')),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  result text,
  created_at timestamptz not null default now(),
  unique (week_start, rule_key, object_key)
);

-- === Haftalık toplantı ===
create table public.weekly_reviews (
  week_start date primary key,
  topic text,
  decisions jsonb not null default '[]'::jsonb,
  task_ids uuid[],
  saved_by uuid references public.profiles(id),
  saved_at timestamptz not null default now()
);

-- === RLS: okuma yönetici, yazma yalnız service_role ===
alter table public.ad_objects enable row level security;
alter table public.ad_content_links enable row level security;
alter table public.ad_change_log enable row level security;
alter table public.ad_recommendations enable row level security;
alter table public.weekly_reviews enable row level security;

create policy sel_ad_objects on public.ad_objects for select using (public.is_yonetici());
create policy sel_ad_content_links on public.ad_content_links for select using (public.is_yonetici());
create policy sel_ad_change_log on public.ad_change_log for select using (public.is_yonetici());
create policy sel_ad_recommendations on public.ad_recommendations for select using (public.is_yonetici());
create policy sel_weekly_reviews on public.weekly_reviews for select using (public.is_yonetici());

revoke all on public.ad_objects, public.ad_content_links, public.ad_change_log,
  public.ad_recommendations, public.weekly_reviews from anon, public, authenticated;
grant select on public.ad_objects, public.ad_content_links, public.ad_change_log,
  public.ad_recommendations, public.weekly_reviews to authenticated;
grant all on public.ad_objects, public.ad_content_links, public.ad_change_log,
  public.ad_recommendations, public.weekly_reviews to service_role;

-- === Ayar tohumları ===
insert into public.app_settings (key, value) values
  ('kapi_esikleri', '{"ilk_arama_dk":15,"ulasma_yuzde":80,"randevu_yuzde":35,"gelme_yuzde":70}'::jsonb),
  ('aylik_butce', '{"google_tl":0,"meta_tl":0}'::jsonb)
on conflict (key) do nothing;

-- Aşama 3 anahtarı korunur; yalnız eksik alanlar eklenir (mevcut değer sağda, kazanır).
insert into public.app_settings (key, value) values
  ('reklam_kurallari', '{"buyutme_yuzde":20,"yorgunluk_siklik":3,"yorgunluk_ctr_dusus_yuzde":30}'::jsonb)
on conflict (key) do update
  set value = excluded.value || public.app_settings.value;
