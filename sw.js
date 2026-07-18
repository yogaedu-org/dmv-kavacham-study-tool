/**
 * Service worker (#15, hardened #27) — resilient offline app shell.
 *
 * Strategy:
 *  - Navigations (the HTML page): NETWORK-FIRST — always the freshest page when
 *    online, cached fallback (then index.html) when offline. This prevents a
 *    returning visitor being stuck on a stale/half-updated shell.
 *  - Other assets (js/css/json/font/icons): cache-first for speed/offline.
 *  - Precache is TOLERANT: one unavailable asset during a deploy can't abort the
 *    whole SW update (Promise.allSettled, not the atomic cache.addAll).
 *
 * Bump CACHE when shipping new assets.
 */
'use strict';

const CACHE = 'dmv-kavacham-v5';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './config.json',
  './data/verses.json',
  './i18n/en.json',
  './i18n/ne.json',
  './i18n/es.json',
  './fonts/NotoSerifDevanagari.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE)
      // Tolerant: a single failed asset must not abort the update.
      .then(function(cache) {
        return Promise.allSettled(ASSETS.map(function(a) { return cache.add(a); }));
      })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; })
        .map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

function isNavigation(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').indexOf('text/html') !== -1;
}

self.addEventListener('fetch', function(event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  // Network-first for the page itself: freshest when online, graceful offline.
  if (isNavigation(request)) {
    event.respondWith(
      fetch(request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE).then(function(cache) { cache.put(request, clone); });
        return response;
      }).catch(function() {
        return caches.match(request).then(function(cached) {
          return cached || caches.match('./index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  // Cache-first for everything else.
  event.respondWith(
    caches.match(request).then(function(cached) {
      return cached || fetch(request).then(function(response) {
        if (response && response.ok && request.url.indexOf(self.location.origin) === 0) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(request, clone); });
        }
        return response;
      }).catch(function() { return cached; });
    })
  );
});
