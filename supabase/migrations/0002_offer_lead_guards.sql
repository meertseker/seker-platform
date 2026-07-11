-- 0002: DB-level kilit tetikleyicileri
--
-- Final whole-branch review'da bulunan iki kritik açığı DB seviyesinde kapatır:
--
--  1) Teklif sahteciliği (spec §6.2): RLS'in ins_offers politikası yalnızca
--     created_by = auth.uid() kontrol eder; bir danışman PostgREST üzerinden
--     doğrudan status='onaylandi' + uydurma list_price ile teklif ekleyip
--     lead'i meşru gibi öğrenciye dönüştürebilirdi. Bu dosyadaki
--     guard_offers_insert tetikleyicisi, yönetici/service_role dışındaki
--     kullanıcılar için: karar bilgisi (decided_by/superseded_by_offer_id)
--     taşıyan bir insert'e izin vermez; yalnızca 'onay_bekliyor' veya
--     gerçekten aktif fiyat listesine eşit/üzeri bir otomatik onay
--     ('onaylandi' + offered_price >= list_price + list_price = aktif
--     fiyat listesindeki güncel değer) insert edilebilir.
--
--  2) Sonuçlanmış teklifin tekrar karara bağlanması (spec §6.2): actions/offers.ts
--     decideOffer artık status='onay_bekliyor' değilse erken hata döner, ama
--     bu yalnızca uygulama katmanı. guard_offers_terminal tetikleyicisi aynı
--     kuralı yönetici dahil TÜM roller için DB seviyesinde kilitler:
--     'onay_bekliyor'dan her yöne geçiş serbest, 'onaylandi' -> 'gecersiz'
--     (supersede akışı) serbest, sonlanmış durumlardan başka her geçiş
--     reddedilir.
--
--  3) Dönüştürülmüş lead kilidi (spec §6.1): actions/leads.ts updateLead
--     artık converted_student_id doluysa erken hata döner, ama bu da yalnızca
--     uygulama katmanı. guard_leads_converted tetikleyicisi aynı kuralı DB
--     seviyesinde kilitler: converted_student_id doluyken yalnızca
--     last_activity_at/updated_at değişebilir; dönüşüm yazımının kendisi
--     (converted_student_id null -> dolu, status -> 'kazanildi') serbest kalır.
--
-- service_role tespiti mevcut 0001 guard trigger'larıyla aynı yöntemle
-- yapılır: (select auth.uid()) is null  ==  service_role bağlantısı
-- (bkz. 0001_schema.sql:303-366, guard_offers_danisman / guard_installments_danisman).

-- ===================== Trigger: teklif insert sahtecilik koruması =====================
create or replace function public.guard_offers_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  active_price numeric(12,2);
begin
  -- service_role (auth.uid() IS NULL, ör. test fixture'ları), yöneticiler ve
  -- accept_counter_offer() RPC'si (bkz. dosya sonu) içindeki denetimli insert: kısıtsız.
  -- app.accept_counter yalnızca bu dosyadaki SECURITY DEFINER fonksiyon içinden,
  -- transaction-local olarak set edilebilir; PostgREST pg_catalog.set_config'i
  -- istemciye açmadığı için dışarıdan taklit edilemez.
  if (select auth.uid()) is null or public.is_yonetici()
     or current_setting('app.accept_counter', true) = '1' then
    return new;
  end if;

  -- Diğer roller (danışman): karar bilgisi taşıyan bir teklif asla insert edilemez
  -- (kararlar yalnızca decideOffer üzerinden UPDATE ile, yönetici tarafından verilir).
  if new.decided_by is not null or new.superseded_by_offer_id is not null then
    raise exception 'Karar bilgisi içeren bir teklif oluşturulamaz';
  end if;

  if new.status = 'onay_bekliyor' then
    return new;
  end if;

  if new.status = 'onaylandi' then
    -- Otomatik onay yalnızca aktif fiyat listesindeki GERÇEK liste fiyatına
    -- eşit/üzeri tekliflerde geçerlidir (bkz. actions/offers.ts activeListPrice +
    -- lib/offer-rules.ts initialOfferStatus). list_price alanı burada sunucu
    -- tarafında yeniden doğrulanır; istemcinin gönderdiği değere güvenilmez.
    select pli.monthly_fee into active_price
    from public.price_list_items pli
    join public.price_lists pl on pl.id = pli.price_list_id
    where pl.is_active and pli.program = new.program;

    if active_price is null or new.list_price <> active_price then
      raise exception 'Liste fiyatı aktif fiyat listesiyle eşleşmiyor';
    end if;

    if new.offered_price < new.list_price then
      raise exception 'Otomatik onay için teklif liste fiyatının altında olamaz';
    end if;

    return new;
  end if;

  raise exception 'Danışman bu durumda teklif oluşturamaz';
end;
$$;

create trigger guard_offers_insert
  before insert on public.offers
  for each row execute function public.guard_offers_insert();

-- ===================== Trigger: sonuçlanmış teklifin donması =====================
create or replace function public.guard_offers_terminal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- service_role (auth.uid() IS NULL, ör. test fixture'ları): kısıtsız
  if (select auth.uid()) is null then
    return new;
  end if;

  -- 'onay_bekliyor'dan her yöne geçiş serbest (ilk karar anı)
  if old.status = 'onay_bekliyor' then
    return new;
  end if;

  -- Durum değişmiyorsa serbest (örn. superseded_by_offer_id / diğer alan
  -- güncellemeleri; kolon bazlı kısıtlama zaten guard_offers_danisman'da var)
  if new.status = old.status then
    return new;
  end if;

  -- Supersede akışı: onaylı bir teklif yeni bir onaydan dolayı geçersiz kılınır
  -- (bkz. actions/offers.ts supersedeApprovedOffers) — yönetici dahil herkes için serbest
  if old.status = 'onaylandi' and new.status = 'gecersiz' then
    return new;
  end if;

  -- Sonlanmış durumlardan (onaylandi/reddedildi/revize_edildi/gecersiz) başka
  -- her geçiş, yönetici dahil TÜM roller için yasaktır (spec §6.2)
  raise exception 'Teklif zaten sonuçlandırılmış, durumu değiştirilemez';
end;
$$;

create trigger guard_offers_terminal
  before update on public.offers
  for each row execute function public.guard_offers_terminal();

-- ===================== Trigger: dönüştürülmüş lead kilidi =====================
create or replace function public.guard_leads_converted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- service_role (auth.uid() IS NULL, ör. test fixture'ları): kısıtsız
  if (select auth.uid()) is null then
    return new;
  end if;

  -- Dönüşüm yazımının kendisi (converted_student_id null -> dolu, status ->
  -- 'kazanildi') serbesttir (bkz. actions/students.ts convertLeadToStudent)
  if old.converted_student_id is null then
    return new;
  end if;

  -- Dönüştürülmüş lead: yalnızca last_activity_at/updated_at değişebilir
  -- (bkz. actions/notes.ts addNote — not eklemek last_activity_at'i günceller)
  if (new.parent_name is distinct from old.parent_name) or
     (new.phone is distinct from old.phone) or
     (new.child_name is distinct from old.child_name) or
     (new.child_birth_month is distinct from old.child_birth_month) or
     (new.child_birth_year is distinct from old.child_birth_year) or
     (new.source is distinct from old.source) or
     (new.source_detail is distinct from old.source_detail) or
     (new.status is distinct from old.status) or
     (new.lost_reason is distinct from old.lost_reason) or
     (new.assigned_to is distinct from old.assigned_to) or
     (new.converted_student_id is distinct from old.converted_student_id) or
     (new.created_at is distinct from old.created_at)
  then
    raise exception 'Öğrenciye dönüştürülmüş lead güncellenemez';
  end if;

  return new;
end;
$$;

create trigger guard_leads_converted
  before update on public.leads
  for each row execute function public.guard_leads_converted();

-- ===================== 4) Karşı teklif kabulü: danışman için atomik RPC =====================
--
-- Final-review takibi: spec §6.2 akışının 2. adımı (yönetici 'revize_edildi' +
-- counter_price ile karşı teklif sunar -> danışman "Karşı rakamla teklif
-- oluştur" der -> createOfferFromCounter yeni 'onaylandi' teklif açar ve
-- kaynağı superseded_by_offer_id ile kapatır) danışman için iki yönden kırıktı:
--
--  a) Kaynak teklifin superseded_by_offer_id güncellemesi danışman için
--     RLS (upd_offers_danisman with check status='gecersiz') VE
--     guard_offers_danisman (yukarıda; status 'gecersiz' değilse red) yüzünden
--     başarısız oluyordu — durum 'revize_edildi' olarak kalıyor.
--  b) Bu dosyadaki guard_offers_insert, decided_by dolu geldiği için (karşı
--     teklif akışı decided_by'ı kaynaktan kopyalar) danışman insert'ini
--     doğrudan reddediyordu.
--
-- Sonuç: orphan (kaynağı kapatılmamış) onaylı teklif + atlanmış event/lead
-- durumu ilerletme. Çözüm: tüm işlemi tek bir SECURITY DEFINER RPC'ye
-- taşımak (Option A). RPC postgres sahipli olduğu için içindeki tüm
-- yazımlar RLS'i bypass eder (superuser), ANCAK BEFORE trigger'lar (yukarıdaki
-- guard_offers_insert / guard_offers_danisman) rol/RLS'den bağımsız her
-- yazımda tetiklenir — bu yüzden onlara transaction-local
-- `app.accept_counter` bayrağıyla kısıtlı bir bypass eklendi (yalnızca bu
-- fonksiyon set edebilir; PostgREST pg_catalog.set_config'i istemciye
-- açığa çıkarmadığından dışarıdan taklit edilemez). auth.uid() SECURITY
-- DEFINER içinde de çağıranın kimliğini döndürmeye devam eder (JWT claim
-- okur, rol değişiminden etkilenmez) — bu yüzden created_by/decided_by hâlâ
-- doğru kullanıcılara işaret eder.
--
-- Yeniden kullanım koruması (actions/offers.ts createOfferFromCounter'daki
-- orijinal mantıkla aynı semantik): source.superseded_by_offer_id dolu ise
-- veya status <> 'revize_edildi' ya da counter_price boşsa red. Satır
-- `for update` ile kilitlenir, böylece iki eşzamanlı kabul isteğinden yalnız
-- biri başarılı olur (ikincisi kilit açıldığında superseded_by_offer_id'nin
-- dolu olduğunu görüp "zaten kullanılmış" hatası alır) — RLS/uygulama
-- katmanındaki eski TS "existingAccepted" yumuşatması artık gerekmiyor,
-- çünkü tüm akış tek transaction'da atomik.
create or replace function public.accept_counter_offer(source_offer_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  src public.offers%rowtype;
  caller uuid;
  new_offer_id uuid;
begin
  caller := auth.uid();

  if caller is null then
    raise exception 'Bu işlem için oturum açmış bir kullanıcı gerekir';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = caller and p.is_active
  ) then
    raise exception 'Bu işlem için aktif personel yetkisi gerekir';
  end if;

  select * into src from public.offers where id = source_offer_id for update;

  if not found then
    raise exception 'Revize teklif bulunamadı';
  end if;

  if src.superseded_by_offer_id is not null then
    raise exception 'Bu revize teklif zaten kullanılmış';
  end if;

  if src.status <> 'revize_edildi' or src.counter_price is null then
    raise exception 'Bu teklif için karşı rakam bulunmuyor';
  end if;

  -- Yalnızca bu transaction içinde geçerli; commit/rollback sonrası sıfırlanır.
  perform set_config('app.accept_counter', '1', true);

  insert into public.offers (
    lead_id, created_by, program, list_price, offered_price,
    installment_count, note, status, decided_by, decided_at
  ) values (
    src.lead_id, caller, src.program, src.list_price, src.counter_price,
    src.installment_count, src.note, 'onaylandi', src.decided_by, now()
  )
  returning id into new_offer_id;

  -- bkz. actions/offers.ts supersedeApprovedOffers — lead için başka
  -- onaylı teklif varsa geçersiz kılınır (guard_offers_terminal bu geçişi
  -- zaten herkese açık bırakıyor: onaylandi -> gecersiz).
  update public.offers
    set status = 'gecersiz', superseded_by_offer_id = new_offer_id
    where lead_id = src.lead_id and status = 'onaylandi' and id <> new_offer_id;

  update public.offers
    set superseded_by_offer_id = new_offer_id
    where id = src.id and superseded_by_offer_id is null;

  return new_offer_id;
end;
$$;

revoke all on function public.accept_counter_offer(uuid) from public;
grant execute on function public.accept_counter_offer(uuid) to authenticated, service_role;

-- ===================== guard_offers_danisman yeniden tanımı (bkz. 0001_schema.sql) =====================
-- Yalnızca accept_counter_offer() içindeki kaynak-teklif güncellemesine
-- (superseded_by_offer_id set edilirken status 'revize_edildi' olarak kalır)
-- izin vermek için app.accept_counter bypass'ı eklendi; mantığın geri kalanı
-- 0001'dekiyle birebir aynıdır.
create or replace function public.guard_offers_danisman() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- service_role (auth.uid() IS NULL), yöneticiler ve accept_counter_offer()
  -- RPC'si içindeki denetimli güncelleme: kısıtsız.
  if (select auth.uid()) is null or public.is_yonetici()
     or current_setting('app.accept_counter', true) = '1' then
    return new;
  end if;

  if (new.lead_id           is distinct from old.lead_id)           or
     (new.created_by        is distinct from old.created_by)        or
     (new.program           is distinct from old.program)           or
     (new.list_price        is distinct from old.list_price)        or
     (new.offered_price     is distinct from old.offered_price)     or
     (new.installment_count is distinct from old.installment_count) or
     (new.note              is distinct from old.note)              or
     (new.decided_by        is distinct from old.decided_by)        or
     (new.decided_at        is distinct from old.decided_at)        or
     (new.counter_price     is distinct from old.counter_price)     or
     (new.created_at        is distinct from old.created_at)
  then
    raise exception 'Danışman teklif üzerinde yalnızca geçersiz kılma yapabilir';
  end if;

  if new.status is distinct from 'gecersiz' then
    raise exception 'Danışman teklif üzerinde yalnızca geçersiz kılma yapabilir';
  end if;

  return new;
end;
$$;
-- Trigger zaten 0001'de tanımlı (guard_offers_danisman before update on
-- public.offers); create or replace function yeterli, trigger'ı yeniden
-- oluşturmaya gerek yok.
