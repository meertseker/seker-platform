-- 0022_odeme_faz1.sql — Ödeme denetimi Faz 1 (21.10.2026).
--
-- 1. correct_payment: "Ödemeyi düzelt". Ödenmiş satırın ödemesi geri alınır (olaylıysa
--    undo_payment, olaysızsa içe aktarma geri alması) ve yeni tutar / yöntem / tarihle
--    take_payment aynı işlemde uygulanır. Gruba tek "Ödeme düzeltildi" mesajı gider.
-- 2. close_installment_remainder: "Kalanı kapat". Bekleyen taksit silinir, kalemin
--    toplamı (payment_plans.total_amount) aynı tutarda düşer; neden zorunlu.
-- 3. enqueue_wa_event: `seker.wa_sessiz` işlem ayarı açıkken olay kuyruğa girmez
--    (düzeltmenin içindeki geri alma ve yeni ödeme olayları gruba ayrı ayrı düşmesin).
-- 4. v_overdue_installments yalnız aktif öğrencileri gösterir (geciken tek tanım).
--
-- Dosya idempotenttir; prod verisinde hiçbir satırı değiştirmez. 0019 ve 0021 sonrası uygulanır.

-- ===================== WhatsApp kuyruğu: sessiz işlem =====================
-- `seker.wa_sessiz` yalnız SQL ile verilebilir (PostgREST istemcisi set_config çağıramaz).
create or replace function public.enqueue_wa_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type in ('seed_import') or not public.wa_bildirim_acik()
     or coalesce(current_setting('seker.wa_sessiz', true), '') = 'on' then
    return new;
  end if;
  insert into public.wa_outbox (event_id) values (new.id) on conflict (event_id) do nothing;
  return new;
end;
$$;
revoke all on function public.enqueue_wa_event() from public, anon, authenticated;

-- ===================== Yardımcı =====================
-- Ödenmiş satırların tahsilat parçaları: tutar, yöntem, İstanbul günü (ödeme sırasıyla).
create or replace function public.odeme_parcalari(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'amountTl', coalesce(i.paid_amount, i.amount),
           'method', i.payment_method,
           'paidOn', to_char((i.paid_at at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD'))
         order by i.paid_at, i.id), '[]'::jsonb)
    from public.installments i
   where i.id = any(p_ids) and i.status = 'odendi';
$$;
revoke all on function public.odeme_parcalari(uuid[]) from public, anon, authenticated;

-- ===================== correct_payment =====================
-- p_installment_id: ödemenin herhangi bir ödenmiş satırı (olaylı ödemede bütün ödeme düzeltilir).
-- p_ops / p_paid_at / p_payload: take_payment ile aynı biçim. p_ops yalnız bu ödemenin
-- taksitlerine (geri alındıktan sonraki tutarlarıyla) yazılabilir.
create or replace function public.correct_payment(
  p_installment_id uuid, p_paid_at timestamptz, p_ops jsonb, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_student uuid;
  v_status text;
  v_event uuid;
  v_payload jsonb;
  v_targets uuid[];
  v_before_ids uuid[];
  v_lock_ids uuid[];
  v_op_ids uuid[];
  v_blocker text;
  v_before jsonb;
  v_items jsonb;
  v_take jsonb;
  v_after_ids uuid[];
  v_created_ids uuid[];
  v_remainder numeric;
  v_note text;
  v_correction uuid;
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;
  if not public.is_yonetici() then
    raise exception 'Ödemeyi yalnız yönetici düzeltebilir' using errcode = '42501';
  end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 then
    raise exception 'Doğru tutarı girin' using errcode = '22023';
  end if;

  select p.student_id, i.status into v_student, v_status
    from public.installments i
    join public.payment_plans p on p.id = i.plan_id
   where i.id = p_installment_id;
  if not found then raise exception 'Taksit bulunamadı' using errcode = 'P0002'; end if;
  if v_status <> 'odendi' then
    raise exception 'Bu taksit ödenmiş görünmüyor; sayfayı yenileyin' using errcode = 'P0001';
  end if;

  v_event := public.payment_event_for_installment(p_installment_id);
  if v_event is not null then
    select e.payload into v_payload from public.events e where e.id = v_event for update;
    v_targets := array(select (s->>'id')::uuid
                         from jsonb_array_elements(coalesce(v_payload->'snapshots', '[]'::jsonb)) s);
    v_before_ids := public.odeme_uuid_dizisi(v_payload->'paidIds');
    v_lock_ids := v_targets || v_before_ids || public.odeme_uuid_dizisi(v_payload->'createdIds');
  else
    v_targets := array[p_installment_id];
    v_before_ids := array[p_installment_id];
    v_lock_ids := v_targets;
  end if;

  perform 1 from public.installments i where i.id = any(v_lock_ids) order by i.id for update;

  if v_event is not null then
    v_blocker := public.payment_undo_blocker(v_event);
    if v_blocker is not null then
      raise exception 'Bu ödeme düzeltilemez: ödemeden sonra başka işlem yapılmış (%). Önce sonraki işlemi geri alın.', v_blocker
        using errcode = 'P0001';
    end if;
  end if;

  v_op_ids := array(select (o->>'id')::uuid from jsonb_array_elements(p_ops) o);
  if not (v_op_ids <@ v_targets) then
    raise exception 'Düzeltme yalnız bu ödemenin taksitlerine yazılabilir; sayfayı yenileyip tekrar deneyin'
      using errcode = 'P0001';
  end if;

  v_before := public.odeme_parcalari(v_before_ids);
  select coalesce(jsonb_agg(jsonb_build_object('itemType', p.item_type, 'dueDate', i.due_date)
                            order by i.due_date, i.id), '[]'::jsonb)
    into v_items
    from public.installments i
    join public.payment_plans p on p.id = i.plan_id
   where i.id = any(v_targets);

  -- İçteki geri alma ve yeni ödeme olayları gruba düşmez; tek "Ödeme düzeltildi" gider.
  perform set_config('seker.wa_sessiz', 'on', true);
  perform public.revert_installment_payment(p_installment_id);
  v_take := public.take_payment(
    v_student, p_paid_at, p_ops,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('correctionOf', v_event, 'correctedInstallmentId', p_installment_id));
  perform set_config('seker.wa_sessiz', '', true);

  v_after_ids := public.odeme_uuid_dizisi(v_take->'paidIds');
  v_created_ids := public.odeme_uuid_dizisi(v_take->'createdIds');
  select coalesce(sum(i.amount), 0) into v_remainder
    from public.installments i
   where i.id = any(v_created_ids) and i.status = 'bekliyor';
  v_note := nullif(btrim(coalesce(p_payload->>'note', '')), '');

  insert into public.events (entity_type, entity_id, event_type, actor_id, payload)
  values ('student', v_student, 'odeme_duzeltildi', v_uid,
          jsonb_build_object(
            'installmentId', p_installment_id,
            'source', case when v_event is null then 'ice_aktarma' else 'odeme' end,
            'undoneEventId', v_event,
            'newEventId', v_take->'eventId',
            'before', jsonb_build_object(
              'totalTl', (select coalesce(sum((x->>'amountTl')::numeric), 0) from jsonb_array_elements(v_before) x),
              'parts', v_before),
            'after', jsonb_build_object('totalTl', v_take->'totalTl', 'parts', public.odeme_parcalari(v_after_ids)),
            'remainderTl', v_remainder,
            'items', v_items,
            'note', v_note))
  returning id into v_correction;

  return jsonb_build_object('studentId', v_student, 'eventId', v_take->'eventId',
                            'correctionEventId', v_correction, 'totalTl', v_take->'totalTl',
                            'remainderTl', v_remainder);
end;
$$;

-- ===================== close_installment_remainder =====================
-- Bekleyen taksitin kalanını kapatır (küsurat, indirim): taksit silinir, kalemin toplamı
-- aynı tutarda düşer. Kalan bir ödemenin kalanıysa o ödemenin geri alınması kilitlenir.
create or replace function public.close_installment_remainder(p_installment_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_row record;
  v_n int;
  v_total_after numeric;
  v_pending int;
  v_pending_sum numeric;
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;
  if not public.is_yonetici() then
    raise exception 'Kalanı yalnız yönetici kapatabilir' using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'Kapatma nedenini yazın (ör. küsurat, indirim)' using errcode = '22023';
  end if;
  v_reason := left(v_reason, 200);

  select i.id, i.plan_id, i.due_date, i.amount, i.status, p.student_id, p.item_type, p.total_amount
    into v_row
    from public.installments i
    join public.payment_plans p on p.id = i.plan_id
   where i.id = p_installment_id
   for update of i, p;
  if not found then raise exception 'Taksit bulunamadı' using errcode = 'P0002'; end if;
  if v_row.status <> 'bekliyor' then
    raise exception 'Yalnız bekleyen taksitin kalanı kapatılabilir (taksit az önce ödenmiş olabilir; sayfayı yenileyin)'
      using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.installments i
                  where i.plan_id = v_row.plan_id and i.id <> v_row.id and i.status <> 'iptal') then
    raise exception 'Bu kalemin başka taksiti yok; kalanı kapatılırsa kalem sıfırlanır. Kalem tümüyle kaldırılacaksa planın silinmesi gerekir.'
      using errcode = 'P0001';
  end if;
  if v_row.total_amount - v_row.amount <= 0 then
    raise exception 'Kalem toplamı sıfırın altına inemez' using errcode = 'P0001';
  end if;

  perform set_config('seker.odeme_rpc', 'on', true);

  delete from public.installments i where i.id = v_row.id and i.status = 'bekliyor';
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'Kalan kapatılamadı; sayfayı yenileyip tekrar deneyin' using errcode = 'P0001';
  end if;

  update public.payment_plans
     set total_amount = total_amount - v_row.amount
   where id = v_row.plan_id
  returning total_amount into v_total_after;

  -- Kapatılan satır bir ödemenin kalanıysa o ödeme artık olduğu gibi geri alınamaz.
  update public.events e
     set payload = e.payload || jsonb_build_object('undoBlocked', 'kalanı kapatıldı')
   where e.event_type = 'odeme_alindi'
     and not coalesce((e.payload->>'undone')::boolean, false)
     and e.payload->'createdIds' ? v_row.id::text;

  select count(*), coalesce(sum(i.amount), 0) into v_pending, v_pending_sum
    from public.installments i
   where i.plan_id = v_row.plan_id and i.status = 'bekliyor';

  insert into public.events (entity_type, entity_id, event_type, actor_id, payload)
  values ('student', v_row.student_id, 'kalan_kapatildi', v_uid,
          jsonb_build_object(
            'installmentId', v_row.id,
            'planId', v_row.plan_id,
            'itemType', v_row.item_type,
            'dueDate', v_row.due_date,
            'amountTl', v_row.amount,
            'reason', v_reason,
            'planTotalBeforeTl', v_row.total_amount,
            'planTotalAfterTl', v_total_after,
            'pendingCount', v_pending,
            'pendingTl', v_pending_sum,
            'closed', v_pending = 0));

  perform set_config('seker.odeme_rpc', '', true);
  return jsonb_build_object('studentId', v_row.student_id, 'planId', v_row.plan_id,
                            'amountTl', v_row.amount, 'planTotalTl', v_total_after,
                            'closed', v_pending = 0);
end;
$$;

revoke all on function public.correct_payment(uuid, timestamptz, jsonb, jsonb) from public, anon;
revoke all on function public.close_installment_remainder(uuid, text) from public, anon;
grant execute on function public.correct_payment(uuid, timestamptz, jsonb, jsonb) to authenticated;
grant execute on function public.close_installment_remainder(uuid, text) to authenticated;

-- ===================== Geciken: yalnız aktif öğrenci =====================
-- Sütunlar 0009 ile aynı; yalnız öğrenci durumu süzgeci eklendi.
create or replace view public.v_overdue_installments
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
  and i.due_date < (now() at time zone 'Europe/Istanbul')::date
  and s.status = 'aktif';

revoke all on public.v_overdue_installments from anon, public;
grant select on public.v_overdue_installments to authenticated, service_role;
