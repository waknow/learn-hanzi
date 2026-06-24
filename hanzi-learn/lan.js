#!/usr/bin/env node
/**
 * 局域网访问入口
 * 启动后在同一 WiFi 下的设备（iPad/手机）可通过 http://<本机IP>:3000 访问
 */
const { execSync } = require('child_process');
const os = require('os');

// 获取局域网 IP
const ifaces = os.networkInterfaces();
let lanIP = '127.0.0.1';
Object.keys(ifaces).forEach((name) => {
  ifaces[name].forEach((iface) => {
    if (iface.family === 'IPv4' && !iface.internal) {
      lanIP = iface.address;
    }
  });
});

const PORT = process.env.PORT || 3000;

console.log('');
console.log('  🎈  快乐识字  —  局域网访问');
console.log('  ─────────────────────────────');
console.log(`  本机:    http://localhost:${PORT}`);
console.log(`  局域网:  http://${lanIP}:${PORT}`);
console.log('');
console.log('  在同一 WiFi 下的 iPad/手机浏览器打开上方局域网地址即可');
console.log('  如需在 iPad 上全屏运行，用 Safari 打开后：');
console.log('  分享按钮 → 添加到主屏幕');
console.log('');

execSync(`npx next start --hostname 0.0.0.0 --port ${PORT}`, {
  stdio: 'inherit',
  cwd: __dirname,
});
