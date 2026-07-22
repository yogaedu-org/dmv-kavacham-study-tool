#!/usr/bin/env python3
"""Build the DMV Kavacham verse-by-verse listening player — 6 tabs (Days 1-6), one per day's
take, auto-advancing playback so KA can hear each day's Kavacham straight through and vote on
which recording to promote into the study-tool app. Also plays pada-level (line 1 / line 2,
and verse 14's individual repeats) segments -- a reference implementation the separate
dmv-kavacham-study-tool app can reuse: one <audio> per verse, sub-segments are just seek + stop
at an offset, no extra file cutting needed (#9).

  python gen_kavacham_player.py

Reads reference/chants/dmv-kavacham/kavacham-verse-timings.json (Day 3) and
kavacham-verse-timings-dayN.json (other days, once aligned) -- skips any day not yet aligned.
Writes reference/chants/dmv-kavacham/player.html, sitting next to audio/day3, audio/day1, etc so
relative paths resolve. LOCAL FILE, not a published artifact (large local audio, private QA use).
Run with PYTHONIOENCODING=utf-8 PYTHONUTF8=1
"""
import json, sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO = Path(__file__).resolve().parents[2]
KAV = REPO / "reference" / "chants" / "dmv-kavacham"


def load_day(n):
    p = KAV / ("kavacham-verse-timings.json" if n == 3 else f"kavacham-verse-timings-day{n}.json")
    if not p.exists():
        return None
    d = json.loads(p.read_text(encoding="utf-8"))
    return d["verses"]


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def clip_t0(v):
    """Absolute time the verse's own clip (verseNN.mp3) starts at -- matches the 0.3s
    pre-roll pad used when it was cut, so a pada's abs time - this = the clip-relative
    offset to seek the SAME <audio> element to."""
    return max(0.0, v["start_abs"] - 0.3)


def off(v, abs_t):
    return round(abs_t - clip_t0(v), 2)


def line2_full_end(v):
    l2 = v["padas"][1]
    return l2["repeats"][-1]["end_abs"] if "repeats" in l2 else l2["end_abs"]


def line2_single_span(v):
    """(start, end) of ONE occurrence of line 2 -- the first repetition if repeated."""
    l2 = v["padas"][1]
    if "repeats" in l2:
        r = l2["repeats"][0]
        return r["start_abs"], r["end_abs"]
    return l2["start_abs"], l2["end_abs"]


def gap_pad(end_a, start_b):
    """Split the natural silence between two adjacent segments in half, so each keeps a
    breath of trailing/leading room instead of a cut jammed against the last phoneme --
    the fix for loops sounding abruptly chopped (#9). No-ops if there's no real gap."""
    gap = start_b - end_a
    if gap <= 0:
        return end_a, start_b
    half = gap / 2
    return end_a + half, start_b - half


def compute_ranges(verses):
    """Per-verse playable ranges (absolute seconds), silence-padded, and aware that only
    WHOLE-CHANT playback should include every repetition of a repeated closing line --
    a standalone verse/line play or loop uses just one occurrence (#9)."""
    ranges = []
    n = len(verses)
    for i, v in enumerate(verses):
        l1, l2 = v["padas"]
        l1_start, l1_end = l1["start_abs"], l1["end_abs"]
        l2_start = l2["start_abs"]
        repeated = "repeats" in l2
        single_start, single_end = line2_single_span(v)
        full_end = line2_full_end(v)

        # Internal line1<->line2 gap -- always present, always worth padding.
        l1_end_pad, l2_start_pad = gap_pad(l1_end, l2_start)

        # Cross-verse gap to the NEXT verse -- pads this verse's full/chain-mode end.
        next_start = verses[i + 1]["padas"][0]["start_abs"] if i + 1 < n else None
        chain_end_pad = gap_pad(full_end, next_start)[0] if next_start is not None else full_end

        # Single-occurrence end: pad against the 2nd repetition's start if repeated,
        # else against the next verse (same natural-pause philosophy, one level up).
        if repeated:
            single_end_pad = gap_pad(single_end, l2["repeats"][1]["start_abs"])[0]
        else:
            single_end_pad = chain_end_pad  # no repeats: single occurrence IS the whole line

        r = {
            "l1_start": l1.get("om_end_abs", l1_start),  # skip verse 1's standalone "Om" when playing line 1 alone
            "l1_end": l1_end_pad,
            "l2_start": l2_start_pad,
            "l2_end": single_end_pad,          # default L2 button: one occurrence only
            "verse_true_start": l1_start,      # whole-verse/whole-chant start: Om included, it's really there
            "verse_single_end": single_end_pad,   # standalone verse play/loop: one occurrence only
            "verse_chain_end": chain_end_pad,      # whole-chant play/loop: every recorded repetition
        }
        if repeated:
            r["l2_all_end"] = chain_end_pad  # explicit "hear every repetition" button, padded same as chain mode
        ranges.append(r)
    return ranges


days = {}
for n in range(1, 7):
    verses = load_day(n)
    if verses:
        days[n] = verses
print(f"days with aligned verses: {sorted(days)}")

# open on the day with the HIGHEST average alignment confidence, not just tab order --
# defaulting to Day 1 first (its own low-confidence verses 1-2) is what made this look broken.
best_day = max(days, key=lambda n: sum(v["align_score"] for v in days[n]) / len(days[n])) if days else None
LOW_THRESH = 0.85
for n, verses in days.items():
    for v in verses:
        v["low"] = v["align_score"] < LOW_THRESH

tabs = "".join(
    f'<button class="tab" data-day="{n}" onclick="showDay({n})">Day {n}'
    f'{" ⚠" if any(v["low"] for v in days[n]) else ""}</button>'
    for n in sorted(days))


def pada_controls(n, i, v, r):
    """Line 1 / line 2 (/ all-repetitions) buttons -- suppressed for low-confidence verses,
    since their pada split inherits the same unreliable boundaries (#9)."""
    if v["low"] or not v.get("padas"):
        return ""
    # L1 / L2 only. A repeated closing line (verse 14) plays ONE occurrence here; the
    # full repetition (3x traditional) is heard only via whole-chant playback (#9, KA).
    btns = [f'<button class="pbtn" onclick="playPada({n},{i},{off(v, r["l1_start"])},{off(v, r["l1_end"])},this)">▶ L1</button>',
            f'<button class="pbtn" onclick="playPada({n},{i},{off(v, r["l2_start"])},{off(v, r["l2_end"])},this)">▶ L2</button>']
    return f'<div class="padas">{"".join(btns)}</div>'


panels = []
for n, verses in sorted(days.items()):
    ranges = compute_ranges(verses)
    rows = "".join(
        f'''<li class="v{' low' if v['low'] else ''}" data-day="{n}" data-i="{i}">
  <button class="play" onclick="playVerse({n},{i},false,{off(v, r['verse_single_end'])})">▶</button>
  <span class="num">{v['n']}</span>
  <div class="txt"><div class="dev">{esc(v['dev'])}</div><div class="iast">{esc(v['iast'])}</div>
  {pada_controls(n, i, v, r)}</div>
  <span class="score" title="alignment confidence -- flagged low, may not match this verse">{v['align_score']:.2f}{' ⚠' if v['low'] else ''}</span>
  <audio data-day="{n}" data-i="{i}" preload="none" src="{v['clip']}"></audio>
</li>'''
        for i, (v, r) in enumerate(zip(verses, ranges)))
    panels.append(f'<div class="panel" id="panel{n}" style="display:none">'
                  f'<div class="dayhead"><h2>Day {n}</h2><button class="playall" onclick="playAll({n})">▶ Play all, verse 1 →14</button>'
                  f'<button class="stopall" onclick="stopAll()">■ Stop</button></div>'
                  f'<ol class="verses">{rows}</ol></div>')

HTML = f"""<!doctype html><meta charset="utf-8">
<title>DMV Kavacham — verse-by-verse (all days)</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{{--ink:#222;--bg:#fafafa;--card:#fff;--line:#ddd;--accent:#b5651d;--muted:#888;--playing:#2f8f5f}}
@media (prefers-color-scheme:dark){{:root{{--ink:#e8e6f0;--bg:#15161f;--card:#1d1e2a;--line:#2e3040;--accent:#e0a24a;--muted:#9a97ad;--playing:#4fbf83}}}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,Segoe UI,sans-serif}}
header{{padding:16px 20px;border-bottom:1px solid var(--line)}}
header h1{{margin:0 0 4px;font-size:19px}}
header p{{margin:0;color:var(--muted);font-size:13px}}
.tabs{{display:flex;gap:6px;padding:12px 20px;border-bottom:1px solid var(--line);flex-wrap:wrap}}
.tab{{padding:7px 16px;border:1px solid var(--line);border-radius:16px;background:var(--card);color:var(--ink);
 cursor:pointer;font-size:13px;font-weight:600}}
.tab.active{{background:var(--accent);color:#fff;border-color:var(--accent)}}
.panel{{padding:16px 20px 60px}}
.dayhead{{display:flex;align-items:center;gap:12px;margin-bottom:14px}}
.dayhead h2{{margin:0;font-size:17px}}
.playall,.stopall{{padding:7px 14px;border-radius:8px;border:1px solid var(--line);background:var(--card);
 color:var(--ink);cursor:pointer;font-size:13px}}
.playall{{background:var(--accent);color:#fff;border-color:var(--accent)}}
ol.verses{{list-style:none;margin:0;padding:0}}
li.v{{display:flex;align-items:center;gap:12px;padding:9px 6px;border-bottom:1px solid var(--line)}}
li.v.low{{border-left:3px solid #d9534f}}
li.v.low .score{{color:#d9534f;font-weight:600}}
li.v.playing{{background:color-mix(in srgb,var(--playing) 12%,transparent)}}
.play{{width:30px;height:30px;border-radius:50%;border:1px solid var(--line);background:var(--card);
 color:var(--ink);cursor:pointer;flex:0 0 auto}}
li.v.playing .play{{background:var(--playing);color:#fff;border-color:var(--playing)}}
.num{{width:20px;text-align:right;color:var(--muted);font-size:12px;flex:0 0 auto}}
.txt{{flex:1;min-width:0}}
.dev{{font-size:15px}}
.iast{{font-size:12px;color:var(--muted);font-style:italic}}
.padas{{margin-top:4px;display:flex;gap:6px;flex-wrap:wrap}}
.pbtn{{padding:2px 8px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);
 cursor:pointer;font-size:11px}}
.pbtn.playing{{background:var(--playing);color:#fff;border-color:var(--playing)}}
.score{{font-size:11px;color:var(--muted);flex:0 0 auto}}
.loopbar{{padding:8px 20px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px;font-size:13px}}
.loopbar label{{display:flex;align-items:center;gap:6px;cursor:pointer}}
</style>
<header><h1>DMV Kavacham — verse by verse, all days</h1>
<p>Auto-advancing playback of each day's actual chant, aligned to the 14 shlokas. Play the whole
chant, one verse, or (below each verse) line 1 / line 2 alone -- verse 14's L2 also offers its
first repetition alone, for line-by-line study vs. the full (all-repetitions) chant. A red border
+ score marks a verse the aligner itself is unsure of -- worth checking against the waveform tool
before trusting it; line/repeat buttons are hidden there since they'd inherit the same bad boundaries.</p></header>
<div class="loopbar"><label><input type="checkbox" id="loopToggle"> 🔁 Loop whatever I press next (whole chant wraps to verse 1; a verse or line repeats itself)</label></div>
<div class="tabs">{tabs}</div>
{"".join(panels)}
<script>
let current = null; // {{day, i}}
function stopAll(){{
  document.querySelectorAll('audio').forEach(a=>{{a.pause(); a.currentTime=0;}});
  document.querySelectorAll('li.v.playing').forEach(li=>li.classList.remove('playing'));
  document.querySelectorAll('.pbtn.playing').forEach(b=>b.classList.remove('playing'));
  current = null;
}}
/** Generic range player: seeks the verse's own <audio> to startOffset, stops at endOffset
 * (or plays to the end if null). This is the whole reusable pattern -- no extra audio files
 * needed for line/repeat playback, just start/end offsets, same as the JSON's own schema. */
function playRange(day, i, startOffset, endOffset, chain, btn){{
  stopAll();
  const a = document.querySelector(`audio[data-day="${{day}}"][data-i="${{i}}"]`);
  if(!a) return;
  // A previous range on THIS SAME <audio> (e.g. L1 still playing when L2 is clicked) may
  // still have its old timeupdate listener attached -- stopAll() doesn't know about it,
  // since it's a closure with no outside reference. Clear it or the stale listener fires
  // the instant currentTime crosses ITS OWN old endOffset, pausing the new range dead.
  if(a._onTime){{ a.removeEventListener('timeupdate', a._onTime); a._onTime = null; }}
  const li = a.closest('li.v'); li.classList.add('playing');
  if(btn) btn.classList.add('playing');
  li.scrollIntoView({{block:'center', behavior:'smooth'}});
  current = {{day, i}};
  a.currentTime = startOffset || 0;
  function onTime(){{
    if(endOffset != null && a.currentTime >= endOffset) finish();
  }}
  function finish(){{
    a.pause();
    a.removeEventListener('timeupdate', onTime);
    if(a._onTime === onTime) a._onTime = null;
    const looping = document.getElementById('loopToggle').checked;
    if(chain){{
      const items = document.querySelectorAll(`li.v[data-day="${{day}}"]`);
      if(i+1 < items.length){{ playVerse(day, i+1, true); return; }}
      if(looping){{ playVerse(day, 0, true); return; }}  // whole chant: wrap back to verse 1
    }} else if(looping){{
      playRange(day, i, startOffset, endOffset, false, btn);  // verse/line: repeat itself
      return;
    }}
    li.classList.remove('playing');
    if(btn) btn.classList.remove('playing');
  }}
  if(endOffset != null){{ a.addEventListener('timeupdate', onTime); a._onTime = onTime; }}
  a.onended = finish;
  a.play();
}}
/** chain=true (whole-chant play/loop) plays every recorded repetition (the natural file end);
 * chain=false (a single verse, played or looped on its own) uses singleEndOffset -- one
 * occurrence of any repeated line, same as how you'd actually study it verse-by-verse (#9). */
function playVerse(day, i, chain, singleEndOffset){{ playRange(day, i, 0, chain ? null : singleEndOffset, chain); }}
function playPada(day, i, startOffset, endOffset, btn){{ playRange(day, i, startOffset, endOffset, false, btn); }}
function playAll(day){{ playVerse(day, 0, true); }}
function showDay(n){{
  stopAll();
  document.querySelectorAll('.panel').forEach(p=>p.style.display='none');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('panel'+n).style.display='block';
  document.querySelector(`.tab[data-day="${{n}}"]`).classList.add('active');
}}
showDay({best_day if best_day else 'null'});
</script>"""

OUT = KAV / "player.html"
OUT.write_text(HTML, encoding="utf-8", newline="\n")
print(f"wrote {OUT} ({len(HTML)/1024:.0f} KB) — {len(days)} day(s) ready")
