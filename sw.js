/* ReturnPlay — Service Worker: يعمل أوفلاين بالكامل
   عند أي تحديث للموقع غيّر رقم CACHE ليُنظف الكاش القديم تلقائيًا. */
const CACHE = 'returnplay-v2';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'data.js',
  'qrcode.min.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // صفحات وملفات الموقع نفسه: كاش أولًا ثم تحديث الكاش من الشبكة (stale-while-revalidate)
  if (url.origin === location.origin){
    e.respondWith(
      caches.match(req).then(cached => {
        const fetched = fetch(req).then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || fetched;
      })
    );
    return;
  }
  // مصادر خارجية (خطوط جوجل، pdf.js): كاش أولًا مع سقوط للشبكة
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => cached))
  );
});
