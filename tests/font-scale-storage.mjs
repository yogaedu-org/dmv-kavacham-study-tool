#!/usr/bin/env node
/**
 * Blocked-storage guard (#50).
 *
 * Named failure: when site data is blocked (sandboxed iframes, some in-app
 * browsers) `localStorage.getItem` throws SecurityError. initFontScale() is
 * called inside initializeApp's try, so an unguarded read aborted init and the
 * reader saw a false "Failed to load verse data" instead of the verses.
 */
const props = {};
const calls = { set: [] };
globalThis.localStorage = {
  getItem() { const e = new Error('The operation is insecure.'); e.name = 'SecurityError'; throw e; },
  setItem() { const e = new Error('The operation is insecure.'); e.name = 'SecurityError'; throw e; },
};
globalThis.document = {
  documentElement: { style: { setProperty(k, v) { props[k] = v; } } },
  getElementById() { return null; },
  addEventListener() {},
};
globalThis.window = globalThis;

const { initFontScale } = await import('../js/controls.js');
try {
  initFontScale();
} catch (e) {
  console.error(`FAIL font-scale-storage: initFontScale threw ${e.name}: ${e.message}`);
  process.exit(1);
}
if (props['--user-scale'] !== '1.00') {
  console.error(`FAIL font-scale-storage: expected --user-scale 1.00 fallback, got ${props['--user-scale']}`);
  process.exit(1);
}
console.log('ok font-scale-storage: blocked localStorage falls back to scale 1');
