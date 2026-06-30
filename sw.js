// Service Worker v2 — 网络优先策略，有新版本立即生效
const CACHE = 'cheforder-v2';
const URLS = ['/','/index.html','/manifest.json','/config.js',
  '/js/supabase.js','/js/store.js','/js/router.js','/js/ui.js','/js/shared.js',
  '/js/chef.js','/js/customer.js','/js/orders.js','/css/style.css'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(URLS).catch(() => {}))
  );
  self.skipWaiting(); // 立即激活，不等旧 SW 释放
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim(); // 立即接管所有页面
});

// 网络优先策略：先尝试网络，失败才用缓存
self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co') || e.request.url.includes('unpkg.com') || e.request.url.includes('jsdelivr.net') || e.request.url.includes('esm.sh')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
