const CACHE_VERSION = "20260216_01";
const CACHE = `ai-assassins-pwa-${CACHE_VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./integrations.js?v=20260215_01",
  "./pricing.html",
  "./pricing.js?v=20260216_01",
  "./success.html",
  "./cancel.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png"
];

self.addEventListener("install", (event) => {
  console.log("[SW] install", CACHE);
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] activate", CACHE);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Network-first for navigations so HTML never stays stale.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Never cache Worker API responses.
  if (url.hostname === "ai-assassins-api.quandrix357.workers.dev") {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|svg|webmanifest|ico)$/i.test(url.pathname);

  // Stale-while-revalidate for same-origin static assets.
  if (isSameOrigin && isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
