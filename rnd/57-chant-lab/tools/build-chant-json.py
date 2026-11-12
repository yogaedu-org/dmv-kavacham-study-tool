"""Build rnd/57-chant-lab/chant.json: the ONE file that holds everything chant-specific (dmv #57).

    python rnd/57-chant-lab/tools/build-chant-json.py --results <results.json of the #55 analysis>

Reads (read only): the #55 analysis results.json (per-akshara reference timings, per-day confidence), the app's
data/verses.json (NFC text) and the two probe outputs kept in research/ (dtw_probe.json, zipa_gop_probe.json).
Writes chant.json beside the pages. No audio is read or written. To reuse the book for another chant, write a
chant.json of the same shape for it; the pages and scripts do not name this chant anywhere.
"""
import argparse, datetime, json, os, sys, unicodedata

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
BOOK = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(BOOK))
ap = argparse.ArgumentParser()
ap.add_argument("--results", required=True)
ap.add_argument("--set", default="2", help="reference day number (default 2, the #55 recommendation)")
ap.add_argument("--other", default="5", help="the other day whose clips the book can also play")
a = ap.parse_args()

nfc = lambda s: unicodedata.normalize("NFC", s)
res = json.load(open(a.results, encoding="utf-8"))
app = json.load(open(os.path.join(ROOT, "config.json"), encoding="utf-8"))["app"]
verses_src = json.load(open(os.path.join(ROOT, "data", "verses.json"), encoding="utf-8"))
dtw = json.load(open(os.path.join(BOOK, "research", "dtw_probe.json"), encoding="utf-8"))
zipa = json.load(open(os.path.join(BOOK, "research", "zipa_gop_probe.json"), encoding="utf-8"))
DAY = int(a.set)
assert res["recommended_day"] == DAY, "the analysis no longer recommends Day %d" % DAY

verses = []
for v in verses_src["verses"]:
    n = v["number"]
    t = res["takes"]["%d.%d" % (DAY, n)]
    syl = res["syllables"][str(n)]
    padas = t["padas"]
    last_line = 0 if n == 14 else len(padas) - 1      # verse 14's closing line repeats a variable number of times
    keep = [s for s in syl if s["line"] <= last_line]
    lines_dev = nfc(v["sanskrit"]).split("\n")
    lines_iast = nfc(v["transliteration"]).split("\n")
    verses.append({
        "id": n,
        "sanskrit": lines_dev,
        "transliteration": lines_iast,
        "duration_s": t["dur_s"],
        "analysis_span": [padas[0]["t0"], padas[last_line]["t1"]],
        "analysis_note": "the closing line repeats a variable number of times, so only line 1 is compared" if n == 14 else None,
        "confidence": {"mean": t["conf"]["mean"], "min": t["conf"]["min"], "lines": [p["conf"] for p in padas]},
        "syllables": [{"i": s["i"], "deva": nfc(s["deva"]), "iast": nfc(s["iast"]), "line": s["line"]} for s in keep],
        "syl_t": t["syl_t"][: len(keep)],
    })

days = []
for d in sorted(res["day_conf"], key=int):
    c = res["day_conf"][d]
    days.append({"day": int(d), "mean": c["mean"], "n_scored": c["n_scored"], "n_above_70": c["n_above"]})

by = {}
for r in dtw["rows"]:
    by.setdefault(r["verse"], {})[r["kind"]] = {"top": r["top"], "score": round(r["top_score"], 2), "hit": bool(r.get("hit_top1")), "slip": r["slip_syll"]}
dtw_rows = [{"verse": k, **v} for k, v in sorted(by.items())]
zb = {}
for r in zipa["rows"]:
    zb.setdefault(r["verse"], {})[r["kind"]] = {"top": r["top"], "z": round(r["top_z"], 2), "hit": bool(r["hit"])}
zipa_rows = [{"verse": k, **v} for k, v in sorted(zb.items())]

out = {
    "schema": 1,
    "generated": datetime.date.today().isoformat(),
    "generated_from": "#55 analysis results.json; research/dtw_probe.json; research/zipa_gop_probe.json; data/verses.json",
    "chant": {"id": "dmv-kavacham", "title": app["title"], "title_latin": verses_src["metadata"]["title"],
              "subtitle": app["subtitle"], "unit": "verse", "unit_count": len(verses), "line_name": "line"},
    "clips": {
        "base": "local-audio/",
        "path": "{set}/verse{nn}.mp3",
        "cloud_base": None,
        "note": "Audio is never committed (#48). Copy it with tools/copy-clips.py.",
    },
    "sets": [
        {"id": "day%d" % DAY, "label": "Day %d" % DAY, "role": "reference",
         "note": "the day the #55 analysis recommends: the most clean verses"},
        {"id": "day%s" % a.other, "label": "Day %s" % a.other, "role": "other take"},
    ],
    "reference_set": "day%d" % DAY,
    "evidence": {
        "days": days,
        "recommended_day": DAY,
        "days_note": "an estimate from the #55 method, not a measured probability; the weights were chosen by the analyst, not fitted",
        "dtw_boundary": dtw["boundary"],
        "dtw_per_take": [{"take": p["take"], "median_ms": round(p["median_ms"], 1), "p90_ms": round(p["p90_ms"], 1)} for p in dtw["per_take"]],
        "splice_dtw": {"summary": dtw["splice"], "rows": dtw_rows},
        "splice_zipa": {"summary": zipa["summary"], "rows": zipa_rows},
        "synthetic_55": res["calibration"],
    },
    "verses": verses,
}
path = os.path.join(BOOK, "chant.json")
json.dump(out, open(path, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
print("wrote %s: %d verses, %d bytes" % (path, len(verses), os.path.getsize(path)))
