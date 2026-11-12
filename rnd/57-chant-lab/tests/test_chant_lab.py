"""Browser tests for the chant-lab book (dmv #57). Playwright for Python, Chromium. Run from the repo root:

    python -I -m pytest rnd/57-chant-lab/tests/test_chant_lab.py -q -p no:cacheprovider

The book serves from the repo root (it mounts ../56-audio-sources/ and /fonts/). The Day 2 and Day 5 clips are
gitignored: run `python rnd/57-chant-lab/tools/copy-clips.py` first; without them the audio tests skip with that hint.
Each test is named for the failure it catches.
"""
import json, os, re, sys
from urllib.parse import urljoin, urlparse

import pytest
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
BOOK = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(BOOK))
sys.path.insert(0, os.path.join(BOOK, "tools"))
import serve  # noqa: E402

PAGES = ["index", "ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "lab1", "lab2", "lab3", "sources", "glossary"]
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
    pg.errors = []
    pg.on("console", lambda m: pg.errors.append(("console", m.text)) if m.type == "error" else None)
    pg.on("pageerror", lambda e: pg.errors.append(("pageerror", str(e))))
    yield pg
    ctx.close()


def chant():
    return json.load(open(os.path.join(BOOK, "chant.json"), encoding="utf-8"))


def test_every_page_loads_with_no_console_error_and_no_broken_internal_link(site, page):
    seen = set()
    for name in PAGES:
        page.goto(site + name + ".html")
        page.wait_for_timeout(2500 if HAVE_AUDIO else 800)
        assert page.errors == [], f"{name}: {page.errors}"
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


def test_every_external_link_in_the_chapters_is_listed_on_the_sources_page(site, page):
    listed = set()
    page.goto(site + "sources.html")
    for h in page.eval_on_selector_all("a[href^='http']", "els => els.map(e => e.href)"):
        listed.add(h.rstrip("/"))
    missing = []
    for name in PAGES:
        if name == "sources":
            continue
        page.goto(site + name + ".html")
        for h in page.eval_on_selector_all("main a[href^='http']", "els => els.map(e => e.href)"):
            if urlparse(h).hostname != "127.0.0.1" and h.rstrip("/") not in listed:
                missing.append((name, h))
    assert missing == [], missing


def test_every_chart_and_ribbon_has_a_text_summary(site, page):
    for name in ["index", "ch1", "ch2", "ch3", "ch4", "ch6", "lab3"]:
        page.goto(site + name + ".html")
        page.wait_for_timeout(2500 if HAVE_AUDIO else 800)
        n = page.evaluate("""() => [...document.querySelectorAll('canvas.chart, .ribbon')].filter(el => {
            if (el.offsetParent === null) return false;                      // hidden charts need no summary
            const stage = el.closest('.stage'); return !stage || ![...stage.querySelectorAll('[data-summary]')].some(s => s.textContent.trim().length > 20);
        }).length""")
        assert n == 0, f"{name}: a visible chart or ribbon has no text summary"


@needs_audio
def test_ribbon_plays_a_verse_and_the_current_syllable_advances(site, page):
    page.goto(site + "index.html")
    page.wait_for_function("document.querySelector('#audio').readyState >= 2", timeout=20000)
    assert page.evaluate("document.querySelector('#ribbon').dataset.now") in ("-1", None, "")
    page.evaluate("document.querySelector('#audio').play()")
    page.wait_for_function("document.querySelector('#audio').currentTime > 1.5", timeout=15000)
    first = int(page.evaluate("document.querySelector('#ribbon').dataset.now"))
    assert first >= 0 and page.locator(".rb-cell.now").count() == 1
    page.wait_for_function("document.querySelector('#audio').currentTime > 4", timeout=15000)
    later = int(page.evaluate("document.querySelector('#ribbon').dataset.now"))
    assert later > first, f"ribbon stayed on syllable {first}"
    page.evaluate("document.querySelector('#audio').pause()")
    # pressing a syllable seeks to it
    v = chant()["verses"][0]
    page.locator(".rb-cell[data-i='20']").click()
    t = page.evaluate("document.querySelector('#audio').currentTime")
    assert abs(t - v["syl_t"][20][0]) < 0.6, t


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
    assert r["flagged"] == []
    assert r["levels"]["verse"]["score"] >= 95 and r["levels"]["verse"]["conf"] > 0
    assert len(r["levels"]["lines"]) == 2 and all(l["score"] >= 95 and l["conf"] is not None for l in r["levels"]["lines"])
    assert len(r["levels"]["ak"]) == len(v["syllables"]) and all(a["score"] >= 90 and isinstance(a["conf"], int) for a in r["levels"]["ak"])
    assert r["overall"]["score"] >= 95 and r["overall"]["n"] == 1
    rows = page.locator("#aktable tbody tr")
    assert rows.count() == len(v["syllables"])           # passes get a row and a score too, not only flags
    levels_text = page.inner_text("#levels")
    for word in ("Overall", "Verse 3", "Line 1", "Line 2"):
        assert word in levels_text


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
    assert page.inner_text("#t-clean") == "0 of 1"      # a clean clip against itself must show no flag


@needs_audio
def test_missing_audio_message_names_the_source_tried_and_the_fix(site, page):
    page.goto(site + "ch7.html")
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
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})        # no microphone permission, no fake device
    pg = ctx.new_page()
    pg.add_init_script("navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), {name: 'NotAllowedError'}))")
    pg.goto(site + "lab1.html")
    pg.wait_for_timeout(800)
    pg.click("#rec")
    pg.wait_for_function("document.querySelector('#recstatus').textContent.length > 10")
    t = pg.inner_text("#recstatus")
    assert "blocked" in t and "address bar" in t and "press Record again" in t
    ctx.close()


@needs_audio
@pytest.mark.parametrize("name", ["index", "ch3", "lab2"])
def test_no_horizontal_page_scroll_on_a_phone_width(site, browser, name):
    ctx = browser.new_context(viewport={"width": 360, "height": 740}, device_scale_factor=2)
    pg = ctx.new_page()
    pg.goto(site + name + ".html")
    pg.wait_for_timeout(3500)
    w = pg.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    assert w[0] <= w[1] + 1, f"{name}: page is {w[0]} px wide in a {w[1]} px window"
    ctx.close()
