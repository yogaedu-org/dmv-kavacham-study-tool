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

const CACHE = 'dmv-kavacham-v12';
// Downloaded verse audio (a later offline-download feature, #56) lives in caches named 'dmv-audio-<set>@<version>'.
// The cleanup below must never delete them, so an app update does not erase a reader's offline audio.
const AUDIO_CACHE_PREFIX = 'dmv-audio-';
const ASSETS = [
  './',
  './index.html',
  './js/main.js',
  './js/state.js',
  './js/util.js',
  './js/config.js',
  './js/i18n.js',
  './js/controls.js',
  './js/filters.js',
  './js/render.js',
  './js/audio.js',
  './js/audio-source.js',
  './styles.css',
  './figures/body-head.webp',
  './figures/body-face.webp',
  './figures/body-neck.webp',
  './figures/body-chest.webp',
  './figures/body-hands.webp',
  './figures/body-belly.webp',
  './figures/body-back.webp',
  './figures/body-hips.webp',
  './figures/body-legs.webp',
  './figures/body-feet.webp',
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
      return Promise.all(keys.filter(function(k) { return k !== CACHE && k.indexOf(AUDIO_CACHE_PREFIX) !== 0; })
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

  // Media range requests (audio seeking/streaming) go straight to the network: a cached whole file (a 200) must never
  // answer a range request, which expects a 206 slice (#56).
  if (request.headers.has('range')) return;

  // Recitation-set data (sets/index.json + manifests, hosted with the audio) is NETWORK-FIRST: a new set appears without a
  // CACHE bump, and the last list still works offline (#56).
  if (request.url.indexOf('/sets/') !== -1 && request.url.split('?')[0].slice(-5) === '.json') {
    event.respondWith(
      fetch(request).then(function(response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function() { return caches.match(request); })
    );
    return;
  }

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
        if (response && response.status === 200 && request.url.indexOf(self.location.origin) === 0) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(request, clone); });
        }
        return response;
      }).catch(function() { return cached; });
    })
  );
});
