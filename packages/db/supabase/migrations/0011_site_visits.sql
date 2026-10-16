-- 0011_site_visits.sql — çerezsiz, anonim site ziyaret sayacı.
-- Kişisel veri tutulmaz: IP, çerez, cihaz kimliği veya oturum kimliği YOK. Yalnızca gün × sayfa × kaynak × cihaz
-- türü bazında toplam sayılar. Bu yüzden çerez onayından bağımsız olarak her ziyaret sayılır.

create table public.site_visit_daily (
  day date not null,
  path text not null check (char_length(path) between 1 and 200 and path like '/%'),
  source text not null check (source in ('google_ads', 'arama', 'sosyal', 'kampanya', 'diger_site', 'dogrudan', 'site_ici')),
  device text not null check (device in ('mobil', 'masaustu')),
  pageviews int not null default 0 check (pageviews >= 0),
  entrances int not null default 0 check (entrances >= 0),
  primary key (day, path, source, device)
);

alter table public.site_visit_daily enable row level security;

-- Yalnızca yönetici okur; yazma yalnızca service_role (sitenin sunucusu, record_site_visit ile).
create policy sel_site_visit_daily on public.site_visit_daily for select using (public.is_yonetici());

revoke all on public.site_visit_daily from anon, public, authenticated;
grant select on public.site_visit_daily to authenticated;
grant all on public.site_visit_daily to service_role;

-- Tek ziyareti İstanbul gününe ekler (yarışsız: insert ... on conflict).
create or replace function public.record_site_visit(
  p_path text,
  p_source text,
  p_device text,
  p_entrance boolean
) returns void
language sql set search_path = '' as $$
  insert into public.site_visit_daily as v (day, path, source, device, pageviews, entrances)
  values ((now() at time zone 'Europe/Istanbul')::date, p_path, p_source, p_device, 1, case when p_entrance then 1 else 0 end)
  on conflict (day, path, source, device) do update
    set pageviews = v.pageviews + 1,
        entrances = v.entrances + excluded.entrances;
$$;

revoke all on function public.record_site_visit(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.record_site_visit(text, text, text, boolean) to service_role;
