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
  -- service_role (auth.uid() IS NULL, ör. test fixture'ları) ve yöneticiler: kısıtsız
  if (select auth.uid()) is null or public.is_yonetici() then
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
