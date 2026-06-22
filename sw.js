// TranziIQ Service Worker — Offline-first PWA
// © 2025 TranziIQ (Pty) Ltd. All Rights Reserved.
const CACHE = 'tiq-v4';
const FONTS = 'tiq-fonts-v1';

// Files to pre-cache on install (the whole app is one HTML file)
const PRECACHE = [
  './',
  './TranziIQ_TMS-v4.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept Supabase API calls — let them go to network
  // (the app's offline queue handles failures client-side)
  if(url.hostname.includes('supabase.co')) return;

  // Google Fonts — network first, fall back to font cache
  if(url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com')){
    e.respondWith(
      caches.open(FONTS).then(c =>
        fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; })
          .catch(() => c.match(e.request))
      )
    );
    return;
  }

  // Everything else — cache first, network fallback, update cache in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if(res && res.status === 200 && e.request.method === 'GET'){
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
