"""Known-slip calibration: splice day-2 clips so the true error is known, then see whether passes B and C find it."""
import json, os, sys
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dmvlib as L
ab = json.load(open(f"{L.ROOT}/out/passAB.json", encoding="utf-8"))["clips"]
os.makedirs(f"{L.ROOT}/work/synth", exist_ok=True)
SR = 16000
cases = []
def seg(v, a, b, d=2):
    al = ab[f"{d}.{v}"]["aligned"]
    return int(max(0, al[a]["t0"] - 0.02) * SR), int((al[b + 1]["t0"] if b + 1 < len(al) else al[b]["t1"]) * SR)
def make(name, v, kind, a, b, d=2):
    x, _ = sf.read(L.wav_path(d, v), dtype="float32")
    s0, s1 = seg(v, a, b, d)
    if kind == "omission":
        y = np.concatenate([x[:s0], x[s1:]])
    elif kind == "repeat":
        y = np.concatenate([x[:s1], x[s0:s1], x[s1:]])
    elif kind == "substitution":       # replace syllables a..b with the audio of the syllables 6..8 later in the same verse
        o0, o1 = seg(v, a + 6, b + 6, d)
        y = np.concatenate([x[:s0], x[o0:o1], x[s1:]])
    sf.write(f"{L.ROOT}/work/synth/{name}.wav", y, SR)
    cases.append({"name": name, "verse": v, "kind": kind, "syll": [a, b], "day": d})
make("s_omit_v7", 7, "omission", 8, 10)
make("s_rep_v9", 9, "repeat", 12, 15)
make("s_sub_v11", 11, "substitution", 4, 5)
make("s_omit_v3", 3, "omission", 19, 20)
make("s_sub_v5", 5, "substitution", 21, 22)
json.dump(cases, open(f"{L.ROOT}/work/synth/cases.json", "w"), indent=1)
print(cases)
