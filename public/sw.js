/* Service Worker: chơi offline.
 * - Trang (HTML): ưu tiên mạng, mất mạng thì dùng bản đã lưu (luôn có COOP/COEP như lúc lưu).
 * - File còn lại (JS/CSS đã băm tên, nhân giả lập, biểu tượng): ưu tiên bản đã lưu.
 * Khi thay nhân giả lập mà giữ nguyên tên file, hãy tăng số VERSION bên dưới để xoá bản cũ.
 */
const VERSION = 'v5';
const CACHE = `retro-web-${VERSION}`;
const SCOPE = self.registration.scope;
const PRECACHE = [
  './',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'cores/mgba/mgba_libretro.js',
  'cores/mgba/mgba_libretro.wasm',
].map((p) => new URL(p, SCOPE).href);

// Nguồn nhân dự phòng (xem src/config.ts) cũng được lưu để chơi offline.
const CDN_HOSTS = ['cdn.jsdelivr.net'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Từng file một: thiếu file nào (vd. chưa có nhân) cũng không làm hỏng việc cài đặt.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            const isHtml = (res.headers.get('content-type') || '').includes('text/html');
            if (res.ok && (!isHtml || url === SCOPE)) {
              await cache.put(url, res);
            }
          } catch {
            /* bỏ qua */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) {
        if (k.startsWith('retro-web-') && k !== CACHE) await caches.delete(k);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return;
  if (req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});

async function networkFirstPage(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(new URL('./', SCOPE).href, res.clone());
    return res;
  } catch {
    return (await cache.match(new URL('./', SCOPE).href)) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  const type = res.headers.get('content-type') || '';
  // Không lưu trang HTML dự phòng của máy chủ (khi file không tồn tại).
  if (res.ok && !type.includes('text/html')) cache.put(req, res.clone());
  return res;
}
