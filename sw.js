// Service worker: app shell + JS/WASM cached for offline use; pages are
// network-first so redeploys always reach the user. Model files from
// Hugging Face are NOT touched here — the ML runtimes own their caches.
const CACHE = 'offline-llm-v4';
const SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('offline-llm-') && k !== CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isModelHost(url) {
  return url.hostname.includes('huggingface.co') || url.hostname.includes('cdn-lfs');
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (isModelHost(url)) return; // runtime-owned model caches, never touch
  const isDoc = e.request.mode === 'navigate' || url.pathname.endsWith('.html');
  if (isDoc) {
    // Pages: network first (updates win), cache is the offline fallback.
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }
  // Assets (JS/WASM): cache first, populate on miss.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
