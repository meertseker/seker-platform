-- Faz 4: geciken taksitler listesi.
-- security_invoker: view, sorguyu yapan kullanıcının yetkisiyle çalışır; installments/students/families RLS'i aynen uygulanır.

create view public.v_overdue_installments
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
  p.season
from public.installments i
join public.payment_plans p on p.id = i.plan_id
join public.students s on s.id = p.student_id
left join public.families f on f.id = s.family_id
where i.status = 'bekliyor'
  and i.due_date < (now() at time zone 'Europe/Istanbul')::date;

revoke all on public.v_overdue_installments from anon, public;
grant select on public.v_overdue_installments to authenticated, service_role;
