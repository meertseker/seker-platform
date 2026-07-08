create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- 5.1 profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('yonetici','danisman')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Yardımcı: rol kontrolü (profiles tablosundan sonra)
create or replace function public.is_yonetici() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'yonetici' and p.is_active
  );
$$;

-- 5.7 students (leads FK verdiği için önce)
create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  birth_month int check (birth_month between 1 and 12),
  birth_year int check (birth_year between 2010 and 2035),
  parent_name text not null,
  phone text not null,
  season text not null,
  program text not null check (program in ('tam_gun','yarim_gun','uc_gun','play_grup')),
  start_date date,
  status text not null default 'aktif' check (status in ('aktif','ayrildi','mezun')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5.2 leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  phone text not null,
  child_name text,
  child_birth_month int check (child_birth_month between 1 and 12),
  child_birth_year int check (child_birth_year between 2010 and 2035),
  source text not null check (source in ('referans','instagram','reklam','tabela_gecerken','telefon','diger')),
  source_detail text,
  status text not null default 'yeni' check (status in ('yeni','ulasildi','randevu','gorusme_yapildi','teklif','kazanildi','kaybedildi')),
  lost_reason text check (lost_reason in ('fiyat','uzaklik','baska_okul','ulasilamadi','vazgecti','diger')),
  assigned_to uuid references public.profiles(id),
  converted_student_id uuid references public.students(id),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lost_reason_required check (status <> 'kaybedildi' or lost_reason is not null)
);

-- 5.3 lead_notes (yalnızca insan notu)
create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- 5.4 appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  scheduled_at timestamptz not null,
  type text not null check (type in ('okul_ziyareti','telefon')),
  outcome text not null default 'bekliyor' check (outcome in ('bekliyor','geldi','gelmedi','ertelendi','iptal')),
  outcome_note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5.5 price_lists
create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  season text not null unique,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_active_price_list on public.price_lists ((true)) where is_active;

create table public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  program text not null check (program in ('tam_gun','yarim_gun','uc_gun','play_grup')),
  monthly_fee numeric(12,2) not null check (monthly_fee > 0),
  registration_fee numeric(12,2) not null default 0 check (registration_fee >= 0),
  unique (price_list_id, program)
);

-- 5.6 offers
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  program text not null check (program in ('tam_gun','yarim_gun','uc_gun','play_grup')),
  list_price numeric(12,2) not null,
  offered_price numeric(12,2) not null check (offered_price > 0),
  installment_count int not null default 10 check (installment_count between 1 and 12),
  note text,
  status text not null check (status in ('onay_bekliyor','onaylandi','revize_edildi','reddedildi','gecersiz')),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  counter_price numeric(12,2),
  superseded_by_offer_id uuid references public.offers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- spec §6.2: lead başına tek onay_bekliyor teklif
create unique index one_pending_offer_per_lead on public.offers (lead_id) where status = 'onay_bekliyor';

-- 5.8 payment_plans + installments
create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  season text not null,
  item_type text not null check (item_type in ('aidat','kayit_ucreti','servis','yemek','diger')),
  total_amount numeric(12,2) not null check (total_amount > 0),
  installment_count int not null check (installment_count between 1 and 12),
  source_offer_id uuid references public.offers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.payment_plans(id) on delete cascade,
  due_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'bekliyor' check (status in ('bekliyor','odendi')),
  paid_at timestamptz,
  paid_amount numeric(12,2),
  payment_method text check (payment_method in ('havale','nakit','pos','diger')),
  marked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- spec §6.3: ödendi ise ödeme alanları zorunlu
  constraint paid_fields check (
    (status = 'bekliyor' and paid_at is null and paid_amount is null and payment_method is null and marked_by is null)
    or
    (status = 'odendi' and paid_at is not null and paid_amount > 0 and payment_method is not null and marked_by is not null)
  )
);

-- 5.9 tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id),
  due_date date not null,
  title text not null,
  status text not null default 'acik' check (status in ('acik','tamamlandi')),
  auto_generated boolean not null default false,
  rule_key text, -- otomatik görev tekilleştirme: örn. 'takipsiz:<lead_id>'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_open_auto_task_per_rule on public.tasks (rule_key) where status = 'acik' and rule_key is not null;

-- 5.10 notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5.11 events (append-only)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead','offer','student','installment','appointment','price_list')),
  entity_id uuid not null,
  event_type text not null,
  actor_id uuid references public.profiles(id),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- 5.12 app_settings
create table public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values
  ('takipsizlik_gun', '3'),
  ('cakisma_dakika', '45');

-- updated_at trigger'ları
do $$ declare t text;
begin
  foreach t in array array['profiles','students','leads','appointments','price_lists','offers','payment_plans','installments','tasks']
  loop
    execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- İndeksler (spec §11)
create index idx_leads_status on public.leads (status);
create index idx_leads_assigned_status on public.leads (assigned_to, status);
create index idx_leads_phone on public.leads (phone);
create index idx_appointments_scheduled on public.appointments (scheduled_at);
create index idx_installments_due_status on public.installments (due_date, status);
create index idx_installments_plan on public.installments (plan_id);
create index idx_events_entity on public.events (entity_type, entity_id, created_at);
create index idx_notifications_user on public.notifications (user_id, read_at);

-- ===================== RLS =====================
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.appointments enable row level security;
alter table public.price_lists enable row level security;
alter table public.price_list_items enable row level security;
alter table public.offers enable row level security;
alter table public.payment_plans enable row level security;
alter table public.installments enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.events enable row level security;
alter table public.app_settings enable row level security;

-- Küçük ekip: tüm aktif kullanıcılar her şeyi OKUR
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;

create policy sel_profiles on public.profiles for select using (is_staff());
create policy sel_students on public.students for select using (is_staff());
create policy sel_leads on public.leads for select using (is_staff());
create policy sel_lead_notes on public.lead_notes for select using (is_staff());
create policy sel_appointments on public.appointments for select using (is_staff());
create policy sel_price_lists on public.price_lists for select using (is_staff());
create policy sel_price_list_items on public.price_list_items for select using (is_staff());
create policy sel_offers on public.offers for select using (is_staff());
create policy sel_payment_plans on public.payment_plans for select using (is_staff());
create policy sel_installments on public.installments for select using (is_staff());
create policy sel_tasks on public.tasks for select using (is_staff());
create policy sel_notifications on public.notifications for select using (user_id = auth.uid());
create policy sel_events on public.events for select using (is_staff());
create policy sel_app_settings on public.app_settings for select using (is_staff());

-- Yazma politikaları (spec §4 yetki tablosu)
create policy ins_leads on public.leads for insert with check (is_staff());
create policy upd_leads on public.leads for update using (is_staff());
create policy del_leads on public.leads for delete using (is_yonetici());

create policy ins_lead_notes on public.lead_notes for insert with check (is_staff() and author_id = auth.uid());

create policy ins_appointments on public.appointments for insert with check (is_staff());
create policy upd_appointments on public.appointments for update using (is_staff());

create policy ins_students on public.students for insert with check (is_staff());
create policy upd_students on public.students for update using (is_staff());
create policy del_students on public.students for delete using (is_yonetici());

-- Fiyat listesi: yalnız yönetici
create policy all_price_lists on public.price_lists for all using (is_yonetici()) with check (is_yonetici());
create policy all_price_list_items on public.price_list_items for all using (is_yonetici()) with check (is_yonetici());

-- Teklifler: herkes oluşturur; karar (status değişimi) yönetici,
-- danışman yalnızca 'gecersiz'e çekebilir (supersede) — spec §6.2
create policy ins_offers on public.offers for insert with check (is_staff() and created_by = auth.uid());
create policy upd_offers_yonetici on public.offers for update using (is_yonetici());
create policy upd_offers_danisman on public.offers for update
  using (is_staff()) with check (status = 'gecersiz');

create policy ins_payment_plans on public.payment_plans for insert with check (is_staff());
create policy upd_payment_plans on public.payment_plans for update using (is_yonetici());

-- Taksit: danışman yalnızca ödendi işaretler; düzenleme/geri alma yönetici — spec §6.3
create policy ins_installments on public.installments for insert with check (is_staff());
create policy upd_installments_yonetici on public.installments for update using (is_yonetici());
create policy upd_installments_danisman on public.installments for update
  using (is_staff()) with check (status = 'odendi' and marked_by = auth.uid());

create policy ins_tasks on public.tasks for insert with check (is_staff());
create policy upd_tasks on public.tasks for update using (is_staff());

create policy ins_notifications on public.notifications for insert with check (is_staff());
create policy upd_notifications on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- events: INSERT var, UPDATE/DELETE politikası YOK (append-only, spec §5.11)
create policy ins_events on public.events for insert with check (is_staff() and actor_id = auth.uid());

-- app_settings yazma: yönetici
create policy write_app_settings on public.app_settings for all using (is_yonetici()) with check (is_yonetici());
