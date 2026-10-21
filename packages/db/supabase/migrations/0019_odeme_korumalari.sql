-- 0019_odeme_korumalari.sql — Ödeme denetimi Faz 0 (21.10.2026): kanamayı durdur.
--
-- 1. Ödeme yazmaları tek işlemde, satır kilidiyle: take_payment, undo_payment,
--    reschedule_installments, revert_installment_payment (+ salt okuma önizleme).
-- 2. Danışman doğrudan PostgREST ile tutar küçültemez, ödenmiş satır ekleyemez.
-- 3. Ödenmiş taksit silinemez (service_role dahil). Bilinçli toplu iş için:
--      select set_config('seker.odenmis_taksit_silme', 'on', true);  -- aynı işlem içinde
-- 4. Para tablolarında anon/public yetkisi yok; authenticated'den TRUNCATE/REFERENCES/TRIGGER kalktı.
--
-- RPC'ler tetikleyicileri `seker.odeme_rpc` işlem ayarıyla atlar. Bu ayar yalnız
-- SQL ile verilebilir; PostgREST istemcisi set_config çağıramaz (pg_catalog açık değil).
-- Dosya idempotenttir; prod verisinde hiçbir satırı değiştirmez.

-- ===================== Tetikleyiciler =====================

-- Danışman (yönetici olmayan oturum) yalnız tam ödeme işaretleyebilir: tutar değişmez,
-- ödenen = tutar, işaretleyen kendisi. Kısmi ödeme ve geri alma RPC üzerinden gider.
create or replace function public.guard_installments_danisman() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- service_role (auth.uid() IS NULL), yöneticiler ve ödeme RPC'leri: kısıtsız
  if (select auth.uid()) is null or public.is_yonetici()
     or coalesce(current_setting('seker.odeme_rpc', true), '') = 'on' then
    return new;
  end if;

  if old.status <> 'bekliyor'                         or
     new.status <> 'odendi'                           or
     (new.plan_id    is distinct from old.plan_id)    or
     (new.due_date   is distinct from old.due_date)   or
     (new.created_at is distinct from old.created_at) or
     (new.amount     is distinct from old.amount)     or
     (new.paid_amount is distinct from new.amount)    or
     (new.marked_by  is distinct from (select auth.uid()))
  then
    raise exception 'Danışman taksitte yalnızca tam ödeme işaretleyebilir' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Trigger 0001'de tanımlı; yine de yoksa kur.
drop trigger if exists guard_installments_danisman on public.installments;
create trigger guard_installments_danisman
  before update on public.installments
  for each row execute function public.guard_installments_danisman();

-- Danışman yalnız bekleyen taksit ekleyebilir (plan kurulumu). Ödenmiş satır RPC'den gelir.
create or replace function public.guard_installments_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or public.is_yonetici()
     or coalesce(current_setting('seker.odeme_rpc', true), '') = 'on' then
    return new;
  end if;

  if new.status <> 'bekliyor' or new.paid_at is not null or new.paid_amount is not null
     or new.payment_method is not null or new.marked_by is not null then
    raise exception 'Danışman yalnız bekleyen taksit ekleyebilir' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_installments_insert on public.installments;
create trigger guard_installments_insert
  before insert on public.installments
  for each row execute function public.guard_installments_insert();

-- Ödenmiş taksit silinmez — service_role ve cascade (öğrenci/plan silme) dahil.
create or replace function public.guard_installments_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'odendi'
     and coalesce(current_setting('seker.odeme_rpc', true), '') <> 'on'
     and coalesce(current_setting('seker.odenmis_taksit_silme', true), '') <> 'on' then
    raise exception 'Ödenmiş taksit silinemez; önce ödemeyi geri alın' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists guard_installments_delete on public.installments;
create trigger guard_installments_delete
  before delete on public.installments
  for each row execute function public.guard_installments_delete();

revoke all on function public.guard_installments_danisman() from public, anon, authenticated;
revoke all on function public.guard_installments_insert() from public, anon, authenticated;
revoke all on function public.guard_installments_delete() from public, anon, authenticated;

-- ===================== Yardımcılar =====================

create or replace function public.odeme_uuid_dizisi(p jsonb) returns uuid[]
language sql immutable set search_path = '' as $$
  select coalesce(array(select x::uuid from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) x), '{}');
$$;
revoke all on function public.odeme_uuid_dizisi(jsonb) from public, anon, authenticated;

-- Bir odeme_alindi olayı bugün geri alınabilir mi? null = evet; değilse nedeni.
-- Satırları kilitlemez; undo_payment kilitledikten sonra çağırır.
create or replace function public.payment_undo_blocker(p_event_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_payload jsonb;
  v_paid uuid[];
  v_created uuid[];
  v_remainders uuid[];
  v_total numeric;
  v_snap record;
  v_row record;
  v_n int;
  v_paid_sum numeric;
  v_snap_sum numeric;
  v_rem_sum numeric;
  v_missing int;
  v_rem_paid int;
  v_rem_cancelled int;
begin
  select e.payload into v_payload from public.events e
   where e.id = p_event_id and e.event_type = 'odeme_alindi';
  if not found then return 'ödeme kaydı bulunamadı'; end if;
  if coalesce((v_payload->>'undone')::boolean, false) then return 'bu ödeme zaten geri alındı'; end if;
  if v_payload ? 'undoBlocked' then return v_payload->>'undoBlocked'; end if;

  v_paid := public.odeme_uuid_dizisi(v_payload->'paidIds');
  v_created := public.odeme_uuid_dizisi(v_payload->'createdIds');
  v_remainders := array(select x from unnest(v_created) x where not (x = any(v_paid)));
  v_total := (v_payload->>'totalTl')::numeric;

  -- Ödenen taksitler hâlâ ödenmiş ve tutarı ödemeyle aynı.
  for v_snap in
    select (s->>'id')::uuid as id, (s->>'amount')::numeric as amount
      from jsonb_array_elements(coalesce(v_payload->'snapshots', '[]'::jsonb)) s
  loop
    select i.status, i.amount, i.paid_amount into v_row from public.installments i where i.id = v_snap.id;
    if not found then return 'ödenen taksit silinmiş'; end if;
    if v_row.status <> 'odendi' then return 'ödenen taksit artık ödenmiş değil'; end if;
    if v_row.paid_amount is distinct from v_row.amount or v_row.amount > v_snap.amount then
      return 'ödenen taksitin tutarı değiştirilmiş';
    end if;
  end loop;

  select count(*), coalesce(sum(i.paid_amount), 0) into v_n, v_paid_sum
    from public.installments i
   where i.id = any(v_paid) and i.status = 'odendi' and i.paid_amount = i.amount;
  if v_n <> coalesce(cardinality(v_paid), 0) then return 'ödenen taksitlerden biri değiştirilmiş'; end if;
  if v_payload ? 'paid' and exists (
    select 1 from jsonb_array_elements(v_payload->'paid') p
      join public.installments i on i.id = (p->>'id')::uuid
     where i.paid_amount <> (p->>'amount')::numeric
  ) then
    return 'ödenen tutar değiştirilmiş';
  end if;
  if v_total is null or v_paid_sum <> v_total then return 'ödenen tutar değiştirilmiş'; end if;

  -- Kalan taksitler hâlâ bekliyor ve değişmemiş.
  select count(*) filter (where i.id is null),
         count(*) filter (where i.status = 'odendi'),
         count(*) filter (where i.status = 'iptal'),
         coalesce(sum(i.amount) filter (where i.status = 'bekliyor'), 0)
    into v_missing, v_rem_paid, v_rem_cancelled, v_rem_sum
    from unnest(v_remainders) r(id)
    left join public.installments i on i.id = r.id;
  if v_rem_paid > 0 then return 'kalan taksit ödendi'; end if;
  if v_missing > 0 then return 'kalan taksit silinmiş'; end if;
  if v_rem_cancelled > 0 then return 'kalan taksit iptal edilmiş'; end if;
  if v_payload ? 'created' and exists (
    select 1 from jsonb_array_elements(v_payload->'created') c
      join public.installments i on i.id = (c->>'id')::uuid
     where i.status = 'bekliyor' and i.amount <> (c->>'amount')::numeric
  ) then
    return 'kalan taksitin tutarı değiştirilmiş';
  end if;

  select coalesce(sum((s->>'amount')::numeric), 0) into v_snap_sum
    from jsonb_array_elements(coalesce(v_payload->'snapshots', '[]'::jsonb)) s;
  if v_snap_sum <> v_total + v_rem_sum then return 'kalan taksitlerin tutarı değiştirilmiş'; end if;

  return null;
end;
$$;
revoke all on function public.payment_undo_blocker(uuid) from public, anon, authenticated;

-- Bir taksiti ödeyen, geri alınmamış odeme_alindi olayı (yoksa null).
create or replace function public.payment_event_for_installment(p_installment_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select e.id from public.events e
   where e.event_type = 'odeme_alindi'
     and e.payload->'paidIds' ? p_installment_id::text
     and not coalesce((e.payload->>'undone')::boolean, false)
   order by e.created_at desc
   limit 1;
$$;
revoke all on function public.payment_event_for_installment(uuid) from public, anon, authenticated;

-- ===================== take_payment =====================
-- p_ops: [{ "id", "amount" (okunan tutar), "parts": [{ "amount", "method" }],
--           "remainders": [{ "dueDate", "amount" }] }]
-- p_payload: olaya eklenecek alanlar (paidOn, methods, note, settled, plans).
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
      if v_first then
        update public.installments
           set amount = (v_part->>'amount')::numeric,
               status = 'odendi',
               paid_at = p_paid_at,
               paid_amount = (v_part->>'amount')::numeric,
               payment_method = v_part->>'method',
               marked_by = v_uid
         where id = v_row.id and status = 'bekliyor';
        get diagnostics v_n = row_count;
        if v_n <> 1 then
          raise exception 'Bu taksit az önce başka biri tarafından ödendi' using errcode = 'P0001';
        end if;
        v_paid_ids := v_paid_ids || v_row.id;
        v_paid := v_paid || jsonb_build_object('id', v_row.id, 'amount', (v_part->>'amount')::numeric);
        v_first := false;
      else
        insert into public.installments (plan_id, due_date, amount, status, paid_at, paid_amount, payment_method, marked_by)
        values (v_row.plan_id, v_row.due_date, (v_part->>'amount')::numeric, 'odendi', p_paid_at,
                (v_part->>'amount')::numeric, v_part->>'method', v_uid)
        returning id into v_new;
        v_paid_ids := v_paid_ids || v_new;
        v_created_ids := v_created_ids || v_new;
        v_paid := v_paid || jsonb_build_object('id', v_new, 'amount', (v_part->>'amount')::numeric);
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

-- ===================== undo_payment =====================
-- Ödemenin tam tersi: oluşturulan satırlar silinir, ödenen taksitler eski tutarıyla bekler,
-- olay undone olur. Sonradan başka işlem yapılmışsa reddeder.
create or replace function public.undo_payment(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_event record;
  v_paid uuid[];
  v_created uuid[];
  v_snap_ids uuid[];
  v_blocker text;
  v_snap record;
  v_n int;
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;

  select e.id, e.entity_id, e.actor_id, e.created_at, e.event_type, e.payload into v_event
    from public.events e where e.id = p_event_id for update;
  if not found or v_event.event_type <> 'odeme_alindi' then
    raise exception 'Ödeme kaydı bulunamadı' using errcode = 'P0002';
  end if;
  if coalesce((v_event.payload->>'undone')::boolean, false) then
    raise exception 'Bu ödeme zaten geri alındı' using errcode = 'P0001';
  end if;
  -- Danışman kendi ödemesini 15 dakika içinde geri alabilir; gerisi yönetici.
  if not public.is_yonetici()
     and not (v_event.actor_id = v_uid and v_event.created_at > now() - interval '15 minutes') then
    raise exception 'Bu ödemeyi yalnız yönetici geri alabilir' using errcode = '42501';
  end if;

  v_paid := public.odeme_uuid_dizisi(v_event.payload->'paidIds');
  v_created := public.odeme_uuid_dizisi(v_event.payload->'createdIds');
  v_snap_ids := array(select (s->>'id')::uuid
                        from jsonb_array_elements(coalesce(v_event.payload->'snapshots', '[]'::jsonb)) s);

  perform 1 from public.installments i
   where i.id = any(v_paid || v_created || v_snap_ids) order by i.id for update;

  v_blocker := public.payment_undo_blocker(p_event_id);
  if v_blocker is not null then
    raise exception 'Bu ödemeden sonra başka işlem yapılmış (%). Önce sonraki işlemi geri alın.', v_blocker
      using errcode = 'P0001';
  end if;

  perform set_config('seker.odeme_rpc', 'on', true);

  if coalesce(cardinality(v_created), 0) > 0 then
    delete from public.installments i
     where i.id = any(v_created) and (i.status = 'bekliyor' or i.id = any(v_paid));
    get diagnostics v_n = row_count;
    if v_n <> cardinality(v_created) then
      raise exception 'Ödeme geri alınamadı (oluşturulan taksitler değişmiş)' using errcode = 'P0001';
    end if;
  end if;

  for v_snap in
    select (s->>'id')::uuid as id, (s->>'amount')::numeric as amount
      from jsonb_array_elements(coalesce(v_event.payload->'snapshots', '[]'::jsonb)) s
  loop
    update public.installments
       set amount = v_snap.amount, status = 'bekliyor', paid_at = null, paid_amount = null,
           payment_method = null, marked_by = null
     where id = v_snap.id and status = 'odendi';
    get diagnostics v_n = row_count;
    if v_n <> 1 then
      raise exception 'Ödeme geri alınamadı (taksit değişmiş)' using errcode = 'P0001';
    end if;
  end loop;

  update public.events
     set payload = payload || jsonb_build_object('undone', true, 'undoneAt', now(), 'undoneBy', v_uid)
   where id = p_event_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'Ödeme kaydı güncellenemedi' using errcode = 'P0001';
  end if;

  insert into public.events (entity_type, entity_id, event_type, actor_id, payload)
  values ('student', v_event.entity_id, 'odeme_geri_alindi', v_uid,
          jsonb_build_object('eventId', p_event_id,
                             'totalTl', v_event.payload->'totalTl',
                             'paidOn', v_event.payload->'paidOn',
                             'installmentCount', coalesce(cardinality(v_snap_ids), 0)));

  perform set_config('seker.odeme_rpc', '', true);
  return jsonb_build_object('kind', 'odeme', 'studentId', v_event.entity_id,
                            'totalTl', v_event.payload->'totalTl');
end;
$$;

-- ===================== revert_installment_payment =====================
-- Taksit tablosu / matris "Geri al": taksiti ödeyen olay varsa onu geri alır (undo_payment);
-- olay yoksa (içe aktarma, seed) yalnız durumu geri alır ve bunu olaya yazar.
create or replace function public.revert_installment_payment(p_installment_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_row record;
  v_n int;
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;

  v_event := public.payment_event_for_installment(p_installment_id);
  if v_event is not null then
    return public.undo_payment(v_event);
  end if;

  if not public.is_yonetici() then
    raise exception 'Bu işlem için yönetici yetkisi gerekir' using errcode = '42501';
  end if;

  select i.id, i.status, i.amount, i.paid_amount, i.payment_method, i.paid_at, p.student_id
    into v_row
    from public.installments i
    join public.payment_plans p on p.id = i.plan_id
   where i.id = p_installment_id
   for update of i;
  if not found then raise exception 'Taksit bulunamadı' using errcode = 'P0002'; end if;
  if v_row.status <> 'odendi' then
    raise exception 'Sadece ödenmiş taksit geri alınabilir' using errcode = 'P0001';
  end if;
  -- Eski "taksit_odendi" yolu kısmi ödemede kalan satır üretiyordu; o satır burada geri alınmaz.
  if exists (select 1 from public.events e
              where e.event_type = 'taksit_odendi' and e.entity_id = p_installment_id
                and coalesce((e.payload->>'partial')::boolean, false)) then
    raise exception 'Bu taksit eski bir kısmi ödemeyle bölünmüş; panelden geri alınamaz' using errcode = 'P0001';
  end if;

  perform set_config('seker.odeme_rpc', 'on', true);
  update public.installments
     set status = 'bekliyor', paid_at = null, paid_amount = null, payment_method = null, marked_by = null
   where id = p_installment_id and status = 'odendi';
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'Ödeme geri alınamadı' using errcode = 'P0001';
  end if;

  insert into public.events (entity_type, entity_id, event_type, actor_id, payload)
  values ('student', v_row.student_id, 'odeme_geri_alindi', v_uid,
          jsonb_build_object('installmentId', p_installment_id,
                             'totalTl', v_row.paid_amount,
                             'amountTl', v_row.amount,
                             'method', v_row.payment_method,
                             'paidAt', v_row.paid_at,
                             'source', 'ice_aktarma',
                             'installmentCount', 1));

  perform set_config('seker.odeme_rpc', '', true);
  return jsonb_build_object('kind', 'ice_aktarma', 'studentId', v_row.student_id, 'totalTl', v_row.paid_amount);
end;
$$;

-- Onay penceresi için: "Geri al" neyi geri alacak? Salt okuma.
create or replace function public.preview_installment_revert(p_installment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_event record;
  v_row record;
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;

  select e.id, e.actor_id, e.created_at, e.payload into v_event
    from public.events e where e.id = public.payment_event_for_installment(p_installment_id);
  if found then
    return jsonb_build_object(
      'kind', 'odeme',
      'eventId', v_event.id,
      'totalTl', v_event.payload->'totalTl',
      'paidOn', v_event.payload->'paidOn',
      'methods', coalesce(v_event.payload->'methods', '[]'::jsonb),
      'installmentCount', jsonb_array_length(coalesce(v_event.payload->'snapshots', '[]'::jsonb)),
      'createdCount', jsonb_array_length(coalesce(v_event.payload->'createdIds', '[]'::jsonb)),
      'allowed', public.is_yonetici()
                 or (v_event.actor_id = v_uid and v_event.created_at > now() - interval '15 minutes'),
      'blocker', public.payment_undo_blocker(v_event.id));
  end if;

  select i.status, i.amount, i.paid_amount, i.payment_method, i.paid_at into v_row
    from public.installments i where i.id = p_installment_id;
  if not found then raise exception 'Taksit bulunamadı' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'kind', 'ice_aktarma',
    'totalTl', coalesce(v_row.paid_amount, v_row.amount),
    'method', v_row.payment_method,
    'paidAt', v_row.paid_at,
    'installmentCount', 1,
    'createdCount', 0,
    'allowed', public.is_yonetici(),
    'blocker', case when v_row.status <> 'odendi' then 'taksit ödenmiş değil' end);
end;
$$;

-- ===================== reschedule_installments =====================
-- Bekleyen taksitleri yeni taksitlere böler (p_drafts: [{ "dueDate", "amount" }]); toplam değişmez.
-- Silinen satırlar bir ödemenin kalanıysa o ödemenin createdIds listesi yeni satırlara taşınır
-- (geri alma kalanı doğru siler). Kalan başka taksitlerle birleştiyse ödemenin geri alınması kilitlenir.
create or replace function public.reschedule_installments(p_ids uuid[], p_drafts jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_plan uuid;
  v_student uuid;
  v_found int;
  v_bad int;
  v_plans int;
  v_old_sum numeric;
  v_new_sum numeric;
  v_new_ids uuid[];
  v_new_created jsonb;
  v_n int;
  v_ev record;
  v_ev_created uuid[];
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'Taksit seçin' using errcode = '22023';
  end if;
  if p_drafts is null or jsonb_typeof(p_drafts) <> 'array'
     or jsonb_array_length(p_drafts) not between 1 and 12 then
    raise exception 'Taksit sayısı 1-12 arasında olmalı' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_drafts) d
              where (d->>'amount') is null or (d->>'amount')::numeric <= 0 or (d->>'dueDate') is null) then
    raise exception 'Geçersiz taksit' using errcode = '22023';
  end if;

  select count(*), count(*) filter (where t.status <> 'bekliyor'), count(distinct t.plan_id),
         coalesce(sum(t.amount), 0), min(t.plan_id::text)::uuid
    into v_found, v_bad, v_plans, v_old_sum, v_plan
    from (select i.status, i.plan_id, i.amount from public.installments i
           where i.id = any(p_ids) order by i.id for update) t;
  if v_found <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'Taksitler bulunamadı' using errcode = 'P0002';
  end if;
  if v_bad > 0 then
    raise exception 'Yalnız bekleyen taksitler taksitlendirilebilir (taksit az önce ödenmiş olabilir)' using errcode = 'P0001';
  end if;
  if v_plans <> 1 then
    raise exception 'Taksitler aynı kaleme ait olmalı' using errcode = 'P0001';
  end if;

  select p.student_id into v_student from public.payment_plans p where p.id = v_plan for update;

  select coalesce(sum((d->>'amount')::numeric), 0) into v_new_sum from jsonb_array_elements(p_drafts) d;
  if v_new_sum <> v_old_sum then
    raise exception 'Yeni taksitlerin toplamı bekleyen tutara eşit değil' using errcode = '22023';
  end if;

  with ins as (
    insert into public.installments (plan_id, due_date, amount)
    select v_plan, (d->>'dueDate')::date, (d->>'amount')::numeric from jsonb_array_elements(p_drafts) d
    returning id, amount
  )
  select array_agg(id), coalesce(jsonb_agg(jsonb_build_object('id', id, 'amount', amount, 'status', 'bekliyor')), '[]'::jsonb)
    into v_new_ids, v_new_created from ins;

  delete from public.installments i where i.id = any(p_ids) and i.status = 'bekliyor';
  get diagnostics v_n = row_count;
  if v_n <> v_found then
    raise exception 'Taksitlendirilemedi, hiçbir değişiklik yapılmadı' using errcode = 'P0001';
  end if;

  for v_ev in
    select e.id, e.payload from public.events e
     where e.event_type = 'odeme_alindi'
       and not coalesce((e.payload->>'undone')::boolean, false)
       and e.payload->'createdIds' ?| array(select x::text from unnest(p_ids) x)
     for update
  loop
    v_ev_created := public.odeme_uuid_dizisi(v_ev.payload->'createdIds');
    if p_ids <@ v_ev_created then
      update public.events
         set payload = payload || jsonb_build_object(
               'createdIds', to_jsonb(array(select x from unnest(v_ev_created) x where not (x = any(p_ids))) || v_new_ids),
               'rescheduled', coalesce(payload->'rescheduled', '[]'::jsonb)
                              || jsonb_build_object('at', now(), 'replaced', to_jsonb(p_ids), 'with', to_jsonb(v_new_ids)))
             || case when payload ? 'created' then jsonb_build_object('created',
                  coalesce((select jsonb_agg(c) from jsonb_array_elements(payload->'created') c
                             where not ((c->>'id')::uuid = any(p_ids))), '[]'::jsonb) || v_new_created)
                else '{}'::jsonb end
       where id = v_ev.id;
    else
      update public.events
         set payload = payload || jsonb_build_object(
               'undoBlocked', 'kalan taksit başka taksitlerle birlikte yeniden düzenlendi')
       where id = v_ev.id;
    end if;
  end loop;

  insert into public.events (entity_type, entity_id, event_type, actor_id, payload)
  values ('student', v_student, 'taksitlendirildi', v_uid,
          jsonb_build_object('planId', v_plan, 'totalTl', v_old_sum,
                             'count', jsonb_array_length(p_drafts),
                             'firstDueDate', (select min((d->>'dueDate')::date) from jsonb_array_elements(p_drafts) d),
                             'replaced', to_jsonb(p_ids), 'created', to_jsonb(v_new_ids)));

  return jsonb_build_object('studentId', v_student, 'planId', v_plan, 'createdIds', to_jsonb(v_new_ids));
end;
$$;

-- ===================== RPC yetkileri =====================
revoke all on function public.take_payment(uuid, timestamptz, jsonb, jsonb) from public, anon;
revoke all on function public.undo_payment(uuid) from public, anon;
revoke all on function public.revert_installment_payment(uuid) from public, anon;
revoke all on function public.preview_installment_revert(uuid) from public, anon;
revoke all on function public.reschedule_installments(uuid[], jsonb) from public, anon;
grant execute on function public.take_payment(uuid, timestamptz, jsonb, jsonb) to authenticated;
grant execute on function public.undo_payment(uuid) to authenticated;
grant execute on function public.revert_installment_payment(uuid) to authenticated;
grant execute on function public.preview_installment_revert(uuid) to authenticated;
grant execute on function public.reschedule_installments(uuid[], jsonb) to authenticated;

-- ===================== Para tablolarında yetki temizliği =====================
-- RLS'in dayandığı SELECT/INSERT/UPDATE/DELETE authenticated'de kalır.
revoke all on table public.installments, public.payment_plans, public.refunds, public.events, public.wa_outbox
  from anon, public;
revoke truncate, references, trigger on table
  public.installments, public.payment_plans, public.refunds, public.events, public.wa_outbox
  from authenticated;
do $$
begin
  -- PG17: MAINTAIN (VACUUM/ANALYZE/REINDEX/...) da authenticated'e gerekmez.
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on table public.installments, public.payment_plans, public.refunds, '
            'public.events, public.wa_outbox from authenticated';
  end if;
end $$;
