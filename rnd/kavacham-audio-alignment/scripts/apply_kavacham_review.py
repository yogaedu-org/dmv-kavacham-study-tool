#!/usr/bin/env python
"""Write a navaratri-cue-review export back into kavacham-verse-timings-dayN.json (#9).

  python apply_kavacham_review.py <day_num> <exported-snapshot.json>

<exported-snapshot.json> is the file downloaded via the review tool's "Export JSON"
button (Downloads\\navaratri-day1-cues-*.json). Two kinds of markers are applied:

- verseNN: whole-verse boundary. Updates start_abs (clip_start_abs + t), recomputes
  end_abs/dur_s from the NEXT verse's (possibly also-corrected) start_abs, re-cuts
  that verse's mp3 from the original m4a, and clears align_score (manual correction,
  the aligner's confidence no longer applies).
- vNN-om / vNN-l1end / vNN-l2start / vNN-rep0end / vNN-rep1start: pada (line-level)
  boundaries -- IDs built by build_kavacham_review.py. Written directly into that
  verse's "padas" entry; no mp3 re-cut needed, these are just timestamps within the
  verse's own already-correct clip.

Only touches markers the snapshot shows as actually moved -- everything else is left as-is.
Run with PYTHONIOENCODING=utf-8 PYTHONUTF8=1
"""
import sys, os, json, glob, re, subprocess
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO = r"C:\Users\kaanchan\Projects\Yoga\Navaratri Online Sadhana"
KAV = os.path.join(REPO, "reference", "chants", "dmv-kavacham")
FF = r"C:\Users\kaanchan\bin\FFmpeg\ffmpeg-latest\bin\ffmpeg.exe"

n = int(sys.argv[1])
snapshot_path = sys.argv[2]

manifest_path = os.path.join(REPO, "tools", "navaratri-cue-review", "public", "manifest.json")
manifest = json.load(open(manifest_path, encoding="utf-8"))
clip_start_abs = manifest["clip_start_abs"]

snapshot = json.load(open(snapshot_path, encoding="utf-8"))
moved = {m["id"]: m["t"] for m in snapshot["mahavidyas"]}

timings_path = os.path.join(KAV, "kavacham-verse-timings.json" if n == 3 else f"kavacham-verse-timings-day{n}.json")
timings = json.load(open(timings_path, encoding="utf-8"))
verses = timings["verses"]
by_n = {v["n"]: v for v in verses}

def pada_field(v, suffix):
    """(container_dict, key) for a pada-marker suffix, or None if this verse lacks it."""
    if "padas" not in v:
        return None
    line1, line2 = v["padas"]
    return {
        "om": (line1, "om_end_abs") if "om_end_abs" in line1 else None,
        "l1end": (line1, "end_abs"),
        "l2start": (line2, "start_abs"),
        "rep0end": (line2["repeats"][0], "end_abs") if "repeats" in line2 else None,
        "rep1start": (line2["repeats"][1], "start_abs") if "repeats" in line2 else None,
    }.get(suffix)


changed = []
pada_changed = []
for vid, t in moved.items():
    verse_m = re.match(r"verse(\d+)$", vid)
    pada_m = re.match(r"v(\d+)-(om|l1end|l2start|rep0end|rep1start)$", vid)
    new_abs = round(clip_start_abs + t, 2)

    if verse_m and int(verse_m.group(1)) in by_n:
        vn = int(verse_m.group(1))
        v = by_n[vn]
        if abs(new_abs - v["start_abs"]) < 0.01:
            continue
        print(f"  verse {vn:2}: start_abs {v['start_abs']:.2f} -> {new_abs:.2f}  (manual correction)")
        v["start_abs"] = new_abs
        v["align_score"] = None  # manually placed -- the aligner's confidence no longer applies
        v["manual"] = True
        changed.append(vid)
    elif pada_m and int(pada_m.group(1)) in by_n:
        vn, suffix = int(pada_m.group(1)), pada_m.group(2)
        field = pada_field(by_n[vn], suffix)
        if field is None:
            print(f"  verse {vn:2}: marker {vid} has no matching pada field -- skipped")
            continue
        container, key = field
        if abs(new_abs - container[key]) < 0.01:
            continue
        print(f"  verse {vn:2}: {suffix} {container[key]:.2f} -> {new_abs:.2f}  (manual correction)")
        container[key] = new_abs
        pada_changed.append(vid)

if not changed and not pada_changed:
    sys.exit(f"no markers in {snapshot_path} differ from the current timings for day {n} -- nothing to apply")
if pada_changed:
    print(f"[day{n}] applied {len(pada_changed)} pada correction(s) directly, no mp3 re-cut needed")
if not changed:
    json.dump(timings, open(timings_path, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
    print(f"[day{n}] wrote pada-only corrections -> {timings_path}")
    sys.exit(0)

verses.sort(key=lambda v: v["start_abs"])
for i, v in enumerate(verses):
    nxt = verses[i + 1] if i + 1 < len(verses) else None
    v["end_abs"] = round(nxt["start_abs"], 2) if nxt else round(v["start_abs"] + v.get("dur_s", 15), 2)
    v["dur_s"] = round(v["end_abs"] - v["start_abs"], 2)

day_dir = next(p for p in glob.glob(os.path.join(REPO, "2026 July - Ashadha Navaratri", f"Day {n} - *")))
m4a = glob.glob(os.path.join(day_dir, "recordings", "*_Recording.m4a"))[0]
outdir = os.path.join(KAV, "audio", "verses" if n == 3 else f"day{n}")

for vid in changed:
    vn = int(vid.replace("verse", ""))
    v = by_n[vn]
    clip = os.path.join(outdir, f"verse{vn:02d}.mp3")
    subprocess.run([FF, "-nostdin", "-loglevel", "error", "-y",
                    "-ss", f"{max(0, v['start_abs']-0.3):.2f}", "-to", f"{v['end_abs']+0.3:.2f}",
                    "-i", m4a, "-ac", "1", "-ar", "44100", "-b:a", "128k", clip], check=True)
    print(f"  re-cut {clip}")

json.dump(timings, open(timings_path, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
print(f"[day{n}] applied {len(changed)} manual correction(s) -> {timings_path}")
