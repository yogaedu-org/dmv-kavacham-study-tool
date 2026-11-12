"""Step 2 (a)+(b): MMS_FA CTC forced alignment to the reference + reference-free greedy CTC decode, per clip.
Both come from ONE forward pass per clip. GPU, serial, gpu-guard rules (lock, foreign-process check, 1-op ping, per-clip deadline).
Adapted from SYP-ajna-analysis forced_align_chant.py @37a23875 and shruti-transcript bench/align.py @596c4793."""
import json
import os
import subprocess
import sys
import time

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import numpy as np
import soundfile as sf
import torch
import torchaudio
import torchaudio.functional as F
import dmvlib as L

os.makedirs(L.ROOT, exist_ok=True)
LOCK = os.path.join(L.ROOT, "gpu-guard.lock")
CLIP_DEADLINE_S = 60


def guard_precheck():
    # rule 1: serial -- no other compute process on the GPU
    q = subprocess.run(["nvidia-smi", "--query-compute-apps=pid,process_name", "--format=csv,noheader"], capture_output=True, text=True).stdout.strip()
    if q:
        sys.exit(f"gpu-guard: foreign GPU compute process present, refusing: {q}")
    free = subprocess.run(["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"], capture_output=True, text=True).stdout.strip()
    if int(free) < 4000:
        sys.exit(f"gpu-guard: only {free} MiB free")
    if os.path.exists(LOCK):
        sys.exit("gpu-guard: lock held")
    open(LOCK, "w").write(str(os.getpid()))
    # rule 2: 1-op ping with deadline
    t0 = time.perf_counter()
    a = torch.randn(256, 256, device="cuda")
    (a @ a).sum().item()
    torch.cuda.synchronize()
    dt = time.perf_counter() - t0
    if dt > 15:
        os.remove(LOCK)
        sys.exit(f"gpu-guard: ping took {dt:.1f}s")
    print(f"gpu-guard: free {free} MiB, ping {dt*1000:.0f} ms", flush=True)


def main():
    guard_precheck()
    try:
        bundle = torchaudio.pipelines.MMS_FA
        model = bundle.get_model().to("cuda").eval()
        labels = bundle.get_labels()
        tokenizer = bundle.get_tokenizer()
        verses = {v["n"]: L.syllabify(v["dev"]) for v in L.load_verses()}
        out = {}
        for d in L.DAYS:
            for v in L.VERSES:
                t0 = time.perf_counter()
                x, sr = sf.read(L.wav_path(d, v), dtype="float32")
                xt = torch.from_numpy(np.ascontiguousarray(x))[None].to("cuda")
                with torch.inference_mode():
                    em, _ = model(xt)
                    em = torch.log_softmax(em, dim=-1)[0].float().cpu()
                T = em.shape[0]
                ratio = len(x) / T / sr
                # (b) greedy decode
                # MMS_FA's wildcard '*' (last class) wins every frame under a plain argmax (measured: 585/585 frames on d3v3),
                # so the greedy decode drops it and renormalises over blank + the 27 real symbols.
                em28 = torch.log_softmax(em[:, :-1], dim=-1)
                am = em28.argmax(-1).numpy()
                prob = em28.exp().numpy()
                letters, times, conf = [], [], []
                k = 0
                while k < T:
                    j = k
                    while j < T and am[j] == am[k]:
                        j += 1
                    if am[k] != 0 and labels[am[k]] not in ("*",):
                        letters.append(labels[am[k]])
                        times.append([round(k * ratio, 3), round(j * ratio, 3)])
                        conf.append(round(float(prob[k:j, am[k]].max()), 3))
                    k = j
                # (a) forced alignment to the reference aksharas
                sy = verses[v]
                toks = tokenizer([s["a"] for s in sy])
                flat = [t for ts in toks for t in ts]
                targets = torch.tensor(flat, dtype=torch.int32)[None]
                path, scores = F.forced_align(em[None], targets, blank=0)
                spans = F.merge_tokens(path[0], scores[0].exp())
                assert len(spans) == len(flat), (d, v, len(spans), len(flat))
                k = 0
                rows = []
                for s, ts in zip(sy, toks):
                    sp = spans[k:k + len(ts)]
                    k += len(ts)
                    ln = sum(q.end - q.start for q in sp)
                    rows.append({
                        "idx": s["idx"], "t0": round(sp[0].start * ratio, 3), "t1": round(sp[-1].end * ratio, 3),
                        "post": round(float(sum(q.score * (q.end - q.start) for q in sp) / ln), 3),
                        "post_min": round(float(min(q.score for q in sp)), 3),
                    })
                dt = time.perf_counter() - t0
                if dt > CLIP_DEADLINE_S:
                    sys.exit(f"gpu-guard: clip {d}.{v} took {dt:.0f}s > deadline; aborting")
                out[f"{d}.{v}"] = {"day": d, "verse": v, "frames": T, "sec_per_frame": ratio, "dur_s": round(len(x) / sr, 3),
                                   "aligned": rows, "greedy": "".join(letters), "greedy_times": times, "greedy_conf": conf}
            print(f"day {d} done", flush=True)
        json.dump({"model": "torchaudio MMS_FA", "torch": torch.__version__, "torchaudio": torchaudio.__version__, "clips": out},
                  open(f"{L.ROOT}/out/passAB.json", "w", encoding="utf-8", newline="\n"), ensure_ascii=False)
        print("wrote out/passAB.json", flush=True)
    finally:
        if os.path.exists(LOCK):
            os.remove(LOCK)


if __name__ == "__main__":
    main()
