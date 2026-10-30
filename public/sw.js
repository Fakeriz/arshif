// Arshif service worker — offline support.
// Install: precache the app shell. Navigation: network-first, cache fallback.
// Next.js assets: cache-first (filenames are hashed). Other assets:
// stale-while-revalidate. API: always network-only.

const VERSION = 'arshif-v11';

// Separate cache for Web Share Target images so they survive SW version bumps.
const SHARE_CACHE = 'arshif-share-v1';
const SHARE_KEY = '/__arshif_shared_receipt__';

const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION && k !== SHARE_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isCacheableResponse(response, expectedType) {
  if (!response || response.status !== 200 || response.type === 'opaque') return false;
  if (expectedType && !response.headers.get('content-type')?.toLowerCase().startsWith(expectedType)) return false;
  return true;
}

function putInCache(request, response, expectedType) {
  if (!isCacheableResponse(response, expectedType)) return;
  const copy = response.clone();
  caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
}

async function handleShareTarget(request) {
  try {
    const form = await request.formData();
    let file = form.get('receipt');
    // Fallback: kalau field 'receipt' kosong, ambil file gambar apapun yang ada.
    if (!(file && typeof file !== 'string' && file.size > 0)) {
      for (const [, value] of form.entries()) {
        if (value && typeof value !== 'string' && value.size > 0 &&
            String(value.type || '').startsWith('image/')) {
          file = value;
          break;
        }
      }
    }
    if (file && file.size > 0 && file.size <= 25 * 1024 * 1024) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        SHARE_KEY,
        new Response(file, {
          headers: { 'Content-Type': file.type || 'image/jpeg' },
        })
      );
    }
  } catch (e) {
    // Abaikan: page.js akan membuka sheet scan kosong sebagai fallback.
  }
  // Halaman perantara: Chrome menampilkan response POST tapi tidak mengikuti
  // redirect 303 dengan benar, jadi kita redirect sendiri via JavaScript
  // (instant) ke aplikasi dengan flag ?sharedReceipt=1.
  const bridgeHtml = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#09090b"><title>Arshif</title>
<script>location.replace("/?sharedReceipt=1");</script></head>
<body style="margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#09090b;color:#fff;font-family:system-ui,sans-serif;gap:12px">
<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="4" y="4" width="40" height="40" rx="12" stroke="#fff" stroke-width="3"/><path d="M17 30V18h8a6 6 0 0 1 0 12h-8" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>
<p style="margin:0;font-size:15px;opacity:.85">Menerima gambar struk&hellip;</p>
<noscript><a href="/?sharedReceipt=1" style="color:#fff">Buka Arshif</a></noscript>
</body></html>`;
  return new Response(bridgeHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Web Share Target: intercept POST /share in the service worker.
  // The image is read on-device and stored in Cache Storage, so it never hits
  // the serverless upload limit. The bridge page self-redirects to
  // /?sharedReceipt=1 because Chrome ignores a 303 from a service worker.
  if (
    request.method === 'POST' &&
    url.origin === self.location.origin &&
    url.pathname === '/share'
  ) {
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // API: network-only

  // Navigations are network-first. Preserve route responses and use an explicit
  // offline document rather than showing the home page for every failed route.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (isCacheableResponse(res, 'text/html')) putInCache(request, res, 'text/html');
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/offline.html')))
    );
    return;
  }

  // Static Next.js assets use cache-first retrieval.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            putInCache(request, res);
            return res;
          })
      )
    );
    return;
  }

  // 3. Sisanya -> stale-while-revalidate
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          putInCache(request, res);
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});

// Service worker lifecycle
// Web Push Notifications
// Service worker lifecycle

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    try { data = { body: event.data ? event.data.text() : '' } } catch {}
  }

  const title = data.title || 'Arshif'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    data: data.data || {},
    tag: (data.data && data.data.type ? 'arshif-' + data.data.type + '-' : 'arshif-') + Date.now(),
    renotify: false,
    silent: false,
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const action = (event.notification.data && event.notification.data.action) || 'notifications'
  // Petakan action ke tab/sheet yang sesuai
  let url = '/'
  if (action === 'bills') url = '/?tab=bills'
  else if (action === 'goals') url = '/?tab=goals'
  else if (action === 'notifications') url = '/?sheet=notifications'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Fokus ke tab yang sudah terbuka kalau ada
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Kalau tidak ada, buka baru
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
});
