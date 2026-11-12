"""Make a PREVIEW-ONLY config for the verse audio (#56): the committed config (public Cloudflare host, Day 2) plus a clearly
labelled local fixture set, so the owner can try the recitation switcher without anything being uploaded or committed.

    python tools/make-preview-config.py --mock-cloud <dir served at --mock-url> --mock-url http://127.0.0.1:8771/ --out <config.json>

Requires the mock cloud to already hold a full second set at <dir>/sets/<set>/ (built by tools/build-audio-sets.py --out <dir>).
It writes <dir>/fixture-sets/index.json and <dir>/fixture-sets/<set>/manifest.json (label "<Set> (local test)") and an --out
config whose audio.extraIndexes lists that index. Serve the app with the output mapped over /config.json:

    python rnd/56-audio-sources/tools/serve.py --root . --port 8775 --map config.json=<out>

The committed config.json is never changed (tests/audio-sets.mjs F7 guards that).
"""
import argparse, json, os, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--mock-cloud", required=True)
ap.add_argument("--mock-url", required=True)
ap.add_argument("--set", default="day5")
ap.add_argument("--out", required=True)
a = ap.parse_args()

src = os.path.join(a.mock_cloud, "sets", a.set, "manifest.json")
m = json.load(open(src, encoding="utf-8"))
label = "%s (local test)" % ("Day %s" % a.set.replace("day", "") if a.set.startswith("day") else a.set)
m.update({"label": label, "reciter": "local test fixture", "licence": "local test fixture", "base": "../../sets/%s/" % a.set})
d = os.path.join(a.mock_cloud, "fixture-sets", a.set)
os.makedirs(d, exist_ok=True)
json.dump(m, open(os.path.join(d, "manifest.json"), "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
json.dump({"schema": 1, "sets": [{"id": a.set + "-local", "label": label, "recommended": False, "manifest": "%s/manifest.json" % a.set}]},
          open(os.path.join(a.mock_cloud, "fixture-sets", "index.json"), "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
cfg = json.load(open(os.path.join(ROOT, "config.json"), encoding="utf-8"))
cfg["audio"]["extraIndexes"] = [a.mock_url.rstrip("/") + "/fixture-sets/index.json"]
json.dump(cfg, open(a.out, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=2)
print("preview config: cloudBase %s + extra set '%s' from %s" % (cfg["audio"]["cloudBase"], label, cfg["audio"]["extraIndexes"][0]))
