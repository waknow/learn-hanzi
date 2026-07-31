# ===== 构建阶段 =====
FROM node:20-alpine AS builder

# 版本信息（由 scripts/build.sh 传入；手动构建时缺省为 0.0.0-dev）
ARG APP_VERSION=0.0.0-dev
ARG GIT_COMMIT=unknown

WORKDIR /app

# 1. 先装依赖（利用 Docker 缓存）
COPY package.json package-lock.json ./
RUN npm ci

# 2. 复制源码并构建
COPY . .
# 将版本信息写入 public/version.json，应用可读取展示
RUN echo "{\"version\":\"${APP_VERSION}\",\"commit\":\"${GIT_COMMIT}\"}" > public/version.json
RUN npm run build

# ===== 运行阶段 =====
FROM node:20-alpine AS runner

# 版本信息（镜像元数据 + 运行时环境变量）
ARG APP_VERSION=0.0.0-dev
ARG GIT_COMMIT=unknown
ENV APP_VERSION="${APP_VERSION}"
ENV GIT_COMMIT="${GIT_COMMIT}"

LABEL org.opencontainers.image.title="hanzi-learn" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.description="快乐识字 - 儿童汉字学习应用"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# 只复制运行时需要的文件
COPY --from=builder /app/.next       ./.next
COPY --from=builder /app/public      ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.js ./

EXPOSE 3000

# 使用 npx --no-install 强制用本地 next，避免 npx 下载新版
CMD ["npx", "--no-install", "next", "start", "--hostname", "0.0.0.0"]
