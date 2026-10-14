#!/bin/sh
# Elle geri dönüş: bir önceki başarılı etikete geçer.
set -eu
cd /opt/seker
[ -s .previous_tag ] || { echo "önceki etiket yok (.previous_tag)" >&2; exit 1; }
PREV_TAG=$(cat .previous_tag)
exec /opt/seker/deploy.sh "$PREV_TAG"
