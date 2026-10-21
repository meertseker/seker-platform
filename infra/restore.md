# Veritabanı geri yükleme denemesi

Amaç: S3'teki gece yedeğinin gerçekten geri yüklenebildiğini kanıtlamak. Üretim veritabanına
**asla** geri yükleme yapılmaz; hedef her zaman yerel Supabase'tir.

1. Üretimdeki satır sayılarını not et (Supabase SQL Editor):
   `select (select count(*) from students) s, (select count(*) from leads) l, (select count(*) from installments) i, (select count(*) from auth.users) u;`
2. Son yedeği indir (yönetici AWS hesabıyla; yedek kullanıcısının okuma izni yoktur):
   `aws s3 ls s3://sekeranaokulu-backup/db/ | tail -3`
   `aws s3 cp s3://sekeranaokulu-backup/db/<en-son>.dump ./restore.dump`
3. Temiz yerel veritabanı: `cd packages/db && npx supabase db reset --no-seed`
4. Önce hesaplar, sonra uygulama verisi:
   `pg_restore --dbname=postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres --data-only --schema=auth --table=users --table=identities --disable-triggers ./restore.dump`
   `pg_restore --dbname=postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres --clean --if-exists --no-owner --schema=public ./restore.dump`
5. Aynı sayım sorgusunu yerelde çalıştır (`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`).
   Dört sayı 1. adımdakiyle aynı olmalı (yedek gece alındığı için gün içinde eklenenler kadar az olabilir).
6. Paneli yerel veritabanıyla aç (`pnpm --filter @seker/panel dev`) ve bir öğrencinin ödeme ızgarasını kontrol et.
7. Sonucu ve tarihi bu dosyanın sonundaki tabloya yaz. Yerel veriyi sil: `npx supabase db reset`.

Not: 4. adımdaki `pg_restore` sürümü yedekteki pg_dump sürümünden düşük olamaz; yerelde 17 yoksa
`docker run --rm -v "$PWD:/w" --network host seker-cron:local pg_restore …` ile konteynerden çalıştır.

| Tarih | Yedek dosyası | Sayılar eşleşti mi | Yapan |
|---|---|---|---|
| 2026-10-21 | sunucuda backup.sh ile aynı pg_dump (S3 dosyası değil; yönetici AWS girişi süresi dolmuştu) → yerel ayrı `restore_test` veritabanı | Evet: öğrenci 62, aday 3, taksit 696, kullanıcı 5, olay 152, tahsilat 6.126.015, site içeriği 31 | koordinatör |

Gizli ayarlar: `/opt/seker/.env`'nin SSE şifreli kopyası `s3://sekeranaokulu-backup/db/env-YYYY-MM-DD.env` (yedek kullanıcısı yalnız `db/` altına yazabilir). Ayar değişince yenilenir:
`cat .env | docker exec -i seker-cron-1 sh -c '. /app/env.sh; aws s3 cp - s3://$S3_BACKUP_BUCKET/db/env-$(date +%F).env --sse AES256'`
