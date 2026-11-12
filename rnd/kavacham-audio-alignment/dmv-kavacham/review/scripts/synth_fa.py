"""Forced alignment (pass A numbers) for the 5 spliced calibration clips. GPU, serial, gpu-guard (no foreign process)."""
import json, os, subprocess, sys
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, soundfile as sf, torch, torchaudio, torchaudio.functional as F
import dmvlib as L
if subprocess.run(["nvidia-smi", "--query-compute-apps=pid", "--format=csv,noheader"], capture_output=True, text=True).stdout.strip():
    sys.exit("gpu-guard: foreign GPU process")
cases = json.load(open(f"{L.ROOT}/work/synth/cases.json"))
vs = {r["n"]: L.syllabify(r["dev"]) for r in L.load_verses()}
b = torchaudio.pipelines.MMS_FA; m = b.get_model().to("cuda").eval(); tok = b.get_tokenizer()
out = {}
for c in cases:
    x, _ = sf.read(f"{L.ROOT}/work/synth/{c['name']}.wav", dtype="float32")
    with torch.inference_mode():
        e, _ = m(torch.from_numpy(x)[None].to("cuda"))
    e = torch.log_softmax(e, -1)[0].float().cpu(); ratio = len(x) / e.shape[0] / 16000
    sy = vs[c["verse"]]; toks = tok([s["a"] for s in sy]); flat = [t for ts in toks for t in ts]
    path, sc = F.forced_align(e[None], torch.tensor(flat, dtype=torch.int32)[None], blank=0)
    spans = F.merge_tokens(path[0], sc[0].exp()); k = 0; rows = []
    for s, ts in zip(sy, toks):
        sp = spans[k:k + len(ts)]; k += len(ts); ln = sum(q.end - q.start for q in sp)
        rows.append({"idx": s["idx"], "t0": round(sp[0].start * ratio, 3), "t1": round(sp[-1].end * ratio, 3), "post": round(float(sum(q.score * (q.end - q.start) for q in sp) / ln), 3)})
    out[c["name"]] = rows
json.dump(out, open(f"{L.SITE}/synth_fa.json", "w"), indent=1)
print("ok")
