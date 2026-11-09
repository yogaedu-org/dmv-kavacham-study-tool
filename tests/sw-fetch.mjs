#!/usr/bin/env node
/**
 * Service-worker fetch guard (#50).
 *
 * Named failures:
 *  (a) A navigation that gets a non-OK response (404/5xx during a deploy) was
 *      written to the cache, replacing the good page offline readers fall back to.
 *  (b) Offline, a cache-first miss resolved to `undefined`, so respondWith got a
 *      non-Response and the browser showed a network error for a script/asset.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'sw.js'), 'utf8');

async function run({ request, fetchImpl, cached }) {
  const handlers = {};
  const puts = [];
  const cache = { put: (...a) => { puts.push(a); return Promise.resolve(); }, add: () => Promise.resolve() };
  const sandbox = {
    self: {
      addEventListener: (t, f) => { handlers[t] = f; },
      location: { origin: 'https://x.test' },
      skipWaiting() {}, clients: { claim() {} },
    },
    caches: {
      open: () => Promise.resolve(cache),
      match: () => Promise.resolve(cached),
      keys: () => Promise.resolve([]),
    },
    fetch: fetchImpl,
    Promise, Response,
  };
  vm.runInNewContext(src, sandbox);
  let responded;
  handlers.fetch({ request, respondWith: (p) => { responded = p; } });
  const result = await responded;
  await new Promise(r => setTimeout(r, 10));
  return { result, puts };
}

const nav = { method: 'GET', mode: 'navigate', url: 'https://x.test/', headers: { get: () => 'text/html' } };
const asset = { method: 'GET', mode: 'no-cors', url: 'https://x.test/js/new.js', headers: { get: () => '' } };
const fails = [];

const a = await run({ request: nav, cached: undefined,
  fetchImpl: () => Promise.resolve(new Response('boom', { status: 500 })) });
if (a.puts.length) fails.push('(a) non-OK navigation response was cached (cache.put called)');

const b = await run({ request: asset, cached: undefined,
  fetchImpl: () => Promise.reject(new TypeError('offline')) });
if (!(b.result instanceof Response)) fails.push('(b) cache-first miss offline did not resolve to a Response');

if (fails.length) { console.error('FAIL sw-fetch:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('ok sw-fetch: non-OK navigation not cached; offline miss returns a Response');
