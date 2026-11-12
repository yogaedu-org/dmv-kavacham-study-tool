"""Build the recitation-set data for the verse player (#56) from a folder of per-verse clips.

    python tools/build-audio-sets.py --src <dir holding day2/ day5/ ... with verse01.mp3 .. verse14.mp3>
                                     [--sets day2:recommended,day5] [--stage <dir>]

Writes audio/sets/index.json and audio/sets/<set>/manifest.json (sha256, bytes, duration, codec per verse). The AUDIO is never
written into the repo: --stage copies the clips into <dir>/<set>/verseNN.mp3, which is exactly the tree to upload to the cloud
host (or to serve from a mock cloud in local preview). Duration comes from ffprobe (must be on PATH or pass --ffprobe).

Adding another set later is data only: put its 14 clips next to the others, add it to --sets, run this, upload the tree.
"""
import argparse, datetime, hashlib, json, os, shutil, subprocess, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True)
ap.add_argument("--sets", default="day2:recommended,day5")
ap.add_argument("--stage")
ap.add_argument("--ffprobe", default="ffprobe")
ap.add_argument("--version", default=datetime.date.today().isoformat())
a = ap.parse_args()

verses = json.load(open(os.path.join(ROOT, "data", "verses.json"), encoding="utf-8"))["verses"]
nums = [v["number"] for v in verses]


def duration(path):
    out = subprocess.run([a.ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, encoding="utf-8", check=True).stdout.strip()
    return round(float(out), 2)


index = {"schema": 1, "sets": []}
for spec in a.sets.split(","):
    sid, _, flag = spec.partition(":")
    label = "Day %s" % sid.replace("day", "") if sid.startswith("day") else sid
    entries = {}
    for n in nums:
        name = "verse%02d.mp3" % n
        p = os.path.join(a.src, sid, name)
        if not os.path.isfile(p):
            sys.exit("missing clip: %s" % p)
        data = open(p, "rb").read()
        entries[str(n)] = {"key": name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data),
                           "duration": duration(p), "codec": "audio/mpeg"}
        if a.stage:
            os.makedirs(os.path.join(a.stage, sid), exist_ok=True)
            shutil.copyfile(p, os.path.join(a.stage, sid, name))
    manifest = {"schema": 1, "set": sid, "version": a.version, "label": label,
                "reciter": None, "licence": None,  # not known to this repo: fill in before publishing (open question)
                "base": sid + "/", "verses": entries}
    d = os.path.join(ROOT, "audio", "sets", sid)
    os.makedirs(d, exist_ok=True)
    json.dump(manifest, open(os.path.join(d, "manifest.json"), "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=2)
    index["sets"].append({"id": sid, "label": label, "recommended": flag == "recommended", "manifest": "audio/sets/%s/manifest.json" % sid})
    print("%s: %d clips, %.1f MB" % (sid, len(entries), sum(e["bytes"] for e in entries.values()) / 1e6))
assert sum(1 for s in index["sets"] if s["recommended"]) == 1, "exactly one set must be recommended"
json.dump(index, open(os.path.join(ROOT, "audio", "sets", "index.json"), "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=2)
print("wrote audio/sets/index.json with %d sets" % len(index["sets"]))
