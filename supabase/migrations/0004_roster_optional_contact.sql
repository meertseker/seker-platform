-- Roster'ı "okulun kaldığı yerden devam etmesi" için esnetiyoruz: telefon, program
-- ve veli adı artık SONRADAN doldurulabilir alanlar. Amaç, okulun mevcut öğrenci
-- listesini (iletişim/program bilgisi henüz tam olmasa bile) sisteme girip oradan
-- yönetebilmesi. Sistem WhatsApp/Excel'i replace etmiyor; kaldıkları yerden devam
-- etmelerini sağlıyor — bu yüzden eksik alan kaydı bloke etmemeli.
--
-- program CHECK kısıtı korunur; NULL değerler CHECK'i (bilinmeyen) sağlar, yani
-- program boş bırakılabilir ama dolduğunda yine geçerli enum olmak zorundadır.
alter table public.students alter column phone drop not null;
alter table public.students alter column program drop not null;
alter table public.students alter column parent_name drop not null;
