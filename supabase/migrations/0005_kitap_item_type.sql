-- "Kitap-Kırtasiye" kalem türü: aidat Excel'indeki KİTAP-KIRTASİYE ücreti daha önce
-- 'diger' (Diğer) olarak tutuluyordu ve kullanıcı için anlamsızdı. Kendi türünü veriyoruz.
alter table public.payment_plans drop constraint payment_plans_item_type_check;
alter table public.payment_plans add constraint payment_plans_item_type_check
  check (item_type in ('aidat','kayit_ucreti','servis','yemek','kitap','diger'));
