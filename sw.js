/**
 * Service worker (#15) — cache-first app shell for offline use.
 * Bump CACHE when shipping new assets to invalidate the old cache.
 */
'use strict';

const CACHE = 'dmv-kavacham-v3';
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
      .then(function(cache) { return cache.addAll(ASSETS); })
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

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).then(function(response) {
        if (response && response.ok && event.request.url.indexOf(self.location.origin) === 0) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function() { return cached; });
    })
  );
});
