/* sw.js — WTD PWA Service Worker (cache + iOS web push)
   Put this file next to index.html (site root for GitHub Pages project).
*/

const VERSION = "wtd-sw-v1";
const CACHE_NAME = `${VERSION}-cache`;

// Add/remove files as you like. Keep it small to avoid stale-cache headaches.
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// --- Install: pre-cache core assets ---
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(PRECACHE_URLS);
    } catch (e) {
      // If one of the files is missing, don't fail the whole install.
      // (e.g., you haven't added icons yet)
    }
    await self.skipWaiting();
  })());
});

// --- Activate: clean old caches ---
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// --- Fetch: network-first for HTML, cache-first for static assets ---
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  const accept = req.headers.get("accept") || "";
  const isHTML =
    req.mode === "navigate" ||
    accept.includes("text/html") ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith(".html");

  // Network-first for HTML (so updates show up), fallback to cache.
  if (isHTML) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match("./index.html") || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Cache-first for everything else (icons, manifest, css/js if you add them later).
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return new Response("Offline", { status: 503 });
    }
  })());
});

// --- Push: show a notification ---
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch {
      // Some senders deliver plain text
      try { data = { body: event.data.text() }; } catch {}
    }

    const title = data.title || "WTD Alert";
    const body = data.body || "Open WTD for details.";
    const targetUrl = data.url || "./";

    const options = {
      body,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      // You can add tag/renotify for deduping:
      // tag: "wtd-alert",
      // renotify: true,
      data: { url: targetUrl }
    };

    await self.registration.showNotification(title, options);
  })());
});

// --- Notification click: focus existing app tab or open it ---
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil((async () => {
    const url = (event.notification.data && event.notification.data.url) || "./";

    // Prefer focusing an existing client
    const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientList) {
      // If your app can be served from multiple paths, loosen this match
      if (client.url && client.url.startsWith(self.location.origin)) {
        await client.focus();
        // Optionally navigate:
        // client.navigate(url);
        return;
      }
    }
    await clients.openWindow(url);
  })());
});
