#!/usr/bin/env python
"""Build/refresh navaratri-cue-review's manifest for ONE day's DMV Kavacham chant (#9).

  python build_kavacham_review.py <day_num> [preroll_s=45] [postroll_s=10]

Re-cuts the review clip from the ORIGINAL m4a with a generous lead-in (default 45s)
so the real silence-before-chant boundary is visible for manual correction -- the
first cut only padded 0.7s past the aligner's own rough chant-start guess, which
landed mid-speech with no silence to snap to. Recomputes VAD (langseg env) and
waveform peaks for the new clip, and writes public/manifest.json + public/audio/.
Rerun with a different day_num to switch which day the review tool has loaded.
Run with PYTHONIOENCODING=utf-8 PYTHONUTF8=1
"""
import sys, os, json, glob, subprocess
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO = r"C:\Users\kaanchan\Projects\Yoga\Navaratri Online Sadhana"
TOOL = os.path.join(REPO, "tools", "navaratri-cue-review")
KAV = os.path.join(REPO, "reference", "chants", "dmv-kavacham")
FF = r"C:\Users\kaanchan\bin\FFmpeg\ffmpeg-latest\bin\ffmpeg.exe"
LANGSEG_PY = r"C:\Users\kaanchan\miniconda3\envs\langseg\python.exe"

n = int(sys.argv[1])
PREROLL = float(sys.argv[2]) if len(sys.argv) > 2 else 45.0
POSTROLL = float(sys.argv[3]) if len(sys.argv) > 3 else 10.0

timings_path = os.path.join(KAV, "kavacham-verse-timings.json" if n == 3 else f"kavacham-verse-timings-day{n}.json")
timings = json.load(open(timings_path, encoding="utf-8"))
chant_start, chant_end = timings["chant_span_abs"]
clip_start_abs = max(0.0, chant_start - PREROLL)
clip_end_abs = chant_end + POSTROLL

day_dir = next(p for p in glob.glob(os.path.join(REPO, "2026 July - Ashadha Navaratri", f"Day {n} - *")))
m4a = glob.glob(os.path.join(day_dir, "recordings", "*_Recording.m4a"))[0]

audio_name = f"kavacham-day{n}.m4a"
audio_out = os.path.join(TOOL, "public", "audio", audio_name)
os.makedirs(os.path.dirname(audio_out), exist_ok=True)
subprocess.run([FF, "-nostdin", "-loglevel", "error", "-y",
                "-ss", f"{clip_start_abs:.2f}", "-to", f"{clip_end_abs:.2f}", "-i", m4a,
                "-ac", "1", "-ar", "44100", "-c:a", "aac", "-b:a", "128k", audio_out], check=True)
print(f"[day{n}] audio clip {clip_start_abs:.1f}-{clip_end_abs:.1f}s "
      f"({clip_end_abs-clip_start_abs:.1f}s, preroll {PREROLL:.0f}s) -> {audio_out}", flush=True)

# 16k mono wav for VAD (temp, deleted after)
wav16 = os.path.join(REPO, ".claude", "tmp", f"kavacham-day{n}-review.16k.wav")
subprocess.run([FF, "-nostdin", "-loglevel", "error", "-y", "-i", audio_out,
                "-ac", "1", "-ar", "16000", wav16], check=True)
vad_out = os.path.join(REPO, ".claude", "tmp", f"kavacham-day{n}-vad.json")
subprocess.run([LANGSEG_PY, os.path.join(REPO, "tools", "lexicon", "run_vad.py"), wav16, vad_out], check=True)
os.remove(wav16)
vad = json.load(open(vad_out, encoding="utf-8"))
print(f"[day{n}] VAD: {len(vad)} speech regions", flush=True)

# Waveform peaks (browser can't decodeAudioData a clip this long reliably at full rate)
subprocess.run(["python", os.path.join(TOOL, "scripts", "gen_peaks.py"), audio_name], check=True, cwd=TOOL)

LOW_THRESH = 0.85
mahavidyas = []
for v in timings["verses"]:
    rel_t = round(v["start_abs"] - clip_start_abs, 2)
    low = v["align_score"] < LOW_THRESH
    mahavidyas.append({"id": f"verse{v['n']:02d}",
                        "label": f"Verse {v['n']}{' (LOW CONF)' if low else ''}",
                        "kind": "chant", "t": max(0.0, rel_t)})
    # Line-level (pada) markers -- reuses the same generic draggable channel so no frontend
    # changes are needed. IDs are parsed by apply_kavacham_review.py to know which JSON field
    # each corrected position writes back to (#9).
    if low or "padas" not in v:
        continue
    l1, l2 = v["padas"]
    vn = v["n"]

    def pt(marker_id, label, abs_t):
        mahavidyas.append({"id": marker_id, "label": f"Verse {vn}: {label}", "kind": "pada",
                            "t": max(0.0, round(abs_t - clip_start_abs, 2))})

    if "om_end_abs" in l1:
        pt(f"v{vn:02d}-om", "Om ends / rest of line 1 begins", l1["om_end_abs"])
    pt(f"v{vn:02d}-l1end", "line 1 ends", l1["end_abs"])
    pt(f"v{vn:02d}-l2start", "line 2 begins", l2["start_abs"])
    if "repeats" in l2:
        pt(f"v{vn:02d}-rep0end", "1st repetition of line 2 ends", l2["repeats"][0]["end_abs"])
        pt(f"v{vn:02d}-rep1start", "2nd repetition of line 2 begins", l2["repeats"][1]["start_abs"])

duration = clip_end_abs - clip_start_abs
manifest = {
    "project": "navaratri-cue-review",
    "day": f"kavacham-day{n}-review",
    "clip_start_abs": round(clip_start_abs, 2),   # absolute source-recording seconds at t=0 of this clip
    "title": f"Day {n} Kavacham -- 14 verse boundaries (manual correction)",
    "audio": f"audio/{audio_name}",
    "duration": duration,
    "markers": [{"id": "chant-start-est", "label": "Chant start (rough estimate -- drag to the real silence boundary)",
                 "kind": "chant", "t": round(chant_start - clip_start_abs, 2)}],
    "mahavidyas": mahavidyas,
    "vad": [[v["start"], v["end"]] for v in vad],
    "segments": [],
}
out = os.path.join(TOOL, "public", "manifest.json")
json.dump(manifest, open(out, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
print(f"[day{n}] wrote {out} | {len(mahavidyas)} verse markers | duration {duration:.1f}s", flush=True)
