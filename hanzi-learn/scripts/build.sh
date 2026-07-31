#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# ===== 用法 =====
#   bash scripts/build.sh                     # 版本取自最近 git tag（要求 HEAD 与 tag 一致）
#   bash scripts/build.sh hanzi-learn         # 指定镜像名（默认 hanzi-learn）
#   bash scripts/build.sh hanzi-learn 1.2.0   # 显式指定版本（跳过一致性校验）
#   ALLOW_DIRTY=1 bash scripts/build.sh       # HEAD 超前 tag 时强制构建，版本自动附加 commit 距离
IMAGE_NAME="${1:-hanzi-learn}"
EXPLICIT_VERSION="${2:-}"
ALLOW_DIRTY="${ALLOW_DIRTY:-0}"

# git commit 短哈希，便于追溯
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

# ---- 解析版本号（优先级: 显式参数 > 最近 git tag > package.json）----
VERSION="$EXPLICIT_VERSION"
if [ -z "$VERSION" ]; then
  GIT_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
  if [ -n "$GIT_TAG" ]; then
    VERSION="${GIT_TAG#v}"

    # ---- 一致性校验：HEAD 必须与最近 tag 指向的 commit 一致 ----
    # 注意：annotated tag 用 rev-parse 直接取到的是 tag 对象哈希，需 ^{commit} 取真实 commit
    TAG_COMMIT="$(git rev-parse --short "$GIT_TAG^{commit}" 2>/dev/null || true)"
    if [ -n "$TAG_COMMIT" ] && [ "$TAG_COMMIT" != "$GIT_COMMIT" ]; then
      if [ "$ALLOW_DIRTY" = "1" ]; then
        # 强制构建：版本改为 git describe 风格（含 commit 距离与哈希），保证版本↔commit 唯一对应
        VERSION="$(git describe --tags 2>/dev/null | sed 's/^v//')"
        echo "⚠ 强制构建：HEAD 超前 tag $GIT_TAG，版本调整为 $VERSION"
      else
        echo "错误: 当前 HEAD ($GIT_COMMIT) 与最近 tag $GIT_TAG ($TAG_COMMIT) 不一致" >&2
        echo "" >&2
        echo "可能原因: 打 tag 之后又有新提交，版本号已不准确。" >&2
        echo "解决方式:" >&2
        echo "  1) 为当前代码打新 tag 后再构建: bash scripts/tag.sh   （推荐）" >&2
        echo "  2) 显式指定版本构建: bash scripts/build.sh $IMAGE_NAME <版本号>" >&2
        echo "  3) 强制构建（版本自动附加 commit 距离，如 1.0.0-1-g779accd）:" >&2
        echo "     ALLOW_DIRTY=1 bash scripts/build.sh" >&2
        exit 1
      fi
    fi
  else
    # 无 tag 时回退 package.json 版本
    VERSION="$(node -p "require('./package.json').version")"
  fi
fi

# 去掉可能的 v 前缀，保证镜像 tag / 文件名统一
VERSION="${VERSION#v}"

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
