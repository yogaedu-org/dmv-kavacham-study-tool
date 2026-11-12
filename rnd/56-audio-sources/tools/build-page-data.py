"""Build the two small data files the side page needs (dmv #56 / #57). No audio is read or written.

    python rnd/56-audio-sources/tools/build-page-data.py --results <results.json of the #55 analysis>

Writes, next to the page:
  page-data.json         per verse: Devanagari + IAST (NFC, from data/verses.json), the #55 Day 2 confidence and
                         findings summary, per-akshara reference timings (for the #57 difference view)
  audio-config.json      the audio manifest the player is driven by (verse id, file, sha256, duration, set label;
                         one offline source and one cloud source; no audio is stored here)

The #55 numbers are an estimate, not a measured probability (see the analysis METHOD.md).
"""
import argparse, json, os, sys, unicodedata

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(OUT))
DAY = 2
AUDIO_MANIFEST = os.path.join(ROOT, "rnd", "kavacham-audio-alignment", "dmv-kavacham", "audio-manifest.json")
ap = argparse.ArgumentParser()
ap.add_argument("--results", required=True)
ap.add_argument("--mock-cloud", default="http://127.0.0.1:8771/")
args = ap.parse_args()

nfc = lambda s: unicodedata.normalize("NFC", s)
res = json.load(open(args.results, encoding="utf-8"))
verses = json.load(open(os.path.join(ROOT, "data", "verses.json"), encoding="utf-8"))["verses"]
am = json.load(open(AUDIO_MANIFEST, encoding="utf-8"))
by_path = {f["path"]: f for f in am["files"]}
assert res["recommended_day"] == DAY, "the analysis no longer recommends Day %d" % DAY

out_verses, cfg_verses = [], []
for v in verses:
    n = v["number"]
    t = res["takes"]["%d.%d" % (DAY, n)]
    syl = res["syllables"][str(n)]
    assert len(syl) == len(t["syl_t"]), "syllable/timing count differs for verse %d" % n
    padas = t["padas"]
    # verse 14's closing line repeats a variable number of times; the single-pass alignment of it is not trustworthy
    last_line = 0 if n == 14 else len(padas) - 1
    span = [padas[0]["t0"], padas[last_line]["t1"]]
    out_verses.append({
        "id": n,
        "sanskrit": nfc(v["sanskrit"]),
        "transliteration": nfc(v["transliteration"]),
        "conf": t["conf"],
        "padas": [{"line": p["line"], "conf": p["conf"], "na": p["na"]} for p in padas],
        "findings": [{k: f.get(k) for k in ("kind", "tier", "expected", "heard", "t_start")} for f in t["findings"]],
        "dur_s": t["dur_s"],
        "analysis_span": span,
        "analysis_note": "closing line repeats a variable number of times: only line 1 is compared" if n == 14 else None,
        "syllables": [{"i": s["i"], "deva": nfc(s["deva"]), "iast": nfc(s["iast"]), "line": s["line"]} for s in syl if s["line"] <= last_line],
        "syl_t": t["syl_t"][: len([s for s in syl if s["line"] <= last_line])],
    })
    rel = "rnd/kavacham-audio-alignment/dmv-kavacham/audio/day%d/verse%02d.mp3" % (DAY, n)
    a = by_path[rel]
    cfg_verses.append({"id": n, "file": {"offline": "verse%02d.mp3" % n, "cloud": "verse%02d.mp3" % n},
                       "sha256": a["sha256"], "bytes": a["bytes"], "duration": t["dur_s"], "set": "Day %d" % DAY,
                       "_release_asset": a["asset"]})

dc = res["day_conf"][str(DAY)]
page = {
    "generated_from": "#55 analysis results.json (recommended_day=%d)" % res["recommended_day"],
    "set_label": "Day %d, recommended by the #55 analysis" % DAY,
    "overall": {"mean": dc["mean"], "n_scored": dc["n_scored"], "n_above_70": dc["n_above"],
                "note": "estimate from the #55 method, not a measured probability; weights are not fitted"},
    "verses": out_verses,
}
json.dump(page, open(os.path.join(OUT, "page-data.json"), "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)

def config(cloud_base, release_names):
    vs = []
    for v in cfg_verses:
        v = dict(v)
        asset = v.pop("_release_asset")
        if release_names:
            v["file"] = {"cloud": asset, "offline": v["file"]["offline"]}
        vs.append(v)
    return {"version": 1, "set": {"id": "day%d" % DAY, "label": page["set_label"]},
            "sources": [{"kind": "custom", "label": "your own files"},
                        {"kind": "offline", "base": "local-audio/offline/", "label": "offline folder"},
                        {"kind": "cloud", "base": cloud_base, "label": "cloud"}],
            "order": ["custom", "offline", "cloud"], "verses": vs}

# GitHub release assets are NOT offered as a cloud source: report 02 measured no CORS headers and a draft release answers 404.
for name, cfg in (("audio-config.json", config(args.mock_cloud, False)),):
    json.dump(cfg, open(os.path.join(OUT, name), "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
print("wrote page-data.json (%d verses), audio-config.json" % len(out_verses))
