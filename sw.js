// Service Worker — 离线缓存
const CACHE = 'cheforder-v1';
const URLS = ['/','/index.html','/manifest.json','/config.js',
  '/js/supabase.js','/js/store.js','/js/router.js','/js/ui.js','/js/chef.js','/js/customer.js','/js/orders.js',
  '/css/style.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co')) return; // 不缓存 API
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
    if (res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); }
    return res;
  })));
});
