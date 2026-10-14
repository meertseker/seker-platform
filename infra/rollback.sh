#!/bin/sh
# Elle geri dönüş: bir önceki başarılı etikete geçer.
set -eu
cd /opt/seker
PREV_TAG=$(cat .previous_tag)
exec /opt/seker/deploy.sh "$PREV_TAG"
