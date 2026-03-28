const CACHE_NAME = 'canteen-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './student.html',
  './css/style.css',
  './js/api.js',
  './js/student.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', event => {
  // Only cache GET requests (don't cache API POSTs)
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
