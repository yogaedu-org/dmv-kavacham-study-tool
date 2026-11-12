import json, os, subprocess, sys
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dmvlib as L
mode = sys.argv[1]
if subprocess.run(["nvidia-smi", "--query-compute-apps=pid", "--format=csv,noheader"], capture_output=True, text=True).stdout.strip():
    sys.exit("gpu-guard: foreign GPU process")
cases = json.load(open(f"{L.ROOT}/work/synth/cases.json"))
out = {}
if mode == "mms":
    import numpy as np, soundfile as sf, torch, torchaudio
    b = torchaudio.pipelines.MMS_FA; m = b.get_model().to("cuda").eval(); lab = b.get_labels()
    for c in cases:
        x, _ = sf.read(f"{L.ROOT}/work/synth/{c['name']}.wav", dtype="float32")
        with torch.inference_mode():
            e, _ = m(torch.from_numpy(x)[None].to("cuda"))
        e = torch.log_softmax(e[:, :, :-1], -1)[0].cpu(); am = e.argmax(-1).numpy()
        ls, prev = [], -1
        for a in am:
            if a != prev and a != 0: ls.append(lab[a])
            prev = a
        out[c["name"]] = "".join(ls)
else:
    from faster_whisper import WhisperModel
    m = WhisperModel("large-v2", device="cuda", compute_type="float16")
    for c in cases:
        segs, _ = m.transcribe(f"{L.ROOT}/work/synth/{c['name']}.wav", language="hi", beam_size=5, condition_on_previous_text=False, temperature=0.0, vad_filter=False)
        out[c["name"]] = " ".join(s.text.strip() for s in segs)
json.dump(out, open(f"{L.ROOT}/work/synth/out_{mode}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
