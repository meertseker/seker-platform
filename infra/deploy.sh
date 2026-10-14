#!/bin/sh
# Kullanım: deploy.sh <git-sha>. Sağlık kontrolü geçmezse bir önceki etikete döner.
set -eu
cd /opt/seker
NEW_TAG="$1"
PREV_TAG=$(grep '^IMAGE_TAG=' .env | cut -d= -f2)

set_tag() { sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" .env; }
healthy() {
  docker compose exec -T web wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 &&
  docker compose exec -T panel wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1
}

set_tag "$NEW_TAG"
if ! docker compose pull web panel; then
  set_tag "$PREV_TAG"
  echo "imaj çekilemedi: $NEW_TAG; $PREV_TAG etiketinde kalındı" >&2
  exit 1
fi
docker compose up -d --build --remove-orphans

i=0
until healthy; do
  i=$((i + 1))
  if [ "$i" -ge 12 ]; then
    echo "sağlık kontrolü 60 sn içinde geçmedi; $PREV_TAG etiketine dönülüyor" >&2
    set_tag "$PREV_TAG"
    docker compose up -d --remove-orphans
    exit 1
  fi
  sleep 5
done

[ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$NEW_TAG" ] && echo "$PREV_TAG" > .previous_tag
docker image prune -af --filter "until=168h" >/dev/null
echo "yayında: $NEW_TAG"
