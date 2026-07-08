-- Lokal geliştirme kullanıcıları (şifreler yalnızca lokal!)
insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, email_change_token_current,
  recovery_token, phone_change, phone_change_token
)
values
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','yonetici@test.local', crypt('sifre123', gen_salt('bf')), now(), 'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','danisman@test.local', crypt('sifre123', gen_salt('bf')), now(), 'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','{"sub":"00000000-0000-0000-0000-000000000001","email":"yonetici@test.local"}','email',now(),now(),now()),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','{"sub":"00000000-0000-0000-0000-000000000002","email":"danisman@test.local"}','email',now(),now(),now());

insert into public.profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-000000000001','Mehtap Hanım (Test)','yonetici'),
  ('00000000-0000-0000-0000-000000000002','Danışman (Test)','danisman');

insert into public.price_lists (id, season, is_active) values
  ('00000000-0000-0000-0000-00000000000a','2026-2027', true);
insert into public.price_list_items (price_list_id, program, monthly_fee, registration_fee) values
  ('00000000-0000-0000-0000-00000000000a','tam_gun', 22000, 5000),
  ('00000000-0000-0000-0000-00000000000a','yarim_gun', 17000, 5000),
  ('00000000-0000-0000-0000-00000000000a','uc_gun', 15000, 5000),
  ('00000000-0000-0000-0000-00000000000a','play_grup', 13000, 5000);
