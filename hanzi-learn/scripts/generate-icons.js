#!/usr/bin/env node
/**
 * 生成 PWA 图标（零依赖，纯 Node 实现）
 *
 * 产物（写入 public/）：
 *   icon-192.png          192×192  （manifest 主图标）
 *   icon-512.png          512×512  （manifest 大图标）
 *   apple-touch-icon.png  180×180  （iOS 主屏图标）
 *
 * 设计：糖果粉（#FF6B9D）圆角方块 + 白色圆点（模拟"泡泡"，无需字体渲染）。
 * 用法：node scripts/generate-icons.js
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ---- CRC32（PNG chunk 校验用）----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** 编码一张 RGBA PNG：圆角方块底 + 居中白色圆点 */
function encodePng(size, bg, dotRadius, cornerRadius) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  const [br, bgG, bgB] = bg;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const o = rowStart + 1 + x * 4;

      // 圆角方块遮罩
      const rx = Math.min(x, size - 1 - x);
      const ry = Math.min(y, size - 1 - y);
      const inCorner = rx < cornerRadius && ry < cornerRadius;
      const inRoundRect =
        !inCorner || Math.hypot(cornerRadius - rx, cornerRadius - ry) <= cornerRadius;

      // 居中白色圆点
      const dx = x - size / 2 + 0.5;
      const dy = y - size / 2 + 0.5;
      const inDot = Math.hypot(dx, dy) <= dotRadius;

      let r = br;
      let g = bgG;
      let b = bgB;
      let a = 255;
      if (!inRoundRect) {
        a = 0;
      } else if (inDot) {
        r = 255;
        g = 255;
        b = 255;
      }
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "..", "public");
fs.mkdirSync(outDir, { recursive: true });

const PINK = [0xff, 0x6b, 0x9d];
// [文件名, 尺寸, 圆点半径比例, 圆角比例]
const targets = [
  ["icon-192.png", 192, 0.3, 0.22],
  ["icon-512.png", 512, 0.3, 0.22],
  ["apple-touch-icon.png", 180, 0.3, 0.22],
];

for (const [name, size, dotR, cornerR] of targets) {
  const png = encodePng(size, PINK, size * dotR, size * cornerR);
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(`✔ ${name} (${size}×${size}, ${png.length} bytes)`);
}
console.log("完成：图标已写入 public/");
