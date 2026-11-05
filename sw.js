// Service worker: cache the app shell + JS module graph so the app opens offline.
// Model files from Hugging Face are intentionally NOT cached here —
// Transformers.js already caches them in its own Cache Storage.
const CACHE = 'offline-llm-v1';
const SHELL = ['./', './index.html', './manifest.json', './sw.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

function isModelHost(url) {
  return url.hostname.includes('huggingface.co') || url.hostname.includes('cdn-lfs');
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || isModelHost(new URL(e.request.url))) return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
