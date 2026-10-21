-- 0021_take_payment_parca_tarihi.sql — "İki yöntemle" ödemede her parçanın kendi tarihi (21.10.2026).
--
-- Gerçekte parçalar farklı günlerde ödenebiliyor (12.10'da 4.000 nakit, 14.10'da 15.000 kart).
-- take_payment p_ops[].parts[] içinde isteğe bağlı "paidAt" alır; yoksa p_paid_at.
-- Her parçanın tarihi ayrı ayrı "bugünden ileri olamaz" denetiminden geçer.
-- Olaydaki "paid" listesi her satır için method ve paidAt taşır (ödeme geçmişi, WhatsApp).
-- İmza (uuid, timestamptz, jsonb, jsonb) aynı; create or replace yetkileri korur.
-- Dosya idempotenttir; veri değiştirmez. 0019 sonrası uygulanır.

-- p_ops: [{ "id", "amount" (okunan tutar), "parts": [{ "amount", "method", "paidAt"? }],
--           "remainders": [{ "dueDate", "amount" }] }]
-- p_payload: olaya eklenecek alanlar (paidOn, methods, parts, note, settled, plans).
-- Parçanın paidAt'i yoksa p_paid_at kullanılır; her tarih için "bugünden ileri olamaz".
create or replace function public.take_payment(
  p_student_id uuid, p_paid_at timestamptz, p_ops jsonb, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_op jsonb;
  v_part jsonb;
  v_rem jsonb;
  v_row record;
  v_first boolean;
  v_sum numeric;
  v_new uuid;
  v_n int;
  v_total numeric := 0;
  v_paid_ids uuid[] := '{}';
  v_created_ids uuid[] := '{}';
  v_snapshots jsonb := '[]'::jsonb;
  v_paid jsonb := '[]'::jsonb;
  v_created jsonb := '[]'::jsonb;
  v_event uuid;
  v_part_at timestamptz;
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 then
    raise exception 'Taksit seçin' using errcode = '22023';
  end if;
  if p_paid_at is null
     or (p_paid_at at time zone 'Europe/Istanbul')::date > (now() at time zone 'Europe/Istanbul')::date then
    raise exception 'Ödeme tarihi bugünden ileri olamaz' using errcode = '22023';
  end if;

  v_ids := array(select (o->>'id')::uuid from jsonb_array_elements(p_ops) o);
  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then
    raise exception 'Aynı taksit iki kez seçildi' using errcode = '22023';
  end if;

  -- Eşzamanlı ikinci ödeme burada bekler, sonra durumu 'odendi' görüp reddedilir.
  perform 1 from public.installments i where i.id = any(v_ids) order by i.id for update;

  perform set_config('seker.odeme_rpc', 'on', true);

  for v_op in select * from jsonb_array_elements(p_ops) loop
    select i.id, i.plan_id, i.due_date, i.amount, i.status, p.student_id
      into v_row
      from public.installments i
      join public.payment_plans p on p.id = i.plan_id
     where i.id = (v_op->>'id')::uuid;
    if not found then raise exception 'Taksit bulunamadı' using errcode = 'P0002'; end if;
    if v_row.student_id <> p_student_id then
      raise exception 'Taksit bu öğrenciye ait değil' using errcode = 'P0001';
    end if;
    if v_row.status <> 'bekliyor' then
      raise exception 'Bu taksit az önce başka biri tarafından ödendi' using errcode = 'P0001';
    end if;
    if v_row.amount <> (v_op->>'amount')::numeric then
      raise exception 'Taksit tutarı az önce değişti; sayfayı yenileyip tekrar deneyin' using errcode = 'P0001';
    end if;
    if jsonb_array_length(coalesce(v_op->'parts', '[]'::jsonb)) = 0 then
      raise exception 'Ödeme tutarı eksik' using errcode = '22023';
    end if;

    select coalesce(sum((x->>'amount')::numeric), 0) into v_sum
      from jsonb_array_elements(v_op->'parts') x;
    if v_sum + coalesce((select sum((x->>'amount')::numeric)
                           from jsonb_array_elements(coalesce(v_op->'remainders', '[]'::jsonb)) x), 0)
       <> v_row.amount then
      raise exception 'Ödeme ve kalan toplamı taksit tutarına eşit değil' using errcode = '22023';
    end if;
    v_total := v_total + v_sum;

    v_first := true;
    for v_part in select * from jsonb_array_elements(v_op->'parts') loop
      begin
        v_part_at := coalesce(nullif(v_part->>'paidAt', '')::timestamptz, p_paid_at);
      exception when others then
        raise exception 'Geçerli bir ödeme tarihi girin' using errcode = '22023';
      end;
      if (v_part_at at time zone 'Europe/Istanbul')::date > (now() at time zone 'Europe/Istanbul')::date then
        raise exception 'Ödeme tarihi bugünden ileri olamaz' using errcode = '22023';
      end if;
      if v_first then
        update public.installments
           set amount = (v_part->>'amount')::numeric,
               status = 'odendi',
               paid_at = v_part_at,
               paid_amount = (v_part->>'amount')::numeric,
               payment_method = v_part->>'method',
               marked_by = v_uid
         where id = v_row.id and status = 'bekliyor';
        get diagnostics v_n = row_count;
        if v_n <> 1 then
          raise exception 'Bu taksit az önce başka biri tarafından ödendi' using errcode = 'P0001';
        end if;
        v_paid_ids := v_paid_ids || v_row.id;
        v_paid := v_paid || jsonb_build_object('id', v_row.id, 'amount', (v_part->>'amount')::numeric,
                                               'method', v_part->>'method', 'paidAt', v_part_at);
        v_first := false;
      else
        insert into public.installments (plan_id, due_date, amount, status, paid_at, paid_amount, payment_method, marked_by)
        values (v_row.plan_id, v_row.due_date, (v_part->>'amount')::numeric, 'odendi', v_part_at,
                (v_part->>'amount')::numeric, v_part->>'method', v_uid)
        returning id into v_new;
        v_paid_ids := v_paid_ids || v_new;
        v_created_ids := v_created_ids || v_new;
        v_paid := v_paid || jsonb_build_object('id', v_new, 'amount', (v_part->>'amount')::numeric,
                                               'method', v_part->>'method', 'paidAt', v_part_at);
        v_created := v_created || jsonb_build_object('id', v_new, 'amount', (v_part->>'amount')::numeric, 'status', 'odendi');
      end if;
    end loop;

    for v_rem in select * from jsonb_array_elements(coalesce(v_op->'remainders', '[]'::jsonb)) loop
      insert into public.installments (plan_id, due_date, amount)
      values (v_row.plan_id, (v_rem->>'dueDate')::date, (v_rem->>'amount')::numeric)
      returning id into v_new;
      v_created_ids := v_created_ids || v_new;
      v_created := v_created || jsonb_build_object('id', v_new, 'amount', (v_rem->>'amount')::numeric, 'status', 'bekliyor');
    end loop;

    v_snapshots := v_snapshots || jsonb_build_object('id', v_row.id, 'amount', v_row.amount);
  end loop;

  if v_total <= 0 then
    raise exception 'Ödeme tutarı 0''dan büyük olmalı' using errcode = '22023';
  end if;

  insert into public.events (entity_type, entity_id, event_type, actor_id, payload)
  values ('student', p_student_id, 'odeme_alindi', v_uid,
          -- İstemci geri alma işaretlerini yazamaz.
          (coalesce(p_payload, '{}'::jsonb) - array['undone', 'undoneAt', 'undoneBy', 'undoBlocked', 'rescheduled'])
          || jsonb_build_object(
            'totalTl', v_total,
            'paidAt', p_paid_at,
            'paidIds', to_jsonb(v_paid_ids),
            'createdIds', to_jsonb(v_created_ids),
            'snapshots', v_snapshots,
            'paid', v_paid,
            'created', v_created))
  returning id into v_event;

  perform set_config('seker.odeme_rpc', '', true);
  return jsonb_build_object('eventId', v_event, 'totalTl', v_total,
                            'paidIds', to_jsonb(v_paid_ids), 'createdIds', to_jsonb(v_created_ids));
end;
$$;

revoke all on function public.take_payment(uuid, timestamptz, jsonb, jsonb) from public, anon;
grant execute on function public.take_payment(uuid, timestamptz, jsonb, jsonb) to authenticated;
