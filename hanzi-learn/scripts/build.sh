#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# ===== 用法 =====
#   bash scripts/build.sh                    # 版本自动取自最近 git tag / package.json
#   bash scripts/build.sh hanzi-learn        # 指定镜像名（默认 hanzi-learn）
#   bash scripts/build.sh hanzi-learn 1.2.0  # 显式指定版本号
IMAGE_NAME="${1:-hanzi-learn}"
VERSION="${2:-}"

# ---- 解析版本号（优先级: 显式参数 > 最近 git tag > package.json）----
if [ -z "$VERSION" ]; then
  # 优先取最近的 git tag（如 v1.0.0 → 1.0.0）
  GIT_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
  if [ -n "$GIT_TAG" ]; then
    VERSION="${GIT_TAG#v}"
  else
    # 无 tag 时回退 package.json 版本
    VERSION="$(node -p "require('./package.json').version")"
  fi
fi

# 去掉可能的 v 前缀，保证镜像 tag / 文件名统一
VERSION="${VERSION#v}"

# git commit 短哈希，便于追溯
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

OUTPUT="hanzi-learn-image-${VERSION}.tar"
PROXY="${HTTP_PROXY:-http://host.docker.internal:7890}"

echo "=== 构建镜像 ($IMAGE_NAME:$VERSION, commit $GIT_COMMIT) ==="
docker build \
  --build-arg HTTP_PROXY="$PROXY" \
  --build-arg HTTPS_PROXY="$PROXY" \
  --build-arg APP_VERSION="$VERSION" \
  --build-arg GIT_COMMIT="$GIT_COMMIT" \
  --platform linux/amd64 \
  -t "$IMAGE_NAME:$VERSION" \
  -t "$IMAGE_NAME:latest" \
  .

echo ""
echo "=== 导出镜像 → $OUTPUT ==="
docker save -o "$OUTPUT" "$IMAGE_NAME:$VERSION"
echo "完成: $(ls -lh "$OUTPUT" | awk '{print $5}')"
echo "版本: $VERSION (commit $GIT_COMMIT)"
