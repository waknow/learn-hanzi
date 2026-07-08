#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE_TAG="${1:-hanzi-learn}"
OUTPUT="hanzi-learn-image.tar"

PROXY="${HTTP_PROXY:-http://host.docker.internal:7890}"

echo "=== 构建镜像 ($IMAGE_TAG) ==="
docker build \
  --build-arg HTTP_PROXY="$PROXY" \
  --build-arg HTTPS_PROXY="$PROXY" \
  --platform linux/amd64 \
  -t "$IMAGE_TAG" \
  .

echo ""
echo "=== 导出镜像 → $OUTPUT ==="
docker save -o "$OUTPUT" "$IMAGE_TAG"
echo "完成: $(ls -lh "$OUTPUT" | awk '{print $5}')"
