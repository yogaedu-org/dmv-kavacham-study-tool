"""Measured sync check + preview screenshots for follow-along (#61), against a running preview that plays the REAL Day 2 clips.

    python -I rnd/61-karaoke/tools/measure-sync.py --app http://127.0.0.1:8777/ --out rnd/61-karaoke

For verses 1 and 14 it plays the clip in real time in Chromium, samples (audio.currentTime, lit akshara) every 50 ms inside the page,
and compares each sample with audio/sets/day2/timings.json: lead = the highlight shows an akshara before its start, lag = it still shows
one after its lit window (or shows nothing while one is due). This measures the highlight against the TIMINGS FILE, not the timings against
the voice: whether the aligned start of each akshara sits on the voice is what KA's listening test decides.
"""
import argparse, json, os, sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ap = argparse.ArgumentParser(); ap.add_argument("--app", required=True); ap.add_argument("--out", required=True)
a = ap.parse_args()
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
T = json.load(open(os.path.join(ROOT, "audio", "sets", "day2", "timings.json"), encoding="utf-8"))["verses"]
HOLD = 0.6


def window(vt, k):
    ak = vt["aksharas"]; nxt = ak[k + 1]["start"] if k + 1 < len(ak) else float("inf")
    return ak[k]["start"], min(nxt, ak[k]["end"] + HOLD)


def expected(vt, t):
    ak = vt["aksharas"]; k = -1
    for j, x in enumerate(ak):
        if x["start"] <= t: k = j
        else: break
    if k < 0: return -1
    s, e = window(vt, k)
    return k if t < e else -1


SAMPLER = """() => new Promise(resolve => {
  const au = document.getElementById('verseAudio'), out = [];
  const tick = () => { const el = document.querySelector('.sanskrit .is-akshara'); out.push([au.currentTime, el ? Number(el.dataset.i) : -1]); };
  const id = setInterval(tick, 50);
  au.addEventListener('ended', () => { clearInterval(id); resolve(out); }, { once: true });
  setTimeout(() => { clearInterval(id); resolve(out); }, 60000);
})"""

report = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    for n in (1, 14):
        vt = T[str(n)]
        ctx = b.new_context(viewport={"width": 1280, "height": 900}); pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(a.app); pg.wait_for_selector("article.verse")
        pg.click(".verse-play[data-verse='%d']" % n)
        pg.wait_for_function("() => { const x = document.getElementById('verseAudio'); return !x.paused && x.currentTime > 0.02; }", timeout=20000)
        samples = pg.evaluate(SAMPLER)
        leads, lags, wrong = [], [], 0
        # the idx in the DOM is the displayed akshara (i); map the expected entry to its i
        for t, i in samples:
            e = expected(vt, t)
            exp_i = vt["aksharas"][e]["i"] if e >= 0 else -1
            if i == exp_i: continue
            wrong += 1
            if i >= 0:
                cands = [k for k, x in enumerate(vt["aksharas"]) if x["i"] == i]
                k = min(cands, key=lambda c: min(abs(t - window(vt, c)[0]), abs(t - window(vt, c)[1]) if window(vt, c)[1] != float("inf") else 1e9))
                s, e2 = window(vt, k)
                if t < s: leads.append(round((s - t) * 1000))
                elif t >= e2: lags.append(round((t - e2) * 1000))
            else:
                lags.append(round((t - window(vt, e)[0]) * 1000))
        report[str(n)] = {"samples": len(samples), "duration_s": vt["duration"], "mismatching_samples": wrong,
                          "worst_lead_ms": max(leads) if leads else 0, "worst_lag_ms": max(lags) if lags else 0, "page_errors": errs}
        print(n, report[str(n)], flush=True)
        ctx.close()
    json.dump(report, open(os.path.join(a.out, "sync-report.json"), "w"), indent=1)
    # screenshots mid-playback (clock slowed to a crawl so the frame is a known akshara)
    shots = os.path.join(a.out, "shots"); os.makedirs(shots, exist_ok=True)
    for width, height, name in ((1280, 900, "1280"), (390, 800, "390")):
        for theme in ("dark", "light"):
            if width == 390 and theme == "light": pass
            ctx = b.new_context(viewport={"width": width, "height": height}, color_scheme=theme, device_scale_factor=1)
            pg = ctx.new_page(); pg.goto(a.app); pg.wait_for_selector("article.verse")
            pg.click(".verse-play[data-verse='1']")
            pg.wait_for_function("() => { const x = document.getElementById('verseAudio'); return !x.paused && x.currentTime > 0.02; }", timeout=20000)
            pg.evaluate("() => { const x = document.getElementById('verseAudio'); x.playbackRate = 0.0625; x.currentTime = 8.3; }")
            pg.wait_for_timeout(400)
            pg.screenshot(path=os.path.join(shots, "verse1-%s-%s.png" % (name, theme)))
            ctx.close()
    b.close()
