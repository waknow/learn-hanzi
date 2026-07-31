#!/usr/bin/env bash
set -euo pipefail

# ===== 版本打 tag 脚本 =====
# 用法:
#   bash scripts/tag.sh              # 基于 package.json 版本自动 +1 patch
#   bash scripts/tag.sh 1.2.0        # 指定版本
#   bash scripts/tag.sh 1.2.0 -m 说明  # 指定版本 + tag 注释
cd "$(dirname "$0")/.."

VERSION="${1:-}"
MESSAGE=""

if [ "${2:-}" = "-m" ]; then
  MESSAGE="${3:-}"
fi

# 未指定版本时，基于 package.json 版本自动递增 patch
if [ -z "$VERSION" ]; then
  CURRENT="$(node -p "require('./package.json').version")"
  VERSION="$(echo "$CURRENT" | awk -F. '{printf "%d.%d.%d", $1, $2, $3+1}')"
  echo "→ 未指定版本，基于 $CURRENT 自动递增为 $VERSION"
fi

# 规范化版本号（统一为 vX.Y.Z）
VERSION="${VERSION#v}"
TAG="v${VERSION}"

# 检查 tag 是否已存在
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "错误: tag $TAG 已存在" >&2
  exit 1
fi

# 同步 package.json 版本（如不一致）
PKG_VERSION="$(node -p "require('./package.json').version")"
if [ "$PKG_VERSION" != "$VERSION" ]; then
  echo "→ 同步 package.json 版本: $PKG_VERSION → $VERSION"
  npm version "$VERSION" --no-git-tag-version
fi

# 创建 annotated tag
git tag -a "$TAG" -m "${MESSAGE:-release $TAG}"

echo "✔ 已创建 tag: $TAG"
git log -1 --oneline
