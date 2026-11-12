"""Build a recitation set's follow-along timings.json from the #55 per-akshara forced alignment (#61).

    python tools/build-timings.py --results <results.json> --manifest <manifest.json | URL> --out audio/sets/day2/timings.json \
        [--day 2] [--realign 14=<realign-v14.json>] [--report <report.json>]

Input  `results.json` (the #55 chant-accuracy analysis, sections `syllables` and `takes`): per verse the aksharas it aligned and,
       per take "<day>.<verse>", `syl_t` = [start, end] seconds of each akshara (CTC forced alignment, torchaudio MMS_FA, 20 ms frames).
       `--realign` replaces a verse's times with a re-alignment that knows its closing line is sung several times (verse 14).
Output `timings.json`, per verse: aksharas [{i, deva, iast, word, line, start, end, pass?}], words, lines, the clip duration and sha256
       from the manifest. The aksharas are cut from `data/verses.json` (the DISPLAYED text), never from the analysis text: the
       analysis spelled a few places differently (र्ऋ for ृ, anusvara for ङ्), so the two segmentations are matched index by index
       and every difference is written to the report. `iast` is a slice of the app's own transliteration (null when it cannot be
       sliced exactly: that word is then highlighted as a whole in the transliteration).
Validation (exit 1 on failure): start monotonic, 0 <= start <= end <= clip duration, every displayed akshara has a time and the
       concatenated aksharas reproduce the verse's Devanagari (NFC, spaces and dandas removed).
"""
import argparse, json, os, re, sys, unicodedata, urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONS = {"क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ṅ", "च": "c", "छ": "ch", "ज": "j", "झ": "jh", "ञ": "ñ",
        "ट": "ṭ", "ठ": "ṭh", "ड": "ḍ", "ढ": "ḍh", "ण": "ṇ", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
        "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v",
        "श": "ś", "ष": "ṣ", "स": "s", "ह": "h", "ळ": "ḷ"}
VOW = {"अ": "a", "आ": "ā", "इ": "i", "ई": "ī", "उ": "u", "ऊ": "ū", "ऋ": "ṛ", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au"}
MATRA = {"ा": "ā", "ि": "i", "ी": "ī", "ु": "u", "ू": "ū", "ृ": "ṛ", "े": "e", "ै": "ai", "ो": "o", "ौ": "au"}
VIRAMA, NUKTA = "्", "़"
MOD = {"ं": "ṃ", "ः": "ḥ", "ँ": "m̐"}


def akshara_split(word):
    """One Devanagari word -> [(deva, iast_guess)] aksharas: a conjunct cluster + its vowel sign + anusvara/visarga stays whole
    (never split, so shaping is untouched); a word-final virama consonant joins the previous akshara."""
    out, i, n = [], 0, len(word)
    while i < n:
        ch = word[i]
        if ch == "ॐ":
            out.append(["ॐ", "Om"]); i += 1; continue
        start, rom = i, ""
        if ch in VOW:
            rom = VOW[ch]; i += 1
        elif ch in CONS:
            coda = False
            while i < n and word[i] in CONS:
                rom += CONS[word[i]]; i += 1
                if i < n and word[i] == NUKTA: i += 1
                if i < n and word[i] == VIRAMA:
                    i += 1
                    if i < n and word[i] in CONS: continue
                    coda = True
                break
            if coda and out:
                out[-1][0] += word[start:i]; out[-1][1] += rom; continue
            if i < n and word[i] in MATRA: rom += MATRA[word[i]]; i += 1
            else: rom += "a"
        else:
            raise ValueError("unsegmentable character %r (U+%04X) in %r" % (ch, ord(ch), word))
        while i < n and word[i] in MOD:
            rom += MOD[word[i]]; i += 1
        out.append([word[start:i], rom])
    return out


def deva_words(text):
    """Devanagari verse text -> words (daṇḍas and the verse-number token dropped)."""
    toks = re.split(r"[\s ]+", unicodedata.normalize("NFC", text).strip())
    return [t for t in toks if t and not re.fullmatch(r"[।॥०-९]+", t)]


def latin_words(text):
    toks = re.split(r"[\s ]+", unicodedata.normalize("NFC", text).strip())
    return [t for t in toks if t and not re.fullmatch(r"\|+(\d+\|+)?", t)]


def norm_key(s):                      # comparison form for the analysis akshara (its IAST uses ṁ ē ō)
    s = unicodedata.normalize("NFC", s).lower().replace("ṁ", "ṃ").replace("ē", "e").replace("ō", "o").replace("r̥", "ṛ")
    return s


def load_json(src):
    if re.match(r"https?://", src):
        with urllib.request.urlopen(src, timeout=30) as r:
            return json.load(r)
    return json.load(open(src, encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--day", default="2")
    ap.add_argument("--realign", action="append", default=[], help="<verse>=<json from rnd/61-karaoke/tools/realign-v14.py>")
    ap.add_argument("--report", default=None)
    a = ap.parse_args()

    res = load_json(a.results)
    man = load_json(a.manifest)
    verses = load_json(os.path.join(ROOT, "data", "verses.json"))["verses"]
    realign = {int(k): load_json(p) for k, p in (x.split("=", 1) for x in a.realign)}
    problems, notes = [], []
    out_verses = {}

    for v in verses:
        n = int(v["number"])
        # ---- the displayed text, segmented
        dwords = deva_words(v["sanskrit"])
        lwords = latin_words(v["transliteration"])
        shown = []                                    # [{deva, iast_guess, word, line}]
        line = 0
        # a line break in the verse text separates lines; a daṇḍa ends one
        wi = 0
        for ln, ltxt in enumerate(v["sanskrit"].split("\n")):
            for w in deva_words(ltxt):
                for deva, rom in akshara_split(w):
                    shown.append({"deva": deva, "rom": rom, "word": wi, "line": ln})
                wi += 1
        if wi != len(dwords):
            problems.append("verse %d: word count mismatch" % n)
        concat = "".join(s["deva"] for s in shown)
        want = re.sub(r"[\s ।॥०-९]", "", unicodedata.normalize("NFC", v["sanskrit"]))
        if concat != want:
            problems.append("verse %d: aksharas do not reproduce the verse text" % n)
        # ---- slice the app's transliteration per akshara, word by word
        if len(lwords) != len(dwords):
            notes.append("verse %d: %d Devanagari words but %d transliteration words: transliteration highlights nothing" % (n, len(dwords), len(lwords)))
            for s in shown: s["iast"] = None
        else:
            for w, lw in enumerate(lwords):
                ws = [s for s in shown if s["word"] == w]
                guess = "".join(s["rom"] for s in ws)
                if unicodedata.normalize("NFC", guess).lower() == lw.lower():
                    k = 0
                    for s in ws:
                        m = len(unicodedata.normalize("NFC", s["rom"]))
                        s["iast"] = lw[k:k + m]; k += m
                else:
                    notes.append("verse %d word %d: transliteration %r != generated %r: word-level only" % (n, w, lw, guess))
                    for s in ws: s["iast"] = None
        # ---- times from the analysis (its own akshara list), mapped by index
        ana = res["syllables"][str(n)]
        take = res["takes"]["%s.%d" % (a.day, n)]
        st = take["syl_t"]
        if len(ana) != len(st):
            problems.append("verse %d: analysis has %d aksharas but %d times" % (n, len(ana), len(st)))
            continue
        merged = {}                                   # displayed index -> the analysis aksharas it spans (when the counts differ)
        if len(ana) != len(shown):
            import difflib
            key = lambda d: re.sub(r"[ा-्ँ-ः]", "", d)[:1]
            sm = difflib.SequenceMatcher(a=[key(s["deva"]) for s in shown], b=[key(x["deva"]) for x in ana], autojunk=False)
            ok = True
            for op, i1, i2, j1, j2 in sm.get_opcodes():
                if op == "equal": continue
                if op == "replace" and i2 - i1 == j2 - j1:                 # same count, spelled differently (ङ्ग / ंग): by index
                    for k in range(i2 - i1):
                        notes.append("verse %d akshara %d: shown %s, analysed as %s (matched by position)" % (n, i1 + k, shown[i1 + k]["deva"], ana[j1 + k]["deva"]))
                    continue
                if op == "insert" and j2 - j1 == 1 and i1 > 0 and shown[i1 - 1]["deva"].endswith(VIRAMA):
                    merged[i1 - 1] = (j1 - 1, j1)             # displayed ...न् is one akshara; the analysis text had दी + न
                    notes.append("verse %d akshara %d: shown %s, analysed as %s + %s (the analysis text lacks the final virama); the times are merged" % (n, i1 - 1, shown[i1 - 1]["deva"], ana[j1 - 1]["deva"], ana[j1]["deva"]))
                elif op == "replace" and i2 - i1 == 1 and j2 - j1 == 2:
                    merged[i1] = (j1, j2 - 1)
                    notes.append("verse %d akshara %d: shown %s, analysed as %s + %s (the analysis text lacks the final virama); the times are merged" % (n, i1, shown[i1]["deva"], ana[j1]["deva"], ana[j1 + 1]["deva"]))
                else:
                    ok = False
            if not ok:
                problems.append("verse %d: displayed text has %d aksharas, analysis %d, and they do not reconcile" % (n, len(shown), len(ana)))
                continue
        diffs = [(i, s["deva"], ana[i]["deva"]) for i, s in enumerate(shown) if len(ana) == len(shown) and s["deva"] != ana[i]["deva"]]
        for i, mine, theirs in diffs:
            notes.append("verse %d akshara %d: shown %s, analysed as %s (same count, matched by index)" % (n, i, mine, theirs))
        if merged:
            rows, j = [], 0
            for i in range(len(shown)):
                if i in merged: a0, a1 = merged[i]; rows.append({"i": i, "start": st[a0][0], "end": st[a1][1]}); j = a1 + 1
                else: rows.append({"i": i, "start": st[j][0], "end": st[j][1]}); j += 1
        else:
            rows = [{"i": i, "start": st[i][0], "end": st[i][1]} for i in range(len(shown))]
        repeats = None
        if n in realign:
            ra = realign[n]
            rows = [{"i": r["i"], "pass": r["pass"], "start": r["start"], "end": r["end"]} for r in ra["rows"]]
            repeats = ra["repeats"]
            notes.append("verse %d: times from the re-alignment with the closing line sung %d times (#55 aligned it once and smeared it over 18 s)" % (n, repeats))
        mv = man["verses"].get(str(n))
        if not mv:
            problems.append("verse %d: not in the manifest" % n); continue
        dur = float(mv["duration"])
        aks = []
        for r in rows:
            s = shown[r["i"]]
            e = {"i": r["i"], "deva": s["deva"], "iast": s["iast"], "word": s["word"], "line": s["line"],
                 "start": round(r["start"], 3), "end": round(r["end"], 3)}
            if "pass" in r: e["pass"] = r["pass"]
            aks.append(e)
        # ---- validation
        prev = -1.0
        for e in aks:
            if e["start"] < prev - 1e-9: problems.append("verse %d: start goes backwards at akshara %d" % (n, e["i"]))
            if not (0 <= e["start"] <= e["end"] <= dur + 0.05): problems.append("verse %d: akshara %d [%s,%s] outside the %.2f s clip" % (n, e["i"], e["start"], e["end"], dur))
            prev = e["start"]
        first_pass = [e["i"] for e in aks if e.get("pass", 0) in (0, 1)] if repeats else [e["i"] for e in aks]
        if first_pass != list(range(len(shown))):
            problems.append("verse %d: not every displayed akshara has a time" % n)
        groups = {}
        for e in aks:
            groups.setdefault((e.get("pass", 0), e["word"]), []).append(e)
        words = []
        for (p, w), es in groups.items():
            d = {"w": w, "line": es[0]["line"], "start": es[0]["start"], "end": es[-1]["end"]}
            if repeats: d["pass"] = p
            words.append(d)
        lines = {}
        for e in aks:
            lines.setdefault((e.get("pass", 0), e["line"]), []).append(e)
        lns = []
        for (p, l), es in lines.items():
            d = {"line": l, "start": es[0]["start"], "end": es[-1]["end"]}
            if repeats: d["pass"] = p
            lns.append(d)
        words.sort(key=lambda d: d["start"]); lns.sort(key=lambda d: d["start"])
        # outliers worth a human look (reported, not fixed)
        for e, nx in zip(aks, aks[1:] + [None]):
            if e["end"] - e["start"] > 1.5: notes.append("verse %d akshara %d %s lasts %.2f s (sustained or smeared)" % (n, e["i"], e["deva"], e["end"] - e["start"]))
            if nx and nx["start"] - e["end"] > 1.0: notes.append("verse %d: %.2f s of quiet after akshara %d %s" % (n, nx["start"] - e["end"], e["i"], e["deva"]))
        out_verses[str(n)] = {"duration": dur, "sha256": mv.get("sha256"), "repeats": repeats, "aksharas": aks, "words": words, "lines": lns}

    doc = {"schema": 1, "set": man.get("set"), "kind": "akshara timings (seconds from the start of each clip)",
           "source": "#55 chant-accuracy analysis, CTC forced alignment (torchaudio MMS_FA, 20 ms frames) of the Day %s take; alignment accuracy is not ear-checked" % a.day,
           "verses": out_verses}
    if not problems:
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        with open(a.out, "w", encoding="utf-8", newline="\n") as f:
            json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
    rep = {"verses": len(out_verses), "problems": problems, "notes": notes, "bytes": os.path.getsize(a.out) if os.path.exists(a.out) else None}
    if a.report:
        json.dump(rep, open(a.report, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
    print("verses written: %d" % len(out_verses))
    for t in notes: print("NOTE   " + t)
    for t in problems: print("PROBLEM " + t)
    print("OK: %s (%s bytes)" % (a.out, rep["bytes"]) if not problems else "FAILED: %d problem(s), nothing written" % len(problems))
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
