// Guards sw.js ASSETS (#50): the offline precache list must match the files on disk.
// Failure named: a renamed/added module, locale, figure or font silently missing from
// (or dangling in) the precache, leaving the offline shell incomplete.
// Run: node tests/sw-assets.mjs   (SW_ROOT=<dir> checks another tree, used to prove it can fail)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = process.env.SW_ROOT
  ? resolve(process.env.SW_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');

const src = readFileSync(join(root, 'sw.js'), 'utf8');
const m = src.match(/const ASSETS\s*=\s*\[([\s\S]*?)\];/);
if (!m) { console.error('FAIL: ASSETS array not found in sw.js'); process.exit(1); }
const assets = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);

// Dev-only files under shipped dirs that the app never loads offline.
const NOT_PRECACHED = new Set(['i18n/review-flags.json']);

const errors = [];
const listed = new Set(assets.map(a => a.replace(/^\.\//, '')));

for (const a of assets) {
  if (a === './') continue;
  if (!existsSync(join(root, a))) errors.push(`listed but missing on disk: ${a}`);
}

const want = [
  ['js', /\.js$/], ['i18n', /\.json$/], ['figures', /\.webp$/], ['fonts', /\.(woff2?|ttf|otf)$/],
];
for (const [dir, re] of want) {
  const p = join(root, dir);
  if (!existsSync(p)) continue;
  for (const f of readdirSync(p)) {
    const rel = `${dir}/${f}`;
    if (re.test(f) && !NOT_PRECACHED.has(rel) && !listed.has(rel)) {
      errors.push(`on disk but not in ASSETS: ./${rel}`);
    }
  }
}

if (errors.length) {
  console.error('FAIL sw-assets:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`ok sw-assets: ${assets.length} precache entries match disk`);
