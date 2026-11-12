"""Builds <chant>/review.html from review_template.html and chant.json, and (when the analysis scratch has it)
merges the known-slip calibration into <chant>/results.json. CPU only, no model needed.

    python build_review.py [chant folder]      # default: the chant folder this script sits in (../..)

The page itself holds no data: it reads chant.json and results.json at run time. The template fills in only the
chant title. To give a second chant the same page: put chant.json + results.json in its folder (same results schema,
written by that chant's own analysis) and run this with that folder.

Calibration: if <work>/out/synthetic_calibration.json exists (written by synth_check.py; <work> is dmvlib.ROOT,
default <chant>/review/work, or $DMV_REVIEW_WORK) it is merged into results.json together with synth_conf.json;
otherwise results.json keeps the calibration it already has.
"""
import html
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
CHANT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.abspath(os.path.join(HERE, "..", ".."))
WORK = os.environ.get("DMV_REVIEW_WORK") or os.path.join(CHANT, "review", "work")

cfg = json.load(open(f"{CHANT}/chant.json", encoding="utf-8"))
results_path = f"{CHANT}/{cfg.get('results', 'results.json')}"
r = json.load(open(results_path, encoding="utf-8"))

cal_path = f"{WORK}/out/synthetic_calibration.json"
if os.path.isfile(cal_path):
    cal = json.load(open(cal_path, encoding="utf-8"))
    det, rows = 0, []
    for c in cal:
        a, b = c["true_syll"]
        ok = {}
        for nm in ("B", "C"):
            fl = [k for k in c[nm]["flagged_syll"] if a - 1 <= k <= b + 1]
            ins = [i for i in c[nm]["ins"] if a - 1 <= i[0] <= b + 1]
            ok[nm] = bool(fl or ins)
        rows.append({"case": c["case"], "kind": c["kind"], "true_syll": c["true_syll"], "located_by_B": ok["B"], "located_by_C": ok["C"]})
        det += ok["B"] and ok["C"]
    r["calibration"] = {"n": len(cal), "detected": det, "rows": rows,
                        "note": "the spliced repeat was heard by both letter-level listeners (CTC letters and Whisper) but placed several syllables away, so it would be a listen-and-judge lead" if any(x["kind"] == "repeat" and not (x["located_by_B"] and x["located_by_C"]) for x in rows) else ""}
    print("calibration merged from", cal_path)
else:
    print("no", cal_path, "- keeping the calibration already in results.json")


def finding_conf(key, f):
    """Confidence (0-95) that a finding is real, from what results.json already holds:
    100 * (sources that flagged it) / (sources that could have: pass A if it ran on that line, pass B, pass C unless
    Whisper looped on the clip, plus the silence meter when it confirmed the finding), capped at 95 like the line scores.
    An audio defect no pass flagged is a direct measurement (duration against the other days, loud first/last 40 ms):
    1 of 1, so the cap. See METHOD.md, 'Confidence of a single finding'."""
    v = key.split(".")[1]
    pads = r["takes"][key]["padas"]
    if f.get("syll"):
        pa = pads[r["syllables"][v][f["syll"][0]]["line"]]
        a_ran = bool(pa["a_ran"])
    else:
        a_ran = any(p["a_ran"] for p in pads)
    agree = f.get("agreeing_sources")
    if agree is None:
        agree = f.get("passes_agreeing", 0)
    ran = int(a_ran) + 1 + int(key not in r.get("whisper_void_clips", [])) + int(bool(f.get("signal")))
    if f["tier"] == "defect" and agree == 0:
        agree, ran = 1, 1
    ran = max(ran, agree, 1)
    return int(min(95, round(100 * agree / ran)))


for _key, _take in r["takes"].items():
    for _f in _take["findings"]:
        _f["fconf"] = finding_conf(_key, _f)
sc = f"{CHANT}/synth_conf.json"
if os.path.isfile(sc):
    r["synth_conf"] = json.load(open(sc, encoding="utf-8"))
json.dump(r, open(results_path, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)

tpl = open(f"{HERE}/review_template.html", encoding="utf-8").read()
out = tpl.replace("__TITLE__", html.escape(cfg.get("title", "Chant"))).replace("__FAVICON__", html.escape(cfg.get("favicon") or "data:,"))
open(f"{CHANT}/review.html", "w", encoding="utf-8", newline="\n").write(out)
print("review.html", os.path.getsize(f"{CHANT}/review.html"), "bytes;", results_path, os.path.getsize(results_path), "bytes")
