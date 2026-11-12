"""Step 2 (c): faster-whisper large-v2, no reference prompt, language fixed to Hindi (Devanagari output; 'sa' looped on d5v9 in a probe).
GPU, serial, gpu-guard rules: lock, no foreign GPU process, free-VRAM check, per-clip deadline."""
import json, os, subprocess, sys, time
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dmvlib as L
os.makedirs(L.ROOT, exist_ok=True)
LOCK = os.path.join(L.ROOT, "gpu-guard.lock")
q = subprocess.run(["nvidia-smi", "--query-compute-apps=pid,process_name", "--format=csv,noheader"], capture_output=True, text=True).stdout.strip()
if q:
    sys.exit(f"gpu-guard: foreign GPU process: {q}")
free = int(subprocess.run(["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"], capture_output=True, text=True).stdout.strip())
if free < 6000 or os.path.exists(LOCK):
    sys.exit(f"gpu-guard: free {free} MiB or lock held")
open(LOCK, "w").write(str(os.getpid()))
try:
    from faster_whisper import WhisperModel
    m = WhisperModel("large-v2", device="cuda", compute_type="float16")
    out = {}
    for d in L.DAYS:
        for v in L.VERSES:
            t0 = time.time()
            segs, info = m.transcribe(L.wav_path(d, v), language="hi", beam_size=5, word_timestamps=True,
                                      condition_on_previous_text=False, temperature=0.0, vad_filter=False)
            words, text = [], []
            for s in segs:
                text.append(s.text.strip())
                for w in (s.words or []):
                    words.append({"w": w.word.strip(), "t0": round(w.start, 2), "t1": round(w.end, 2), "p": round(w.probability, 3)})
            dt = time.time() - t0
            if dt > 120:
                sys.exit(f"gpu-guard: clip {d}.{v} took {dt:.0f}s; abort")
            out[f"{d}.{v}"] = {"text": " ".join(text), "words": words, "sec": round(dt, 1)}
        print("day", d, "done", flush=True)
    json.dump({"model": "faster-whisper large-v2 (Systran) float16", "faster_whisper": __import__("faster_whisper").__version__,
               "language": "hi", "clips": out}, open(f"{L.ROOT}/out/passC.json", "w", encoding="utf-8", newline="\n"), ensure_ascii=False)
finally:
    os.remove(LOCK)
