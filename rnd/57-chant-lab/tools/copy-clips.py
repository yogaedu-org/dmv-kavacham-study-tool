"""Copy the reference clips into the gitignored folder chant.json points at (dmv #57). Audio never enters git (#48).

    python rnd/57-chant-lab/tools/copy-clips.py [--src <folder holding day2/ day5/ ...>] [--days 2,5]

Writes rnd/57-chant-lab/local-audio/<set>/verseNN.mp3. Day 2 is checked against the sha256 in
../56-audio-sources/audio-config.json when that file is present. Exit 1 if any clip is missing or wrong.
"""
import argparse, hashlib, json, os, shutil, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BOOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--src", default="D:/dmv-49-preview/rnd/kavacham-audio-alignment/dmv-kavacham/audio")
ap.add_argument("--days", default="2,5")
a = ap.parse_args()
chant = json.load(open(os.path.join(BOOK, "chant.json"), encoding="utf-8"))
sums = {}
side = os.path.join(os.path.dirname(BOOK), "56-audio-sources", "audio-config.json")
if os.path.isfile(side):
    sums = {"day2": {"verse%02d.mp3" % v["id"]: v["sha256"] for v in json.load(open(side, encoding="utf-8"))["verses"]}}
bad = copied = 0
for d in a.days.split(","):
    sid = "day" + d.strip()
    for v in chant["verses"]:
        name = "verse%02d.mp3" % v["id"]
        src = os.path.join(a.src, sid, name)
        if not os.path.isfile(src):
            print("MISSING:", src); bad += 1; continue
        want = sums.get(sid, {}).get(name)
        if want and hashlib.sha256(open(src, "rb").read()).hexdigest() != want:
            print("SHA256 MISMATCH:", src); bad += 1; continue
        dst = os.path.join(BOOK, "local-audio", sid)
        os.makedirs(dst, exist_ok=True)
        shutil.copyfile(src, os.path.join(dst, name)); copied += 1
print("copied %d clips, %d problems" % (copied, bad))
sys.exit(1 if bad else 0)
