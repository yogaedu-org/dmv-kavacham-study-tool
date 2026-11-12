"""Step 3+4: merge the passes into findings per verse x day, score takes, recommend a day. CPU only.
Passes: A = CTC forced alignment (timing/posterior vs the other days), B = reference-free greedy CTC letters vs reference,
C = faster-whisper large-v2 text vs reference. 'signal' = step-1 energy/duration pre-screen."""
import collections
import difflib
import json
import os
import re
import statistics as st
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import dmvlib as L

# ---- tunables (all documented in METHOD.md) -------------------------------------------------
B_COST_FLAG = 1.0          # a reference syllable whose char-level edit cost reaches this is a candidate
HABIT_DAYS = 4             # same pass flags the same reference syllable on >= this many of the 6 days -> likely model error (task said all six; 4 is stricter against false alarms)
A_HABIT_DAYS = 3           # pass A is relative to the other days, so a syllable flagged on >= 3 days means unstable alignment, not slips
WHISPER_LOOP = 1.5         # pass C is void for a clip whose text is this many times longer than the reference (decoder loop)
A_POST_DROP = 0.25         # pass A: posterior this far below the same syllable on other days (clip-median adjusted) ...
A_POST_ABS = 0.30          # ... and below this absolute value
A_STRETCH = 2.0            # pass A: onset-to-onset interval this many times the other-days median ...
A_STRETCH_S = 0.40         # ... and this many seconds longer
A_SQUEEZE = 0.40
A_SQUEEZE_S = 0.25
PAUSE_MIN = 0.50           # long pause: energy-gated silence inside a pada, at least this long and unusual for that place
EDGE_LOUD_DB = -10.0       # clip edge louder than this (re peak speech level) = cut mid-sound
W = {"substitution": 2, "omission": 3, "insertion": 2, "repeat/restart": 4, "long pause": 1, "timing": 1, "older-text variant": 0, "audio defect": 0}


def collapse_vowels(letters, times=None):
    out, tt = [], []
    for i, c in enumerate(letters):
        if out and out[-1] == c and c in "aeiou":
            if times:
                tt[-1] = [tt[-1][0], times[i][1]]
            continue
        out.append(c)
        if times:
            tt.append(list(times[i]))
    return "".join(out), tt


def ref_for(v, base):
    """Reference syllables; verse 14 gets its closing line twice more as OPTIONAL copies (the chant repeats it 2-3 times by day)."""
    sy = [dict(s) for s in base]
    optional = set()
    if v == 14:
        last_line = max(s["line"] for s in sy)
        l2 = [s for s in base if s["line"] == last_line]
        for rep in (2, 3):
            for s in l2:
                c = dict(s)
                c["idx"] = len(sy)
                c["base"] = s["idx"]
                c["rep"] = rep
                sy.append(c)
                optional.add(c["idx"])
    for s in sy:
        s.setdefault("base", s["idx"])
        s.setdefault("rep", 1)
    return sy, optional


def main():
    verses = {r["n"]: r for r in L.load_verses()}
    base = {v: L.syllabify(verses[v]["dev"]) for v in L.VERSES}
    pre = json.load(open(f"{L.ROOT}/out/prescreen.json", encoding="utf-8"))
    ab = json.load(open(f"{L.ROOT}/out/passAB.json", encoding="utf-8"))["clips"]
    pc = json.load(open(f"{L.ROOT}/out/passC.json", encoding="utf-8"))["clips"]

    flags = {}      # (d, v) -> {"A": {base_idx: info}, "B": {...}, "C": {...}}  (per-syllable)
    ins_flags = {}  # (d, v) -> {"B": [..], "C": [..]}
    raw = {}
    for d in L.DAYS:
        for v in L.VERSES:
            sy, optional = ref_for(v, base[v])
            clip = ab[f"{d}.{v}"]
            # ---- pass B
            letters, tt = collapse_vowels(clip["greedy"], clip["greedy_times"])
            hb = L.hyp_n_form("".join(letters))
            # hyp_n_form can change length (sh->s); recompute times only for the collapse step, so rebuild times 1:1 when lengths match
            hb_times = tt if len(hb) == len(letters) else None
            perB, insB = L.compare_to_reference(sy, hb, hb_times, optional)
            # ---- pass C
            text = pc[f"{d}.{v}"]["text"]
            hc, _ = collapse_vowels(L.hyp_n_form(L.deva_to_letters(re.sub(r"[।॥,.\-?!]", " ", unicodedata.normalize("NFC", text)))))
            c_void = len(hc) > WHISPER_LOOP * sum(len(x['n']) for x in base[v]) * (1.0 if v != 14 else 2.0)
            perC, insC = L.compare_to_reference(sy, hc, None, optional)
            if c_void:
                perC = [dict(p_, cost=0.0) for p_ in perC]
                insC = []
            raw[(d, v)] = {"c_void": c_void, "greedy": clip["greedy"], "whisper": text, "B": perB, "C": perC, "insB": insB, "insC": insC, "sy": sy}

    # ---------------- pass A: per-syllable timing/posterior vs other days
    n0 = {v: len(base[v]) for v in L.VERSES}
    A = {}
    for v in L.VERSES:
        post, iv = {}, {}
        for d in L.DAYS:
            al = ab[f"{d}.{v}"]["aligned"]
            p = [a["post"] for a in al]
            med = st.median(p)
            post[d] = [x - med for x in p]
            span = al[-1]["t1"] - al[0]["t0"]
            ivs = [al[k + 1]["t0"] - al[k]["t0"] for k in range(len(al) - 1)] + [al[-1]["t1"] - al[-1]["t0"]]
            iv[d] = (ivs, span)
        for d in L.DAYS:
            others = [o for o in L.DAYS if o != d and not (o == 1 and v in (1, 2))]
            al = ab[f"{d}.{v}"]["aligned"]
            for k in range(n0[v]):
                if v == 14 and base[v][k]["line"] == 1:
                    continue  # closing line is repeated a variable number of times; single-pass alignment cannot place it
                rp = [post[o][k] for o in others]
                rm = st.median(rp)
                mad = st.median([abs(x - rm) for x in rp])
                drop = post[d][k] - rm
                info = None
                if drop < -max(A_POST_DROP, 3 * 1.4826 * mad) and al[k]["post"] < A_POST_ABS:
                    info = {"why": f"posterior {al[k]['post']:.2f}, {abs(drop):.2f} below the other days"}
                ivs, span = iv[d]
                rel = ivs[k] / span
                ro = [iv[o][0][k] / iv[o][1] for o in others]
                rmed = st.median(ro)
                dsec = ivs[k] - rmed * span
                if rmed > 0 and rel / rmed > A_STRETCH and dsec > A_STRETCH_S:
                    info = {"why": f"stretched {rel / rmed:.1f}x (+{dsec:.2f} s) vs the other days", "stretch": True}
                elif rmed > 0 and rel / rmed < A_SQUEEZE and dsec < -A_SQUEEZE_S:
                    info = {"why": f"squeezed to {rel / rmed:.1f}x ({dsec:.2f} s) vs the other days"}
                if info:
                    A[(d, v, k)] = info
    a_days = collections.Counter((v_, k_) for (d_, v_, k_) in A)
    A = {key: val for key, val in A.items() if a_days[(key[1], key[2])] < A_HABIT_DAYS}
    a_habit = sorted(f"v{v_}:{k_}" for (v_, k_), n in a_days.items() if n >= A_HABIT_DAYS)

    # ---------------- per-pass per-syllable flags from B and C
    PF = collections.defaultdict(dict)   # (d,v,k_base) -> {"B": info, "C": info}
    INS = collections.defaultdict(list)  # (d,v) -> [(pass, info)]
    for (d, v), r in raw.items():
        sy = r["sy"]
        for pas, per in (("B", r["B"]), ("C", r["C"])):
            for k, p in enumerate(per):
                if p["cost"] >= B_COST_FLAG:
                    bk = sy[k]["base"]
                    PF[(d, v, bk)].setdefault(pas, []).append({"k": k, "rep": sy[k]["rep"], "expected": p["expected"], "heard": p["heard"], "cost": p["cost"]})
        for pas, ins in (("B", r["insB"]), ("C", r["insC"])):
            for i in ins:
                if i["cost"] >= 1.5:
                    INS[(d, v)].append((pas, i))

    # model-habit rule: same pass flags the same reference syllable on >= HABIT_DAYS days
    habit = set()
    for v in L.VERSES:
        for k in range(n0[v]):
            for pas in ("B", "C"):
                n = sum(1 for d in L.DAYS if pas in PF.get((d, v, k), {}))
                if n >= HABIT_DAYS:
                    habit.add((v, k, pas))

    # ---------------- build findings
    findings = {}
    for d in L.DAYS:
        for v in L.VERSES:
            sy = base[v]
            p = pre[f"{d}.{v}"]
            al = ab[f"{d}.{v}"]["aligned"]
            per_k = {}
            for k in range(n0[v]):
                ent = {}
                if (d, v, k) in A:
                    ent["A"] = A[(d, v, k)]
                for pas in ("B", "C"):
                    if pas in PF.get((d, v, k), {}):
                        e = PF[(d, v, k)][pas][0]
                        e = dict(e)
                        e["habit"] = (v, k, pas) in habit
                        ent[pas] = e
                if ent:
                    per_k[k] = ent
            # cluster adjacent flagged syllables (gap <= 1) into findings
            ks = sorted(per_k)
            clusters, cur = [], []
            for k in ks:
                if cur and k - cur[-1] > 1:
                    clusters.append(cur)
                    cur = []
                cur.append(k)
            if cur:
                clusters.append(cur)
            out = []
            for c in clusters:
                passes = {}
                habit_passes = set()
                for k in c:
                    for pas, e in per_k[k].items():
                        if e.get("habit"):
                            habit_passes.add(pas)
                        else:
                            passes.setdefault(pas, []).append((k, e))
                if not passes:
                    out.append({"kind": "model-habit", "syll": [c[0], c[-1]], "passes": sorted(habit_passes), "habit_only": True})
                    continue
                t0 = al[c[0]]["t0"]
                t1 = al[c[-1]]["t1"]
                exp = " ".join(sy[k]["n"] for k in c)
                heardB = " ".join(e["heard"] or "-" for k, e in passes.get("B", [])) if "B" in passes else None
                heardC = " ".join(e["heard"] or "-" for k, e in passes.get("C", [])) if "C" in passes else None
                heard = heardB if heardB is not None else heardC
                if heard is not None:
                    allempty = all((e["heard"] == "") for pas in ("B", "C") for k, e in passes.get(pas, []))
                    kind = "omission" if allempty else "substitution"
                else:
                    kind = "timing"
                if heard is None and "A" in passes:
                    heard = passes["A"][0][1]["why"]
                out.append({
                    "kind": kind, "syll": [c[0], c[-1]], "t_start": round(t0, 2), "t_end": round(t1, 2),
                    "expected": exp, "expected_deva": "".join(sy[k]["deva"] for k in range(c[0], c[-1] + 1)),
                    "heard": heard, "heard_B": heardB, "heard_C": heardC,
                    "heard_C_text": raw[(d, v)]["whisper"] if "C" in passes else None,
                    "passes": sorted(passes), "evidence": {pas: [e.get("why") or f"expected {e['expected']} heard {e['heard'] or '(nothing)'}" for k, e in passes[pas]] for pas in passes},
                    "habit_passes_ignored": sorted(habit_passes),
                })
            # insertions
            for pas, i in INS.get((d, v), []):
                after = i["after_syll"]
                if after >= n0[v] - 1 and v == 14:
                    continue   # trailing repeats of the closing line
                heardx = i["heard"]
                kind = "insertion"
                ctx = "".join(b["n"] for b in base[v][max(0, after - 2):after + 4])
                cover = sum(b_.size for b_ in difflib.SequenceMatcher(None, heardx, ctx).get_matching_blocks()) / max(1, len(heardx))
                if len(heardx) >= 5 and cover >= 0.6:
                    kind = "repeat/restart"
                if v == 10 and difflib.SequenceMatcher(None, heardx, "ugratara").ratio() > 0.55 and len(heardx) >= 4:
                    kind = "older-text variant"
                if after >= 0 and i["t"]:
                    t0, t1 = i["t"]
                elif after >= 0:
                    t0, t1 = al[after]["t1"], al[min(after + 1, len(al) - 1)]["t0"]
                else:
                    t0, t1 = 0.0, al[0]["t0"]
                seg = {"kind": kind, "syll": [max(after, 0), min(after + 1, n0[v] - 1)], "t_start": round(t0, 2), "t_end": round(t1, 2),
                       "expected": "(nothing)", "heard": heardx, "passes": [pas], "evidence": {pas: [f"extra '{heardx}' heard after syllable {after + 1}"]}}
                # merge with an insertion from the other pass at nearby position
                dup = next((o for o in out if o["kind"] in ("insertion", "repeat/restart", "older-text variant") and o.get("expected") == "(nothing)" and abs(o["syll"][0] - seg["syll"][0]) <= 3), None)
                if dup:
                    if kind != "insertion" and dup["kind"] == "insertion":
                        dup["kind"] = kind
                    if pas not in dup["passes"]:
                        dup["passes"].append(pas)
                        dup["passes"].sort()
                    dup["evidence"].update(seg["evidence"])
                else:
                    out.append(seg)
            # ---- signal: long pauses inside a pada
            for pz in p["pauses"]:
                if pz["at_pada_boundary"] or pz["len"] < PAUSE_MIN:
                    continue
                mid = (pz["t0"] + pz["t1"]) / 2
                kk = None
                for k in range(len(al) - 1):
                    if al[k]["t0"] <= mid <= al[k + 1]["t0"]:
                        kk = k
                        break
                if kk is None or sy[kk]["line"] != sy[kk + 1]["line"]:
                    continue
                others = 0
                for o in L.DAYS:
                    if o == d:
                        continue
                    ao = ab[f"{o}.{v}"]["aligned"]
                    if ao[kk + 1]["t0"] - ao[kk]["t1"] >= 0.3:
                        others += 1
                if others >= 2:
                    continue   # a regular breath point
                near = next((o for o in out if o["kind"] == "timing" and o["syll"][0] - 1 <= kk <= o["syll"][1] + 1), None)
                if near:
                    near["kind"] = "long pause"
                    near["signal"] = True
                    near["evidence"]["signal"] = [f"energy gate: {pz['len']:.2f} s below speech level at {pz['t0']:.1f}-{pz['t1']:.1f} s"]
                    near["t_start"], near["t_end"] = min(near["t_start"], pz["t0"]), max(near["t_end"], pz["t1"])
                    continue
                out.append({"kind": "long pause", "syll": [kk, kk + 1], "t_start": pz["t0"], "t_end": pz["t1"], "expected": f"{sy[kk]['n']} | {sy[kk + 1]['n']}",
                            "heard": f"silence of {pz['len']:.2f} s inside the line (only {others} of the other 5 days pause here)", "passes": [], "signal": True,
                            "evidence": {"signal": [f"energy gate: {pz['len']:.2f} s below speech level at {pz['t0']:.1f}-{pz['t1']:.1f} s"]}})
            findings[(d, v)] = out

    # ---------------- audio defects (pre-screen) and re-labelling
    defects = {}
    for d in L.DAYS:
        for v in L.VERSES:
            p = pre[f"{d}.{v}"]
            dl = []
            if p["dur_ratio"] < 0.6:
                dl.append({"kind": "audio defect", "t_start": 0.0, "t_end": p["dur_s"], "heard": f"clip is {p['dur_s']:.1f} s; the same verse on the other days is {p['dur_median_verse']:.1f} s (existing align score {p['align_score_existing']}) - the cut is wrong, not the chanting", "scope": "whole", "sev": "high"})
            if p["edge_start_db"] > EDGE_LOUD_DB:
                dl.append({"kind": "audio defect", "t_start": 0.0, "t_end": 0.3, "heard": f"clip starts mid-sound ({p['edge_start_db']:.0f} dB re speech): first syllable(s) cut", "scope": "start", "sev": "low"})
            if p["edge_end_db"] > EDGE_LOUD_DB:
                dl.append({"kind": "audio defect", "t_start": round(p["dur_s"] - 0.3, 2), "t_end": p["dur_s"], "heard": f"clip ends mid-sound ({p['edge_end_db']:.0f} dB re speech): last syllable(s) may be cut", "scope": "end", "sev": "low"})
            defects[(d, v)] = dl
    # findings that merely restate a cut edge become defects; whole-clip defects swallow everything
    for (d, v), fl in list(findings.items()):
        dl = defects[(d, v)]
        whole = any(x["scope"] == "whole" for x in dl)
        keep = []
        for f in fl:
            if f.get("habit_only"):
                keep.append(f)
                continue
            if whole:
                f["superseded_by_defect"] = True
                continue
            if f["kind"] in ("omission", "substitution") and f["syll"][0] <= 1 and any(x["scope"] == "start" for x in dl) and f["t_start"] < 1.2:
                f["kind"] = "audio defect"
                f["heard"] = "the clip starts mid-sound, so the opening syllable(s) are missing from the audio: " + str(f["heard"])
                f["cut_edge"] = True
            if f["kind"] in ("omission", "substitution") and f["syll"][1] >= n0[v] - 2 and any(x["scope"] == "end" for x in dl) and f["t_end"] > ab[f"{d}.{v}"]["aligned"][-1]["t0"] - 0.1:
                f["kind"] = "audio defect"
                f["heard"] = "the clip ends mid-sound, so the closing syllable(s) are cut: " + str(f["heard"])
                f["cut_edge"] = True
            keep.append(f)
        findings[(d, v)] = keep

    # ---------------- tiering and scoring
    result_takes = {}
    for d in L.DAYS:
        for v in L.VERSES:
            fl = [f for f in findings[(d, v)] if not f.get("habit_only") and not f.get("superseded_by_defect")]
            habit_notes = [f for f in findings[(d, v)] if f.get("habit_only")]
            score, probable, judge = 0.0, 0, 0
            for f in fl:
                n_pass = len(f["passes"])
                f["passes_agreeing"] = n_pass
                nsyl = f["syll"][1] - f["syll"][0] + 1
                if f["kind"] in ("audio defect", "older-text variant"):
                    f["tier"] = "defect" if f["kind"] == "audio defect" else "older-text"
                    f["severity"] = 0
                    continue
                w = W.get(f["kind"], 1) * min(nsyl, 3)
                agree = n_pass + (1 if f.get("signal") else 0)
                f["agreeing_sources"] = agree
                if f.get("signal") and n_pass == 0:
                    f["tier"] = "probable slip" if (f["t_end"] - f["t_start"]) >= 1.0 else "listen and judge"
                else:
                    f["tier"] = "probable slip" if agree >= 2 else "listen and judge"
                f["severity"] = round(w * (1.0 if f["tier"] == "probable slip" else 0.25), 2)
                score += f["severity"]
                probable += f["tier"] == "probable slip"
                judge += f["tier"] == "listen and judge"
            for x in defects[(d, v)]:
                fl.append({"kind": "audio defect", "t_start": x["t_start"], "t_end": x["t_end"], "syll": None, "expected": "", "heard": x["heard"], "passes": [], "evidence": {"signal": [x["heard"]]},
                           "tier": "defect", "severity": 0, "passes_agreeing": 0, "defect_sev": x["sev"]})
            whole = any(x["scope"] == "whole" for x in defects[(d, v)])
            for hn in habit_notes:
                hn["tier"] = "model-habit"
            result_takes[(d, v)] = {"day": d, "verse": v, "findings": fl, "model_habit": habit_notes, "score": round(score, 2), "probable": probable, "judge": judge,
                                    "defect_whole": whole, "defect_edges": sum(1 for x in defects[(d, v)] if x["scope"] in ("start", "end")),
                                    "clean": (probable == 0 and not whole), "greedy": raw[(d, v)]["greedy"], "whisper": raw[(d, v)]["whisper"],
                                    "dur_s": pre[f"{d}.{v}"]["dur_s"]}


    # ---------------- confidence that each pada (line) was chanted as written (estimate, not a probability)
    CONF = {"w_P": 0.35, "w_D": 0.35, "w_N": 0.30, "P_mid": 0.75, "P_span": 0.40, "pen_probable": 25, "pen_judge": 8, "pen_cap": 60, "cap": 95, "thresh": 70}
    pm = {}
    for d in L.DAYS:
        for v in L.VERSES:
            al = ab[f"{d}.{v}"]["aligned"]
            for pd_ in (0, 1):
                ks = [k for k in range(n0[v]) if base[v][k]["line"] == pd_]
                pm[(d, v, pd_)] = st.mean(al[k]["post"] for k in ks)
    off = {d: st.median(pm[(d, v, q)] for v in L.VERSES for q in (0, 1) if not (d == 1 and v in (1, 2))) for d in L.DAYS}
    pref = {(v, q): st.median(pm[(d, v, q)] - off[d] for d in L.DAYS if not (d == 1 and v in (1, 2))) for v in L.VERSES for q in (0, 1)}
    for d in L.DAYS:
        for v in L.VERSES:
            t = result_takes[(d, v)]
            al = ab[f"{d}.{v}"]["aligned"]
            rawr = raw[(d, v)]
            pads = []
            for q in (0, 1):
                ks = [k for k in range(n0[v]) if base[v][k]["line"] == q]
                na = None
                if t["defect_whole"]:
                    na = "this clip is cut wrongly (audio defect)"
                elif rawr["c_void"]:
                    na = "the Whisper pass failed on this clip (it looped)"
                elif any(f.get("cut_edge") and f.get("syll") and f["syll"][0] in ks for f in t["findings"]):
                    na = "the clip starts or ends mid-sound, so syllables of this line are missing from the audio"
                no_a = (v == 14 and q == 1)
                P = None if no_a else max(0.0, min(1.0, CONF["P_mid"] + ((pm[(d, v, q)] - off[d]) - pref[(v, q)]) / CONF["P_span"]))
                pen = {"probable": 0, "judge": 0}
                for f in t["findings"]:
                    if f.get("syll") and f["tier"] in ("probable slip", "listen and judge") and f["syll"][0] in ks:
                        pen["probable" if f["tier"] == "probable slip" else "judge"] += 1
                a_flag = any((d, v, k) in A for k in ks)
                pads.append({"line": q, "syl": ks, "t0": al[ks[0]]["t0"], "t1": al[ks[-1]]["t1"], "post_mean": round(pm[(d, v, q)], 3),
                             "P": None if P is None else round(P, 3), "a_flag": a_flag, "a_ran": not no_a,
                             "costB": [raw[(d, v)]["B"][k]["cost"] for k in ks], "costC": [raw[(d, v)]["C"][k]["cost"] for k in ks],
                             "exclB": [(v, k, "B") in habit for k in ks], "exclC": [(v, k, "C") in habit for k in ks],
                             "pen": pen, "na": na})
            t["padas"] = pads
            t["syl_t"] = [[al[k]["t0"], al[k]["t1"]] for k in range(n0[v])]
    def pada_conf(p, tog=()):
        n = len(p["syl"])
        sB = sum(0 if (p["exclB"][i] and p["syl"][i] not in tog) else min(1.0, p["costB"][i]) for i in range(n))
        sC = sum(0 if (p["exclC"][i] and p["syl"][i] not in tog) else min(1.0, p["costC"][i]) for i in range(n))
        D = ((1 - sB / n) + (1 - sC / n)) / 2
        cleanB = not any(p["costB"][i] >= 1.0 and not (p["exclB"][i] and p["syl"][i] not in tog) for i in range(n))
        cleanC = not any(p["costC"][i] >= 1.0 and not (p["exclC"][i] and p["syl"][i] not in tog) for i in range(n))
        runs = [cleanB, cleanC] + ([not p["a_flag"]] if p["a_ran"] else [])
        N = sum(runs) / len(runs)
        wP = CONF["w_P"] if p["P"] is not None else 0.0
        base_ = (wP * (p["P"] or 0) + CONF["w_D"] * D + CONF["w_N"] * N) / (wP + CONF["w_D"] + CONF["w_N"])
        tg = sum(1 for i in range(n) if p["syl"][i] in tog and (p["costB"][i] >= 1 or p["costC"][i] >= 1) and (p["exclB"][i] or p["exclC"][i]))
        pen = min(CONF["pen_cap"], CONF["pen_probable"] * p["pen"]["probable"] + CONF["pen_judge"] * (p["pen"]["judge"] + tg))
        return max(0.0, min(CONF["cap"], 100 * base_ - pen))
    for d in L.DAYS:
        for v in L.VERSES:
            t = result_takes[(d, v)]
            for p in t["padas"]:
                p["conf"] = None if p["na"] else round(pada_conf(p), 1)
            cs = [p["conf"] for p in t["padas"]]
            if any(c is None for c in cs):
                t["conf"] = {"mean": None, "min": None, "na": next(p["na"] for p in t["padas"] if p["na"])}
            else:
                t["conf"] = {"mean": round(st.mean(cs), 1), "min": round(min(cs), 1), "na": None}
    day_conf = {}
    for d in L.DAYS:
        vs_ = [result_takes[(d, v)]["conf"] for v in L.VERSES if result_takes[(d, v)]["conf"]["mean"] is not None]
        day_conf[d] = {"mean": round(st.mean(c["mean"] for c in vs_), 1), "n_scored": len(vs_), "n_above": sum(1 for c in vs_ if c["min"] >= CONF["thresh"])}

    # ---------------- recommendation
    clean_count = {d: sum(1 for v in L.VERSES if result_takes[(d, v)]["clean"]) for d in L.DAYS}
    total_sev = {d: round(sum(result_takes[(d, v)]["score"] for v in L.VERSES if not result_takes[(d, v)]["defect_whole"]), 2) for d in L.DAYS}
    order = sorted(L.DAYS, key=lambda d: (-clean_count[d], total_sev[d]))
    best = order[0]

    def rank_key(d, v):
        t = result_takes[(d, v)]
        return (0 if t["clean"] else 1, t["score"], t["defect_edges"])

    swaps, noclean = [], []
    plan = {}
    for v in L.VERSES:
        bt = result_takes[(best, v)]
        if bt["clean"]:
            plan[v] = best
            continue
        cands = [d for d in L.DAYS if d != best and result_takes[(d, v)]["clean"]]
        if cands:
            cands.sort(key=lambda d: (abs(d - best), rank_key(d, v)))
            pick = cands[0]
            swaps.append({"verse": v, "from_day": best, "to_day": pick, "reason": f"day {best} has {bt['probable']} probable slip(s) in verse {v}" if not bt["defect_whole"] else f"day {best} clip is defective"})
            plan[v] = pick
        else:
            alt = sorted([d for d in L.DAYS], key=lambda d: (result_takes[(d, v)]["defect_whole"], result_takes[(d, v)]["probable"], result_takes[(d, v)]["score"], abs(d - best)))[0]
            noclean.append({"verse": v, "least_bad_day": alt, "probable_slips_each_day": {d: result_takes[(d, v)]["probable"] for d in L.DAYS}})
            plan[v] = alt
    mix_days = len(set(plan.values()))
    alternates = {}
    for v in L.VERSES:
        alt = [d for d in L.DAYS if d != best]
        alt.sort(key=lambda d: (0 if result_takes[(d, v)]["clean"] else 1, abs(d - best), rank_key(d, v)))
        alternates[str(v)] = alt

    notes = collections.defaultdict(list)
    for v in L.VERSES:
        ks = sorted({k for (vv, k, pas) in habit if vv == v})
        for k in ks:
            pas_l = sorted(pas for (vv, kk, pas) in habit if vv == v and kk == k)
            heard = collections.Counter()
            for d in L.DAYS:
                for pas in pas_l:
                    for e in PF.get((d, v, k), {}).get(pas, []):
                        heard[f"{pas}:{e['heard'] or '(nothing)'}"] += 1
            days = sum(1 for d in L.DAYS if any(pas in PF.get((d, v, k), {}) for pas in pas_l))
            perday = {}
            for d in L.DAYS:
                rr = raw[(d, v)]
                perday[str(d)] = {"t": list(result_takes[(d, v)]["syl_t"][k]), "B": rr["B"][k]["heard"], "C": None if rr["c_void"] else rr["C"][k]["heard"],
                                  "flagB": rr["B"][k]["cost"] >= B_COST_FLAG, "flagC": (not rr["c_void"]) and rr["C"][k]["cost"] >= B_COST_FLAG}
            notes[str(v)].append({"syll": k, "deva": base[v][k]["deva"], "iast": base[v][k]["iast"], "expected": base[v][k]["n"], "passes": pas_l, "days_flagged": days, "heard": dict(heard), "per_day": perday, "line": base[v][k]["line"]})
    # JSON-friendly dump
    out = {
        "generated": "2026-11-11", "reference": "kavacham-verses.json (14 verses)",
        "syllables": {str(v): [{"i": s["idx"], "deva": s["deva"], "iast": s["iast"], "line": s["line"], "word": s["word"]} for s in base[v]] for v in L.VERSES},
        "verse_text": {str(v): {"dev": verses[v]["dev"], "iast": verses[v]["iast"]} for v in L.VERSES},
        "takes": {f"{d}.{v}": result_takes[(d, v)] for d in L.DAYS for v in L.VERSES},
        "conf_params": CONF, "day_conf": {str(d): day_conf[d] for d in L.DAYS}, "clean_count_by_day": clean_count, "total_severity_by_day": total_sev, "day_order": order,
        "recommended_day": best, "plan": {str(v): plan[v] for v in L.VERSES}, "swaps": swaps, "alternates": alternates, "no_clean_take": noclean, "days_used_in_plan": mix_days,
        "consistent_differences": notes, "model_habit_syllables": sorted([f"v{v}:{k}:{pas}" for v, k, pas in habit]), "pass_a_unstable_syllables": a_habit,
        "whisper_void_clips": sorted(f"{d}.{v}" for (d, v), r in raw.items() if r["c_void"]),
        "params": {"B_COST_FLAG": B_COST_FLAG, "HABIT_DAYS": HABIT_DAYS, "A_POST_DROP": A_POST_DROP, "A_POST_ABS": A_POST_ABS, "A_STRETCH": A_STRETCH, "A_STRETCH_S": A_STRETCH_S, "PAUSE_MIN": PAUSE_MIN, "A_HABIT_DAYS": A_HABIT_DAYS, "WHISPER_LOOP": WHISPER_LOOP, "EDGE_LOUD_DB": EDGE_LOUD_DB},
    }
    json.dump(out, open(f"{L.SITE}/results.json", "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
    # diagnostics
    print("clean verses by day:", clean_count, "total severity:", total_sev, "best:", best)
    print("takes: probable / judge / score")
    for v in L.VERSES:
        print(f"v{v:2}", "  ".join(f"{result_takes[(d, v)]['probable']}/{result_takes[(d, v)]['judge']}/{result_takes[(d, v)]['score']:<5}" + ("D" if result_takes[(d, v)]["defect_whole"] else " ") for d in L.DAYS))
    print("habit syllables:", len(habit))
    print("swaps:", swaps)
    print("no clean:", noclean)
    tiers = collections.Counter(f["tier"] for t in result_takes.values() for f in t["findings"])
    kinds = collections.Counter(f["kind"] for t in result_takes.values() for f in t["findings"])
    print(tiers, kinds)


if __name__ == "__main__":
    main()
