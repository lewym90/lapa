/* ŁAPA – service worker (praca offline).
   Po każdej zmianie plików zwiększ numer w VERSION, aby wymusić aktualizację. */
const VERSION = 'lapa-v1.10.3';
const IMG_CACHE = 'lapa-img-v1';
const IMG_MAX = 220;
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/bus.js', 'js/ui-core.js', 'js/config.js', 'js/db.js', 'js/store.js', 'js/api.js', 'js/auth.js', 'js/sync.js', 'js/ui.js', 'js/util.js', 'js/icons.js',
  'js/tekst.js', 'js/update.js', 'js/teczka.js', 'js/kto.js', 'js/czat.js', 'js/push.js', 'js/plakat.js', 'js/social.js', 'js/adopcje.js', 'js/zaginiecia.js', 'js/finanse.js', 'js/photos.js', 'js/screens-start.js', 'js/screens-psy.js', 'js/screens-spacer.js', 'js/brama.js', 'js/udzial.js', 'js/terminarz.js', 'js/dogmerge.js', 'js/screens-inne.js',
  'fonts/inter-latin.woff2', 'fonts/inter-latin-ext.woff2',
  'fonts/playfair-latin-normal.woff2', 'fonts/playfair-latin-ext-normal.woff2',
  'fonts/playfair-latin-italic.woff2', 'fonts/playfair-latin-ext-italic.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.svg', 'icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimImages() {
  const c = await caches.open(IMG_CACHE), keys = await c.keys();
  for (let i = 0; i < keys.length - IMG_MAX; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Zdjęcia psów ze strony schroniska: najpierw pamięć podręczna (działa offline), potem sieć.
  if (req.destination === 'image' && url.origin !== location.origin) {
    e.respondWith(caches.open(IMG_CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) { c.put(req, res.clone()).then(trimImages).catch(() => {}); }
        return res;
      } catch { return hit || Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return; // API i reszta: bez ingerencji

  // Nawigacja: sieć najpierw (świeża wersja), w razie braku – zapisana powłoka aplikacji.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); return res;
    }).catch(() => caches.match('index.html').then((r) => r || caches.match('./'))));
    return;
  }
  // Pliki aplikacji: sieć najpierw (żeby po aktualizacji nie było starych skryptów), w razie braku – cache.
  if (url.pathname.endsWith('/version.json')) return; // zawsze z sieci
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req)));
});

// ---------- powiadomienia z serwera ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { t: 'ŁAPA', b: e.data ? e.data.text() : '' }; }
  const n = Number(d.badge) || 0;
  const opts = { body: d.b || '', icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png', data: { url: d.url || '#/czat' } };
  if (d.tag === 'test') opts.tag = 'test';
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.t || 'ŁAPA', opts),
    (async () => { try { if ('setAppBadge' in self.navigator) { n > 0 ? await self.navigator.setAppBadge(n) : await self.navigator.clearAppBadge(); } } catch { /* odznaka nieobsługiwana */ } })()
  ]));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '#/czat';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.postMessage({ type: 'go', url }); return c.focus(); } }
    return self.clients.openWindow(self.registration.scope + url);
  }));
});
