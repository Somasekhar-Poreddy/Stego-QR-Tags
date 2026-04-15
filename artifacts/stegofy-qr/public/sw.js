const CACHE_NAME = "stegofy-v2";
const STATIC_ASSETS = ["/", "/app", "/manifest.json"];

// URLs that must NEVER be cached — always hit the network directly
const BYPASS_PATTERNS = [
  "supabase.co", // all Supabase API + auth calls
  "/auth/v1/", // Supabase auth endpoints
  "/rest/v1/", // Supabase database endpoints
  "/storage/v1/", // Supabase storage
  "admin/login",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
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

  // BYPASS: Never intercept Supabase or auth requests — always go to network
  const shouldBypass = BYPASS_PATTERNS.some((pattern) => url.includes(pattern));
  if (shouldBypass) return; // no respondWith = browser handles normally

  // BYPASS: Only cache GET requests for static assets
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          if (
            response &&
            response.status === 200 &&
            response.type === "basic"
          ) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      );
    }),
  );
});
