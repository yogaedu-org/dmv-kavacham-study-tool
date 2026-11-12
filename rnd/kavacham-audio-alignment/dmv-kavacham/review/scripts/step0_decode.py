"""Step 0: decode every verse clip (day 1-6 x verse 1-14) to 16 kHz mono wav in <work>/work/wav16k/, the input of steps 1-2.
The mp3 clips come from tools/fetch-rnd-audio.py (they are release assets, not git files). Needs ffmpeg on PATH or FFMPEG=<path>."""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import dmvlib as L

os.makedirs(f"{L.ROOT}/work/wav16k", exist_ok=True)
missing = []
for d in L.DAYS:
    for v in L.VERSES:
        src = L.clip_path(d, v)
        if not os.path.isfile(src):
            missing.append(src)
            continue
        subprocess.run([L.FFMPEG, "-y", "-loglevel", "error", "-i", src, "-ar", "16000", "-ac", "1", L.wav_path(d, v)], check=True)
if missing:
    sys.exit(f"{len(missing)} clips missing (run python tools/fetch-rnd-audio.py): first {missing[0]}")
print("decoded", len(L.DAYS) * len(L.VERSES), "clips")
