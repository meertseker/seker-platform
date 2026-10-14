#!/bin/sh
set -eu
# busybox crond işlere ortam değişkenlerini geçirmez; gerekenleri bir dosyaya yazıp her işte okutuyoruz.
: > /app/env.sh
for v in TZ CRON_SECRET SUPABASE_DB_URL S3_BACKUP_BUCKET AWS_DEFAULT_REGION AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY HC_BACKUP_URL HC_CRON_DAILY_URL; do
  eval "val=\${$v:-}"
  val=$(printf %s "$val" | sed "s/'/'\\\\''/g")
  printf "export %s='%s'\n" "$v" "$val" >> /app/env.sh
done
chmod 600 /app/env.sh
exec crond -f -d 6
