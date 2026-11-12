"""Browser tests for follow-along highlighting (#61): Playwright for Python, Chromium. Run:

    python -I -m pytest tests/test_karaoke.py -q -p no:cacheprovider

Self-contained like test_verse_audio.py: a temp copy of the app, synthetic WAV tones with the real clip durations as the audio
(the real recordings are not in git), a mock cloud with CORS. The timings are the REAL bundled audio/sets/day2/timings.json.
Sets on the mock cloud: day2 (no `timings` key: the bundled copy is used), day5 (no timings anywhere), day6 (a `timings` key
pointing at a cloud copy that lacks verse 14; a full bundled copy exists too, so the cloud copy must win).
Each test is named for the failure it catches.
"""
import hashlib, io, json, math, os, shutil, struct, sys, tempfile, wave

os.environ.setdefault("SERVE_QUIET", "1")

import pytest
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "rnd", "56-audio-sources", "tools"))
import serve  # noqa: E402

APP_FILES = ["index.html", "styles.css", "config.json", "manifest.webmanifest", "sw.js", "js", "data", "i18n", "fonts", "icons", "figures", "audio"]
TIMINGS = json.load(open(os.path.join(ROOT, "audio", "sets", "day2", "timings.json"), encoding="utf-8"))
V1, V14 = TIMINGS["verses"]["1"], TIMINGS["verses"]["14"]


def tone(path, hz, secs, rate=8000):
    n = int(secs * rate)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(struct.pack("<%dh" % n, *[int(6000 * math.sin(2 * math.pi * hz * i / rate)) for i in range(n)]))


@pytest.fixture(scope="module")
def env():
    tmp = tempfile.mkdtemp(prefix="dmv61app-")
    site, cloud = os.path.join(tmp, "site"), os.path.join(tmp, "cloud")
    os.makedirs(site); os.makedirs(cloud)
    for f in APP_FILES:
        src, dst = os.path.join(ROOT, f), os.path.join(site, f)
        shutil.copytree(src, dst) if os.path.isdir(src) else shutil.copyfile(src, dst)
    os.makedirs(os.path.join(site, "audio", "sets", "day6"))
    shutil.copyfile(os.path.join(ROOT, "audio", "sets", "day2", "timings.json"), os.path.join(site, "audio", "sets", "day6", "timings.json"))
    sets = os.path.join(cloud, "sets")
    durations = {1: V1["duration"], 14: V14["duration"], 3: 12.0}
    for sid, hz in (("day2", 300), ("day5", 500), ("day6", 700)):
        os.makedirs(os.path.join(sets, sid))
        verses = {}
        for n, d in durations.items():
            p = os.path.join(sets, sid, "verse-%02d.wav" % n)
            tone(p, hz + n * 5, d)
            verses[str(n)] = {"key": "verse-%02d.wav" % n, "sha256": hashlib.sha256(open(p, "rb").read()).hexdigest(), "bytes": os.path.getsize(p), "duration": d, "codec": "audio/wav"}
        m = {"schema": 1, "set": sid, "version": "test", "label": "Day %s" % sid[-1], "base": "./", "verses": verses}
        if sid == "day6":
            m["timings"] = "timings.json"
            cut = json.loads(json.dumps(TIMINGS)); del cut["verses"]["14"]
            json.dump(cut, open(os.path.join(sets, sid, "timings.json"), "w", encoding="utf-8"), ensure_ascii=False)
        json.dump(m, open(os.path.join(sets, sid, "manifest.json"), "w"))
    json.dump({"schema": 1, "sets": [{"id": i, "label": "Day %s" % i[-1], "recommended": i == "day2", "manifest": "%s/manifest.json" % i} for i in ("day2", "day5", "day6")]},
              open(os.path.join(sets, "index.json"), "w"))
    s_cloud = serve.start(cloud, 0, cors=True, ranges=False)
    cloud_url = "http://127.0.0.1:%d/" % s_cloud.server_address[1]
    c = json.load(open(os.path.join(ROOT, "config.json"), encoding="utf-8"))
    c["audio"]["cloudBase"] = cloud_url; c["audio"]["offlineBase"] = ""
    json.dump(c, open(os.path.join(site, "config.json"), "w", encoding="utf-8"))
    s_app = serve.start(site, 0)
    yield {"app": "http://127.0.0.1:%d/" % s_app.server_address[1], "cloud": cloud_url}
    s_app.shutdown(); s_cloud.shutdown()
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        yield b
        b.close()


def open_page(browser, env, **ctx_args):
    ctx = browser.new_context(**ctx_args)
    pg = ctx.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.goto(env["app"])
    pg.wait_for_selector("article.verse")
    return ctx, pg


@pytest.fixture
def page(browser, env):
    ctx, pg = open_page(browser, env)
    yield pg
    ctx.close()


LIT = """(n) => {
  const q = (sel, root) => (root || document).querySelector(sel);
  const art = document.getElementById('verse-' + n);
  const num = (el) => el ? Number(el.dataset.i !== undefined ? el.dataset.i : el.dataset.w) : null;
  return { a: num(q('.sanskrit .is-akshara', art)), w: num(q('.sanskrit .is-word', art)),
           ia: num(q('.transliteration .is-akshara', art)), iw: num(q('.transliteration .is-word', art)),
           wrapped: art.querySelectorAll('.ka').length, t: document.getElementById('verseAudio').currentTime };
}"""


def play(pg, n, rate=0.0625):
    """Start verse n and slow the clock to a crawl so a seek can be read before the time moves (0.0625 is Chromium's floor)."""
    pg.click(".verse-play[data-verse='%d']" % n)
    pg.wait_for_function("() => { const a = document.getElementById('verseAudio'); return !a.paused && a.currentTime > 0.02; }", timeout=10000)
    pg.evaluate("r => { document.getElementById('verseAudio').playbackRate = r; }", rate)


def seek(pg, n, t):
    pg.evaluate("t => { document.getElementById('verseAudio').currentTime = t; }", t)
    pg.wait_for_function("() => !document.getElementById('verseAudio').seeking")
    pg.wait_for_timeout(120)
    return pg.evaluate(LIT, n)


def mid(a):
    return a["start"] + min(0.04, (a["end"] - a["start"]) / 2)


def test_highlight_is_the_akshara_being_sung_at_five_times_of_verse_1(page):
    """Failure caught: the lit akshara or word is not the one the timings say is sounding (first, middle and last aksharas)."""
    play(page, 1)
    aks = V1["aksharas"]
    for k in (0, 7, 15, 25, len(aks) - 1):
        got = seek(page, 1, mid(aks[k]))
        assert got["a"] == k, (k, got)
        assert got["w"] == aks[k]["word"], (k, got)
        assert got["ia"] == k and got["iw"] == aks[k]["word"], ("transliteration out of step", k, got)
    assert not page.errors


def test_seeking_backwards_moves_the_highlight_back(page):
    """Failure caught: after a seek back the highlight stays on, or jumps to, the later akshara."""
    play(page, 1)
    aks = V1["aksharas"]
    assert seek(page, 1, mid(aks[20]))["a"] == 20
    assert seek(page, 1, mid(aks[3]))["a"] == 3
    assert seek(page, 1, mid(aks[3]) + 0.0)["w"] == aks[3]["word"]


def test_second_and_third_pass_of_the_repeated_closing_line_of_verse_14(page):
    """Failure caught: verse 14's closing line (sung 3 times) lights only on the first pass, or the wrong akshara on later passes."""
    play(page, 14)
    for pass_ in (2, 3):
        idx = next(a for a in V14["aksharas"] if a["i"] == 22 and a.get("pass") == pass_)
        got = seek(page, 14, mid(idx))
        assert got["a"] == 22, (pass_, got)


def test_nothing_stays_highlighted_after_pause_stop_or_the_end(page):
    """Failure caught: a highlight (or the wrapping spans) outlives the audio."""
    play(page, 1)
    seek(page, 1, mid(V1["aksharas"][10]))
    page.evaluate("document.getElementById('verseAudio').pause()")
    page.wait_for_timeout(100)
    assert page.evaluate(LIT, 1) == {"a": None, "w": None, "ia": None, "iw": None, "wrapped": 0, "t": page.evaluate("document.getElementById('verseAudio').currentTime")}
    page.click(".verse-play[data-verse='1']")                      # a paused verse's button is still the stop button
    play(page, 1)
    seek(page, 1, mid(V1["aksharas"][10]))
    page.click(".verse-play[data-verse='1']")                      # the stop button
    page.wait_for_timeout(100)
    got = page.evaluate(LIT, 1)
    assert got["a"] is None and got["w"] is None and got["wrapped"] == 0
    play(page, 1, rate=1)
    page.evaluate("t => { document.getElementById('verseAudio').currentTime = t; }", V1["duration"] - 0.4)
    page.wait_for_function("() => document.getElementById('verseAudio').ended || document.getElementById('verseAudio').paused", timeout=8000)
    page.wait_for_timeout(150)
    got = page.evaluate(LIT, 1)
    assert got["a"] is None and got["w"] is None and got["wrapped"] == 0


def test_a_set_without_timings_plays_with_no_highlight_and_no_error(page):
    """Failure caught: a recitation set that has no timings breaks playback or shows a stuck highlight."""
    page.select_option("#audioSetSelect", "day5")
    play(page, 1, rate=1)
    page.wait_for_timeout(600)
    got = page.evaluate(LIT, 1)
    assert got["a"] is None and got["w"] is None and got["wrapped"] == 0
    assert page.evaluate("!document.getElementById('verseAudio').paused")
    assert not page.errors


def test_manifest_timings_path_wins_over_the_bundled_copy(page):
    """Failure caught: the bundled timings are used although the set's own manifest points at its own (verse 14 is absent from it)."""
    page.select_option("#audioSetSelect", "day6")
    play(page, 1)
    assert seek(page, 1, mid(V1["aksharas"][5]))["a"] == 5
    page.click(".verse-play[data-verse='1']")
    play(page, 14)
    got = seek(page, 14, mid(V14["aksharas"][5]))
    assert got["a"] is None and got["wrapped"] == 0


def test_timings_for_a_recording_of_another_length_are_refused(page):
    """Failure caught: timings are applied to a clip of another length (a re-cut take under the same set id)."""
    page.evaluate("async () => { const m = await import('/js/karaoke.js'); const doc = await (await fetch('audio/sets/day2/timings.json')).json(); doc.verses['1'].duration = 40; m.setTimings(doc); }")
    play(page, 1)
    got = seek(page, 1, mid(V1["aksharas"][5]))
    assert got["a"] is None and got["wrapped"] == 0


def test_visible_text_of_every_verse_is_identical_with_follow_along_off_and_on(page):
    """Failure caught: wrapping the aksharas changes the text (a lost space, a dropped daṇḍa) or leaves the markup altered afterwards."""
    res = page.evaluate("""async () => {
      const m = await import('/js/karaoke.js'); const doc = await (await fetch('audio/sets/day2/timings.json')).json();
      const out = [];
      for (const n of Object.keys(doc.verses)) {
        const art = document.getElementById('verse-' + n), s = art.querySelector('.sanskrit'), l = art.querySelector('.transliteration');
        const before = [s.textContent, l.textContent, s.innerHTML, l.innerHTML];
        const d = m.decorateVerse(art, doc.verses[n]);
        const during = d ? [s.textContent, l.textContent, d.layers.length, s.querySelectorAll('.ka').length] : null;
        m.undecorateVerse(d);
        out.push({ n, ok: !!d, same: !!d && during[0] === before[0] && during[1] === before[1], layers: d && during[2], restored: s.innerHTML === before[2] && l.innerHTML === before[3],
                   aksharas: d && during[3], expect: new Set(doc.verses[n].aksharas.map(a => a.i)).size });
      }
      return out;
    }""")
    assert len(res) == 14
    for r in res:
        assert r["ok"] and r["same"] and r["restored"] and r["layers"] == 2 and r["aksharas"] == r["expect"], r


def test_wrapping_aksharas_does_not_move_or_reshape_the_devanagari(page):
    """Failure caught: the akshara spans split a conjunct or shift the text. Every word keeps its width (a split shaping run changes
    it), the block keeps its box, and the pixels differ only by sub-pixel antialiasing (measured, not assumed)."""
    res = page.evaluate(r"""async () => {
      const m = await import('/js/karaoke.js'); const doc = await (await fetch('audio/sets/day2/timings.json')).json();
      const widths = (el, sel) => {
        if (sel) return [...el.querySelectorAll(sel)].map(e => e.getBoundingClientRect().width);
        const out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n; (n = w.nextNode());) { const re = /\S+/g; let x; while ((x = re.exec(n.nodeValue))) {
          if (/^[।॥|0-9०-९]+$/.test(x[0])) continue;
          const r = document.createRange(); r.setStart(n, x.index); r.setEnd(n, x.index + x[0].length); out.push(r.getBoundingClientRect().width); } }
        return out;
      };
      let worst = 0, words = 0, box = [];
      for (const n of Object.keys(doc.verses)) {
        const art = document.getElementById('verse-' + n), s = art.querySelector('.sanskrit');
        const b0 = s.getBoundingClientRect(), before = widths(s);
        const d = m.decorateVerse(art, doc.verses[n]);
        const b1 = s.getBoundingClientRect(), after = widths(s, '.kw');
        m.undecorateVerse(d);
        if (before.length !== after.length) return { error: 'verse ' + n + ': ' + before.length + ' words before, ' + after.length + ' after' };
        before.forEach((w, i) => { worst = Math.max(worst, Math.abs(w - after[i])); words++; });
        box.push(Math.abs(b0.height - b1.height) + Math.abs(b0.width - b1.width));
      }
      return { worst, words, box: Math.max(...box) };
    }""")
    assert "error" not in res, res
    assert res["words"] > 100
    assert res["worst"] < 1.0, "a word changed width by %.2f px when its aksharas were wrapped (shaping broken?)" % res["worst"]
    assert res["box"] == 0, "the text block changed size when wrapped"
    for n in (2, 8, 10, 14):
        art = page.locator("#verse-%d" % n)
        art.scroll_into_view_if_needed()
        art.locator(".sanskrit").scroll_into_view_if_needed()
        page.evaluate("() => new Promise(r => { let y = -1, n = 0; const f = () => { n = scrollY === y ? n + 1 : 0; y = scrollY; n >= 10 ? r() : requestAnimationFrame(f); }; f(); })")   # the page scrolls smoothly: wait until it has stopped
        bb = art.locator(".sanskrit").bounding_box()
        clip = {"x": math.floor(bb["x"]), "y": math.floor(bb["y"]), "width": math.ceil(bb["width"]) + 1, "height": math.ceil(bb["height"]) + 1}
        shot = lambda: page.screenshot(clip=clip)               # one fixed region, so a rounding of the element box cannot differ
        before = shot()
        page.evaluate("""async n => { const m = await import('/js/karaoke.js'); const doc = await (await fetch('audio/sets/day2/timings.json')).json();
                          window.__deco = m.decorateVerse(document.getElementById('verse-' + n), doc.verses[String(n)]); }""", n)
        during = shot()
        page.evaluate("async () => { const m = await import('/js/karaoke.js'); m.undecorateVerse(window.__deco); }")
        after = shot()
        a, d_, r_ = (Image.open(io.BytesIO(x)).convert("L") for x in (before, during, after))
        assert a.size == d_.size == r_.size
        # antialiasing mode may differ between two paints (LCD vs greyscale), so compare the inked shape: binarise, then count mismatches
        ink = lambda x: [1 if v < 128 else 0 for v in x.getdata()]
        mism = lambda x, y: sum(p != q for p, q in zip(ink(x), ink(y))) / max(1, sum(ink(x)))
        assert mism(a, r_) < 0.02, "putting the markup back changed the shape of verse %d" % n
        assert mism(a, d_) < 0.10, "wrapping changed the shape of verse %d" % n   # measured 5-7%: glyph positions round to whole pixels per span


def test_follow_along_off_shows_no_highlight_and_is_remembered(browser, env):
    """Failure caught: the on/off switch does not switch, or forgets its state after a reload."""
    ctx, pg = open_page(browser, env)
    pg.uncheck("#followToggle")
    play(pg, 1)
    assert seek(pg, 1, mid(V1["aksharas"][5]))["wrapped"] == 0
    pg.reload(); pg.wait_for_selector("article.verse")
    assert pg.is_checked("#followToggle") is False
    pg.check("#followToggle")
    play(pg, 1)
    assert seek(pg, 1, mid(V1["aksharas"][5]))["a"] == 5
    ctx.close()


def test_word_mode_lights_the_word_only(page):
    """Failure caught: the syllable/word choice is ignored."""
    page.select_option("#followUnit", "word")
    play(page, 1)
    got = seek(page, 1, mid(V1["aksharas"][12]))
    assert got["a"] is None and got["w"] == V1["aksharas"][12]["word"] and got["iw"] == got["w"]
    assert page.evaluate("localStorage.getItem('dmv-follow-unit')") == "word"


def test_off_screen_line_is_brought_into_view_but_an_on_screen_one_is_left_alone(browser, env):
    """Failure caught: the page jumps while the lit line is visible, or the lit line is left off-screen."""
    ctx, pg = open_page(browser, env, reduced_motion="reduce", viewport={"width": 1000, "height": 700})
    # verse 1 sits near the top: play it, keep it in view, scroll must not move
    play(pg, 1)
    y0 = pg.evaluate("window.scrollY")
    seek(pg, 1, mid(V1["aksharas"][4]))
    assert pg.evaluate("window.scrollY") == y0
    # the reader's page is moved far away by script (not by wheel): the next lit akshara must bring its line back
    pg.evaluate("window.scrollTo(0, 5000)")
    pg.wait_for_timeout(100)
    seek(pg, 1, mid(V1["aksharas"][25]))
    pg.wait_for_timeout(200)
    r = pg.evaluate("(() => { const e = document.querySelector('#verse-1 .sanskrit .is-akshara').getBoundingClientRect(); return [e.top, e.bottom, innerHeight]; })()")
    assert 0 <= r[0] and r[1] <= r[2], r
    ctx.close()


def test_a_reader_who_scrolls_away_is_not_pulled_back(browser, env):
    """Failure caught: the page yanks the reader back to the lit line after they scrolled on purpose."""
    ctx, pg = open_page(browser, env, reduced_motion="reduce", viewport={"width": 1000, "height": 700})
    play(pg, 1)
    pg.mouse.move(500, 300); pg.mouse.wheel(0, 2500)
    pg.wait_for_timeout(300)
    y = pg.evaluate("window.scrollY")
    seek(pg, 1, mid(V1["aksharas"][25]))
    pg.wait_for_timeout(200)
    assert abs(pg.evaluate("window.scrollY") - y) < 2
    ctx.close()
