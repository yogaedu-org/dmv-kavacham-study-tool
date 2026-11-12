"""Copy the clips a chant's pages need into the chant folder's audio/ (gitignored) from a local copy that has them.

    python tools/preview-chant-audio.py --from <folder that holds audio/>  [--chant rnd/kavacham-audio-alignment/dmv-kavacham]

Reads chant.json for which clips exist (every set x every verse), copies each to the same relative path, and
fails loudly if one is missing. The audio never goes into git (#48; rnd/**/audio/ is ignored); the alternative is
tools/fetch-rnd-audio.py, which downloads the release assets.
"""
import argparse, json, os, shutil, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--from", dest="src", required=True, help="folder that contains audio/ (a restored copy of the chant folder)")
ap.add_argument("--chant", default="rnd/kavacham-audio-alignment/dmv-kavacham")
a = ap.parse_args()

chant = os.path.join(ROOT, a.chant)
cfg = json.load(open(os.path.join(chant, "chant.json"), encoding="utf-8"))
missing, n = [], 0
for s in cfg["sets"]:
    for v in range(1, cfg["verse_count"] + 1):
        rel = s["audio"].replace("{vv}", f"{v:02d}").replace("{v}", str(v))
        src, dst = os.path.join(a.src, rel), os.path.join(chant, rel)
        if not os.path.isfile(src):
            missing.append(rel)
            continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        n += 1
print(f"copied {n} clips into {os.path.join(chant, 'audio')}")
if missing:
    sys.exit(f"{len(missing)} clips not found under --from, first: {missing[0]}")
