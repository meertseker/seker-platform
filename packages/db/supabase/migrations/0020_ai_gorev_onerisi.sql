-- 0020_ai_gorev_onerisi.sql — Görev ver ekranının AI konu önerileri.
-- Satır = (hafta, yuva). AI yalnız konu önerir; öneri görevi verenin ekranında kalır, veliye ya da reklama gitmez.
-- Okuma personel (is_staff(): yönetici + danışman); yazma yalnız service_role (sunucu, /api/ai/gorev-onerileri).
-- Okul bilgileri metni app_settings 'okul_bilgileri' anahtarındadır (tablo gerekmez; yazma mevcut write_app_settings ile yönetici).

create table public.ai_gorev_onerileri (
  -- Görevlerin açılacağı haftanın Pazartesi'si
  week_start date not null check (extract(isodow from week_start) = 1),
  slot text not null check (slot in ('reels_a','reels_b','sayfa_google','sayfa_instagram')),
  status text not null default 'hazirlaniyor' check (status in ('hazirlaniyor','hazir','hata')),
  -- [{ "baslik": …, "aciklama": …, "dayanak": … }] — en çok 3
  suggestions jsonb not null default '[]'::jsonb check (jsonb_typeof(suggestions) = 'array'),
  model text,
  -- Kısa hata nedeni (kişisel veri içermez)
  error text,
  generated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (week_start, slot)
);

alter table public.ai_gorev_onerileri enable row level security;

create policy sel_ai_gorev_onerileri on public.ai_gorev_onerileri for select using (public.is_staff());

revoke all on public.ai_gorev_onerileri from anon, public, authenticated;
grant select on public.ai_gorev_onerileri to authenticated;
grant all on public.ai_gorev_onerileri to service_role;
