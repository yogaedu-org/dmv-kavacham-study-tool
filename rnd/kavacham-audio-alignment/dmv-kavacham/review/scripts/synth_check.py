import json, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8")
import dmvlib as L
from step3_merge import collapse_vowels, ref_for
vs = {r["n"]: r for r in L.load_verses()}
cases = json.load(open(f"{L.ROOT}/work/synth/cases.json"))
B = json.load(open(f"{L.ROOT}/work/synth/out_mms.json")); C = json.load(open(f"{L.ROOT}/work/synth/out_whisper.json"))
res = []
for c in cases:
    sy, opt = ref_for(c["verse"], L.syllabify(vs[c["verse"]]["dev"]))
    hb, _ = collapse_vowels(B[c["name"]]); hb = L.hyp_n_form(hb)
    hc, _ = collapse_vowels(L.hyp_n_form(L.deva_to_letters(re.sub(r"[।॥,.\-?!]", " ", unicodedata.normalize("NFC", C[c["name"]])))))
    row = {"case": c["name"], "kind": c["kind"], "true_syll": c["syll"]}
    for nm, h in (("B", hb), ("C", hc)):
        per, ins = L.compare_to_reference(sy, h, None, opt)
        fl = [k for k, p in enumerate(per) if p["cost"] >= 1.0]
        row[nm] = {"flagged_syll": fl, "ins": [(i["after_syll"], i["heard"]) for i in ins if i["cost"] >= 1.5]}
    res.append(row)
    print(row)
json.dump(res, open(f"{L.ROOT}/out/synthetic_calibration.json", "w"), indent=1)
