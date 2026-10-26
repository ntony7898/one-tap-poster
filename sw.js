const C = 'one-tap-poster-v2';
const A = ['./', 'index.html', 'style.css', 'poster.js', 'api.js', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  ...['Anton', 'ArchivoBlack', 'SpaceGrotesk', 'BebasNeue', 'DMSerifDisplay', 'SpaceMono', 'Syne', 'Unbounded', 'PirataOne', 'Monoton'].map(f => `fonts/${f}.woff2`)];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(A)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url), fresh = r.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(u.pathname) || u.pathname.endsWith('/');
  if (fresh) e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r, { ignoreSearch: true })));
  else e.respondWith(caches.match(r).then(m => m || fetch(r)));
});
