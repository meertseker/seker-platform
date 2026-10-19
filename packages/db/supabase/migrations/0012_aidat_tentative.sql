-- 0012_aidat_tentative.sql — aidat planında "kesinleşmedi" tarihi ve atomik tutar güncelleme.

alter table public.payment_plans add column tentative_from date;
comment on column public.payment_plans.tentative_from is
  'Doluysa bu tarihten itibaren taksit tutarları kesinleşmemiştir (zam bekleniyor).';

-- Verilen taksit tutarlarını tek işlemde günceller, plan toplamını taksit toplamına eşitler.
-- p_changes: [{"id": uuid, "amount": numeric}]
-- Hata durumunda (plana ait olmayan / bekliyor olmayan satır) hiçbir değişiklik kalmaz.
create or replace function public.apply_plan_amounts(
  p_plan_id uuid, p_changes jsonb, p_clear_tentative boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
  v_found int;
  v_bad int;
  v_updated int;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'p_changes bir dizi olmalı' using errcode = '22023';
  end if;

  perform 1 from public.payment_plans where id = p_plan_id for update;
  if not found then
    raise exception 'Plan bulunamadı' using errcode = 'P0002';
  end if;

  select array_agg((c->>'id')::uuid) into v_ids from jsonb_array_elements(p_changes) c;

  if exists (
    select 1 from jsonb_array_elements(p_changes) c
    where c->>'amount' is null or (c->>'amount')::numeric < 0
  ) then
    raise exception 'Geçersiz tutar' using errcode = '22023';
  end if;

  -- Hedef taksit satırlarını kilitle (eşzamanlı ödeme işaretlemeyle yarışı önler).
  select count(*), count(*) filter (where t.status <> 'bekliyor')
    into v_found, v_bad
  from (
    select i.status from public.installments i
    where i.id = any(coalesce(v_ids, '{}')) and i.plan_id = p_plan_id
    for update
  ) t;

  if v_found <> coalesce(array_length((select array_agg(distinct x) from unnest(v_ids) x), 1), 0) then
    raise exception 'Taksit bu plana ait değil' using errcode = 'P0001';
  end if;
  if v_bad > 0 then
    raise exception 'Yalnızca bekleyen taksitler güncellenebilir' using errcode = 'P0001';
  end if;

  update public.installments i
     set amount = (c->>'amount')::numeric
    from jsonb_array_elements(p_changes) c
   where i.id = (c->>'id')::uuid and i.plan_id = p_plan_id and i.status = 'bekliyor';
  get diagnostics v_updated = row_count;
  if v_updated < v_found then
    raise exception 'Taksit güncellenemedi' using errcode = 'P0001';
  end if;

  update public.payment_plans p
     set total_amount = (select coalesce(sum(i.amount), 0) from public.installments i
                         where i.plan_id = p.id),
         tentative_from = case when p_clear_tentative then null else p.tentative_from end
   where p.id = p_plan_id;
end;
$$;

revoke execute on function public.apply_plan_amounts(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.apply_plan_amounts(uuid, jsonb, boolean) to service_role;
