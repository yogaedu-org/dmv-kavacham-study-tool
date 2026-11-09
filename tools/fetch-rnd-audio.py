"""Restore the R&D audio that is no longer tracked in git (#48).

The 87 clips under rnd/kavacham-audio-alignment/dmv-kavacham/audio/ live as GitHub
release assets; audio-manifest.json lists each file with its size, sha256 and name.
This downloads whatever is missing or corrupt, verifies every sha256, and writes the
files back to the paths rnd/.../player.html expects (the dir is gitignored).

    python tools/fetch-rnd-audio.py                 # download from the release
    python tools/fetch-rnd-audio.py --from DIR      # copy from a local dir of assets
    python tools/fetch-rnd-audio.py --check         # verify only, download nothing
"""
import argparse, hashlib, json, os, shutil, sys, urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "rnd", "kavacham-audio-alignment", "dmv-kavacham", "audio-manifest.json")

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()

def ok(path, item):
    return os.path.isfile(path) and os.path.getsize(path) == item["bytes"] and sha256(path) == item["sha256"]

ap = argparse.ArgumentParser()
ap.add_argument("--from", dest="src", help="local directory holding the flat release assets")
ap.add_argument("--check", action="store_true", help="verify only; fail if anything is missing")
args = ap.parse_args()

m = json.load(open(MANIFEST, encoding="utf-8"))
bad = fetched = good = 0
for it in m["files"]:
    dest = os.path.join(ROOT, it["path"])
    if ok(dest, it):
        good += 1
        continue
    if args.check:
        print("MISSING/CORRUPT:", it["path"])
        bad += 1
        continue
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    if args.src:
        shutil.copyfile(os.path.join(args.src, it["asset"]), tmp)
    else:
        urllib.request.urlretrieve(m["base_url"] + it["asset"], tmp)
    if sha256(tmp) != it["sha256"]:
        os.remove(tmp)
        print("SHA256 MISMATCH:", it["asset"])
        bad += 1
        continue
    os.replace(tmp, dest)
    fetched += 1
print("audio: %d ok, %d fetched, %d bad (of %d)" % (good, fetched, bad, len(m["files"])))
sys.exit(1 if bad else 0)
