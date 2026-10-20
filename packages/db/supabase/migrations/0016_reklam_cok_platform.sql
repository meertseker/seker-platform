-- 0016_reklam_cok_platform.sql — reklam verisi platformlu (Google + Meta), Meta alanları ve kuyruğu.
-- Google davranışı değişmez; leads.source anlamı değişmez (K10): 'reklam' yalnız Google (gclid).

-- === leads: platform ve Meta alanları ===
alter table public.leads
  add column ad_platform text check (ad_platform in ('google', 'meta')),
  add column fbclid text,
  add column fbc text,
  add column fbp text,
  add column meta_event_id text,
  add column consent_version smallint,
  add column ad_cookie_consent boolean;

-- Geri doldurma: gclid dolu ya da source='reklam' olanlar Google.
update public.leads set ad_platform = 'google'
 where coalesce(gclid, '') <> '' or source = 'reklam';

-- === ad_spend_daily: platform + seviye ===
-- Kural: her platform tek seviye yazar — Google 'campaign', Meta 'ad'; böylece kampanya toplamı satırların toplamıdır.
alter table public.ad_spend_daily
  add column platform text not null default 'google' check (platform in ('google', 'meta')),
  add column level text not null default 'campaign' check (level in ('campaign', 'adset', 'ad')),
  add column object_id text,
  add column adset_id text,
  add column adset_name text,
  add column ad_id text,
  add column ad_name text,
  add column content_code text,
  add column reach int,
  add column frequency numeric(8,4),
  add column platform_results int;

update public.ad_spend_daily set object_id = campaign_id where object_id is null;
alter table public.ad_spend_daily alter column object_id set not null;

alter table public.ad_spend_daily drop constraint ad_spend_daily_pkey;
alter table public.ad_spend_daily add primary key (platform, date, level, object_id);

-- Eski yazıcılar object_id vermezse kampanya kimliği kullanılır.
create or replace function public.ad_spend_daily_object_id() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.object_id := coalesce(new.object_id, new.campaign_id);
  return new;
end;
$$;
create trigger ad_spend_daily_object_id
  before insert on public.ad_spend_daily
  for each row execute function public.ad_spend_daily_object_id();

-- === conversion_uploads: platform, tıklama kimliği türü, olay kimliği ===
alter table public.conversion_uploads
  add column platform text not null default 'google' check (platform in ('google', 'meta')),
  add column click_id_type text check (click_id_type in ('gclid', 'fbc')),
  add column event_id text;

update public.conversion_uploads set click_id_type = 'gclid' where coalesce(gclid, '') <> '';

alter table public.conversion_uploads drop constraint conversion_uploads_conversion_action_check;
alter table public.conversion_uploads add constraint conversion_uploads_conversion_action_check
  check (conversion_action in ('randevu', 'kayit', 'lead'));

alter table public.conversion_uploads drop constraint conversion_uploads_lead_id_conversion_action_key;
alter table public.conversion_uploads add constraint conversion_uploads_lead_action_platform_key
  unique (lead_id, conversion_action, platform);

-- === site_visit_daily: meta_ads kaynağı ===
-- record_site_visit kaynağı kendisi denetlemez; sınırlama tablo kontrolündedir.
alter table public.site_visit_daily drop constraint site_visit_daily_source_check;
alter table public.site_visit_daily add constraint site_visit_daily_source_check
  check (source in ('google_ads', 'meta_ads', 'arama', 'sosyal', 'kampanya', 'diger_site', 'dogrudan', 'site_ici'));

-- === Kuyruk tetikleyicisi: 0008 gövdesi korunur; Google bölümü aynı, Meta bölümü eklenir ===
create or replace function public.enqueue_conversion_upload() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_actions text[];
  v_action text;
  v_click_at timestamptz;
  v_value numeric(12,2);
  v_status text;
  v_error text;
  v_google boolean;
  v_meta boolean;
  v_meta_status text;
  v_meta_error text;
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

  v_google := not (coalesce(new.gclid, '') = '' and new.source <> 'reklam');
  v_meta := new.ad_platform = 'meta';
  if not v_google and not v_meta then
    return new;
  end if;

  if v_google then
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

      insert into public.conversion_uploads (lead_id, gclid, conversion_action, conversion_at, value, status, error, platform, click_id_type)
      values (new.id, nullif(new.gclid, ''), v_action, now(), v_value, v_status, v_error, 'google',
              case when coalesce(new.gclid, '') <> '' then 'gclid' end)
      on conflict (lead_id, conversion_action, platform) do update
        set gclid = excluded.gclid, status = excluded.status, error = excluded.error,
            conversion_at = excluded.conversion_at, value = excluded.value
        where public.conversion_uploads.status = 'atlandi'
          and public.conversion_uploads.error = 'gclid yok'
          and excluded.status = 'bekliyor';
    end loop;
  end if;

  -- Meta: aynı eylemler platform='meta' satırı olarak; uygunluğun kalanı (K9, iptal, 7 gün) gönderim anında TS'te.
  if v_meta then
    v_meta_status := 'bekliyor';
    v_meta_error := null;
    if coalesce(new.web_payload, '{}'::jsonb) ? 'old_web_lead_id'
       or coalesce(new.web_payload, '{}'::jsonb)->>'consent_scope' = 'arama' then
      v_meta_status := 'atlandi';
      v_meta_error := 'onay yalnızca arama için';
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

      insert into public.conversion_uploads
        (lead_id, conversion_action, conversion_at, value, status, error, platform, click_id_type, event_id)
      values (new.id, v_action, now(), v_value, v_meta_status, v_meta_error, 'meta',
              case when coalesce(new.fbc, '') <> '' then 'fbc' end,
              new.id || case when v_action = 'kayit' then ':enrolled' else ':schedule' end)
      on conflict (lead_id, conversion_action, platform) do nothing;
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function public.enqueue_conversion_upload() from public, anon, authenticated;

-- === create_web_lead: 0014 gövdesi korunur; Meta alanları ve platform eklenir ===
create or replace function public.create_web_lead(
  p_parent_name text,
  p_phone text,
  p_gclid text,
  p_utm jsonb,
  p_landing_path text,
  p_consent_at timestamptz,
  p_meta jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_parent_name, ''));
  v_gclid text := nullif(left(btrim(coalesce(p_gclid, '')), 200), '');
  v_path text := nullif(left(btrim(coalesce(p_landing_path, '')), 200), '');
  v_in jsonb := case when jsonb_typeof(p_utm) = 'object' then p_utm else '{}'::jsonb end;
  v_meta jsonb := case when jsonb_typeof(p_meta) = 'object' then p_meta else '{}'::jsonb end;
  v_silent boolean := coalesce(v_meta->>'silent', '') = 'true';
  v_utm jsonb;
  v_campaign text;
  v_payload jsonb;
  v_source text;
  v_lead_id uuid;
  v_assignee uuid;
  v_recent boolean;
  v_content_code text := case when (v_in->>'utm_content') ~ '^[RS]-\d{4}-[A-Z]$'
                              then v_in->>'utm_content' end;
  v_district text := nullif(left(btrim(coalesce(v_meta->>'district', '')), 80), '');
  v_start_window text := case when v_meta->>'start_window' in ('hemen','1_3_ay','3_6_ay','gelecek_yil')
                              then v_meta->>'start_window' end;
  v_wants_wa boolean := case v_meta->>'wants_whatsapp' when 'true' then true when 'false' then false end;
  v_birth_month smallint := case when (v_meta->>'child_birth_month') ~ '^\d{1,2}$'
                                  and (v_meta->>'child_birth_month')::int between 1 and 12
                                 then (v_meta->>'child_birth_month')::smallint end;
  v_fbclid text := nullif(left(btrim(coalesce(v_meta->>'fbclid', '')), 200), '');
  v_fbc text := nullif(left(btrim(coalesce(v_meta->>'fbc', '')), 200), '');
  v_fbp text := nullif(left(btrim(coalesce(v_meta->>'fbp', '')), 200), '');
  v_event_id text := nullif(left(btrim(coalesce(v_meta->>'meta_event_id', '')), 200), '');
  v_consent_version smallint := case when (v_meta->>'consent_version') ~ '^[1-9]$'
                                     then (v_meta->>'consent_version')::smallint end;
  v_cookie_consent boolean := case v_meta->>'ad_cookie_consent' when 'true' then true when 'false' then false end;
  v_ad_platform text;
  v_birth_year smallint := case when (v_meta->>'child_birth_year') ~ '^\d{4}$'
                                 and (v_meta->>'child_birth_year')::int between 2010 and 2035
                                then (v_meta->>'child_birth_year')::smallint end;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'create_web_lead: invalid parent_name' using errcode = '22023';
  end if;
  if p_phone is null or p_phone !~ '^\+905[0-9]{9}$' then
    raise exception 'create_web_lead: invalid phone' using errcode = '22023';
  end if;
  if p_consent_at is null then
    raise exception 'create_web_lead: consent required' using errcode = '22023';
  end if;

  -- Yalnızca bilinen utm anahtarları, her biri en fazla 200 karakter.
  v_utm := jsonb_strip_nulls(jsonb_build_object(
    'utm_source',   nullif(left(btrim(coalesce(v_in->>'utm_source', '')), 200), ''),
    'utm_medium',   nullif(left(btrim(coalesce(v_in->>'utm_medium', '')), 200), ''),
    'utm_campaign', nullif(left(btrim(coalesce(v_in->>'utm_campaign', '')), 200), ''),
    'utm_term',     nullif(left(btrim(coalesce(v_in->>'utm_term', '')), 200), ''),
    'utm_content',  nullif(left(btrim(coalesce(v_in->>'utm_content', '')), 200), '')
  ));
  v_campaign := v_utm->>'utm_campaign';
  v_payload := jsonb_build_object('gclid', v_gclid, 'landing_path', v_path, 'utm', v_utm,
                                  'consent_at', p_consent_at)
               || (v_meta - 'silent');

  -- Aynı telefondan eşzamanlı iki istek iki kart açmasın.
  perform pg_advisory_xact_lock(hashtext('create_web_lead:' || p_phone));

  select l.id into v_lead_id
  from public.leads l
  where l.phone = p_phone
    and l.status not in ('kazanildi', 'kaybedildi')
  order by l.created_at desc
  limit 1;

  if v_lead_id is not null then
    select exists (
      select 1 from public.events e
      where e.entity_type = 'lead'
        and e.entity_id = v_lead_id
        and e.event_type in ('web_basvuru', 'web_tekrar_basvuru')
        and e.created_at > now() - interval '10 minutes'
    ) into v_recent;

    update public.leads
       set last_activity_at = now(),
           gclid = coalesce(gclid, v_gclid),
           content_code = coalesce(content_code, v_content_code),
           district = coalesce(district, v_district),
           start_window = coalesce(start_window, v_start_window),
           wants_whatsapp = coalesce(wants_whatsapp, v_wants_wa),
           child_birth_month = coalesce(child_birth_month, v_birth_month),
           child_birth_year = coalesce(child_birth_year, v_birth_year),
           fbclid = coalesce(fbclid, v_fbclid),
           fbc = coalesce(fbc, v_fbc),
           fbp = coalesce(fbp, v_fbp),
           meta_event_id = coalesce(meta_event_id, v_event_id),
           consent_version = coalesce(consent_version, v_consent_version),
           ad_cookie_consent = coalesce(ad_cookie_consent, v_cookie_consent),
           -- İçe aktarma (consent_scope var) onayı yükseltmez; yalnızca canlı form onayı yazılır.
           consent_at = case when v_meta ? 'consent_scope' then consent_at
                             else coalesce(consent_at, p_consent_at) end
     where id = v_lead_id;

    insert into public.events (entity_type, entity_id, event_type, actor_id, payload)
    values ('lead', v_lead_id, 'web_tekrar_basvuru', null, v_payload);

    if not v_recent and not v_silent then
      insert into public.notifications (user_id, type, payload)
      select p.id, 'web_basvuru', jsonb_build_object(
               'leadId', v_lead_id, 'parentName', v_name, 'source', null,
               'landingPath', v_path, 'duplicate', true)
      from public.profiles p
      join public.leads l on l.id = v_lead_id
      where p.is_active and (p.role = 'yonetici' or p.id = l.assigned_to);
    end if;

    return jsonb_build_object('lead_id', v_lead_id, 'duplicate', true);
  end if;

  -- K10: gclid Google'ı kazanır; Meta reklam işareti (paid_social + bilinen kaynak) Meta;
  -- fbclid tek başına organik Instagram (ad_platform null).
  if v_gclid is not null then
    v_source := 'reklam';
    v_ad_platform := 'google';
  elsif lower(coalesce(v_utm->>'utm_medium', '')) = 'paid_social'
        and lower(coalesce(v_utm->>'utm_source', '')) in ('instagram', 'facebook', 'ig', 'fb', 'meta') then
    v_source := 'instagram';
    v_ad_platform := 'meta';
  elsif v_fbclid is not null then
    v_source := 'instagram';
  else
    v_source := 'web_sitesi';
  end if;

  begin
    select nullif(s.value #>> '{}', '')::uuid into v_assignee
    from public.app_settings s where s.key = 'web_lead_assignee';
  exception when invalid_text_representation then
    v_assignee := null;
  end;
  if v_assignee is not null and not exists (
    select 1 from public.profiles p where p.id = v_assignee and p.is_active
  ) then
    v_assignee := null;
  end if;

  insert into public.leads (
    parent_name, phone, source, source_detail, status, assigned_to,
    gclid, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    landing_path, consent_at, web_payload,
    channel, content_code, district, start_window, wants_whatsapp,
    child_birth_month, child_birth_year,
    ad_platform, fbclid, fbc, fbp, meta_event_id, consent_version, ad_cookie_consent
  ) values (
    v_name, p_phone, v_source, coalesce(v_campaign, v_path), 'yeni', v_assignee,
    v_gclid, v_utm->>'utm_source', v_utm->>'utm_medium', v_campaign,
    v_utm->>'utm_term', v_utm->>'utm_content',
    v_path, p_consent_at, v_payload,
    'form', v_content_code, v_district, v_start_window, v_wants_wa,
    v_birth_month, v_birth_year,
    v_ad_platform, v_fbclid, v_fbc, v_fbp, v_event_id, v_consent_version, v_cookie_consent
  ) returning id into v_lead_id;

  insert into public.events (entity_type, entity_id, event_type, actor_id, payload)
  values ('lead', v_lead_id, 'web_basvuru', null, v_payload);

  -- Meta reklam velisi: form 'Lead' olayı kuyruğa girer (gönderim uygunluğu TS'te).
  if v_ad_platform = 'meta' then
    insert into public.conversion_uploads
      (lead_id, conversion_action, conversion_at, status, platform, click_id_type, event_id)
    values (v_lead_id, 'lead', now(), 'bekliyor', 'meta',
            case when v_fbc is not null then 'fbc' end, v_event_id)
    on conflict (lead_id, conversion_action, platform) do nothing;
  end if;

  if not v_silent then
    insert into public.notifications (user_id, type, payload)
    select p.id, 'web_basvuru', jsonb_build_object(
             'leadId', v_lead_id, 'parentName', v_name, 'source', v_source,
             'landingPath', v_path, 'duplicate', false)
    from public.profiles p
    where p.is_active and (p.role = 'yonetici' or p.id = v_assignee);
  end if;

  return jsonb_build_object('lead_id', v_lead_id, 'duplicate', false);
end;
$$;

revoke all on function public.create_web_lead(text, text, text, jsonb, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_web_lead(text, text, text, jsonb, text, timestamptz, jsonb)
  to service_role;
