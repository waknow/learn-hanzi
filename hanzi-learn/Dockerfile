# ===== 构建阶段 =====
FROM node:20-alpine AS builder

WORKDIR /app

# 1. 先装依赖（利用 Docker 缓存）
COPY package.json package-lock.json ./
RUN npm ci

# 2. 复制源码并构建
COPY . .
RUN npm run build

# ===== 运行阶段 =====
FROM node:20-alpine AS runner

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
