-- 0003_domain_uyum.sql — Okula tam uyum: additive domain changes.

-- === Enum genişletmeleri (CHECK constraint yeniden tanımı) ===
alter table public.appointments drop constraint appointments_type_check;
alter table public.appointments add constraint appointments_type_check
  check (type in ('okul_ziyareti','telefon','demo','oryantasyon'));

alter table public.leads drop constraint leads_source_check;
alter table public.leads add constraint leads_source_check
  check (source in ('referans','instagram','reklam','tabela_gecerken','telefon','etkinlik','diger'));

alter table public.leads drop constraint leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('yeni','ulasildi','randevu','gorusme_yapildi','teklif','beklemede','kazanildi','kaybedildi'));

alter table public.installments drop constraint installments_status_check;
alter table public.installments add constraint installments_status_check
  check (status in ('bekliyor','odendi','iptal'));

-- iptal taksitte ödeme alanları boş kalır: mevcut paid_fields kısıtını genişlet.
alter table public.installments drop constraint paid_fields;
alter table public.installments add constraint paid_fields check (
  (status = 'bekliyor' and paid_at is null and paid_amount is null and payment_method is null and marked_by is null)
  or (status = 'iptal' and paid_at is null and paid_amount is null and payment_method is null and marked_by is null)
  or (status = 'odendi' and paid_at is not null and paid_amount > 0 and payment_method is not null and marked_by is not null)
);

-- === Aile (household) tablosu ===
create table public.families (
  id uuid primary key default gen_random_uuid(),
  family_code text not null unique,
  primary_parent_name text not null,
  phone text,
  discount_type text not null default 'yok' check (discount_type in ('yok','yuzde_10','ozel')),
  discount_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === Yeni sütunlar ===
alter table public.leads
  add column ingilizce_gerekli boolean not null default false,
  add column ozel_durum boolean not null default false,
  add column ozel_durum_note text,
  add column wants_summer boolean not null default false,
  add column beklemede_sezon text,
  add column family_id uuid references public.families(id);

alter table public.students
  add column left_date date,
  add column leave_reason text,
  add column family_id uuid references public.families(id);

alter table public.price_list_items
  add column capacity int check (capacity is null or capacity >= 0);

-- === İade kaydı ===
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('havale','nakit','pos','diger')),
  refund_date date not null,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- === İndeksler ===
create index idx_leads_family on public.leads (family_id);
create index idx_students_family on public.students (family_id);
create index idx_refunds_student on public.refunds (student_id);

-- === updated_at trigger'ları (yeni tablolar) ===
create trigger touch_families before update on public.families
  for each row execute function public.touch_updated_at();

-- === RLS ===
alter table public.families enable row level security;
alter table public.refunds enable row level security;

-- events entity_type genişlet (append-only log yeni varlıkları kabul etsin)
alter table public.events drop constraint events_entity_type_check;
alter table public.events add constraint events_entity_type_check
  check (entity_type in ('lead','offer','student','installment','appointment','price_list','family','refund'));

-- families: tüm aktif personel okur; yazma personel (küçük ekip, lead ile aynı sınıf)
create policy sel_families on public.families for select using (public.is_staff());
create policy ins_families on public.families for insert with check (public.is_staff());
create policy upd_families on public.families for update using (public.is_staff());
create policy del_families on public.families for delete using (public.is_yonetici());

-- refunds: personel okur; oluşturma/güncelleme yalnız yönetici (finansal kapanış)
create policy sel_refunds on public.refunds for select using (public.is_staff());
create policy ins_refunds on public.refunds for insert with check (public.is_yonetici() and created_by = auth.uid());
create policy upd_refunds on public.refunds for update using (public.is_yonetici());
create policy del_refunds on public.refunds for delete using (public.is_yonetici());

-- PostgREST yetkileri (0001 ile aynı desen)
grant all on public.families, public.refunds to postgres, service_role;
grant select, insert, update, delete on public.families, public.refunds to authenticated;
