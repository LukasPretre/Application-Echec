// Offline support: stale-while-revalidate for every file of the app.
const CACHE = 'echecs-coach-v1';
const CORE = ['./', 'index.html', 'css/style.css', 'css/pieces.css', 'js/app.js', 'js/util.js', 'js/board.js', 'js/engine.js', 'js/coach.js', 'js/lib/chess.js',
  'js/views/play.js', 'js/views/review.js', 'js/views/puzzles.js', 'js/views/lessons.js', 'js/views/openings.js', 'js/views/analysis.js',
  'js/data/lessons.js', 'js/data/openings.js', 'js/data/puzzles.js', 'engine/stockfish-19-lite-single.js', 'engine/stockfish-19-lite-single.wasm',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
