#!/usr/bin/env python
"""Add pāda (half-line) + repeat-aware timing to a day's kavacham-verse-timings-dayN.json (#9).

  python align_kavacham_padas.py <day_num>

Each of the 14 shlokas is two lines split by a single daṇḍa (।). This re-aligns
EACH VERSE'S OWN already-cut clip (audio/dayN/verseNN.mp3) against its own word
list split at the daṇḍa, adding a "padas" array:

  "padas": [
    {"line": 1, "start_abs": .., "end_abs": ..},
    {"line": 2, "start_abs": .., "end_abs": ..}          # or, if repeated:
    {"line": 2, "start_abs": .., "end_abs": .., "repeats": [{"start_abs":..,"end_abs":..}, ...]}
  ]

Repeat detection (verse 14's traditional triple repetition of the closing line,
confirmed varying 2x/3x by day via independent listening -- #9): if line 2's
aligned span runs much longer than its word-count-scaled share of line 1's pace,
it's flagged as repeated. Rather than guess the count from silence gaps (there's
a mid-phrase breath INSIDE each repetition too, so a raw gap count overcounts --
verified on Day 5, where 4 gaps were detected but only 2 repetitions are actually
sung), this re-aligns with line 2's words repeated K=2,3,4 times and keeps whichever
K the forced-aligner itself fits best (mean word score) -- the wrong K forces an
implausible stretch/compression and its score visibly degrades. Only fires when the
duration ratio actually indicates repetition -- a normal single-pass verse is
untouched (no "repeats" key).
Run with PYTHONIOENCODING=utf-8 PYTHONUTF8=1
"""
import sys, os, glob, json, re, subprocess, unicodedata
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO = r"C:\Users\kaanchan\Projects\Yoga\Navaratri Online Sadhana"
SHRUTI_BENCH = r"C:\Users\kaanchan\Projects\AI\shruti-transcript\bench"
FF = r"C:\Users\kaanchan\bin\FFmpeg\ffmpeg-latest\bin\ffmpeg.exe"
KAV = os.path.join(REPO, "reference", "chants", "dmv-kavacham")
sys.path.insert(0, SHRUTI_BENCH)
from align import align

n = int(sys.argv[1])
timings_path = os.path.join(KAV, "kavacham-verse-timings.json" if n == 3 else f"kavacham-verse-timings-day{n}.json")
timings = json.load(open(timings_path, encoding="utf-8"))
clipdir = os.path.join(KAV, "audio", "verses" if n == 3 else f"day{n}")

day_dir = next(p for p in glob.glob(os.path.join(REPO, "2026 July - Ashadha Navaratri", f"Day {n} - *")))
m4a = glob.glob(os.path.join(day_dir, "recordings", "*_Recording.m4a"))[0]


def rom(s):
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def words_of(text):
    return [w for raw in rom(text).split() if (w := re.sub(r"[^a-z']", "", raw))]


def best_repeat_count(wav, w1, w2, a0, max_k=4):
    """Try K=2..max_k copies of line2's words; return (K, spans) for whichever the
    forced-aligner fits best (highest mean score over the repeated portion)."""
    best = None
    for k in range(2, max_k + 1):
        spans, _, _ = align(wav, w1 + w2 * k)
        l2 = spans[len(w1):]
        mean_score = sum(s["score"] for s in l2) / len(l2)
        print(f"    K={k}: mean_score={mean_score:.3f}", flush=True)
        if best is None or mean_score > best[1]:
            best = (k, mean_score, l2)
    k, _, l2 = best
    reps = []
    for i in range(k):
        chunk = l2[i * len(w2):(i + 1) * len(w2)]
        reps.append({"start_abs": round(a0 + chunk[0]["start"], 2), "end_abs": round(a0 + chunk[-1]["end"], 2)})
    return reps


def align_verse_padas(v, w1, w2, a0):
    subprocess.run([FF, "-nostdin", "-loglevel", "error", "-y", "-i",
                    os.path.join(clipdir, f"verse{v['n']:02d}.mp3"),
                    "-ac", "1", "-ar", "16000", tmp_wav], check=True)
    spans, dt, dur = align(tmp_wav, w1 + w2)
    l1_spans, l2_spans = spans[:len(w1)], spans[len(w1):]
    line1 = {"line": 1, "start_abs": round(a0 + l1_spans[0]["start"], 2),
              "end_abs": round(a0 + l1_spans[-1]["end"], 2)}
    # Verse 1 opens with a standalone "Om" before the line's actual words -- flag where it
    # ends so a line-1 loop can skip re-saying it every cycle, while whole-verse/whole-chant
    # playback (which starts from line1's true start) still includes it naturally (#9).
    if w1[0] == "om" and len(w1) > 1:
        line1["om_end_abs"] = round(a0 + l1_spans[0]["end"], 2)
    line2_start_abs = round(a0 + l2_spans[0]["start"], 2)
    line2_end_abs = round(a0 + l2_spans[-1]["end"], 2)

    # Expected single-pass duration for line 2, scaled from line 1's own observed pace.
    line1_dur = line1["end_abs"] - line1["start_abs"]
    expected_line2_dur = line1_dur * (len(w2) / len(w1))
    actual_line2_dur = line2_end_abs - line2_start_abs

    line2 = {"line": 2, "start_abs": line2_start_abs, "end_abs": line2_end_abs}
    if actual_line2_dur > 1.5 * expected_line2_dur:
        print(f"  verse {v['n']:2}: line2 span looks repeated (ratio {actual_line2_dur/expected_line2_dur:.1f}x), "
              f"testing repeat counts...", flush=True)
        try:
            line2["repeats"] = best_repeat_count(tmp_wav, w1, w2, a0)
        except RuntimeError as e:
            print(f"  verse {v['n']:2}: repeat-count alignment failed ({e}) -- likely a known content "
                  f"mismatch in this verse's own clip; leaving line2 unsplit, needs manual review", flush=True)
    return line1, line2


tmp_wav = os.path.join(REPO, ".claude", "tmp", "kavacham_pada_align.16k.wav")
for v in timings["verses"]:
    iast = v["iast"]
    line1_text, line2_text = [t.strip() for t in iast.split("।", 1)]
    w1, w2 = words_of(line1_text), words_of(line2_text)
    a0 = max(0.0, v["start_abs"] - 0.3)  # matches the 0.3s pad the clip was originally cut with

    try:
        line1, line2 = align_verse_padas(v, w1, w2, a0)
    except RuntimeError as e:
        print(f"  verse {v['n']:2}: pada alignment failed ({e}) -- likely a known content mismatch "
              f"in this verse's own clip; skipping padas for this verse, needs manual review", flush=True)
        continue

    v["padas"] = [line1, line2]
    print(f"  verse {v['n']:2}: line1 {line1['start_abs']:.2f}-{line1['end_abs']:.2f}  "
          f"line2 {line2['start_abs']:.2f}-{line2['end_abs']:.2f}"
          f"{'  (' + str(len(line2.get('repeats', []))) + ' reps)' if 'repeats' in line2 else ''}", flush=True)

json.dump(timings, open(timings_path, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
os.remove(tmp_wav)
print(f"[day{n}] wrote padas for {len(timings['verses'])} verses -> {timings_path}")
