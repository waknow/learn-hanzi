const { config: loadEnv } = require("dotenv");
const { resolve } = require("path");

// 加载容器内挂载的 /app/env 文件
const envPath = resolve(__dirname, "env");
const result = loadEnv({ path: envPath });

if (result.error) {
  console.log("[env] ⚠️  /app/env 未找到或加载失败, 仅使用系统环境变量");
} else {
  const keys = Object.keys(result.parsed || {});
  console.log(`[env] ✅ 已加载 ${keys.length} 个环境变量: ${keys.join(", ")}`);
  // 打印密钥前4位用于确认（不暴露完整密钥）
  if (process.env.DEEPSEEK_API_KEY) {
    const preview = process.env.DEEPSEEK_API_KEY.slice(0, 8) + "****";
    console.log(`[env] 🔑 DEEPSEEK_API_KEY=${preview}`);
  } else {
    console.log("[env] ⚠️  DEEPSEEK_API_KEY 未设置");
  }
}

// ===== 版本信息注入 =====
// Docker 构建由 scripts/build.sh 传入 APP_VERSION / GIT_COMMIT；
// 本地开发回退 package.json 版本（见 src/lib/version.ts）。
// 写入 env 后，客户端组件可用 process.env.APP_VERSION 读到（构建期内联）。
const pkg = require("./package.json");
const APP_VERSION = process.env.APP_VERSION || pkg.version;
const GIT_COMMIT = process.env.GIT_COMMIT || "";
console.log(`[version] 🏷️  ${APP_VERSION}${GIT_COMMIT ? ` (${GIT_COMMIT})` : ""}`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    APP_VERSION,
    GIT_COMMIT,
  },
};

module.exports = nextConfig;
