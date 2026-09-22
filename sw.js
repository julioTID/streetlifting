/* Service worker: la app abre aunque no haya señal.
   Estrategia: sirve la copia guardada al instante y la actualiza en segundo plano.
   Las llamadas a Google Apps Script NUNCA pasan por la caché. */
const CACHE = 'sl-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(CACHE)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  if (url.origin === self.location.origin) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const cached = await c.match(req, { ignoreSearch: true });
      const network = fetch(req).then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
      if (cached) return cached;
      const r = await network;
      if (r) return r;
      if (req.mode === 'navigate') {
        const shell = await c.match('./index.html');
        if (shell) return shell;
      }
      return Response.error();
    }));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE + '-fonts').then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); c.put(req, r.clone()); return r; }
      catch (err) { return Response.error(); }
    }));
  }
});
