-- 0017_icerik.sql — öğretmen rolü, içerik tabloları (Reels ve sayfa görevleri) ve gizli video kovası.
-- K1: öğretmen yalnız kendi içeriğini görür; veli, öğrenci, ödeme, reklam, görev ve olay verisi ona kapalıdır.
-- Personel politikalarının tamamı is_staff() üzerinden yazıldığı için öğretmen is_staff()'tan çıkarılır.

-- === Rol ve telefon ===
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('yonetici','danisman','ogretmen'));

-- Öğretmene WhatsApp'tan haber bağlantısı (wa.me) için; E.164, +90 ve 10 hane.
alter table public.profiles add column phone text
  constraint profiles_phone_check check (phone is null or phone ~ '^\+90[0-9]{10}$');

-- Personel = etkin yönetici ya da danışman. Öğretmen bu kapsamın dışında.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role in ('yonetici','danisman')
  );
$$;

create or replace function public.is_ogretmen() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ogretmen' and p.is_active
  );
$$;

-- Öğretmen kendi profilini okur; personel zaten hepsini okur (sel_profiles).
-- profiles için update politikası yok: öğretmen rolünü ya da telefonunu değiştiremez.
create policy sel_profiles_self on public.profiles for select using (id = auth.uid());

-- === Ayarlar ===
-- Öğretmen yalnız canlı kontrolün ihtiyaç duyduğu iki anahtarı okur.
create policy sel_app_settings_icerik on public.app_settings for select
  using (public.is_ogretmen() and key in ('yasakli_ifadeler','icerik_limitleri'));

insert into public.app_settings (key, value) values
  ('yasakli_ifadeler', '["en iyi","bir numara","en güvenli","garanti"]'::jsonb),
  ('icerik_limitleri', '{"reels_aciklama":150,"sayfa_baslik":30,"en_az":10}'::jsonb),
  ('reklam_kurallari', '{"hedef_nitelikli_tl":1000,"durdur_kat":3,"kazan_min_nitelikli":5,"sonucsuz_hafta":3}'::jsonb)
on conflict (key) do nothing;

-- === İçerik görevleri ===
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  -- K5: Reels R-<yy><ww>-<harf>, sayfa S-<yy><ww>-<G|I>
  code text not null unique check (code ~ '^[RS]-[0-9]{4}-[A-Z]$'),
  kind text not null check (kind in ('reels','sayfa')),
  platform text not null check (platform in ('instagram','google')),
  -- Haftanın Pazartesi'si
  week_start date not null check (extract(isodow from week_start) = 1),
  topic text not null,
  audience text,
  brief text,
  owner_id uuid not null references public.profiles(id),
  due_at timestamptz,
  status text not null default 'taslak' check (status in ('taslak','teslim','duzeltme','onaylandi')),
  stage text not null default 'gorev' check (stage in ('gorev','kontrol','organik','test','kazanan','arsiv')),
  media_path text,
  media_meta jsonb,
  caption text,
  page_fields jsonb,
  -- "Videoda ya da yazıda bir öğrencinin yüzü ya da adı var mı?" (MEB Ek Madde 4)
  face_answer boolean,
  review_note text,
  submitted_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  stage_changed_at timestamptz not null default now(),
  -- Onaylayan "Videoyu izledim; öğrenci yüzü ya da adı yok" kutusunu işaretledi.
  approver_face_check boolean,
  ig_media_id text,
  -- Instagram'taki gerçek paylaşım zamanı (medya listesindeki timestamp); yalnız service_role yazar.
  ig_published_at timestamptz,
  ig_permalink text,
  learned_note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Reels yalnız Instagram ve R- kodu; sayfa S- kodu, son harf G → Google, I → Instagram.
  constraint content_items_kind_code_check check (
    (kind = 'reels' and platform = 'instagram' and left(code, 2) = 'R-')
    or (kind = 'sayfa' and left(code, 2) = 'S-' and (
      (right(code, 1) = 'G' and platform = 'google')
      or (right(code, 1) = 'I' and platform = 'instagram')
    ))
  )
);

create index idx_content_items_owner on public.content_items (owner_id, status);
create index idx_content_items_week on public.content_items (week_start, kind);
create index idx_content_items_stage on public.content_items (stage, stage_changed_at);

create trigger content_items_touch before update on public.content_items
  for each row execute function public.touch_updated_at();

-- Video yolu, MEB teslim kuralı, teslim damgası ve öğretmenin durum kuralı.
-- (a), (b) ve (d) service_role dahil herkese uygulanır; (c) yalnız içeriğin sahibi öğretmene
-- (service_role: auth.uid() boş; yönetici: is_ogretmen() yanlış → kısıtsız).
create or replace function public.content_items_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_prefix text;
begin
  -- (a) Yol yalnız <owner_id>/<content_id>/<dosya-adı>
  if new.media_path is not null then
    v_prefix := new.owner_id::text || '/' || new.id::text || '/';
    if not starts_with(new.media_path, v_prefix)
       or length(new.media_path) = length(v_prefix)
       or position('/' in substr(new.media_path, length(v_prefix) + 1)) > 0
       or position('..' in new.media_path) > 0 then
      raise exception 'Video yolu bu içeriğin klasöründe olmalı' using errcode = '23514';
    end if;
  end if;

  -- (b) MEB: Reels teslimi için yüz/ad cevabı "Hayır" ve video zorunlu
  if new.kind = 'reels' and new.status = 'teslim'
     and (new.face_answer is distinct from false or new.media_path is null) then
    raise exception 'MEB: öğrenci yüzü ya da adı olan içerik teslim edilemez' using errcode = '23514';
  end if;

  -- (c) Öğretmen durumu hiç değiştirmez ve yalnız taslak|duzeltme içeriği düzenler.
  -- Teslim yalnız submitContent eylemiyle (kontrollerden sonra service_role) yapılır.
  if tg_op = 'UPDATE'
     and (select auth.uid()) is not null
     and (select auth.uid()) = old.owner_id
     and public.is_ogretmen()
     and (old.status not in ('taslak','duzeltme') or new.status is distinct from old.status) then
    raise exception 'Bu içerik şu an değiştirilemez' using errcode = '42501';
  end if;

  -- (d) Teslime geçişte zaman ve Kontrol aşaması burada damgalanır; istemcinin değeri geçersizdir.
  if new.status = 'teslim' and (tg_op = 'INSERT' or old.status is distinct from 'teslim') then
    new.submitted_at := now();
    new.stage := 'kontrol';
    new.stage_changed_at := now();
  end if;

  return new;
end $$;

revoke all on function public.content_items_guard() from public, anon, authenticated;

create trigger content_items_guard before insert or update on public.content_items
  for each row execute function public.content_items_guard();

alter table public.content_items enable row level security;

create policy sel_content_items on public.content_items for select
  using (public.is_staff() or owner_id = auth.uid());
-- Öğretmen yalnız kendi taslak/düzeltme içeriğini düzenler.
-- Teslim (submitContent), ekleme, silme, onay ve aşama değişiklikleri sunucu eylemidir (service_role).
create policy upd_content_items_owner on public.content_items for update
  using (owner_id = auth.uid() and status in ('taslak','duzeltme'))
  with check (owner_id = auth.uid() and status in ('taslak','duzeltme'));

-- Kolon yetkisi: authenticated yalnız öğretmenin doldurduğu alanları günceller; status ve submitted_at yok.
revoke all on public.content_items from anon, public, authenticated;
grant select on public.content_items to authenticated;
grant update (caption, page_fields, media_path, media_meta, face_answer, updated_at)
  on public.content_items to authenticated;
grant all on public.content_items to service_role;

-- === Organik Instagram sayıları (günlük) ===
create table public.content_organic_stats (
  content_id uuid not null references public.content_items(id) on delete cascade,
  day date not null,
  views int,
  reach int,
  saved int,
  shares int,
  total_interactions int,
  avg_watch_ms int,
  fetched_at timestamptz not null default now(),
  primary key (content_id, day)
);

alter table public.content_organic_stats enable row level security;
-- Okuma personel; yazma yalnız service_role (cron).
create policy sel_content_organic_stats on public.content_organic_stats for select using (public.is_staff());

revoke all on public.content_organic_stats from anon, public, authenticated;
grant select on public.content_organic_stats to authenticated;
grant all on public.content_organic_stats to service_role;

-- === Video kovası ===
-- Gizli; storage.objects politikası yok: yükleme ve okuma sunucunun gizli anahtarlı
-- istemcisiyle imzalanan adreslerle yapılır. Kova sınırı 200 MB (uygulama sınırı CONTENT_VIDEO_MAX_MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('icerik', 'icerik', false, 209715200, array['video/mp4','video/quicktime'])
on conflict (id) do nothing;

-- === accept_counter_offer: yalnız personel (bkz. 0002_offer_lead_guards.sql) ===
-- 0002'deki sürüm "etkin profil" yeterli sayıyordu; öğretmen de etkin profil olduğundan
-- security definer RPC RLS'i aşıp teklif üretebilirdi. Denetim is_staff()'a çekildi; gövdenin geri kalanı aynı.
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

  if not public.is_staff() then
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
