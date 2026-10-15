-- Faz 3: reklam harcaması + offline dönüşüm kuyruğu

-- Reklam verisi paylaşım onayının geri alınması (adUserDataFor 'denied' döner).
alter table public.leads add column ad_consent_revoked_at timestamptz;

create table public.ad_spend_daily (
  date date not null,
  campaign_id text not null,
  campaign_name text not null,
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  clicks int not null default 0 check (clicks >= 0),
  impressions int not null default 0 check (impressions >= 0),
  primary key (date, campaign_id)
);

create table public.conversion_uploads (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  gclid text,
  conversion_action text not null check (conversion_action in ('randevu','kayit')),
  conversion_at timestamptz not null default now(),
  value numeric(12,2),
  status text not null default 'bekliyor' check (status in ('bekliyor','gonderildi','hata','atlandi')),
  error text,
  uploaded_at timestamptz,
  unique (lead_id, conversion_action)
);
create index idx_conversion_uploads_status on public.conversion_uploads (status, conversion_at);

alter table public.ad_spend_daily enable row level security;
alter table public.conversion_uploads enable row level security;

-- Yalnızca yönetici okur; yazma yalnızca service_role (cron ve yönetici Server Action'ları secret key ile).
create policy sel_ad_spend_daily on public.ad_spend_daily for select using (public.is_yonetici());
create policy sel_conversion_uploads on public.conversion_uploads for select using (public.is_yonetici());

grant select on public.ad_spend_daily, public.conversion_uploads to authenticated;
grant all on public.ad_spend_daily, public.conversion_uploads to service_role;

-- Kuyruk: durum randevu/gorusme_yapildi/teklif/kazanildi'ya girince 'randevu' dönüşümü,
-- kazanildi'da ayrıca 'kayit' dönüşümü yazar (her biri en fazla bir kez).
-- security definer: danışmanın update'i tetiklediğinde de RLS'e takılmadan yazabilsin.
create or replace function public.enqueue_conversion_upload() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_actions text[];
  v_action text;
  v_click_at timestamptz;
  v_value numeric(12,2);
  v_status text;
  v_error text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('randevu', 'gorusme_yapildi', 'teklif') then
    v_actions := array['randevu'];
  elsif new.status = 'kazanildi' then
    v_actions := array['randevu', 'kayit'];
  else
    return new;
  end if;

  if coalesce(new.gclid, '') = '' and new.source <> 'reklam' then
    return new;
  end if;

  -- Tıklama zamanı: bu gclid'li ilk başvuru olayı; yoksa aday kaydının oluşturulma zamanı.
  if coalesce(new.gclid, '') <> '' then
    select min(e.created_at) into v_click_at
    from public.events e
    where e.entity_type = 'lead' and e.entity_id = new.id
      and e.event_type in ('web_basvuru', 'web_tekrar_basvuru')
      and e.payload->>'gclid' = new.gclid;
  end if;
  v_click_at := coalesce(v_click_at, new.created_at);

  v_status := 'bekliyor';
  v_error := null;
  if coalesce(new.web_payload, '{}'::jsonb) ? 'old_web_lead_id'
     or coalesce(new.web_payload, '{}'::jsonb)->>'consent_scope' = 'arama' then
    -- Eski formun onayı yalnızca telefonla arama içindi; Google'a asla gönderilmez.
    v_status := 'atlandi';
    v_error := 'onay yalnızca arama için';
  elsif coalesce(new.gclid, '') = '' then
    v_status := 'atlandi';
    v_error := 'gclid yok';
  elsif v_click_at < now() - interval '89 days' then
    v_status := 'atlandi';
    v_error := 'tıklama 90 günden eski';
  end if;

  foreach v_action in array v_actions loop
    v_value := null;
    if v_action = 'kayit' then
      select o.offered_price into v_value
      from public.offers o
      where o.lead_id = new.id and o.status = 'onaylandi'
      order by o.decided_at desc nulls last, o.created_at desc
      limit 1;
    end if;

    insert into public.conversion_uploads (lead_id, gclid, conversion_action, conversion_at, value, status, error)
    values (new.id, nullif(new.gclid, ''), v_action, now(), v_value, v_status, v_error)
    on conflict (lead_id, conversion_action) do update
      set gclid = excluded.gclid, status = excluded.status, error = excluded.error
      where public.conversion_uploads.status = 'atlandi'
        and public.conversion_uploads.error = 'gclid yok'
        and excluded.status = 'bekliyor';
  end loop;

  return new;
end;
$$;

revoke all on function public.enqueue_conversion_upload() from public, anon, authenticated;

create trigger enqueue_conversion_upload
  after update of status on public.leads
  for each row execute function public.enqueue_conversion_upload();
