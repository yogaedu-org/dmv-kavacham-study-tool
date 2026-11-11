"""Fail if the published R&D player would have missing audio (#48).

The 87 clips are not in git (release assets, see audio-manifest.json). GitHub Pages serves
`main` with no build step, so on the published site player.html must point each <audio>
at its release asset itself. This check lists every audio the player needs and proves it can
get one:

    python tools/check-player-audio.py            # offline: wiring + manifest (CI-safe, no network)
    python tools/check-player-audio.py --online   # also GET bytes 0-0 of every release asset;
                                                  # expects 206 (range seeking needs it).
                                                  # FAILS until the draft release is published.
"""
import argparse, json, os, re, sys, urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "rnd", "kavacham-audio-alignment", "dmv-kavacham")
ap = argparse.ArgumentParser()
ap.add_argument("--online", action="store_true")
args = ap.parse_args()

html = open(os.path.join(D, "player.html"), encoding="utf-8").read()
m = json.load(open(os.path.join(D, "audio-manifest.json"), encoding="utf-8"))
errors = []

srcs = re.findall(r'<audio[^>]*\ssrc="([^"]+)"', html)
if not srcs:
    errors.append("player.html lists no <audio src>: the check would pass vacuously")
if len(srcs) != len(set(srcs)):
    errors.append("duplicate <audio src> in player.html")

# 1. the player must carry the release fallback (the published site has no audio/ folder)
for needle in ("useReleaseAudioIfNeeded", "audio-manifest.json", 'id="audioNotice"'):
    if needle not in html:
        errors.append("player.html lacks the release-audio fallback (%s): published audio would 404" % needle)

# 2. every src must resolve to exactly one manifest asset (same endswith rule the player uses)
assets = {}
for s in srcs:
    hits = [f for f in m["files"] if f["path"].endswith("/" + s)]
    if len(hits) != 1:
        errors.append("%s: %d manifest matches (need exactly 1)" % (s, len(hits)))
    else:
        assets[s] = hits[0]["asset"]

# 3. manifest sanity
if len(m["files"]) != m["count"] or len({f["asset"] for f in m["files"]}) != m["count"]:
    errors.append("manifest count/asset names inconsistent")
if not m["base_url"].endswith("/releases/download/%s/" % m["release_tag"]):
    errors.append("base_url does not point at release_tag %s" % m["release_tag"])
if "/%s/" % m["release_tag"] not in m["base_url"]:
    errors.append("tag not pinned in base_url")

print("player needs %d clips; %d resolve to a release asset" % (len(srcs), len(assets)))

# 4. online: the asset must really be served, with range support
if args.online:
    bad = 0
    for s, a in assets.items():
        req = urllib.request.Request(m["base_url"] + a, headers={"Range": "bytes=0-0"})
        try:
            code = urllib.request.urlopen(req, timeout=30).status
        except Exception as e:
            code = getattr(e, "code", repr(e))
        if code != 206:
            bad += 1
            print("NOT SERVED (%s): %s" % (code, m["base_url"] + a))
    if bad:
        errors.append("%d of %d release assets are not served (is the release still a draft?)" % (bad, len(assets)))
    else:
        print("online: all %d assets served with 206" % len(assets))

for e in errors:
    print("FAIL:", e)
print("FAIL" if errors else "OK")
sys.exit(1 if errors else 0)
