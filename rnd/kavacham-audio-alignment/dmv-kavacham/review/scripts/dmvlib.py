"""Shared helpers for the DMV Kavacham chant-accuracy study (mooladhara session 2026-11-11).

Reference text -> akshara (orthographic syllable) units, three spellings per unit:
  iast  display transliteration
  a     alignment form: a-z letters only, what the MMS_FA tokenizer accepts (anusvara -> m, visarga -> h)
  n     comparison form: lossy phonetic collapse, with 'N' (anusvara) and 'H' (visarga) wildcards
Hypothesis text (greedy CTC letters or Whisper Devanagari) is reduced to the same n form and aligned to the reference.

Forced-alignment / CTC code is adapted from SYP-ajna-analysis scripts/forced_align_chant.py
(commit 37a23875e4a0d4a694530438bb7de1d4745a6aa2) and shruti-transcript bench/align.py (commit 596c47937ad5dca2cce2d3db108f7a99ca1b6ea8):
torchaudio MMS_FA, F.forced_align over the whole verse target, ffmpeg decode to 16 kHz mono.
"""
import json
import os
import re
import unicodedata

import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
CHANT = os.path.abspath(os.path.join(HERE, "..", ".."))   # the chant folder: chant.json, results.json, kavacham-verses.json, audio/
SITE = CHANT      # where results.json, synth_conf.json and synth_fa.json are written/read (the review page reads them from here)
SRC = CHANT       # reference text + per-day timings
# Scratch for the analysis run (clip decodes, intermediate passes, synthetic splices). Gitignored; override with DMV_REVIEW_WORK.
ROOT = os.environ.get("DMV_REVIEW_WORK") or os.path.join(CHANT, "review", "work")
FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or "ffmpeg"
DAYS = [1, 2, 3, 4, 5, 6]
VERSES = list(range(1, 15))


def clip_path(day, v):
    # the clips are restored by tools/fetch-rnd-audio.py; day 3 lives in audio/verses/
    folder = "verses" if day == 3 else f"day{day}"
    return f"{CHANT}/audio/{folder}/verse{v:02d}.mp3"


def wav_path(day, v):
    return f"{ROOT}/work/wav16k/d{day}v{v:02d}.wav"


def load_verses():
    return json.load(open(f"{SRC}/kavacham-verses.json", encoding="utf-8"))


def load_timings():
    """{(day, verse): record} from the existing per-day timings JSON."""
    out = {}
    for d in DAYS:
        p = f"{SRC}/kavacham-verse-timings.json" if d == 3 else f"{SRC}/kavacham-verse-timings-day{d}.json"
        for r in json.load(open(p, encoding="utf-8"))["verses"]:
            out[(d, r["n"])] = r
    return out


# ---------------------------------------------------------------- transliteration
CONS = {  # char: (iast, a-form)
    "क": ("k", "k"), "ख": ("kh", "kh"), "ग": ("g", "g"), "घ": ("gh", "gh"), "ङ": ("ṅ", "n"),
    "च": ("c", "ch"), "छ": ("ch", "chh"), "ज": ("j", "j"), "झ": ("jh", "jh"), "ञ": ("ñ", "n"),
    "ट": ("ṭ", "t"), "ठ": ("ṭh", "th"), "ड": ("ḍ", "d"), "ढ": ("ḍh", "dh"), "ण": ("ṇ", "n"),
    "त": ("t", "t"), "थ": ("th", "th"), "द": ("d", "d"), "ध": ("dh", "dh"), "न": ("n", "n"),
    "प": ("p", "p"), "फ": ("ph", "ph"), "ब": ("b", "b"), "भ": ("bh", "bh"), "म": ("m", "m"),
    "य": ("y", "y"), "र": ("r", "r"), "ल": ("l", "l"), "व": ("v", "v"),
    "श": ("ś", "sh"), "ष": ("ṣ", "sh"), "स": ("s", "s"), "ह": ("h", "h"), "ळ": ("ḷ", "l"),
}
VOW = {"अ": ("a", "a"), "आ": ("ā", "a"), "इ": ("i", "i"), "ई": ("ī", "i"), "उ": ("u", "u"), "ऊ": ("ū", "u"),
       "ऋ": ("ṛ", "ri"), "ए": ("ē", "e"), "ऐ": ("ai", "ai"), "ओ": ("ō", "o"), "औ": ("au", "au")}
MATRA = {"ा": ("ā", "a"), "ि": ("i", "i"), "ी": ("ī", "i"), "ु": ("u", "u"), "ू": ("ū", "u"), "ृ": ("ṛ", "ri"),
         "े": ("ē", "e"), "ै": ("ai", "ai"), "ो": ("ō", "o"), "ौ": ("au", "au")}
VIRAMA, ANUSVARA, VISARGA, CANDRABINDU, NUKTA = "्", "ं", "ः", "ँ", "़"


def syllabify(dev_text):
    """Split Devanagari text into aksharas. Returns a list of dicts with deva, iast, a, n, word, line.
    A word-final virama consonant (e.g. म् in स्वयम्) joins the previous akshara as a coda."""
    text = unicodedata.normalize("NFC", dev_text)
    sylls = []
    line = 0
    for w_i, word in enumerate(re.split(r"\s+", text.strip())):
        if word in ("।", "॥"):
            line += 1
            continue
        i, n = 0, len(word)
        while i < n:
            ch = word[i]
            if ch == "ॐ":
                sylls.append({"deva": ch, "iast": "oṁ", "a": "om", "n": "oN", "word": w_i, "line": line})
                i += 1
                continue
            if ch in VOW:
                io, ao = VOW[ch]
                start = i
                i += 1
                s = {"deva": word[start:i], "iast": io, "a": ao, "n": ao, "word": w_i, "line": line}
            elif ch in CONS:
                start = i
                io, ao = "", ""
                coda = False
                while i < n and word[i] in CONS:
                    io += CONS[word[i]][0]
                    ao += CONS[word[i]][1]
                    i += 1
                    if i < n and word[i] == NUKTA:
                        i += 1
                    if i < n and word[i] == VIRAMA:
                        i += 1
                        if i < n and word[i] in CONS:
                            continue  # conjunct: keep absorbing consonants
                        coda = True   # word-final virama consonant
                    break
                if coda:
                    if sylls and sylls[-1]["word"] == w_i:
                        p = sylls[-1]
                        p["deva"] += word[start:i]
                        p["iast"] += io
                        p["a"] += ao
                        p["n"] += ao
                    continue
                if i < n and word[i] in MATRA:
                    io += MATRA[word[i]][0]
                    ao += MATRA[word[i]][1]
                    i += 1
                else:
                    io += "a"
                    ao += "a"
                s = {"deva": word[start:i], "iast": io, "a": ao, "n": ao, "word": w_i, "line": line}
            else:
                i += 1
                continue
            while i < n and word[i] in (ANUSVARA, VISARGA, CANDRABINDU):
                if word[i] == VISARGA:
                    s["iast"] += "ḥ"
                    s["a"] += "h"
                    s["n"] += "H"
                else:
                    s["iast"] += "ṁ"
                    s["a"] += "m"
                    s["n"] += "N"
                s["deva"] += word[i]
                i += 1
            sylls.append(s)
    for k, s in enumerate(sylls):
        s["idx"] = k
        s["n"] = n_form(s["n"])
    return sylls


def n_form(s):
    """Lossy phonetic collapse so spelling/aspiration/sibilant variants of the same sound compare equal.
    Keeps the wildcards N (anusvara) and H (visarga) already inserted by syllabify."""
    s = s.replace("chh", "c").replace("ch", "c").replace("sh", "s")
    s = re.sub(r"([kgcjtdpb])h", r"\1", s)
    s = s.replace("w", "v").replace("z", "j").replace("q", "k").replace("x", "ks").replace("f", "p")
    return s


def hyp_n_form(letters):
    """Collapse a hypothesis letter string (greedy CTC output or romanised Whisper text) to the n form."""
    s = re.sub(r"[^a-z]", "", letters.lower())
    return n_form(s)


def deva_to_letters(dev_text):
    """Romanise free Devanagari (a Whisper hypothesis) to a-z letters (alignment form), reusing syllabify."""
    ss = syllabify(unicodedata.normalize("NFC", dev_text))
    return "".join(s["a"] for s in ss)


# ---------------------------------------------------------------- reference vs hypothesis alignment
VOWELS = set("aeiou")
NASALS = set("mn")
VOICE_PAIRS = [("t", "d"), ("k", "g"), ("p", "b"), ("c", "j")]


def sub_cost(r, h):
    if r == h:
        return 0.0
    if r == "N":
        return 0.0 if h in NASALS else 1.0
    if r == "H":
        return 0.0 if h == "h" else 1.0
    if r in VOWELS and h in VOWELS:
        return 0.5
    if {r, h} == {"b", "v"}:
        return 0.3
    if r in NASALS and h in NASALS:
        return 0.4
    for a, b in VOICE_PAIRS:
        if {r, h} == {a, b}:
            return 0.7
    if {r, h} in ({"l", "r"}, {"y", "i"}, {"s", "h"}):
        return 0.7
    return 1.0


def del_cost(r):       # reference char not heard
    if r in "NH":
        return 0.0
    return 0.8 if r in VOWELS else 1.0


def ins_cost(h, prev=None):       # heard char not in reference
    if prev == h and h not in VOWELS:     # doubled consonant (the CTC model writes ksh as kss)
        return 0.2
    return 0.8 if h in VOWELS else 1.0


def align_text(ref_chars, hyp_chars, optional=None):
    """Needleman-Wunsch on char lists. Returns list of (ref_i or None, hyp_j or None, cost)."""
    R, H = len(ref_chars), len(hyp_chars)
    INF = 1e9
    D = [[INF] * (H + 1) for _ in range(R + 1)]
    B = [[None] * (H + 1) for _ in range(R + 1)]
    D[0][0] = 0.0
    for i in range(R + 1):
        for j in range(H + 1):
            d = D[i][j]
            if d >= INF:
                continue
            if i < R and j < H:
                c = d + sub_cost(ref_chars[i], hyp_chars[j])
                if c < D[i + 1][j + 1]:
                    D[i + 1][j + 1], B[i + 1][j + 1] = c, (i, j)
            if i < R:
                c = d + (0.0 if optional and optional[i] else del_cost(ref_chars[i]))
                if c < D[i + 1][j]:
                    D[i + 1][j], B[i + 1][j] = c, (i, j)
            if j < H:
                c = d + ins_cost(hyp_chars[j], hyp_chars[j - 1] if j else None)
                if c < D[i][j + 1]:
                    D[i][j + 1], B[i][j + 1] = c, (i, j)
    ops, i, j = [], R, H
    while (i, j) != (0, 0):
        pi, pj = B[i][j]
        if pi == i - 1 and pj == j - 1:
            ops.append((i - 1, j - 1, sub_cost(ref_chars[i - 1], hyp_chars[j - 1])))
        elif pi == i - 1:
            ops.append((i - 1, None, 0.0 if optional and optional[i - 1] else del_cost(ref_chars[i - 1])))
        else:
            ops.append((None, j - 1, ins_cost(hyp_chars[j - 1], hyp_chars[j - 2] if j > 1 else None)))
        i, j = pi, pj
    ops.reverse()
    return ops


def compare_to_reference(sylls, hyp_letters, hyp_times, optional_sylls=()):
    """Align a hypothesis letter string to the reference aksharas.
    hyp_times: list of (t0, t1) per hyp letter (or None).
    Returns (per_syllable, insertions). per_syllable[k] = {cost, expected, heard, t_heard}; insertions = [{after_syll, heard, cost, t}]"""
    ref_chars, owner, opt = [], [], []
    for s in sylls:
        for c in s["n"]:
            ref_chars.append(c)
            owner.append(s["idx"])
            opt.append(s["idx"] in optional_sylls)
    ops = align_text(ref_chars, list(hyp_letters), opt)
    per = [{"cost": 0.0, "heard": "", "tt": []} for _ in sylls]
    ins_runs, cur = [], None
    last_owner = -1
    for ri, hj, c in ops:
        if ri is not None:
            o = owner[ri]
            last_owner = o
            per[o]["cost"] += c
            if hj is not None:
                per[o]["heard"] += hyp_letters[hj]
                if hyp_times and hyp_times[hj]:
                    per[o]["tt"].append(hyp_times[hj])
            cur = None
        else:
            if cur is None:
                cur = {"after_syll": last_owner, "heard": "", "tt": [], "cost": 0.0}
                ins_runs.append(cur)
            cur["heard"] += hyp_letters[hj]
            cur["cost"] += c
            if hyp_times and hyp_times[hj]:
                cur["tt"].append(hyp_times[hj])
    for k, p in enumerate(per):
        p["cost"] = round(p["cost"], 2)
        p["expected"] = sylls[k]["n"]
        p["t_heard"] = [min(t[0] for t in p["tt"]), max(t[1] for t in p["tt"])] if p["tt"] else None
        del p["tt"]
    ins = []
    for r in ins_runs:
        ins.append({"after_syll": r["after_syll"], "heard": r["heard"], "cost": round(r["cost"], 2),
                    "t": [min(t[0] for t in r["tt"]), max(t[1] for t in r["tt"])] if r["tt"] else None})
    return per, ins


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    vs = load_verses()
    for v in vs:
        ss = syllabify(v["dev"])
        print(v["n"], len(ss), " ".join(s["deva"] for s in ss))
        print("  ", " ".join(s["iast"] for s in ss))
        print("  ", " ".join(s["n"] for s in ss))
