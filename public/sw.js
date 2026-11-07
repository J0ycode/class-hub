/*
 * Class Hub service worker.
 *
 * Kept deliberately small and conservative:
 *  - page loads are always network-first, so a running dev server is never stale
 *  - API calls and YouTube traffic are never touched
 *  - only the app icons and manifest are cached
 *  - if the network is gone, a small built-in offline page is shown
 */
const VERSION = "2";
const CACHE = `class-hub-v${VERSION}`;
const PRECACHE = ["/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline — Class Hub</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: grid; place-items: center; padding: 24px;
    background: #070b16; color: #e9eefb; text-align: center;
    font-family: "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
  }
  .card {
    max-width: 340px; padding: 28px 24px; border-radius: 16px;
    background: #111a2e; border: 1px solid #23304d;
    box-shadow: 0 18px 40px -24px rgba(0,0,0,.9);
  }
  .mark {
    width: 46px; height: 46px; margin: 0 auto 16px; border-radius: 12px;
    display: grid; place-items: center; font-weight: 700; letter-spacing: .5px;
    background: linear-gradient(140deg, #6d7cff, #8e6dff); color: #fff;
  }
  h1 { font-size: 19px; margin: 0 0 8px; }
  p { margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.55; }
  button {
    margin-top: 20px; padding: 10px 18px; border-radius: 9px; cursor: pointer;
    border: 1px solid #23304d; background: #16203a; color: #e9eefb; font-size: 14px;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="mark">CH</div>
    <h1>You&rsquo;re offline</h1>
    <p>Class Hub needs a connection to stream your classes and notes. Reconnect, then try again.</p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch {
            /* an icon missing at install time must not block the worker */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          // 502/503/504 mean the app server is not answering (gateway error,
          // crashed dev server) — the offline page is more useful than that.
          if (response.status === 502 || response.status === 503 || response.status === 504) {
            return offlineResponse();
          }
          return response;
        } catch {
          return offlineResponse();
        }
      })(),
    );
  }
});

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
