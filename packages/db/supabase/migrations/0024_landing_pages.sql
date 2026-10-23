-- 0024_landing_pages.sql — Reklam sayfası yayını (Reklam Konsolu Paket A) ve öğretmenin
-- içerik özeti. Sayfa satırı bir "sayfa" içeriğine bağlıdır; /lp/<slug> DB'den okunur.
-- Okuma: yönetici hepsi, öğretmen kendi içeriğininki; yazma yalnız service_role (sunucu eylemleri).

-- === Sayfa satırları ===
create table public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  -- Taslakta boş olabilir (önizleme adres seçilmeden açılır). Kod slug'ları ve önizleme yolu ayrılmış
  -- (@seker/shared/landing RESERVED_LP_SLUGS ile aynı liste).
  slug text unique
    check (slug ~ '^[a-z0-9-]{3,60}$' and slug not in
      ('beykent-anaokulu','beylikduzu-anaokulu','az-mevcutlu-anaokulu','kres-2-yas','anaokulu-ucret','onizleme')),
  content_id uuid not null unique references public.content_items(id) on delete cascade,
  status text not null default 'taslak' check (status in ('taslak','yayinda','arsiv')),
  -- LandingFields (@seker/shared/landing); taslakta {}.
  fields jsonb not null default '{}'::jsonb,
  -- randomBytes(32).toString('base64url') → 43 karakter; /lp/onizleme/<token>
  preview_token text not null unique check (length(preview_token) >= 43),
  published_at timestamptz,
  published_by uuid references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint landing_pages_slug_live check (status = 'taslak' or slug is not null)
);

create trigger touch_landing_pages before update on public.landing_pages
  for each row execute function public.touch_updated_at();

-- Yayından sonra adres değişmez (reklam bağlantıları kırılmasın); service_role dahil herkese.
create or replace function public.landing_pages_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.published_at is not null and new.slug is distinct from old.slug then
    raise exception 'Yayından sonra adres değişmez' using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function public.landing_pages_guard() from public, anon, authenticated;

create trigger landing_pages_guard before update on public.landing_pages
  for each row execute function public.landing_pages_guard();

alter table public.landing_pages enable row level security;

create policy sel_landing_pages_yonetici on public.landing_pages for select
  using (public.is_yonetici());
create policy sel_landing_pages_owner on public.landing_pages for select
  using (exists (
    select 1 from public.content_items c
    where c.id = landing_pages.content_id and c.owner_id = auth.uid()
  ));

revoke all on public.landing_pages from anon, public, authenticated;
grant select on public.landing_pages to authenticated;
grant all on public.landing_pages to service_role;

-- === Öğretmenin içerik özeti (O3 İçeriğim) ===
create index if not exists idx_leads_content_code on public.leads (content_code) where content_code is not null;

-- Çağıranın kendi içerikleri için veli / randevu / kayıt sayıları. Para alanı yok.
-- appointments: iptal olmayan en az bir randevusu olan veli sayısı.
-- last_sync_at: reklam verisinin son senkron zamanı (max ad_objects.synced_at).
-- approved_by_name: onaylayanın ilk adı (öğretmen diğer profilleri okuyamaz).
create or replace function public.content_owner_summary()
returns table (content_id uuid, code text, leads int, appointments int, enrolled int,
               last_sync_at timestamptz, approved_by_name text)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.code,
    (select count(*)::int from public.leads l where l.content_code = c.code),
    (select count(distinct a.lead_id)::int
       from public.appointments a
       join public.leads l on l.id = a.lead_id
      where l.content_code = c.code and a.outcome <> 'iptal'),
    (select count(*)::int from public.leads l where l.content_code = c.code and l.status = 'kazanildi'),
    (select max(o.synced_at) from public.ad_objects o),
    (select nullif(split_part(btrim(p.full_name), ' ', 1), '') from public.profiles p where p.id = c.approved_by)
  from public.content_items c
  where c.owner_id = auth.uid()
  order by c.week_start desc, c.code;
$$;

revoke all on function public.content_owner_summary() from public, anon;
grant execute on function public.content_owner_summary() to authenticated, service_role;
