#!/usr/bin/env python
"""Silence-snap Kavacham verse/pada ENDS to the true syllable end for one day (#9).

  python snap_kavacham_ends.py <day_num>

MMS_FA (the forced aligner) ends spans slightly EARLY -- worst on sustained notes
(verse-1 Om) and trailing syllables (verses cut off on loop). This deterministic
post-step, for each verse, finds the real end of the last sung syllable via ffmpeg
silencedetect on the ORIGINAL recording and moves the end there, then re-cuts the
verse clip with proper tail. The clip START (start_abs - 0.3) is unchanged, so all
pada clip-relative offsets stay valid. Also fixes verse-1 om_end_abs from a finer
onset of the first post-Om word. Reproducible + deterministic -- safe to re-run.
Run with PYTHONIOENCODING=utf-8 PYTHONUTF8=1
"""
import sys, os, re, json, glob, subprocess
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO = r"C:\Users\kaanchan\Projects\Yoga\Navaratri Online Sadhana"
KAV = os.path.join(REPO, "reference", "chants", "dmv-kavacham")
FF = r"C:\Users\kaanchan\bin\FFmpeg\ffmpeg-latest\bin\ffmpeg.exe"
n = int(sys.argv[1])

timings_path = os.path.join(KAV, "kavacham-verse-timings.json" if n == 3 else f"kavacham-verse-timings-day{n}.json")
timings = json.load(open(timings_path, encoding="utf-8"))
verses = timings["verses"]
day_dir = next(p for p in glob.glob(os.path.join(REPO, "2026 July - Ashadha Navaratri", f"Day {n} - *")))
m4a = glob.glob(os.path.join(day_dir, "recordings", "*_Recording.m4a"))[0]
clipdir = os.path.join(KAV, "audio", "verses" if n == 3 else f"day{n}")


def silence_starts(a0, a1, thr="-33dB", d="0.25"):
    """silence_start times (absolute) in [a0,a1] of the original recording."""
    p = subprocess.run([FF, "-nostdin", "-ss", f"{a0:.2f}", "-to", f"{a1:.2f}", "-i", m4a,
                        "-af", f"silencedetect=noise={thr}:d={d}", "-f", "null", "-"],
                       capture_output=True, text=True)
    return sorted(a0 + float(x) for x in re.findall(r"silence_start:\s*([\d.]+)", p.stderr))


def last_end(v):
    l2 = v["padas"][1]
    return l2["repeats"][-1]["end_abs"] if "repeats" in l2 else l2["end_abs"]


def set_last_end(v, t):
    l2 = v["padas"][1]
    if "repeats" in l2:
        l2["repeats"][-1]["end_abs"] = t
    l2["end_abs"] = max(l2["end_abs"], t) if "repeats" not in l2 else l2["end_abs"]
    if "repeats" not in l2:
        l2["end_abs"] = t
    v["end_abs"] = t


# --- verse-1 Om: move om_end to the first post-Om word onset (MMS under-measures the held Om) ---
v1 = verses[0]
if v1["padas"][0].get("om_end_abs"):
    # first real silence/dip is rare here; use the aligner's SECOND word start as Om end proxy.
    # (word 2 = first line-1 word after Om.) Fall back: leave as-is.
    clip_t0 = max(0.0, v1["start_abs"] - 0.3)
    # detect a dip in the first 2.5s; else nudge om_end to +1.15s (measured Om length on Day 5)
    dips = silence_starts(clip_t0, clip_t0 + 2.5, thr="-30dB", d="0.12")
    om_new = next((s for s in dips if s > clip_t0 + 0.8), clip_t0 + 1.15)
    old = v1["padas"][0]["om_end_abs"]
    v1["padas"][0]["om_end_abs"] = round(om_new, 2)
    print(f"  verse 1 Om end: {old} -> {round(om_new,2)}  (+{om_new-old:.2f}s, excludes held-Om tail)")

# --- silence-snap each verse's last-syllable end ---
for i, v in enumerate(verses):
    le = last_end(v)
    nxt = verses[i + 1]["padas"][0]["start_abs"] if i + 1 < len(verses) else None
    hi = (nxt - 0.05) if nxt else (le + 4.0)
    starts = silence_starts(le - 1.2, hi)
    # the syllable was still sounding at/just-before `le`; its true end is the first
    # silence_start at or after (le - 0.4). cap before the next verse.
    cand = [s for s in starts if s >= le - 0.4 and (nxt is None or s < nxt - 0.05)]
    if cand:
        true_end = round(cand[0], 2)
        if abs(true_end - le) > 0.05:
            print(f"  verse {v['n']:2}: end {le:.2f} -> {true_end:.2f}  (+{true_end-le:.2f}s)")
            set_last_end(v, true_end)
        le = true_end
    # re-cut clip: start unchanged, tail to true end + 0.35 (capped before next verse)
    a0 = max(0.0, v["start_abs"] - 0.3)
    a1 = min(le + 0.35, (nxt - 0.03) if nxt else le + 0.35)
    subprocess.run([FF, "-nostdin", "-loglevel", "error", "-y", "-ss", f"{a0:.2f}", "-to", f"{a1:.2f}",
                    "-i", m4a, "-ac", "1", "-ar", "44100", "-b:a", "128k",
                    os.path.join(clipdir, f"verse{v['n']:02d}.mp3")], check=True)

json.dump(timings, open(timings_path, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
print(f"[day{n}] snapped ends + re-cut {len(verses)} clips -> {timings_path}")
