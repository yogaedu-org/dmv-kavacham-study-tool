# dmv-kavacham-audio deployments

Issue: yogaedu-org/dmv-kavacham-study-tool #56. Owner decision (KA, 2026-11-12 13:35): public Pages project, Day 2 only, no domain, no DNS, no Access app.

## 2026-11-12 (UTC 07:5x) - project created, Day 2 deployed

- Project: `dmv-kavacham-audio` (Cloudflare Pages, production branch `main`, created by API; it did not exist before).
- Base URL: https://dmv-kavacham-audio.pages.dev/
- Current production deployment: `e8ed3086-f67c-4fe5-a85c-be30c50a98e1` (https://e8ed3086.dmv-kavacham-audio.pages.dev, created 2026-11-12T07:56:37Z). Same file set as the first deployment.
- Earlier deployments of the same content (superseded): `c8af4e87` (first; `_headers` cache rule had two `*` splats, ignored), `4fecc485` (per-file cache rules), `3d5c0d2e` (a diagnostic with no `/*` rule, to test Range).
- One PREVIEW deployment `0961050b` (branch `rangetest`, verse-01 only) was made to test Range; its URL has no working TLS cert. Delete it if unwanted (see rollback).
- Source: Day 2 clips `D:/dmv-49-preview/rnd/kavacham-audio-alignment/dmv-kavacham/audio/day2/verse01..14.mp3`, mapped by name verseNN.mp3 -> sets/day2/verse-NN.mp3. They were already MP3 mono 44.1 kHz 128 kbps CBR, so they were stream-copied (no re-encode) with all tags stripped.
- Verse 14 clip is 25.0 s (the others are about 12 s); shipped as in the source.
- Total bundle size: 2,958,157 bytes of audio (about 2.9 MB), 18 files with `_headers`.

### Files (sha256)
- `sets/day2/verse-01.mp3` f65ce40a845eb2504e8a0aac2633ed9b0e9f708e0d444f437edeaeea64c1d531 (212760 bytes)
- `sets/day2/verse-02.mp3` f63b60de30438e866bfb6da259b09bfe9a7ce9b66fe94d339f8d5a1046804f31 (192698 bytes)
- `sets/day2/verse-03.mp3` 128fd979c73a89c9845e04264b0f0dd75e8ac385d88094160d6b3594b2424ca3 (191026 bytes)
- `sets/day2/verse-04.mp3` 268ba47ffec418e58ac4038dc8a4f3d4a9bed7fe9287ae64ed2daf0135c7aac6 (198131 bytes)
- `sets/day2/verse-05.mp3` 0cf78deede7dcb22b6e5daa24d0822b5880d1afdcb6b2145458c255cfc24c4f3 (191026 bytes)
- `sets/day2/verse-06.mp3` 37e065f9cc458da9ae34af3f698870b5786c52b3e86af9239ef1fe8e69f9e3d1 (198967 bytes)
- `sets/day2/verse-07.mp3` 8c4ed1d36c50dbab114e14a4f4adedba04824791292c38b3b9f691abb3775e09 (198967 bytes)
- `sets/day2/verse-08.mp3` 5c69bf7f28aa89286e58773c2b0d074497beac92811d6f9a14cc769c4a5be336 (198967 bytes)
- `sets/day2/verse-09.mp3` 6606b3151dd953e533cd50b5c7d7673b71fbd2da178a38bddfb4ae058a28b3a0 (195206 bytes)
- `sets/day2/verse-10.mp3` b45bb9a6e414ad75757472ddbd4be0fcd0132e980a9fe015ba7cf78440538e79 (198549 bytes)
- `sets/day2/verse-11.mp3` 4064df7f28310b5629b4472fb9a3c8456fa1160a8d1b3220f05cf6ca48566f51 (193116 bytes)
- `sets/day2/verse-12.mp3` 87c1629bc866735bdf47ccf08c68eb13f73801605e52d96d8040b3abd336b83e (191026 bytes)
- `sets/day2/verse-13.mp3` d45e844bfb6203e59bddefe3d544f17a4dae984385e262c8c213a0d477069c1a (196459 bytes)
- `sets/day2/verse-14.mp3` 2991a2d0c3afca1979ddff797f56f3906c4adb87d499a45ae9615fe7022346be (401259 bytes)
- `sets/index.json` f358c0c149f81e872130444dac05dca10a75eca18434534a10b034d26e026be4 (149 bytes)
- `sets/day2/manifest.json` 260f85e6a45e55c1e24d6f198b2881d7064d8d25afb8ba632e89a0929b93d887 (3123 bytes)
- `_headers` 5df5ecb5aca98ab76a519934bd7778e76279654960e3a585da02813d9824d1e2 (1296 bytes)
- `index.html` 69afd8881ce7adb77512989758c450f8ad4a03dc9e6e79dc13af938a775cd00d (174 bytes)

### Known limitation (HTTP Range)
Pages serves these files with `200` and the full body for `Range: bytes=0-1023` (no `Accept-Ranges`, no `206`), confirmed with curl and node fetch, with and without the `_headers` rules. This is the Pages asset server, not the bundle. Chrome and Firefox play small clips without it; Safari may refuse media without 206. The study tool's service worker must slice cached blobs into 206 (as the research plan says) and Safari playback from the network needs a test.

### Roll back
```
cd "C:/Users/kaanchan/Projects/Yoga/Sankirtan Book Organizer"
node node_modules/wrangler/bin/wrangler.js pages deployment list --project-name dmv-kavacham-audio
node node_modules/wrangler/bin/wrangler.js pages deployment delete <deployment-id> --project-name dmv-kavacham-audio
```
(with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment, loaded from `.env.cloudflare`; run from a directory without a `wrangler.toml`). The newest production deployment is the live one; Cloudflare normally refuses to delete the current production deployment (not tried here), so redeploy the previous bundle first. `.claude/tmp/dmv-audio-cloud/tools/cf_run.py` loads the env without printing it.

### Add another set later (other voices)
1. Create `sets/<id>/verse-NN.mp3` and `sets/<id>/manifest.json` (same schema, new `set` and `version`).
2. Add an entry to `sets/index.json`: `{"id","label","recommended","manifest":"<id>/manifest.json"}`.
3. Add per-file Cache-Control rules for `/sets/<id>/verse-NN.mp3` to `_headers` (Pages allows one `*` per rule, so `verse-*` wildcards do not work).
4. Redeploy: `pages deploy <bundle> --project-name dmv-kavacham-audio --branch main` (project already exists).
