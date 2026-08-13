/**
 * 快乐识字 · Service Worker（应用壳离线缓存）
 *
 * 策略：
 * - 导航请求（HTML）：网络优先，失败回退缓存（离线时打开已访问过的页面）
 * - 静态资源（/_next/、图标、manifest）：缓存优先，网络更新
 *
 * 注意：AI 句子生成需要网络；离线时页面仍可打开（AI 请求失败走内置 fallback）。
 */
const CACHE_NAME = "hanzi-shell-v1";

// 安装时预缓存的核心资源（首次访问后即离线可用）
const CORE_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 导航请求：网络优先，失败回退缓存
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 缓存最新页面（下次离线可用）
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // 静态资源：缓存优先，网络未命中时更新缓存
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (
          response.ok &&
          (url.pathname.startsWith("/_next/") ||
            url.pathname.startsWith("/icon") ||
            url.pathname === "/manifest.json")
        ) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
