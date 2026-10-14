#!/bin/sh
# Kullanım: deploy.sh <git-sha>. Sağlık kontrolü geçmezse bir önceki etikete döner.
set -eu
SEKER_DIR="${SEKER_DIR:-/opt/seker}"
cd "$SEKER_DIR"
NEW_TAG="$1"
PREV_TAG=$(grep '^IMAGE_TAG=' .env | cut -d= -f2 || true)

set_tag() {
  if grep -q '^IMAGE_TAG=' .env; then
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" .env
  else
    printf '\nIMAGE_TAG=%s\n' "$1" >> .env
  fi
}
healthy() {
  docker compose exec -T web wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 &&
  docker compose exec -T panel wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1
}
no_prev() {
  echo "ilk dağıtım: geri dönülecek etiket yok" >&2
  exit 1
}

set_tag "$NEW_TAG"
if ! docker compose pull web panel; then
  [ -n "$PREV_TAG" ] || no_prev
  set_tag "$PREV_TAG"
  echo "imaj çekilemedi: $NEW_TAG; $PREV_TAG etiketinde kalındı" >&2
  exit 1
fi
# --build gerekli: cron imajı sunucuda ./cron'dan derlenir (crontab/backup.sh değişiklikleri).
docker compose up -d --build --remove-orphans || {
  [ -n "$PREV_TAG" ] || no_prev
  set_tag "$PREV_TAG"
  echo "compose up başarısız; $PREV_TAG etiketine dönüldü" >&2
  exit 1
}

i=0
until healthy; do
  i=$((i + 1))
  if [ "$i" -ge 12 ]; then
    echo "sağlık kontrolü 60 sn içinde geçmedi" >&2
    [ -n "$PREV_TAG" ] || no_prev
    echo "$PREV_TAG etiketine dönülüyor" >&2
    set_tag "$PREV_TAG"
    docker compose up -d --remove-orphans
    exit 1
  fi
  sleep 5
done

# Caddyfile değişiklikleri uygulansın (en iyi çaba).
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true

[ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$NEW_TAG" ] && echo "$PREV_TAG" > .previous_tag
docker image prune -af --filter "until=168h" >/dev/null
echo "yayında: $NEW_TAG"
