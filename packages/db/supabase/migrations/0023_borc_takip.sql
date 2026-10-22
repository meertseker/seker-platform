-- 0023_borc_takip.sql — Borç takibi: veli görüşmesi, ödeme sözü, öğrenci görevi (22.10.2026).
--
-- 1. veli_gorusmeleri: geciken/eski borçlu velilerle yapılan görüşmeler (kiminle, sonuç, not).
--    Sonuç "söz verdi" ise söz tarihi zorunlu, tutar isteğe bağlı. Kayıt eklenir, düzenlenmez
--    (lead_notes gibi); yanlış kayıt yeni görüşmeyle düzeltilir.
-- 2. tasks.student_id: görev veliye (lead_id) ya da öğrenciye (student_id) bağlanır, ikisine birden değil.
--    Ödeme sözü görevi /api/cron/daily'de 'odeme_sozu:<gorusme_id>' rule_key ile açılır.
-- 3. v_former_overdue_installments: ayrılan / mezun öğrencinin vadesi geçmiş bekleyen taksitleri
--    ("Eski öğrenci alacakları"). v_overdue_installments'ın "yalnız aktif" tanımına dokunulmaz.
--
-- WhatsApp: görüşme kaydı panelden 'veli_gorusmesi' olayı yazar; 0013 trigger'ı kuyruğa alır
-- (ödeme grubu, lib/wa/routing.ts). Bu dosya events'e satır yazmaz.
-- Dosya idempotenttir; prod verisinde hiçbir satırı değiştirmez.

-- ===================== Veli görüşmeleri =====================
create table if not exists public.veli_gorusmeleri (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  contacted_at timestamptz not null default now(),
  contact_with text not null check (contact_with in ('anne','baba','diger_veli','diger')),
  outcome text not null check (outcome in ('ulasilamadi','ulasildi','soz_verdi','odeme_yapti')),
  -- WhatsApp'tan yapıştırılan uzun metin sığsın; grup mesajına kısaltılarak girer.
  note text check (note is null or char_length(note) <= 4000),
  promise_date date,
  promise_amount numeric(12,2) check (promise_amount is null or promise_amount > 0),
  created_at timestamptz not null default now(),
  constraint veli_gorusmeleri_soz check (
    (outcome = 'soz_verdi' and promise_date is not null)
    or (outcome <> 'soz_verdi' and promise_date is null and promise_amount is null)
  )
);
create index if not exists idx_veli_gorusmeleri_student on public.veli_gorusmeleri (student_id, contacted_at desc);
create index if not exists idx_veli_gorusmeleri_soz on public.veli_gorusmeleri (promise_date) where outcome = 'soz_verdi';

alter table public.veli_gorusmeleri enable row level security;

-- Personel (yönetici + danışman) okur ve kendi adına ekler. Güncelleme / silme politikası yok.
drop policy if exists sel_veli_gorusmeleri on public.veli_gorusmeleri;
create policy sel_veli_gorusmeleri on public.veli_gorusmeleri for select using (public.is_staff());
drop policy if exists ins_veli_gorusmeleri on public.veli_gorusmeleri;
create policy ins_veli_gorusmeleri on public.veli_gorusmeleri for insert
  with check (public.is_staff() and author_id = auth.uid());

revoke all on public.veli_gorusmeleri from anon, public, authenticated;
grant select, insert on public.veli_gorusmeleri to authenticated;
grant all on public.veli_gorusmeleri to service_role;

-- ===================== Öğrenci görevi =====================
alter table public.tasks add column if not exists student_id uuid references public.students(id) on delete cascade;
alter table public.tasks drop constraint if exists tasks_tek_baglanti;
alter table public.tasks add constraint tasks_tek_baglanti check (lead_id is null or student_id is null);
create index if not exists idx_tasks_student on public.tasks (student_id) where student_id is not null;

-- ===================== Eski öğrenci alacakları =====================
-- Sütunlar v_overdue_installments ile aynı (+ öğrenci durumu); RLS sorgulayanın yetkisiyle.
create or replace view public.v_former_overdue_installments
with (security_invoker = true) as
select
  i.id as installment_id,
  s.id as student_id,
  s.full_name as student_name,
  coalesce(nullif(s.phone, ''), f.phone) as family_phone,
  i.due_date,
  i.amount,
  ((now() at time zone 'Europe/Istanbul')::date - i.due_date)::int as days_overdue,
  p.item_type,
  p.season,
  s.status as student_status
from public.installments i
join public.payment_plans p on p.id = i.plan_id
join public.students s on s.id = p.student_id
left join public.families f on f.id = s.family_id
where i.status = 'bekliyor'
  and i.due_date < (now() at time zone 'Europe/Istanbul')::date
  and s.status in ('ayrildi', 'mezun');

revoke all on public.v_former_overdue_installments from anon, public;
grant select on public.v_former_overdue_installments to authenticated, service_role;
