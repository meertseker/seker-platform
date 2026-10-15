-- 0010_feedback.sql — panel içi hata bildirimi / öneri kutusu.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hata', 'oneri')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 1 and 4000),
  page text check (char_length(page) <= 200),
  created_by uuid not null default auth.uid() references public.profiles(id),
  status text not null default 'yeni' check (status in ('yeni', 'inceleniyor', 'tamamlandi', 'yapilmayacak')),
  admin_note text check (char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_feedback_created_by on public.feedback (created_by, created_at desc);
create index idx_feedback_status on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;

create policy sel_feedback_own on public.feedback for select
  using (public.is_staff() and created_by = auth.uid());
create policy sel_feedback_yonetici on public.feedback for select
  using (public.is_yonetici());
create policy ins_feedback on public.feedback for insert
  with check (public.is_staff() and created_by = auth.uid() and status = 'yeni' and admin_note is null);
create policy upd_feedback on public.feedback for update
  using (public.is_yonetici()) with check (public.is_yonetici());

-- Yetkiler: anon yok; güncelleme yalnızca status/admin_note kolonlarında.
revoke all on public.feedback from anon, public, authenticated;
grant select on public.feedback to authenticated;
grant insert (kind, title, body, page) on public.feedback to authenticated;
grant update (status, admin_note) on public.feedback to authenticated;
grant all on public.feedback to service_role;

-- updated_at bakımı
create or replace function public.feedback_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_feedback_touch before update on public.feedback
  for each row execute function public.feedback_touch();

-- Yeni geri bildirimde aktif yöneticilere bildirim
create or replace function public.notify_feedback() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_by text;
begin
  select p.full_name into v_by from public.profiles p where p.id = new.created_by;
  insert into public.notifications (user_id, type, payload)
  select p.id, 'geri_bildirim', jsonb_build_object(
           'feedbackId', new.id, 'kind', new.kind, 'title', new.title, 'by', v_by)
  from public.profiles p
  where p.is_active and p.role = 'yonetici';
  return new;
end;
$$;
revoke all on function public.notify_feedback() from public, anon, authenticated;
revoke all on function public.feedback_touch() from public, anon, authenticated;

create trigger trg_feedback_notify after insert on public.feedback
  for each row execute function public.notify_feedback();

-- Saatlik sınır: kullanıcı başına son 1 saatte en fazla 20 kayıt
create or replace function public.feedback_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.feedback f
      where f.created_by = new.created_by and f.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Çok fazla geri bildirim gönderildi, lütfen biraz sonra tekrar deneyin.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.feedback_rate_limit() from public, anon, authenticated;
create trigger trg_feedback_rate_limit before insert on public.feedback
  for each row execute function public.feedback_rate_limit();
