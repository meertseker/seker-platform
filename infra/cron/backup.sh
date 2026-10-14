#!/bin/sh
set -eu
STAMP=$(date +%Y-%m-%dT%H%M)
FILE="/tmp/seker-$STAMP.dump"
trap 'rm -f "$FILE"' EXIT

# public = uygulama verisi, auth = kullanıcı hesapları (profiles bunlara bağlı).
# --format=custom zaten sıkıştırılmıştır ve seçerek geri yüklemeye izin verir.
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth --file="$FILE"

SIZE=$(wc -c < "$FILE")
if [ "$SIZE" -lt 10000 ]; then
  echo "backup FAILED: dosya şüpheli derecede küçük ($SIZE bayt)" >&2
  exit 1
fi

aws s3 cp "$FILE" "s3://$S3_BACKUP_BUCKET/db/$STAMP.dump" --only-show-errors

if [ -n "${HC_BACKUP_URL:-}" ]; then
  curl -fsS -m 10 "$HC_BACKUP_URL" > /dev/null
fi
echo "backup ok: db/$STAMP.dump ($SIZE bayt)"
