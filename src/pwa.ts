export const pwaAppName = "Codex";
export const pwaThemeColorDark = "#0d1117";
export const pwaThemeColorLight = "#ffffff";
export const pwaStaticAssets = [
  "/static/pwa/apple-touch-icon.png",
  "/static/pwa/icon-192.png",
  "/static/pwa/icon-512.png",
] as const;

export function renderPwaHeadTags(): string {
  return [
    `<meta name="theme-color" content="${pwaThemeColorDark}" />`,
    '<link rel="manifest" href="/manifest.json" />',
    '<link rel="apple-touch-icon" href="/static/pwa/apple-touch-icon.png" />',
    `<meta name="apple-mobile-web-app-capable" content="yes" />`,
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    `<meta name="apple-mobile-web-app-title" content="${pwaAppName}" />`,
  ].join("\n    ");
}

export function renderPwaRegisterScript(): string {
  return `<script>
    (function () {
      if (!("serviceWorker" in navigator)) {
        return;
      }

      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").catch(function (error) {
          console.warn("[pwa] service worker registration failed", error);
        });
      }, { once: true });
    })();
  </script>`;
}

export function renderManifest(): Record<string, unknown> {
  return {
    name: pwaAppName,
    short_name: pwaAppName,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: pwaThemeColorDark,
    theme_color: pwaThemeColorDark,
    icons: [
      {
        src: "/static/pwa/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/static/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/static/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

export function renderServiceWorker(): string {
  return `const CACHE_NAME = "codex-vs-ext-web-v1";
const SHELL_ASSETS = ${JSON.stringify(["/manifest.json", ...pwaStaticAssets])};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (!SHELL_ASSETS.includes(url.pathname)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});`;
}
