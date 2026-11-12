"""Re-align Day 2 verse 14 with its closing line repeated (#61). CPU only (a 25 s clip), torchaudio MMS_FA.

The #55 pass aligned verse 14 once, so the closing line (sung 3 times on this clip) smeared across 18 s. Here the target is
line 1 once + the closing line N times; N is chosen by mean alignment posterior. Run with the langseg conda env:
  C:/Users/kaanchan/miniconda3/envs/langseg/python.exe rnd/61-karaoke/tools/realign-v14.py <results.json> <wav16k> <out.json>
"""
import json, os, sys
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import numpy as np, soundfile as sf, torch, torchaudio
import torchaudio.functional as F

results, wav, out = sys.argv[1:4]
d = json.load(open(results, encoding="utf-8"))
syl = d["syllables"]["14"]
assert len(syl) == 32
# alignment spelling per akshara: the pipeline stored it in dmvlib; rebuild via the same module
sys.path.insert(0, os.path.dirname(results) + "/../scripts")
import dmvlib as L
ref = L.syllabify(d["verse_text"]["14"]["dev"])
assert [s["deva"] for s in ref] == [s["deva"] for s in syl]
bundle = torchaudio.pipelines.MMS_FA
model = bundle.get_model().eval(); tok = bundle.get_tokenizer()
x, sr = sf.read(wav, dtype="float32")
with torch.inference_mode():
    em, _ = model(torch.from_numpy(np.ascontiguousarray(x))[None])
    em = torch.log_softmax(em, dim=-1)[0].float()
T = em.shape[0]; ratio = len(x) / T / sr
line0 = [s for s in ref if s["line"] == 0]; line1 = [s for s in ref if s["line"] == 1]
best = None
for n in (1, 2, 3, 4):
    seq = line0 + line1 * n
    toks = tok([s["a"] for s in seq]); flat = [t for ts in toks for t in ts]
    path, scores = F.forced_align(em[None], torch.tensor(flat, dtype=torch.int32)[None], blank=0)
    spans = F.merge_tokens(path[0], scores[0].exp())
    post = float(np.mean([q.score for q in spans]))
    print("repeats", n, "mean posterior %.3f" % post, flush=True)
    if best is None or post > best[0]:
        best = (post, n, seq, toks, spans)
post, n, seq, toks, spans = best
k = 0; rows = []
for j, (s, ts) in enumerate(zip(seq, toks)):
    sp = spans[k:k + len(ts)]; k += len(ts)
    rows.append({"i": s["idx"], "pass": 0 if s["line"] == 0 else 1 + (j - len(line0)) // len(line1),
                 "start": round(sp[0].start * ratio, 3), "end": round(sp[-1].end * ratio, 3),
                 "post": round(float(np.mean([q.score for q in sp])), 3)})
json.dump({"repeats": n, "mean_posterior": round(post, 3), "rows": rows}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print("best repeats", n); 
for r in rows: print(r)
