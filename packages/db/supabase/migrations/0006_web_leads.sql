-- 0006_web_leads.sql — Faz 1: site formu doğrudan CRM leads tablosuna yazar.

-- === Atıf (attribution) kolonları ===
alter table public.leads
  add column gclid text,
  add column utm_source text,
  add column utm_medium text,
  add column utm_campaign text,
  add column utm_term text,
  add column utm_content text,
  add column landing_path text,
  add column consent_at timestamptz,
  add column web_payload jsonb;

create index idx_leads_gclid on public.leads (gclid) where gclid is not null;

-- === Kaynak listesine web_sitesi ===
alter table public.leads drop constraint leads_source_check;
alter table public.leads add constraint leads_source_check
  check (source in ('referans','instagram','reklam','tabela_gecerken','telefon','etkinlik','web_sitesi','diger'));

-- === Web başvurularının varsayılan danışmanı ("" = atanmamış; value NOT NULL) ===
insert into public.app_settings (key, value) values ('web_lead_assignee', '""'::jsonb)
  on conflict (key) do nothing;

-- === Tek giriş noktası ===
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

  v_source := case when v_gclid is not null then 'reklam' else 'web_sitesi' end;

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
    landing_path, consent_at, web_payload
  ) values (
    v_name, p_phone, v_source, coalesce(v_campaign, v_path), 'yeni', v_assignee,
    v_gclid, v_utm->>'utm_source', v_utm->>'utm_medium', v_campaign,
    v_utm->>'utm_term', v_utm->>'utm_content',
    v_path, p_consent_at, v_payload
  ) returning id into v_lead_id;

  insert into public.events (entity_type, entity_id, event_type, actor_id, payload)
  values ('lead', v_lead_id, 'web_basvuru', null, v_payload);

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
