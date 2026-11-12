"""Copy the Day 2 reference clips into the two gitignored folders the side page serves (#56). Audio never enters git (#48).

    python tools/populate-local-audio.py [--src D:/dmv-49-preview/rnd/kavacham-audio-alignment/dmv-kavacham/audio]

  local-audio/offline/verse01.mp3 ...   served same-origin by port 8770 (the "offline" source)
  local-audio/cloud/verse01.mp3   ...   served by port 8771 with CORS (the mock "cloud" source)

Every copy is checked against the sha256 in audio-config.json.
"""
import argparse, hashlib, json, os, shutil, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--src", default="D:/dmv-49-preview/rnd/kavacham-audio-alignment/dmv-kavacham/audio")
a = ap.parse_args()
cfg = json.load(open(os.path.join(OUT, "audio-config.json"), encoding="utf-8"))
bad = 0
for v in cfg["verses"]:
    name = v["file"]["offline"]
    src = os.path.join(a.src, "day2", name)
    if not os.path.isfile(src):
        print("MISSING source:", src); bad += 1; continue
    if hashlib.sha256(open(src, "rb").read()).hexdigest() != v["sha256"]:
        print("SHA256 MISMATCH:", src); bad += 1; continue
    for sub in ("offline", "cloud"):
        d = os.path.join(OUT, "local-audio", sub)
        os.makedirs(d, exist_ok=True)
        shutil.copyfile(src, os.path.join(d, name))
# a different real take of each verse (Day 5), served by the mock cloud only: the page's calibration check uses it as a false-alarm probe
for v in cfg["verses"]:
    name = v["file"]["offline"]
    src = os.path.join(a.src, "day5", name)
    if os.path.isfile(src):
        os.makedirs(os.path.join(OUT, "local-audio", "cloud", "day5"), exist_ok=True)
        shutil.copyfile(src, os.path.join(OUT, "local-audio", "cloud", "day5", name))
print("copied %d clips x 2 folders, %d problems" % (len(cfg["verses"]) - bad, bad))
sys.exit(1 if bad else 0)
