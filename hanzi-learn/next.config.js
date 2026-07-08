const { config: loadEnv } = require('dotenv');
const { resolve } = require('path');

// 加载容器内挂载的 /app/env 文件
const envPath = resolve(__dirname, 'env');
const result = loadEnv({ path: envPath });

if (result.error) {
  console.log('[env] ⚠️  /app/env 未找到或加载失败, 仅使用系统环境变量');
} else {
  const keys = Object.keys(result.parsed || {});
  console.log(`[env] ✅ 已加载 ${keys.length} 个环境变量: ${keys.join(', ')}`);
  // 打印密钥前4位用于确认（不暴露完整密钥）
  if (process.env.DEEPSEEK_API_KEY) {
    const preview = process.env.DEEPSEEK_API_KEY.slice(0, 8) + '****';
    console.log(`[env] 🔑 DEEPSEEK_API_KEY=${preview}`);
  } else {
    console.log('[env] ⚠️  DEEPSEEK_API_KEY 未设置');
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;
