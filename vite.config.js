import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build config (#33): bundle the ES-module app into ONE self-contained
 * dist/index.html. All JS, CSS, JSON data and the Devanagari font are inlined
 * so the file works both when hosted AND when opened via file:// (double-click).
 *
 * The ES modules under js/ stay the dev/test source (`npm run dev`); this config
 * only governs `npm run build`.
 */

/**
 * Fix up <link> asset references for the single-file goal. Vite emits assets
 * referenced by <link rel="manifest|icon|apple-touch-icon"> as SEPARATE files
 * (assetsInlineLimit does not apply to these HTML link hrefs), which would add
 * stray files to dist/ and 404 on file://. We run BEFORE Vite's HTML plugin
 * scans the tags (order:'pre') and:
 *  - inline rel="icon" as a data: URI  →  no favicon.ico request (0 console
 *    errors), no separate file;
 *  - drop rel="manifest" and rel="apple-touch-icon"  →  PWA-only, meaningless in
 *    one file, and their assets can't be inlined.
 * (The CSS @font-face url() font IS inlined — that path honours the limit.)
 */
function inlineFaviconStripPwa() {
  const iconB64 = readFileSync(join(__dirname, 'icons/icon-192.png')).toString('base64');
  const iconDataUri = 'data:image/png;base64,' + iconB64;
  return {
    name: 'inline-favicon-strip-pwa',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace(/\s*<link\s+rel="(?:manifest|apple-touch-icon)"[^>]*>/gi, '')
          .replace(
            /<link\s+rel="icon"[^>]*>/i,
            '<link rel="icon" type="image/png" href="' + iconDataUri + '">'
          );
      }
    }
  };
}

export default defineConfig({
  base: './',
  // Expose a build-only flag so the app can skip service-worker registration in
  // the single-file bundle (a file:// / one-file page has no sw.js to register).
  // Undefined in the raw dev ES-module path, so `typeof` stays safe there.
  define: {
    __SINGLEFILE__: 'true'
  },
  build: {
    // Inline every asset (the 124 KB woff2 font included) as a data: URI.
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    // Keep the emitted HTML readable; the plugin inlines everything anyway.
    assetsDir: '.'
  },
  plugins: [inlineFaviconStripPwa(), viteSingleFile()]
});
