-- Panel işlemlerini okulun WhatsApp grubuna yansıtan gönderim kuyruğu.
-- Her events satırı ve her görüşme notu (lead_notes) bir kuyruk satırı üretir;
-- /api/cron/wa kuyruğu boşaltıp WAHA üzerinden gruba yazar.

create table public.wa_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid unique references public.events(id) on delete cascade,
  note_id uuid unique references public.lead_notes(id) on delete set null,
  status text not null default 'bekliyor' check (status in ('bekliyor','gonderiliyor','gonderildi','hata','atlandi')),
  attempts int not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  error text,
  message text, -- gönderilen metin; ayar ekranında son mesajları göstermek için
  created_at timestamptz not null default now(),
  -- Not silinirse (veli silindi) satır kalır ama kaynaksız olur; işçi onu 'atlandi' yapar.
  constraint wa_outbox_source check (event_id is not null or note_id is not null or status <> 'bekliyor')
);
create index idx_wa_outbox_status on public.wa_outbox (status, available_at);
create index idx_wa_outbox_created on public.wa_outbox (created_at desc);

alter table public.wa_outbox enable row level security;
create policy sel_wa_outbox on public.wa_outbox for select using (public.is_yonetici());
grant select on public.wa_outbox to authenticated;
grant all on public.wa_outbox to service_role;

-- Gönderim kapalıyken kuyruk birikmesin: açılınca eski işlemler gruba yağmasın.
insert into public.app_settings (key, value) values
  ('wa_enabled', 'false'),
  ('wa_group_id', '""'::jsonb),
  ('wa_group_name', '""'::jsonb)
on conflict (key) do nothing;

create or replace function public.wa_bildirim_acik() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.value = 'true'::jsonb from public.app_settings s where s.key = 'wa_enabled'), false);
$$;
revoke all on function public.wa_bildirim_acik() from public, anon, authenticated;

-- security definer: danışmanın işlemi tetiklediğinde de RLS'e takılmadan yazabilsin.
create or replace function public.enqueue_wa_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type in ('seed_import') or not public.wa_bildirim_acik() then
    return new;
  end if;
  insert into public.wa_outbox (event_id) values (new.id) on conflict (event_id) do nothing;
  return new;
end;
$$;
revoke all on function public.enqueue_wa_event() from public, anon, authenticated;

create trigger enqueue_wa_event after insert on public.events
  for each row execute function public.enqueue_wa_event();

create or replace function public.enqueue_wa_note() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.wa_bildirim_acik() then
    return new;
  end if;
  insert into public.wa_outbox (note_id) values (new.id) on conflict (note_id) do nothing;
  return new;
end;
$$;
revoke all on function public.enqueue_wa_note() from public, anon, authenticated;

create trigger enqueue_wa_note after insert on public.lead_notes
  for each row execute function public.enqueue_wa_note();
