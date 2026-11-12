# 02 — Swappable per-verse audio (cloud / offline / custom)

Issue A = [yogaedu-org/dmv-kavacham-study-tool#56](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/56). 2026-11-12. **[M]** measured here, **[S]** cited, **[H]** hypothesis, not checked.

## Answer

Host each audio set (one day = 14 clips, about 3 MB) on the **same GitHub Pages origin** as the app. Describe it in a JSON **set manifest**. The player calls only `resolveVerse(n)`, which tries **custom** (IndexedDB blobs), then **offline** (a verified Cache Storage copy that the SW serves with 206 slicing), then **cloud** (`base` + `key`). A swap edits `config.json → audio.manifest` or a user setting. Player code is never touched. **Release assets cannot back the player**: they send no CORS headers, and a draft release returns 404 to the public.

## Local evidence

| Fact | Value [M] |
|---|---|
| Release `rnd-audio-2026-11` | **Draft**. Anonymous GET returns **404** (0.66 s) |
| PR 49 manifest | 87 files, 54.9 MB. **33.7 MB is two full-chant WAVs**. Fields: `path, asset, bytes, sha256`, plus `base_url`, `release_tag` |
| Clips | MP3 **128 kbps CBR mono 44.1 kHz**. 11.82 s ≈ 190 KB. One day set is 2.6–3.0 MB (ffprobe, du) |
| `sw.js` v11 | `activate` deletes **every cache but `CACHE`**, so downloaded audio would die on each release. Cache-first stores any same-origin `response.ok` response, 206 included. Navigations cache non-OK pages (#50) |
| Pages | `yogaedu-org.github.io/dmv-kavacham-study-tool/`, from `main /`, no custom domain. Packed repo 48.5 MB |

## 1. Cloud options

| Option | Cost / limits | CORS | Range / cache | Swap |
|---|---|---|---|---|
| GitHub release assets | Free | **None**. The github.com 302 and the signed `release-assets.githubusercontent.com` blob both lack `Access-Control-Allow-Origin`, and preflight returns 404 [M] | Blob gives 206. The signed URL expires about 1 h later. Type `octet-stream` [M] | New tag, repo writers. Draft is not public [M] |
| **Same Pages site** | Free. Site ≤1 GB, **100 GB/month soft bandwidth**, 10 builds/h [S1]. Git blocks files >100 MiB [S2] | `ACAO: *`, and same-origin anyway [M] | 206, `max-age=600` [M] | Commit or PR a folder |
| Separate media repo on Pages | Same as above | **Also same origin**, since project sites share `yogaedu-org.github.io` [H] | as above [H] | Commit to the media repo. New repo = KA decision |
| jsDelivr `/gh/` | Free. GitHub packages >50 MB and files >20 MB unsupported [S3] | `ACAO: *` [M, 1.30 s] | 206. `@main` is cached 7 days (`max-age=604800`) [M] | Pin a tag. Third-party dependency |
| Cloudflare R2 | 10 GB-month, 1M/10M ops, **egress free** [S4]. `r2.dev` is rate-limited, dev-only, uncached; production needs a custom domain [S5] | Per-bucket JSON via `wrangler r2 bucket cors set` [S6] | [H] Range yes | Account holder only |
| Cloudflare Pages | 20,000 files, 25 MiB/file, 500 builds/month [S7] | [H] `_headers` | [H] | Account holder only |

100 GB ÷ 2.9 MB ≈ **34,000 full-set downloads a month** on Pages.

## 2. Source abstraction

**Prior art**: Quran.com API v4 has a recitation *catalogue*. Its per-verse files carry a **relative `url`** against an audio base, plus optional `segments` [S8]. The pattern is **catalogue + relative key + swappable base** (podcast RSS `enclosure` is the same idea), with a chain-of-responsibility resolver in front. Hymn and chant apps were not surveyed.

**Manifest** (`audio/sets/<set>/manifest.json`):
```json
{"schema":1,"set":"day3-recommended","version":"2026-11-12","label":"Day 3 (recommended)",
 "reciter":"…","licence":"…","base":"./",
 "verses":{"7":{"key":"verse07.mp3","sha256":"…","bytes":190308,"duration":11.82,"codec":"audio/mpeg","day":3}}}
```
`base` resolves against the manifest URL, so the same file works on Pages, a media repo or R2. A new `version` gives a new offline cache name, `audio:<set>@<version>`. Per-verse day picks from #55 fit: each `key` may point into any folder.

**Resolver** (`js/audio-source.js`): `resolveVerse(n) → {url, source, label} | {error}`.
1. **custom**: an IndexedDB Blob → `URL.createObjectURL`. Revoke it on `ended` or on a source change.
2. **offline**: `caches.open('audio:<set>@<ver>').match(url)`.
3. **cloud**: `new URL(key, manifestURL)`.
4. **Missing**: show "No audio for verse N in '<label>'" on the verse and disable its button. This is PR 49's `#audioNotice` pattern; never fail silently.

**Integrity**: at download, `crypto.subtle.digest('SHA-256')` must match before `cache.put`. That needs CORS-readable bytes, which is free on the same origin and impossible from release assets [M].

## 3. Offline

- A **"Download Day 3 (2.9 MB)" button** fetches the clips, verifies them, then calls `cache.put(url, new Response(blob,{status:200}))` and shows progress. Media must be precached, because runtime responses are 206 partials [S9].
- **SW audio route** (`destination==='audio'`): on a cache hit with `Range`, slice the blob into a 206 plus `Content-Range`. This is a hand-rolled `workbox-range-requests` [S9], about 25 lines, needed with no build step. On a miss, go to the network and never cache the response. [H] Safari rejects 200-for-range on media.
- **Opaque (`no-cors`) responses** can't be hashed or sliced, and Chrome pads each one in quota (about 7 MB, secondary source) [S10].
- **Fix `activate`** to delete only `dmv-kavacham-v*` caches.
- `navigator.storage.persist()` on the click. Safari 17+ supports it and grants it by heuristic, such as home-screen install [S11].
- **iOS**: Safari wipes IndexedDB and the SW cache after **7 days of use without visiting the site**. Home-screen apps are exempt [S12, 2020]. [H] Still exact in iOS 26. UI copy: "Add to Home Screen to keep offline audio."
- Cache Storage beats IndexedDB/OPFS for cloud sets, because the SW returns `Response` objects directly.

## 4. Custom audio

- **`<input type=file accept="audio/*" multiple>` plus drop** works in every browser, iOS included.
- `showDirectoryPicker` works in **Chrome/Edge 105+ only**. Firefox, Safari, iOS and Chrome Android lack it [S13]. Persistent handles (Chrome 122) need the handles kept in IndexedDB plus `requestPermission()` on each visit, unless the user chose "every visit" or installed the app [S14]. **Copy the bytes into IndexedDB instead**: one path everywhere.
- **Mapping**: the filename regex `/(?:verse|v)[-_ ]?0?(\d{1,2})/i`, with a 14-row dropdown for misses. `canPlayType` flags unplayable files. The custom set is stored in the same schema with `base:"idb:"`.
- **iOS cannot** pick folders, keep file handles, or outlive the 7-day rule uninstalled.

## 5. Formats

| Format | Support | 12 s mono |
|---|---|---|
| **MP3 CBR** | All major browsers. Firefox since 71 [S15] | 128 kbps ≈ 192 KB; 64 kbps ≈ 96 KB |
| AAC/m4a | All browsers in MP4, but not in Chromium builds, and Firefox depends on the OS [S15] | 48–96 KB |
| Opus | Chrome, Firefox. iOS full only from 18.4, macOS Safari "partial" [S16] | 36–48 KB |
| WAV 16-bit | Universal | ≈ 1.06 MB |

**Use MP3 CBR mono.** CBR keeps `currentTime` seeks exact for line offsets [H: VBR without a Xing TOC drifts]. 64 kbps would halve the set [H: needs a listening check]. Gapless playback is not needed for per-verse clips.

## Recommended design

1. **Manifest**: the schema above. `config.json → "audio":{"manifest":"audio/sets/day3-recommended/manifest.json"}`.
2. **Order**: custom → offline → cloud → visible "no audio".
3. **Cloud**: **this Pages site**, `audio/sets/<id>/`: about 3 MB per set, same origin, free. The R&D WAVs stay in release assets (#48). **Runner-up**: a Pages media repo (same origin, needs a name from KA). R2 comes third, since it needs a custom domain.
4. **Offline**: the button downloads, verifies sha256 and writes to Cache Storage, then calls `persist()`. The SW range-slices, and `activate` keeps `audio:*`.
5. **Custom**: file input or drop → filename map plus dropdown → IndexedDB → object URL.

**Tests** (Playwright, Chromium + WebKit):
- T1: set A, verse 7 plays with `source==='cloud'`.
- T2: after a download and `setOffline(true)`, `source==='offline'`, and a 5 s seek gets a 206.
- T3: an uploaded `verse-07.mp3` gives `source==='custom'`.
- T4: config switched to set B changes the URL, and `git diff --exit-code js/` passes between T1 and T4.
- T5: a manifest gap, or offline with nothing cached, shows the visible message and a disabled button.
- T6: a corrupted fixture is rejected and not cached.
- T7: a SW version bump keeps the `audio:*` caches.

**Top risk**: iOS Safari evicts offline and custom audio when the app is not installed to the home screen [S12]. Prompt to install next to both buttons.

## Sources (fetched 2026-11-12; all under 10 s)
S1 https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits ·
S2 https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github (search summary) ·
S3 https://data.jsdelivr.com/v1/spec.yaml (search summary) ·
S4 https://developers.cloudflare.com/r2/pricing/ ·
S5 https://developers.cloudflare.com/r2/buckets/public-buckets/ ·
S6 https://developers.cloudflare.com/r2/buckets/cors/ ·
S7 https://developers.cloudflare.com/pages/platform/limits/ ·
S8 https://api-docs.quran.com/docs/content_apis_versioned/4.0.0/recitation-audio-files/ ·
S9 https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video ·
S10 https://cloudfour.com/thinks/when-7-kb-equals-7-mb/ ·
S11 https://webkit.org/blog/14403/updates-to-storage-policy/ (2023-08-10) ·
S12 https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ (2020-03-24) ·
S13 https://caniuse.com/native-filesystem-api ·
S14 https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api ·
S15 https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs ·
S16 https://caniuse.com/opus.
Unverified: whether `Cache.put` rejects 206 (MDN silent), and whether jsDelivr refuses this repo (it served one file).
