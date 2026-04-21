const CACHE_NAME = "stegofy-v3";

// URLs that must NEVER be cached — always hit the network directly
const BYPASS_PATTERNS = [
  "supabase.co",
  "/auth/v1/",
  "/rest/v1/",
  "/storage/v1/",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // BYPASS: Never intercept Supabase or auth requests
  const shouldBypass = BYPASS_PATTERNS.some((pattern) => url.includes(pattern));
  if (shouldBypass) return;

  // BYPASS: Only handle GET requests
  if (event.request.method !== "GET") return;

  // NAVIGATION requests (HTML page loads): always use network-first so the
  // browser always receives the latest HTML and JS bundle, never stale cache.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/") || fetch("/")),
    );
    return;
  }

  // Static assets with content-hashed filenames: cache-first is safe because
  // the filename changes when the content changes (Vite adds hashes).
  const isHashedAsset = /\/assets\/[^/]+\.[a-f0-9]{8,}\.(js|css|woff2?|png|svg|jpg|webp)/.test(url);
  if (isHashedAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Everything else: network-first (manifests, icons, etc.)
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
