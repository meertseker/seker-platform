-- Faz 2: yerinde düzenleme

alter table public.profiles add column can_edit_site boolean not null default false;

create or replace function public.can_edit_site() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.can_edit_site
  );
$$;

-- Bayrağı yalnızca yönetici (veya service role) değiştirebilir.
create or replace function public.guard_profiles_can_edit_site() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.can_edit_site is distinct from old.can_edit_site
     and coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
     and not public.is_yonetici() then
    new.can_edit_site := old.can_edit_site;
  end if;
  return new;
end $$;

create trigger guard_profiles_can_edit_site before update on public.profiles
  for each row execute function public.guard_profiles_can_edit_site();

create or replace function public.set_can_edit_site(p_user uuid, p_value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_yonetici() then
    raise exception 'yalnızca yönetici' using errcode = '42501';
  end if;
  update public.profiles set can_edit_site = p_value where id = p_user;
end $$;
revoke all on function public.set_can_edit_site(uuid, boolean) from public, anon;
grant execute on function public.set_can_edit_site(uuid, boolean) to authenticated;

create table public.site_content (
  key text primary key check (key ~ '^[a-z0-9][a-zA-Z0-9_.-]{1,120}$'),
  value jsonb not null,
  kind text not null check (kind in ('text','rich','image','list')),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  old_value jsonb,
  new_value jsonb,
  editor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index content_revisions_created_idx on public.content_revisions (created_at desc);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  s3_key text not null unique,
  width int not null check (width > 0),
  height int not null check (height > 0),
  alt text not null check (char_length(alt) between 1 and 200),
  faces text not null check (faces in ('yok','bulanik_veya_izinli')),
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null,
  image_id uuid references public.media_assets(id) on delete set null,
  starts_on date not null default ((now() at time zone 'Europe/Istanbul')::date),
  ends_on date,
  published boolean not null default false,
  sort int not null default 0,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint ends_after_start check (ends_on is null or ends_on >= starts_on)
);

create view public.active_announcements with (security_invoker = true) as
  select id, title, body, image_id, starts_on, ends_on, sort, updated_at
  from public.announcements
  where published
    and starts_on <= (now() at time zone 'Europe/Istanbul')::date
    and (ends_on is null or ends_on >= (now() at time zone 'Europe/Istanbul')::date);

alter table public.site_content enable row level security;
alter table public.content_revisions enable row level security;
alter table public.media_assets enable row level security;
alter table public.announcements enable row level security;

create policy sel_site_content on public.site_content for select to anon, authenticated using (true);
create policy ins_site_content on public.site_content for insert to authenticated with check (public.can_edit_site());
create policy upd_site_content on public.site_content for update to authenticated
  using (public.can_edit_site()) with check (public.can_edit_site());
create policy del_site_content on public.site_content for delete to authenticated using (public.can_edit_site());

create policy sel_revisions on public.content_revisions for select to authenticated
  using (public.can_edit_site() or public.is_yonetici());
create policy ins_revisions on public.content_revisions for insert to authenticated
  with check (public.can_edit_site() and editor_id = (select auth.uid()));

create policy sel_media on public.media_assets for select to anon, authenticated using (true);
create policy ins_media on public.media_assets for insert to authenticated
  with check (public.can_edit_site() and uploaded_by = (select auth.uid()));
create policy upd_media on public.media_assets for update to authenticated
  using (public.can_edit_site()) with check (public.can_edit_site());

create policy sel_ann_public on public.announcements for select to anon using (published);
create policy sel_ann_staff on public.announcements for select to authenticated
  using (published or public.can_edit_site());
create policy ins_ann on public.announcements for insert to authenticated with check (public.can_edit_site());
create policy upd_ann on public.announcements for update to authenticated
  using (public.can_edit_site()) with check (public.can_edit_site());
create policy del_ann on public.announcements for delete to authenticated using (public.can_edit_site());

-- Tek giriş noktası: çakışma kontrolü + yazma + revizyon, tek transaction.
create or replace function public.save_site_content(p_edits jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  e jsonb;
  k text;
  cur_value jsonb;
  cur_updated timestamptz;
  conflicts text[] := '{}';
  ts timestamptz := clock_timestamp();
begin
  if not public.can_edit_site() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if jsonb_typeof(p_edits) <> 'array' or jsonb_array_length(p_edits) > 100 then
    raise exception 'geçersiz istek' using errcode = '22023';
  end if;

  -- Yeni anahtarda kilitlenecek satır yok: anahtar başına danışma kilidi (sıralı, kilitlenme olmasın).
  for k in
    select distinct x ->> 'key' from jsonb_array_elements(p_edits) x order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(k, 0));
  end loop;

  for e in select * from jsonb_array_elements(p_edits) loop
    select sc.updated_at into cur_updated from public.site_content sc where sc.key = e ->> 'key' for update;
    if found then
      if (e ->> 'baseUpdatedAt') is null or (e ->> 'baseUpdatedAt')::timestamptz <> cur_updated then
        conflicts := conflicts || (e ->> 'key');
      end if;
    elsif (e ->> 'baseUpdatedAt') is not null then
      conflicts := conflicts || (e ->> 'key');
    end if;
  end loop;

  if cardinality(conflicts) > 0 then
    return jsonb_build_object('conflicts', to_jsonb(conflicts), 'saved_at', null);
  end if;

  for e in select * from jsonb_array_elements(p_edits) loop
    select sc.value into cur_value from public.site_content sc where sc.key = e ->> 'key';
    insert into public.content_revisions (key, old_value, new_value, editor_id)
      values (e ->> 'key', cur_value, nullif(e -> 'value', 'null'::jsonb), (select auth.uid()));
    if e -> 'value' = 'null'::jsonb then
      delete from public.site_content where key = e ->> 'key';
    else
      insert into public.site_content (key, value, kind, updated_by, updated_at)
        values (e ->> 'key', e -> 'value', e ->> 'kind', (select auth.uid()), ts)
      on conflict (key) do update
        set value = excluded.value, kind = excluded.kind,
            updated_by = excluded.updated_by, updated_at = excluded.updated_at;
    end if;
  end loop;

  return jsonb_build_object('conflicts', '[]'::jsonb, 'saved_at', ts);
end $$;
revoke all on function public.save_site_content(jsonb) from public, anon;
grant execute on function public.save_site_content(jsonb) to authenticated;

-- Duyuru sırası: tek transaction'da yeniden numaralama; eşit sort değerleri (sort, id) ile belirlenir.
-- Döner: duyuru bulundu mu (sınırda taşıma no-op, true).
create or replace function public.reorder_announcements(p_id uuid, p_dir int) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_pos int;
  v_n int;
begin
  if not public.can_edit_site() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if p_dir not in (-1, 1) then
    raise exception 'geçersiz yön' using errcode = '22023';
  end if;
  select rn, total into v_pos, v_n from (
    select id, row_number() over (order by sort, id) as rn, count(*) over () as total from public.announcements
  ) o where o.id = p_id;
  if v_pos is null then return false; end if;
  if v_pos + p_dir < 1 or v_pos + p_dir > v_n then return true; end if;
  update public.announcements a set sort = n.pos
  from (
    select id,
      case when rn = v_pos then v_pos + p_dir when rn = v_pos + p_dir then v_pos else rn end as pos
    from (select id, row_number() over (order by sort, id) as rn from public.announcements) r
  ) n
  where a.id = n.id and a.sort is distinct from n.pos;
  return true;
end;
$$;
revoke all on function public.reorder_announcements(uuid, int) from public, anon;
grant execute on function public.reorder_announcements(uuid, int) to authenticated;
