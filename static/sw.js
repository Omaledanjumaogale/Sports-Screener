/* PulseOdds service worker — installable PWA shell.
 * Strategy:
 *  - Install: precache the app shell (index, manifest, icons).
 *  - Fetch navigations: network-first (fresh SvelteKit build wins), falling
 *    back to the cached shell when offline.
 *  - Fetch static assets (/_app/): stale-while-revalidate for speed.
 *  - Everything else (API, Convex, fonts, images): network only.
 */
const CACHE = 'pulseodds-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // Shell misses must never block install.
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // Never intercept POST/PUT/DELETE/OPTIONS.

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // CDN/API/Convex → network.

  // SvelteKit hashed assets: stale-while-revalidate.
  if (url.pathname.startsWith('/_app/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, clone));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Navigations: network-first, cached shell fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Other same-origin static (robots, llms, icons): cache-first, network refresh.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
