-- 0014_on_buro_akisi.sql — Aşama 1: ön büro akışı (nitelik alanları, mesai/şablon ayarları, görev saati).

-- === Lead alanları ===
alter table public.leads
  add column channel text check (channel in ('form','ig_dm','ig_yorum','whatsapp','telefon')),
  add column content_code text,
  add column district text,
  add column start_window text check (start_window in ('hemen','1_3_ay','3_6_ay','gelecek_yil')),
  add column wants_whatsapp boolean,
  add column first_contact_at timestamptz,
  add column claimed_at timestamptz,
  add column q_age_ok boolean,
  add column q_area_ok boolean,
  add column q_timing_ok boolean,
  add column q_reached boolean,
  add column is_qualified boolean generated always as (
    coalesce(q_age_ok, false) and coalesce(q_area_ok, false)
    and coalesce(q_timing_ok, false) and coalesce(q_reached, false)
  ) stored,
  add column contact_note text;

-- === Kaynak ve kayıp nedeni listeleri ===
alter table public.leads drop constraint leads_source_check;
alter table public.leads add constraint leads_source_check
  check (source in ('referans','instagram','reklam','tabela_gecerken','telefon','etkinlik','web_sitesi','whatsapp','diger'));

alter table public.leads drop constraint leads_lost_reason_check;
alter table public.leads add constraint leads_lost_reason_check
  check (lost_reason in ('fiyat','uzaklik','baska_okul','ulasilamadi','vazgecti','yas_uymuyor','gelecek_yil','diger'));

-- === Görev saati (eski kayıtlar için due_date geçerli kalır) ===
alter table public.tasks add column due_at timestamptz;

-- === Ayar tohumları ===
insert into public.app_settings (key, value) values
  ('mesai', '{"days":[1,2,3,4,5],"start":"08:30","end":"18:00"}'::jsonb),
  ('servis_semtleri', '["Beykent","Beylikdüzü","Büyükçekmece","Esenyurt","Gürpınar","Yakuplu"]'::jsonb),
  ('arama_metni', $j$[
    "Merhaba {veli}, Şeker Anaokulu'ndan {danisman}. Formunuz için arıyorum, uygun musunuz?",
    "Formu doğrula: \"Çocuğunuz {cocuk_yasi} yaşında, {semt}'tesiniz, doğru mu?\"",
    "Dinle: \"Okul seçerken sizin için en önemli şey ne?\" Cevabı aşağıya not et.",
    "Ziyarete davet et, iki saat söyle: \"Salı 10:00 mı, Perşembe 16:30 mu?\""
  ]$j$::jsonb),
  ('fiyat_cevabi', to_jsonb('Aylık ücretlerimiz programa göre [ARALIK] TL arasında. En doğrusu okulu görüp öğretmenimizle tanışmanız. Salı mı Perşembe mi uygun?'::text)),
  ('wa_sablonlari', $j$[
    {"key":"ulasilamadi","label":"Ulaşamadım","text":"Merhaba {veli}, Şeker Anaokulu'ndan {danisman}. Formunuz için aradım, ulaşamadım. Size uygun bir saatte tekrar arayabilir miyim?"},
    {"key":"ziyaret_saatleri","label":"Ziyaret saatleri","text":"Merhaba {veli}, Şeker Anaokulu'ndan {danisman}. Okulu gezmek için Salı 10:00 ya da Perşembe 16:30 uygundur. Hangisi size uyar?"},
    {"key":"randevu_onay","label":"Randevu onayı","text":"Merhaba {veli}, ziyaret randevunuz onaylandı. Sizi okulumuzda ağırlamaktan memnuniyet duyarız. - {danisman}, Şeker Anaokulu"},
    {"key":"ziyaret_tesekkur","label":"Ziyaret teşekkürü","text":"Merhaba {veli}, bugün okulumuzu ziyaret ettiğiniz için teşekkür ederiz. Aklınıza takılan her şeyi bana yazabilirsiniz. - {danisman}, Şeker Anaokulu"},
    {"key":"kontenjan","label":"Kontenjan","text":"Merhaba {veli}, Şeker Anaokulu'ndan {danisman}. Kontenjanlarımız sınırlıdır; yer ayırtmak isterseniz size yardımcı olabilirim."}
  ]$j$::jsonb),
  ('ustlenme_dk', '15'::jsonb),
  -- R23: aday hattının açıldığı an. "Şimdi ara" listesi bundan en çok 14 gün önce gelen velileri alır;
  -- 15 dakika uyarısı yalnız bundan sonra gelenler için gider.
  ('aday_hatti_acilis', to_jsonb(to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
on conflict (key) do nothing;

-- === İlk temas geri doldurma (R23) ===
-- Eski panelde aranan velinin izi görüşme notudur (logCallOutcome not yazar, ayrı olay yazmaz).
-- Yeni arama ekranının olayı (arama_kaydi) da sayılır. Kanıtı olmayan velide first_contact_at boş kalır.
-- first-contact-backfill:start
update public.leads l
   set first_contact_at = ev.first_at
  from (
    select x.lead_id, min(x.at) as first_at
    from (
      select n.lead_id, n.created_at as at from public.lead_notes n
      union all
      select e.entity_id, e.created_at from public.events e
       where e.entity_type = 'lead' and e.event_type = 'arama_kaydi'
    ) x
    group by x.lead_id
  ) ev
 where ev.lead_id = l.id
   and l.first_contact_at is null;
-- first-contact-backfill:end

-- === create_web_lead: 0006 gövdesi korunur; yalnız yeni alanlar eklenir ===
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
    landing_path, consent_at, web_payload,
    channel, content_code, district, start_window, wants_whatsapp,
    child_birth_month, child_birth_year
  ) values (
    v_name, p_phone, v_source, coalesce(v_campaign, v_path), 'yeni', v_assignee,
    v_gclid, v_utm->>'utm_source', v_utm->>'utm_medium', v_campaign,
    v_utm->>'utm_term', v_utm->>'utm_content',
    v_path, p_consent_at, v_payload,
    'form', v_content_code, v_district, v_start_window, v_wants_wa,
    v_birth_month, v_birth_year
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
