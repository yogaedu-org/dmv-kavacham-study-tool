"""Step 1: no-GPU pre-screen of every verse x day clip (duration, pauses, clipped edges, restarts, noise bursts)."""
import json
import os
import sys
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import dmvlib as L

SR = 16000
FR, HOP = 320, 160   # 20 ms frames, 10 ms hop


def frames_db(x):
    n = 1 + (len(x) - FR) // HOP
    idx = np.arange(FR)[None, :] + HOP * np.arange(n)[:, None]
    fr = x[idx]
    rms = np.sqrt((fr ** 2).mean(1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    win = fr * np.hanning(FR)
    spec = np.abs(np.fft.rfft(win, axis=1)) + 1e-9
    flat = np.exp(np.log(spec).mean(1)) / spec.mean(1)
    return db, flat, fr


def mfcc(x, n_mfcc=13):
    import torch
    import torchaudio
    m = torchaudio.transforms.MFCC(sample_rate=SR, n_mfcc=n_mfcc, melkwargs=dict(n_fft=512, hop_length=HOP * 2, n_mels=40))
    out = m(torch.from_numpy(x).float()[None])[0].numpy().T  # (frames @ 20ms, n_mfcc)
    out = (out - out.mean(0)) / (out.std(0) + 1e-6)
    return out


def restart_score(feat, win=50, min_gap=75):
    """Strongest similarity between two non-adjacent 1.0 s windows (frame-by-frame cosine, 20 ms frames).
    Natural parallelism (line 1 vs line 2) also scores, so this is only meaningful relative to the same verse on other days."""
    T = len(feat)
    if T < 2 * win + min_gap:
        return 0.0, None
    nrm = feat / (np.linalg.norm(feat, axis=1, keepdims=True) + 1e-9)
    S = nrm @ nrm.T
    best, where = -1, None
    for i in range(0, T - win, 5):
        for j in range(i + win + min_gap, T - win, 5):
            sc = np.mean(np.diag(S, 0)[:0]) if False else np.mean(S[np.arange(i, i + win), np.arange(j, j + win)])
            if sc > best:
                best, where = sc, (i * 0.02, j * 0.02)
    return float(best), where


def main():
    timings = L.load_timings()
    rows = {}
    for d in L.DAYS:
        for v in L.VERSES:
            x, sr = sf.read(L.wav_path(d, v), dtype="float32")
            assert sr == SR
            dur = len(x) / SR
            db, flat, fr = frames_db(x)
            ref = np.percentile(db, 95)
            floor = np.percentile(db, 5)
            thr = ref - 28.0
            quiet = db < thr
            # pause runs (>= 0.30 s), excluding leading/trailing silence
            runs, i = [], 0
            while i < len(quiet):
                if quiet[i]:
                    j = i
                    while j < len(quiet) and quiet[j]:
                        j += 1
                    runs.append((i * HOP / SR, j * HOP / SR))
                    i = j
                else:
                    i += 1
            lead = runs[0][1] if runs and runs[0][0] < 0.05 else 0.0
            trail = dur - runs[-1][0] if runs and runs[-1][1] > dur - 0.05 else 0.0
            inner = [r for r in runs if r[0] > 0.05 and r[1] < dur - 0.05 and (r[1] - r[0]) >= 0.30]
            t = timings[(d, v)]
            a0 = max(0.0, t["start_abs"] - 0.3)
            bounds = []   # expected breath points (pada boundary + repeats), clip time
            pd = t.get("padas") or []
            for p in pd:
                bounds.append((p["start_abs"] - a0, p["end_abs"] - a0))
                for r in p.get("repeats", []):
                    bounds.append((r["start_abs"] - a0, r["end_abs"] - a0))
            pauses = []
            for (s, e) in inner:
                at_boundary = any(s >= b0 - 0.4 and e <= b1 + 0.4 for b0, b1 in [(b[1], b[1] + 1.2) for b in bounds]) or \
                              any(abs(s - b[1]) < 0.6 for b in bounds)
                pauses.append({"t0": round(s, 2), "t1": round(e, 2), "len": round(e - s, 2), "at_pada_boundary": bool(at_boundary)})
            # edges: is speech already/still loud in the first/last 40 ms?
            edge_start = float(db[:4].mean() - ref)
            edge_end = float(db[-4:].mean() - ref)
            # noise bursts: broadband (flat>0.45) frames that are >10 dB above the local (1 s) median
            med = np.array([np.median(db[max(0, k - 50):k + 50]) for k in range(len(db))])
            burst = (flat > 0.45) & (db - med > 10) & (db > ref - 25)
            bursts = []
            k = 0
            while k < len(burst):
                if burst[k]:
                    m = k
                    while m < len(burst) and burst[m]:
                        m += 1
                    if (m - k) * HOP / SR >= 0.03:
                        bursts.append({"t0": round(k * HOP / SR, 2), "t1": round(m * HOP / SR, 2)})
                    k = m
                else:
                    k += 1
            peak = float(np.abs(x).max())
            rs, rw = restart_score(mfcc(x))
            rows[f"{d}.{v}"] = {
                "day": d, "verse": v, "dur_s": round(dur, 2), "ref_db": round(float(ref), 1), "floor_db": round(float(floor), 1),
                "lead_sil": round(lead, 2), "trail_sil": round(trail, 2), "edge_start_db": round(edge_start, 1), "edge_end_db": round(edge_end, 1),
                "pauses": pauses, "bursts": bursts, "peak": round(peak, 3), "clip_samples": int((np.abs(x) >= 0.99).sum()),
                "restart_sim": round(rs, 3), "restart_at": [round(w, 2) for w in rw] if rw else None,
                "align_score_existing": t.get("align_score"),
            }
        print("day", d, "done", flush=True)
    # cross-day normalisation
    for v in L.VERSES:
        durs = {d: rows[f"{d}.{v}"]["dur_s"] for d in L.DAYS}
        med = float(np.median(list(durs.values())))
        sims = [rows[f"{d}.{v}"]["restart_sim"] for d in L.DAYS]
        for d in L.DAYS:
            r = rows[f"{d}.{v}"]
            r["dur_median_verse"] = round(med, 2)
            r["dur_ratio"] = round(r["dur_s"] / med, 3)
            r["restart_sim_z"] = round((r["restart_sim"] - np.median(sims)) / (np.std(sims) + 0.02), 2)
    # per-day normalised alignment score
    for d in L.DAYS:
        sc = [rows[f"{d}.{v}"]["align_score_existing"] for v in L.VERSES]
        m = float(np.median(sc))
        for v in L.VERSES:
            rows[f"{d}.{v}"]["align_score_dayrel"] = round(rows[f"{d}.{v}"]["align_score_existing"] - m, 3)
    os.makedirs(f"{L.ROOT}/out", exist_ok=True)
    json.dump(rows, open(f"{L.ROOT}/out/prescreen.json", "w", encoding="utf-8", newline="\n"), indent=1)
    print("wrote out/prescreen.json")


if __name__ == "__main__":
    main()
