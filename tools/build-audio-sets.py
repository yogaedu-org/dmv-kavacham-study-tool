"""Build LOCAL TEST recitation sets in the hosted layout (#56). Nothing is written into the repo.

    python tools/build-audio-sets.py --src <dir holding day5/ ... with verse01.mp3 .. verse14.mp3> --sets day5 --out <mock cloud root>

The hosted layout (the Cloudflare Pages project `dmv-kavacham-audio`) is:
    sets/index.json                       {"schema":1,"sets":[{"id","label","recommended","manifest":"day2/manifest.json"}]}
    sets/<set>/manifest.json              schema, set, version, label, reciter, licence, base "./", verses{n:{key,sha256,bytes,duration,codec}}
    sets/<set>/verse-01.mp3 .. verse-14.mp3
Only Day 2 is public. This tool exists so the switcher can be proven locally with a SECOND set (for example Day 5) served from a
mock cloud; those files are never uploaded or committed. It merges into an existing <out>/sets/index.json (so copy the real
sets/ tree there first) and never marks the new set recommended. Duration comes from ffprobe (PATH or --ffprobe).
"""
import argparse, datetime, hashlib, json, os, shutil, subprocess, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True)
ap.add_argument("--sets", required=True, help="comma-separated set ids, each a folder under --src")
ap.add_argument("--out", required=True)
ap.add_argument("--ffprobe", default="ffprobe")
a = ap.parse_args()

nums = [v["number"] for v in json.load(open(os.path.join(ROOT, "data", "verses.json"), encoding="utf-8"))["verses"]]


def duration(path):
    out = subprocess.run([a.ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, encoding="utf-8", check=True).stdout.strip()
    return round(float(out), 2)


idx_path = os.path.join(a.out, "sets", "index.json")
index = json.load(open(idx_path, encoding="utf-8")) if os.path.isfile(idx_path) else {"schema": 1, "sets": []}
for sid in a.sets.split(","):
    entries = {}
    for n in nums:
        src = os.path.join(a.src, sid, "verse%02d.mp3" % n)
        if not os.path.isfile(src):
            sys.exit("missing clip: %s" % src)
        key = "verse-%02d.mp3" % n
        data = open(src, "rb").read()
        os.makedirs(os.path.join(a.out, "sets", sid), exist_ok=True)
        shutil.copyfile(src, os.path.join(a.out, "sets", sid, key))
        entries[str(n)] = {"key": key, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "duration": duration(src), "codec": "audio/mpeg"}
    label = "Day %s" % sid.replace("day", "") if sid.startswith("day") else sid
    manifest = {"schema": 1, "set": sid, "version": datetime.date.today().isoformat(), "label": label,
                "reciter": "local test fixture", "licence": "local test fixture", "base": "./", "verses": entries}
    json.dump(manifest, open(os.path.join(a.out, "sets", sid, "manifest.json"), "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
    index["sets"] = [s for s in index["sets"] if s["id"] != sid] + [{"id": sid, "label": label, "recommended": False, "manifest": "%s/manifest.json" % sid}]
    print("%s: %d clips" % (sid, len(entries)))
assert sum(1 for s in index["sets"] if s["recommended"]) <= 1
json.dump(index, open(idx_path, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
print("wrote %s with %d sets" % (idx_path, len(index["sets"])))
