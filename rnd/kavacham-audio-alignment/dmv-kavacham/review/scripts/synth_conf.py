"""Run the confidence formula on the 5 spliced calibration clips and on the same day-2 lines unspliced."""
import json, os, re, statistics as st, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8")
import dmvlib as L
from step3_merge import collapse_vowels, ref_for
R = json.load(open(f"{L.SITE}/results.json", encoding="utf-8")); CF = R["conf_params"]
vs = {r["n"]: r for r in L.load_verses()}
cases = json.load(open(f"{L.ROOT}/work/synth/cases.json")); B = json.load(open(f"{L.ROOT}/work/synth/out_mms.json")); C = json.load(open(f"{L.ROOT}/work/synth/out_whisper.json"))
FA = json.load(open(f"{L.SITE}/synth_fa.json"))
off = {d: st.median(p["post_mean"] - 0 for v in L.VERSES for p in R["takes"][f"{d}.{v}"]["padas"] if not (d == 1 and v in (1, 2))) for d in L.DAYS}
pref = {(v, q): st.median(R["takes"][f"{d}.{v}"]["padas"][q]["post_mean"] - off[d] for d in L.DAYS if not (d == 1 and v in (1, 2))) for v in L.VERSES for q in (0, 1)}
def conf(P, cB, cC, exB, exC, nsy, probable, judge):
    n = nsy
    sB = sum(0 if exB[i] else min(1.0, cB[i]) for i in range(n)); sC = sum(0 if exC[i] else min(1.0, cC[i]) for i in range(n))
    D = ((1 - sB / n) + (1 - sC / n)) / 2
    cleanB = not any(cB[i] >= 1 and not exB[i] for i in range(n)); cleanC = not any(cC[i] >= 1 and not exC[i] for i in range(n))
    N = (cleanB + cleanC + 1) / 3          # pass A assumed clean (not re-run for spliced clips): generous
    base = (CF["w_P"] * P + CF["w_D"] * D + CF["w_N"] * N) / (CF["w_P"] + CF["w_D"] + CF["w_N"])
    pen = min(CF["pen_cap"], CF["pen_probable"] * probable + CF["pen_judge"] * judge)
    return max(0.0, min(CF["cap"], 100 * base - pen))
rows = []
for c in cases:
    v = c["verse"]; a, b = c["syll"]
    sy, opt = ref_for(v, L.syllabify(vs[v]["dev"])); n0 = len([s for s in sy if s["rep"] == 1])
    hb, _ = collapse_vowels(B[c["name"]]); hb = L.hyp_n_form(hb)
    hc, _ = collapse_vowels(L.hyp_n_form(L.deva_to_letters(re.sub(r"[।॥,.\-?!]", " ", unicodedata.normalize("NFC", C[c["name"]])))))
    perB, insB = L.compare_to_reference(sy, hb, None, opt); perC, insC = L.compare_to_reference(sy, hc, None, opt)
    q = sy[a]["line"]; src = R["takes"][f"2.{v}"]["padas"][q]
    ks = src["syl"]; fa = FA[c["name"]]
    pm = st.mean(fa[k]["post"] for k in ks)
    P = max(0.0, min(1.0, CF["P_mid"] + ((pm - off[2]) - pref[(v, q)]) / CF["P_span"]))
    cB = [perB[k]["cost"] for k in ks]; cC = [perC[k]["cost"] for k in ks]
    fb = {k for k in ks if perB[k]["cost"] >= 1 and not src["exclB"][ks.index(k)]}; fc = {k for k in ks if perC[k]["cost"] >= 1 and not src["exclC"][ks.index(k)]}
    insb = [i["after_syll"] for i in insB if i["cost"] >= 1.5 and ks[0] - 1 <= i["after_syll"] <= ks[-1]]; insc = [i["after_syll"] for i in insC if i["cost"] >= 1.5 and ks[0] - 1 <= i["after_syll"] <= ks[-1]]
    probable = judge = 0
    near = lambda x, ys: any(abs(x - y) <= 1 for y in ys)
    for k in sorted(fb | fc):
        if k in fb and near(k, fc | set(insc)) or k in fc and near(k, fb | set(insb)): probable += 1
        else: judge += 1
    probable = max(0, probable - (1 if probable and fb & fc and len(fb & fc) > 1 else 0)) if False else probable
    # adjacent flagged syllables are one finding in the real pipeline: collapse runs
    flagged = sorted(fb | fc); runs = []
    for k in flagged:
        if runs and k - runs[-1][-1] <= 1: runs[-1].append(k)
        else: runs.append([k])
    probable = sum(1 for r in runs if any(k in fb for k in r) and any(k in fc for k in r)); judge = len(runs) - probable
    for ib in insb:
        if not any(abs(ib - ic) <= 3 for ic in insc): judge += 1
        else: probable += 1
    cs = conf(P, cB, cC, src["exclB"], src["exclC"], len(ks), probable, judge)
    rows.append({"case": c["case"] if "case" in c else c["name"], "kind": c["kind"], "line": q + 1, "unspliced": src["conf"], "spliced": round(cs, 1), "found_probable": probable, "found_judge": judge})
    print(rows[-1])
json.dump(rows, open(f"{L.SITE}/synth_conf.json", "w"), indent=1)
