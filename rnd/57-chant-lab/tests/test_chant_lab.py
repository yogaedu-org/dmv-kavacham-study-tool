"""Browser tests for the chant-lab book (dmv #57). Playwright for Python, Chromium. Run from the repo root:

    python -I -m pytest rnd/57-chant-lab/tests/test_chant_lab.py -q -p no:cacheprovider

The book serves from the repo root (it mounts ../56-audio-sources/ and /fonts/). The Day 2 and Day 5 clips are
gitignored: run `python rnd/57-chant-lab/tools/copy-clips.py` first; without them the audio tests skip with that hint.
Each test is named for the failure it catches.
"""
import io, json, math, os, struct, sys, wave
from urllib.parse import urlparse

import pytest
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
BOOK = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(BOOK))
sys.path.insert(0, os.path.join(BOOK, "tools"))
import serve  # noqa: E402

CHAPTERS = ["ch%d" % i for i in range(1, 10)]
PAGES = ["index"] + CHAPTERS + ["lab1", "lab2", "lab3", "sources", "glossary"]
HAVE_AUDIO = os.path.isfile(os.path.join(BOOK, "local-audio", "day2", "verse01.mp3")) and os.path.isfile(os.path.join(BOOK, "local-audio", "day5", "verse01.mp3"))
needs_audio = pytest.mark.skipif(not HAVE_AUDIO, reason="no clips: run python rnd/57-chant-lab/tools/copy-clips.py")


@pytest.fixture(scope="module")
def site():
    srv = serve.start(REPO, 0)
    yield "http://127.0.0.1:%d/rnd/57-chant-lab/" % srv.server_address[1]
    srv.shutdown()


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        yield b
        b.close()


@pytest.fixture()
def page(browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.errors, pg.bad = [], []
    pg.on("console", lambda m: pg.errors.append(("console", m.text)) if m.type == "error" else None)
    pg.on("pageerror", lambda e: pg.errors.append(("pageerror", str(e))))
    pg.on("response", lambda r: pg.bad.append((r.status, r.url)) if r.status >= 400 else None)
    yield pg
    ctx.close()


def chant():
    return json.load(open(os.path.join(BOOK, "chant.json"), encoding="utf-8"))


def beep_wav(seconds=3.0, hz=440, rate=16000):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(9000 * math.sin(2 * math.pi * hz * i / rate))) for i in range(int(seconds * rate))))
    return buf.getvalue()


def test_every_page_loads_with_no_console_error_no_404_and_no_broken_internal_link(site, page):
    seen = set()
    for name in PAGES:
        page.goto(site + name + ".html")
        page.wait_for_timeout(2500 if HAVE_AUDIO else 800)
        assert page.errors == [], f"{name}: {page.errors}"
        assert page.bad == [], f"{name}: a request failed (a missing favicon logs a 404): {page.bad}"
        assert page.locator("h1").count() == 1, f"{name}: needs exactly one h1"
        for href in page.eval_on_selector_all("a[href]", "els => els.map(e => e.href)"):
            u = urlparse(href)
            if u.scheme != "http" or u.hostname != "127.0.0.1":
                continue
            target = href.split("#")[0]
            if target in seen:
                continue
            seen.add(target)
            r = page.request.get(target)
            assert r.status == 200, f"{name}: broken link {href} -> {r.status}"


def test_main_text_of_every_page_stays_under_500_words_excluding_collapsed_blocks(site, page):
    over = {}
    for name in PAGES:
        if name in ("sources", "glossary"):
            continue
        page.goto(site + name + ".html")
        page.wait_for_timeout(600)
        n = page.evaluate("""() => { const m = document.querySelector('main').cloneNode(true);
            m.querySelectorAll('.stage, details, nav, script, .fb, .where, .pager').forEach(e => e.remove());
            return m.textContent.split(/\\s+/).filter(Boolean).length; }""")
        if n > 500:
            over[name] = n
    assert over == {}, f"too long for a chanter to read on one page: {over}"


def test_collapsed_technical_block_is_closed_by_default_on_chapters(site, page):
    for name in CHAPTERS:
        page.goto(site + name + ".html")
        d = page.locator("details.deep")
        assert d.count() == 1, name
        assert d.evaluate("e => e.open") is False, f"{name}: the technical block must start closed"
        assert "technically curious" in d.locator("summary").inner_text()


def test_first_use_of_every_glossary_term_on_a_page_is_a_glossary_link(site, page):
    bad = []
    for name in PAGES:
        if name == "glossary":
            continue
        page.goto(site + name + ".html")
        page.wait_for_timeout(500)
        res = page.evaluate("""async () => {
          const { GLOSSARY } = await import(new URL('js/glossary.js', location.href));
          const skip = (n) => n.closest('h1, h2, h3, summary, button, label, option, select, script, style, pre, code, .stage, .fb, .pager, .where, [data-noterm]');
          const out = [];
          const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
          const nodes = []; for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.trim() && !skip(n.parentElement) && n.parentElement.closest('.col')) nodes.push(n);
          for (const g of GLOSSARY.filter((x) => x.re)) {
            const rx = new RegExp(g.re, 'i');
            const first = nodes.find((n) => rx.test(n.nodeValue));
            if (first && !first.parentElement.closest('a.term[href$="#' + g.id + '"]')) out.push(g.id + ': ' + first.nodeValue.trim().slice(0, 60));
          }
          return out; }""")
        bad += [(name, r) for r in res]
    assert bad == [], bad


def test_every_glossary_entry_has_an_anchor_and_a_term_link_opens_its_definition(site, page):
    page.goto(site + "glossary.html")
    ids = page.evaluate("[...document.querySelectorAll('dt[id]')].map(e => e.id)")
    glossary = page.evaluate("import(new URL('js/glossary.js', location.href)).then(m => m.GLOSSARY.map(g => g.id))")
    assert sorted(ids) == sorted(glossary)
    page.goto(site + "ch3.html")
    link = page.locator("a.term").first
    link.hover()
    page.wait_for_selector("#termpop:not([hidden])")
    assert len(page.inner_text("#termpop")) > 30 and "Open in the glossary" in page.inner_text("#termpop")


def test_chapter_claims_link_to_anchored_sources_entries_that_exist(site, page):
    page.goto(site + "sources.html")
    ids = set(page.evaluate("[...document.querySelectorAll('li[id]')].map(e => e.id)"))
    assert len(ids) >= 50
    for e in page.eval_on_selector_all("li[id]", "els => els.map(e => [e.id, e.querySelector('a') && e.querySelector('a').href, /\\d{4}/.test(e.textContent)])"):
        assert e[1] and e[2], f"entry {e[0]} needs an address and a date"
    missing, direct = [], []
    for name in PAGES:
        if name == "sources":
            continue
        page.goto(site + name + ".html")
        for h in page.eval_on_selector_all("main a[href]", "els => els.map(e => e.getAttribute('href'))"):
            if h.startswith("sources.html#") and h.split("#")[1] not in ids:
                missing.append((name, h))
            if h.startswith("http") or h.startswith("research/"):
                direct.append((name, h))
    assert missing == [], missing
    assert direct == [], f"claims must link to an anchored Sources entry, not straight out: {direct}"


def test_sources_and_glossary_show_the_same_where_am_i_marker_as_other_pages(site, page):
    for name, text in (("sources", "Back of the book: Sources"), ("glossary", "Back of the book: Glossary"), ("ch4", "Chapter 4 of 9"), ("lab2", "Lab 2 of 3")):
        page.goto(site + name + ".html")
        assert page.inner_text(".where") == text
        assert page.locator(".bar a[aria-current='page']").count() == 1


def test_every_chart_and_ribbon_has_a_text_summary(site, page):
    for name in ["index", "ch1", "ch2", "ch3", "ch4", "ch7", "lab3"]:
        page.goto(site + name + ".html")
        page.wait_for_timeout(2500 if HAVE_AUDIO else 800)
        n = page.evaluate("""() => [...document.querySelectorAll('canvas.chart, .ribbon')].filter(el => {
            if (el.offsetParent === null) return false;
            const stage = el.closest('.stage'); return !stage || ![...stage.querySelectorAll('[data-summary]')].some(s => s.textContent.trim().length > 20);
        }).length""")
        assert n == 0, f"{name}: a visible chart or ribbon has no text summary"


@needs_audio
def test_ribbon_plays_a_verse_and_the_current_syllable_advances(site, page):
    page.goto(site + "index.html")
    page.wait_for_function("document.querySelector('#audio').readyState >= 2", timeout=20000)
    assert page.evaluate("document.querySelector('#ribbon').dataset.now") in ("-1", None, "")
    page.click(".rb-play")                                   # the big button on the ribbon, not the native bar
    page.wait_for_function("document.querySelector('#audio').currentTime > 1.5", timeout=15000)
    first = int(page.evaluate("document.querySelector('#ribbon').dataset.now"))
    assert first >= 0 and page.locator(".rb-cell.now").count() == 1
    assert page.inner_text(".rb-play") == "Pause"
    page.wait_for_function("document.querySelector('#audio').currentTime > 4", timeout=15000)
    later = int(page.evaluate("document.querySelector('#ribbon').dataset.now"))
    assert later > first, f"ribbon stayed on syllable {first}"
    page.click(".rb-play")
    assert page.evaluate("document.querySelector('#audio').paused")
    v = chant()["verses"][0]
    page.locator(".rb-cell[data-i='20']").click()
    t = page.evaluate("document.querySelector('#audio').currentTime")
    assert abs(t - v["syl_t"][20][0]) < 0.6, t


@needs_audio
def test_start_page_play_button_is_above_the_fold_and_no_syllable_is_clipped_on_a_phone(site, browser):
    ctx = browser.new_context(viewport={"width": 390, "height": 800}, device_scale_factor=2)
    pg = ctx.new_page()
    pg.goto(site + "index.html")
    pg.wait_for_selector(".rb-cell", timeout=20000)
    pg.wait_for_timeout(2500)
    box = pg.locator(".rb-play").bounding_box()
    assert box and box["y"] + box["height"] < 800 and box["height"] >= 48, box
    clipped = pg.evaluate("""() => { const out = [];
        for (const c of document.querySelectorAll('#ribbon .rb-cell')) {
          const cw = c.getBoundingClientRect().width;
          for (const sp of c.querySelectorAll('.d, .r')) { const r = document.createRange(); r.selectNodeContents(sp); if (r.getBoundingClientRect().width > cw - 2) out.push(sp.textContent + ' ' + Math.round(r.getBoundingClientRect().width) + '>' + Math.round(cw)); }
        } return out; }""")
    assert clipped == [], f"syllables wider than their cell: {clipped}"
    rows = pg.locator("#ribbon .rb-row").count()
    assert rows >= 3, "a narrow screen should wrap the lines onto more rows, not scroll or clip"
    assert pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    ctx.close()


def test_top_nav_targets_are_at_least_40_px_on_a_phone(site, browser):
    ctx = browser.new_context(viewport={"width": 390, "height": 800})
    pg = ctx.new_page()
    pg.goto(site + "ch2.html")
    small = pg.evaluate("""() => [...document.querySelectorAll('.bar nav a, .bar button')].map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim(), Math.round(r.width), Math.round(r.height)]; }).filter(x => x[1] < 40 || x[2] < 40)""")
    assert small == [], f"tap targets under 40 px: {small}"
    ctx.close()


def test_feedback_control_saves_survives_reload_and_exports(site, page):
    page.goto(site + "ch2.html")
    box = page.locator("[data-fb='ch2.wave']")
    box.locator("input[value='improve']").check()
    box.locator("input[type='text']").fill("pause shading too faint")
    page.wait_for_timeout(200)
    page.reload()
    box = page.locator("[data-fb='ch2.wave']")
    assert box.locator("input[value='improve']").is_checked()
    assert box.locator("input[type='text']").input_value() == "pause shading too faint"
    with page.expect_download() as d:
        page.click("#fbexp")
    data = json.load(open(d.value.path(), encoding="utf-8"))
    item = [i for i in data["items"] if i["id"] == "ch2.wave"]
    assert item and item[0]["verdict"] == "improve" and item[0]["note"] == "pause shading too faint" and item[0]["page"] == "ch2"


@needs_audio
def test_lab2_reference_against_itself_scores_every_level_near_perfect_with_no_flags(site, page):
    page.goto(site + "lab2.html?verse=3")
    page.wait_for_selector("#go:not([disabled])", timeout=30000)
    page.check("input[name='src'][value='ref']")
    page.click("#go")
    page.wait_for_selector("#results:not([hidden])", timeout=60000)
    r = page.evaluate("window.__chantlab.lab2")
    v = chant()["verses"][2]
    assert r["flagged"] == [] and r["low"] is False
    assert r["levels"]["verse"]["score"] >= 95 and r["levels"]["verse"]["conf"] > 0
    assert len(r["levels"]["lines"]) == 2 and all(l["score"] >= 95 and l["conf"] is not None for l in r["levels"]["lines"])
    assert len(r["levels"]["ak"]) == len(v["syllables"]) and all(a["score"] >= 90 and isinstance(a["conf"], int) for a in r["levels"]["ak"])
    assert r["overall"]["score"] >= 95 and r["overall"]["n"] == 1
    assert page.locator("#aktable tbody tr").count() == len(v["syllables"])
    levels_text = page.inner_text("#levels")
    for word in ("Overall", "Verse 3", "Line 1", "Line 2"):
        assert word in levels_text
    assert "Score" in page.inner_text(".confbox") and "Confidence" in page.inner_text(".confbox")


@needs_audio
def test_lab2_greys_a_score_that_rests_on_too_little_evidence_instead_of_showing_a_mark(site, page):
    page.goto(site + "lab2.html?verse=3")
    page.wait_for_selector("#go:not([disabled])", timeout=30000)
    page.set_input_files("#file", {"name": "beep.wav", "mimeType": "audio/wav", "buffer": beep_wav()})
    page.click("#go")
    page.wait_for_selector("#results:not([hidden])", timeout=60000)
    r = page.evaluate("window.__chantlab.lab2")
    assert r["levels"]["verse"]["conf"] < 30 and r["low"] is True, r["levels"]["verse"]
    first_row = page.inner_text("#levels tbody tr:nth-child(2)")
    assert "not enough to judge" in first_row, first_row
    assert page.locator("#levels .lowconf").count() >= 2
    assert "not enough to judge" in page.inner_text("#levels-summary")


@needs_audio
def test_lab3_flags_planted_slips_in_the_reference_and_keeps_a_running_tally(site, page):
    page.goto(site + "lab3.html?verse=2")
    page.wait_for_selector("#plant:not([disabled])", timeout=30000)
    for kind, pos in (("silence", 5), ("replace", 9)):
        page.select_option("#kind", kind)
        page.fill("#pos", str(pos))
        n = page.evaluate("window.__chantlab.tally.slips")
        page.click("#plant")
        page.wait_for_function(f"window.__chantlab.tally.slips > {n}", timeout=60000)
        last = page.evaluate("window.__chantlab.last")
        assert last["hit"], f"planted {kind} at syllable {pos} was not flagged: {last}"
    assert page.inner_text("#t-caught") == "2 of 2"
    page.click("#clean")
    page.wait_for_function("window.__chantlab.tally.clean == 1", timeout=60000)
    assert page.inner_text("#t-clean") == "0 of 1"


@needs_audio
def test_missing_audio_message_names_the_source_tried_and_the_fix(site, page):
    page.goto(site + "ch9.html")
    page.wait_for_function("document.querySelector('#audio').readyState >= 2", timeout=20000)
    page.check("input[name='mode'][value='cloud']")
    page.click("#find")
    page.wait_for_function("document.querySelector('#status').classList.contains('err')", timeout=15000)
    t = page.inner_text("#status")
    assert "No audio found" in t and "cloud" in t and "copy-clips.py" in t
    page.check("input[name='mode'][value='custom']")
    page.click("#find")
    page.wait_for_function("document.querySelector('#status').textContent.includes('your own files')", timeout=15000)
    assert "no custom files chosen" in page.inner_text("#status")


def test_lab1_blocked_microphone_says_what_happened_and_what_to_do(site, browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    pg.add_init_script("navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), {name: 'NotAllowedError'}))")
    pg.goto(site + "lab1.html")
    pg.wait_for_timeout(800)
    pg.click("#rec")
    pg.wait_for_function("document.querySelector('#recstatus').textContent.length > 10")
    t = pg.inner_text("#recstatus")
    assert "blocked" in t and "address bar" in t and "press Record again" in t
    ctx.close()


def test_lab1_settings_line_says_not_reported_instead_of_undefined_or_claiming_off(site, browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    pg.add_init_script("""navigator.mediaDevices.getUserMedia = async () => { const c = new AudioContext(); const d = c.createMediaStreamDestination();
        const s = d.stream; s.getAudioTracks()[0].getSettings = () => ({}); return s; }""")
    pg.goto(site + "lab1.html")
    pg.wait_for_timeout(800)
    pg.click("#rec")
    pg.wait_for_function("document.querySelector('#micinfo').textContent.length > 10")
    t = pg.inner_text("#micinfo")
    assert "undefined" not in t and "All three are off" not in t, t
    assert t.count("not reported by this browser") >= 3, t
    pg.click("#stop")
    ctx.close()


@needs_audio
@pytest.mark.parametrize("name", ["index", "ch3", "ch7", "lab2"])
def test_no_horizontal_page_scroll_on_a_phone_width(site, browser, name):
    ctx = browser.new_context(viewport={"width": 360, "height": 740}, device_scale_factor=2)
    pg = ctx.new_page()
    pg.goto(site + name + ".html")
    pg.wait_for_timeout(3500)
    w = pg.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    assert w[0] <= w[1] + 1, f"{name}: page is {w[0]} px wide in a {w[1]} px window"
    ctx.close()
