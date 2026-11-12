"""Browser tests for the player + accuracy review as linked tabs (#55).

    python -m pytest tests/test_rnd_chant_tabs.py -q -p no:cacheprovider

Each test is named for the failure it catches. Needs Playwright for Python + Chromium. The tests that check the audio
position need the clips under rnd/kavacham-audio-alignment/dmv-kavacham/audio/ (python tools/fetch-rnd-audio.py, or
tools/preview-chant-audio.py); without them that one assertion is skipped, the rest still run.
"""
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

import pytest
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALIGN = os.path.join(ROOT, "rnd", "kavacham-audio-alignment")
CHANT = os.path.join(ALIGN, "dmv-kavacham")
KEY = "dmvChantReview.v1"
R = json.load(open(os.path.join(CHANT, "results.json"), encoding="utf-8"))
HAVE_AUDIO = os.path.isfile(os.path.join(CHANT, "audio", "day2", "verse07.mp3"))


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def start_server(root):
    port = free_port()
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    proc = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "serve-range.py"), str(port), root],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)
    for _ in range(50):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1)
            break
        except Exception:
            time.sleep(0.1)
    return proc, f"http://127.0.0.1:{port}"


@pytest.fixture(scope="session")
def base():
    proc, url = start_server(ROOT)
    yield url + "/rnd/kavacham-audio-alignment/dmv-kavacham/"
    proc.terminate()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture()
def page(browser):
    ctx = browser.new_context(viewport={"width": 1100, "height": 900})
    pg = ctx.new_page()
    yield pg
    ctx.close()


def first_probable():
    """(day, verse, finding) of the first probable slip in results.json, in take order."""
    for k in sorted(R["takes"], key=lambda s: tuple(map(int, s.split(".")))):
        for f in R["takes"][k]["findings"]:
            if f["tier"] == "probable slip" and f.get("syll"):
                d, v = map(int, k.split("."))
                return d, v, f
    raise AssertionError("no probable slip in results.json")


def num(x):
    """JS-style number text (4.0 -> '4')."""
    return str(int(x)) if float(x).is_integer() else str(x)


# ---------------------------------------------------------------- deep links

def test_review_finding_link_opens_player_on_the_right_verse_day_and_time(page, base):
    d, v, f = first_probable()
    page.goto(base + "review.html")
    page.click(f'button.cell[data-day="{d}"][data-verse="{v}"]')
    link = page.locator(f'#vb{v} .find.t-probable a:has-text("Open in player")').first
    href = link.get_attribute("href")
    assert href.startswith("player.html#"), href
    assert f"verse={v}&day={d}&t={num(f['t_start'])}" in href, href
    link.click()
    page.wait_for_url(re.compile(r"player\.html#"))
    page.wait_for_selector("#chantMsg:not([hidden]) button")
    assert page.locator(f"#panel{d}").is_visible(), "the link's day is not the open tab"
    row = page.locator(f'li.v[data-day="{d}"][data-i="{v - 1}"]')
    assert "chant-target" in row.get_attribute("class")
    msg = page.inner_text("#chantMsg")
    assert f"verse {v}" in msg and f"Day {d}" in msg and f"{f['t_start']:.1f} s" in msg, msg
    assert f["expected_deva"] in msg, "the flagged akshara is not named"
    if HAVE_AUDIO:
        page.wait_for_function(
            "([d,i,t]) => Math.abs(document.querySelector(`audio[data-day='${d}'][data-i='${i}']`).currentTime - t) < 0.2",
            arg=[d, v - 1, f["t_start"] - 1])
    else:
        pytest.skip("clips not restored: verse/day/message checked, audio position not")


def test_player_link_opens_the_right_review_section_with_that_day_open(page, base):
    page.goto(base + "player.html#day=2")
    page.wait_for_selector('li.v[data-day="2"][data-i="6"] a.chant-xlink')
    page.click('li.v[data-day="2"][data-i="6"] a.chant-xlink')
    page.wait_for_url(re.compile(r"review\.html#verse=7&day=2$"))
    page.wait_for_selector("details#v7[open]")
    assert page.locator('#vb7 .tab[aria-selected="true"]').inner_text().startswith("Day 2")
    assert "Day 2:" in page.inner_text("#vb7")


def test_review_link_with_time_outlines_the_finding_nearest_that_time(page, base):
    d, v, f = first_probable()
    page.goto(base + f"review.html#verse={v}&day={d}&t={num(f['t_start'])}")
    page.wait_for_selector(".find.chant-target")
    assert "t-probable" in page.locator(".find.chant-target").first.get_attribute("class")


def test_player_badge_shows_the_review_result_for_each_take(page, base):
    d, v, f = first_probable()
    page.goto(base + "player.html")
    page.wait_for_selector(".chant-badge", state="attached")
    bad = page.locator(f'li.v[data-day="{d}"][data-i="{v - 1}"] .chant-badge').inner_text()
    assert "finding" in bad, bad
    clean = page.locator('li.v[data-day="2"][data-i="6"] .chant-badge').inner_text()
    assert clean.startswith("clean") and "confidence" in clean, clean
    cut = page.locator('li.v[data-day="1"][data-i="0"] .chant-badge').inner_text()
    assert cut == "bad cut", cut
    assert page.locator("li.v").count() == page.locator("li.v a.chant-xlink").count() == 84


@pytest.mark.parametrize("hash_,needle", [
    ("verse=99", 'verse "99"'),
    ("verse=3&day=9", 'day "9"'),
    ("verse=3&t=abc", '"abc"'),
    ("verse=3&s=x-y", '"x-y"'),
])
@pytest.mark.parametrize("name", ["player.html", "review.html"])
def test_bad_or_out_of_range_link_shows_a_plain_message_never_a_blank_page(page, base, name, hash_, needle):
    page.goto(base + name + "#" + hash_)
    page.wait_for_selector("#chantMsg:not([hidden])")
    assert needle in page.inner_text("#chantMsg")
    assert page.locator("nav.chant-tabs a").count() == 2
    assert len(page.inner_text("body")) > 500, "page is blank"


def test_time_beyond_the_clip_is_reported_and_the_verse_still_opens(page, base):
    if not HAVE_AUDIO:
        pytest.skip("needs the clips to know their length")
    page.goto(base + "player.html#verse=7&day=2&t=999")
    page.wait_for_function("document.getElementById('chantMsg') && /only .* s long/.test(document.getElementById('chantMsg').textContent)")
    assert "chant-target" in page.locator('li.v[data-day="2"][data-i="6"]').get_attribute("class")


# ---------------------------------------------------------------- tab bar

@pytest.mark.parametrize("name,current", [("player.html", "Player"), ("review.html", "Accuracy review")])
def test_tab_bar_marks_the_current_page_and_links_the_other(page, base, name, current):
    page.goto(base + name)
    page.wait_for_selector("nav.chant-tabs a")
    tabs = page.locator("nav.chant-tabs a")
    assert [tabs.nth(i).inner_text() for i in range(tabs.count())] == ["Player", "Accuracy review"]
    marked = page.locator('nav.chant-tabs a[aria-current="page"]')
    assert marked.count() == 1 and marked.inner_text() == current
    other = page.locator('nav.chant-tabs a:not([aria-current])')
    other.click()
    page.wait_for_url(re.compile(r"(review|player)\.html$"))
    assert page.locator('nav.chant-tabs a[aria-current="page"]').inner_text() != current


def test_tab_bar_is_reachable_by_keyboard_and_a_tab_is_a_real_link(page, base):
    page.goto(base + "review.html")
    page.wait_for_selector("nav.chant-tabs a")
    page.keyboard.press("Tab")
    assert page.evaluate("document.activeElement.className") == "chant-tab"
    page.keyboard.press("Tab")
    assert page.evaluate("document.activeElement.getAttribute('href')") == "review.html"
    page.keyboard.press("Shift+Tab")
    page.keyboard.press("Enter")
    page.wait_for_url(re.compile(r"player\.html$"))


# ---------------------------------------------------------------- KA's marks

def old_shape_id_and_entry():
    """The key shape the review page has always written: '<day>.<verse>.<kind>.<t_start>' -> {v, n, m}."""
    d, v, f = first_probable()
    fid = f"{d}.{v}.{f['kind']}.{num(f['t_start'])}"
    return d, v, fid, {"v": "right", "n": "heard it too", "m": {"day": d, "verse": v, "kind": f["kind"]}}


def test_existing_marks_in_local_storage_are_still_read_after_the_change(page, base):
    d, v, fid, entry = old_shape_id_and_entry()
    page.goto(base + "chant.json")   # same origin as the pages, so localStorage is shared
    page.evaluate("([k,id,e]) => localStorage.setItem(k, JSON.stringify({[id]: e}))", [KEY, fid, entry])
    page.goto(base + f"review.html#verse={v}&day={d}")
    page.wait_for_selector(f'[id="f-{fid}"]')
    box = page.locator(f'[id="f-{fid}"]')
    assert box.locator("button.vbtn.right").get_attribute("aria-pressed") == "true"
    assert box.locator("input.note").input_value() == "heard it too"
    assert page.inner_text("#count") == "1 answered"
    # nothing was re-keyed or dropped
    assert page.evaluate("Object.keys(localStorage)") == [KEY]
    assert json.loads(page.evaluate("k => localStorage.getItem(k)", KEY)) == {fid: entry}


def test_a_new_mark_is_saved_under_the_same_old_key(page, base):
    d, v, fid, _ = old_shape_id_and_entry()
    page.goto(base + f"review.html#verse={v}&day={d}")
    page.wait_for_selector(f'[id="f-{fid}"]')
    page.click(f'[id="f-{fid}"] button.vbtn.wrong')
    stored = json.loads(page.evaluate("k => localStorage.getItem(k)", KEY))
    assert stored[fid]["v"] == "wrong"
    assert page.evaluate("Object.keys(localStorage)") == [KEY]


def test_import_never_overwrites_an_answer_already_given_here(page, base):
    d, v, fid, entry = old_shape_id_and_entry()
    page.goto(base + "chant.json")
    page.evaluate("([k,id,e]) => localStorage.setItem(k, JSON.stringify({[id]: e}))", [KEY, fid, entry])
    page.goto(base + "review.html")
    page.wait_for_selector("#doimport", state="attached")
    payload = {"answers": [
        {"finding": fid, "answer": "wrong", "note": "other browser", "details": None},
        {"finding": "9.9.substitution.1.5", "answer": "unsure", "note": "", "details": {"x": 1}}]}
    page.evaluate("() => document.getElementById('jsonin').closest('details').open = true")
    page.fill("#jsonin", json.dumps(payload))
    page.click("#doimport")
    stored = json.loads(page.evaluate("k => localStorage.getItem(k)", KEY))
    assert stored[fid] == entry, "an existing answer was overwritten"
    assert stored["9.9.substitution.1.5"]["v"] == "unsure"
    assert "Imported 1" in page.inner_text("#status") and "1 already answered" in page.inner_text("#status")


# ---------------------------------------------------------------- health

@pytest.mark.parametrize("name", ["player.html", "review.html", "review.html#verse=7&day=2", "player.html#verse=1&day=6&t=6.4&s=17"])
def test_pages_load_with_no_console_errors(page, base, name):
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "/audio/" not in (m.location.get("url") or "") else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + name)
    page.wait_for_selector("nav.chant-tabs a")
    page.wait_for_load_state("networkidle")
    assert errors == []


def test_review_has_no_horizontal_scroll_at_phone_width(browser, base):
    ctx = browser.new_context(viewport={"width": 390, "height": 800})
    pg = ctx.new_page()
    for name in ("player.html", "review.html#verse=7&day=2"):
        pg.goto(base + name)
        pg.wait_for_selector("nav.chant-tabs a")
        pg.wait_for_load_state("networkidle")
        assert pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), name
    ctx.close()


# ---------------------------------------------------------------- scores at every level (owner's standing rule)

def test_every_finding_shows_a_numeric_confidence(page, base):
    page.goto(base + "review.html")
    page.wait_for_selector("#vb1", state="attached")
    total = sum(len(t["findings"]) for t in R["takes"].values())
    seen = page.evaluate("""() => { const out = [];
        VERSES.forEach(v => DAYS.forEach(d => { openVerse(v, d, false);
          document.querySelectorAll('#vb' + v + ' .find:not(.ign)').forEach(f => { const c = f.querySelector('.fconf');
            out.push({id: f.dataset.id, txt: c ? c.textContent : null}); }); }));
        return out; }""")
    assert len(seen) == total == 59, (len(seen), total)
    bad = [x for x in seen if not x["txt"] or not re.fullmatch(r"confidence \d{1,2}", x["txt"]) or int(x["txt"].split()[1]) > 95]
    assert bad == []


def test_finding_confidence_follows_the_stated_formula():
    """1 of 3 listeners = 33, 2 of 3 = 67, 3 of 3 = 95 (cap); derived from results.json, never invented (METHOD.md)."""
    vals = {}
    for t in R["takes"].values():
        for f in t["findings"]:
            if f["tier"] != "defect" and not f.get("signal"):
                vals.setdefault(f.get("passes_agreeing"), set()).add(f["fconf"])
    assert vals[1] <= {33, 50} and vals[2] == {67} and vals[3] == {95}, vals


def test_not_scored_cells_say_why_instead_of_showing_nothing(page, base):
    page.goto(base + "review.html")
    page.wait_for_selector("button.cell")
    expected = sorted(k for k, t in R["takes"].items() if t["conf"]["na"])
    assert expected == ["1.1", "1.2", "1.3", "6.9"], expected
    for k in expected:
        d, v = k.split(".")
        cell = page.locator(f'button.cell[data-day="{d}"][data-verse="{v}"]')
        txt = cell.inner_text()
        assert "n/a" in txt and re.search(r"not scored: (bad cut|looped|cut edge)", txt), (k, txt)
        assert "not scored:" in cell.get_attribute("aria-label")
    assert page.locator("button.cell:has-text('not scored')").count() == 4
    assert "not scored" in page.inner_text("#legend")


def test_player_shows_each_days_review_score_and_the_recommended_mark(page, base):
    cfg = json.load(open(os.path.join(CHANT, "chant.json"), encoding="utf-8"))
    page.goto(base + "player.html")
    page.wait_for_selector(".tab .chant-dscore")
    for s in cfg["sets"]:
        btn = page.locator(f'.tab[data-day="{s["id"]}"]')
        want = R["day_conf"][str(s["id"])]["mean"]
        shown = int(re.search(r"· (\d+)", btn.inner_text()).group(1))
        assert abs(shown - want) <= 1, (s["id"], btn.inner_text(), want)
        assert (btn.locator(".chant-rec").count() == 1) == (s["id"] == cfg["recommended_set"])
        assert f"confidence {shown}" in page.locator(f"#panel{s['id']} .dayhead").text_content()


def test_player_opens_on_the_recommended_set_from_chant_json(page, base):
    cfg = json.load(open(os.path.join(CHANT, "chant.json"), encoding="utf-8"))
    page.goto(base + "player.html")
    page.wait_for_selector("nav.chant-tabs a")
    shown = page.evaluate("[...document.querySelectorAll('.panel')].filter(p => p.style.display === 'block').map(p => p.id)")
    assert shown == [f"panel{cfg['recommended_set']}"], shown
    assert "active" in page.locator(f'.tab[data-day="{cfg["recommended_set"]}"]').get_attribute("class")


def test_player_row_number_is_labelled_and_its_tooltip_is_true_for_that_row(page, base):
    page.goto(base + "player.html")
    page.wait_for_selector("li.v", state="attached")
    low = page.locator('li.v[data-day="1"][data-i="0"] .score')
    fine = page.locator('li.v[data-day="2"][data-i="0"] .score')
    assert low.text_content().startswith("align 0.07") and "Below 0.85" in low.get_attribute("title")
    assert fine.text_content().startswith("align 0.9") and "At or above 0.85" in fine.get_attribute("title")
    assert "flagged low" not in fine.get_attribute("title")
    assert "not the accuracy review" in fine.get_attribute("title").lower()


def test_trust_text_names_three_listeners_everywhere(page, base):
    page.goto(base + "review.html")
    page.wait_for_selector("#summary .card")
    txt = page.inner_text("#summary")
    assert "Three automatic listeners" in txt and "both listeners" not in txt
    assert "both letter-level listeners" in txt


def test_favicon_is_linked_and_loads_on_both_pages(page, base):
    for name in ("player.html", "review.html"):
        page.goto(base + name)
        href = page.evaluate("document.querySelector('link[rel=icon]').href")
        assert page.evaluate("u => fetch(u).then(r => r.status)", href) == 200, (name, href)


# ---------------------------------------------------------------- phone: tap targets, sideways scroll, the bar

TAP_JS = """() => [...document.querySelectorAll('button, a[href], input[type=checkbox], input[type=text], summary')]
  .filter(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'; })
  .map(e => ({el: e.tagName + '.' + e.className + ' ' + (e.textContent || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height * 10) / 10}))
  .filter(x => x.h < 39.5)"""


@pytest.mark.parametrize("name", [
    "player.html", "player.html#verse=4&day=1", "player.html#verse=1&day=6&t=6.4",
    "review.html", "review.html#verse=1&day=6", "review.html#verse=7&day=2", "review.html#verse=3&day=4"])
def test_every_control_is_at_least_40px_high_on_a_phone_and_nothing_scrolls_sideways(browser, base, name):
    ctx = browser.new_context(viewport={"width": 390, "height": 800})
    pg = ctx.new_page()
    pg.goto(base + name)
    pg.wait_for_selector("nav.chant-tabs a")
    pg.wait_for_load_state("networkidle")
    if name.startswith("review"):
        pg.evaluate("document.getElementById('jsonin').closest('details').open = true")
    assert pg.evaluate(TAP_JS) == []
    assert pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    ctx.close()


def test_day_table_shows_recommended_tag_and_clean_count_without_sideways_scroll_on_a_phone(browser, base):
    ctx = browser.new_context(viewport={"width": 390, "height": 800})
    pg = ctx.new_page()
    pg.goto(base + "review.html")
    pg.wait_for_selector("table.daytab")
    assert pg.evaluate("(() => { const w = document.querySelector('.daytab').closest('.gridwrap'); return w.scrollWidth <= w.clientWidth; })()")
    rec = pg.locator(".daytab .badge:has-text('recommended')").bounding_box()
    clean = pg.locator(".daytab td[data-label='Clean verses']").first.bounding_box()
    for b in (rec, clean):
        assert b and b["x"] >= 0 and b["x"] + b["width"] <= 390
    ctx.close()


def test_bottom_bar_is_hidden_until_audio_is_used_and_then_never_covers_the_last_content(browser, base):
    ctx = browser.new_context(viewport={"width": 390, "height": 800})
    pg = ctx.new_page()
    pg.goto(base + "review.html#verse=1&day=6")
    pg.wait_for_selector(".find .btn-play")
    assert not pg.locator(".bar").is_visible()
    pg.locator(".find .btn-play").first.click()
    pg.wait_for_selector(".bar.on")
    pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    bar_top = pg.locator(".bar").bounding_box()["y"]
    last = pg.evaluate("Math.max(...[...document.querySelectorAll('body > .card, body > div:not(.bar)')].map(e => e.getBoundingClientRect().bottom))")
    assert last <= bar_top + 0.5, (last, bar_top)
    pg.click("#stop")
    assert not pg.locator(".bar").is_visible()
    ctx.close()


# ---------------------------------------------------------------- repo hygiene

LOCAL_PATH_NEEDLES = [("C:", "/Users"), ("C:", "\\Users"), ("C:", "\\\\Users"), ("D:", "/"), ("D:", "\\")]


def test_no_machine_local_paths_in_the_committed_files():
    needles = ["".join(n) for n in LOCAL_PATH_NEEDLES]
    out = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard", "--",
                          "rnd/kavacham-audio-alignment/shared", "rnd/kavacham-audio-alignment/dmv-kavacham",
                          "rnd/kavacham-audio-alignment/scripts/gen_kavacham_player.py",
                          "tools/preview-chant-audio.py", "tools/serve-range.py", "tests/test_rnd_chant_tabs.py"],
                         cwd=ROOT, capture_output=True, text=True, encoding="utf-8").stdout.split("\n")
    # review/ and the generated pages are the files copied in from the analysis; the older player data are scanned too
    files = [f for f in out if f and not f.startswith("rnd/kavacham-audio-alignment/dmv-kavacham/audio/")]
    assert any(f.endswith("review.html") for f in files) and any(f.endswith("METHOD.md") for f in files)
    hits = []
    for f in files:
        txt = open(os.path.join(ROOT, f), encoding="utf-8", errors="replace").read()
        for n in needles:
            if n in txt:
                hits.append((f, n))
    assert hits == []


# ---------------------------------------------------------------- generic over a chant

def test_second_chant_folder_gets_both_pages_and_an_extra_tab_without_code_changes(browser, tmp_path):
    root = tmp_path / "rnd" / "kavacham-audio-alignment"
    shutil.copytree(os.path.join(ALIGN, "shared"), root / "shared")
    other = root / "second-chant"
    other.mkdir(parents=True)
    for f in os.listdir(CHANT):
        if f.endswith(".json") or f in ("review",):
            src = os.path.join(CHANT, f)
            (shutil.copytree if os.path.isdir(src) else shutil.copy)(src, other / f)
    cfg = json.load(open(other / "chant.json", encoding="utf-8"))
    cfg.update({"id": "second-chant", "title": "Second Chant", "review_storage_key": "secondChantReview.v1"})
    cfg["tabs"].append({"id": "lab", "label": "Lab / book", "href": "../57-chant-lab/index.html"})
    json.dump(cfg, open(other / "chant.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    env = dict(os.environ, PYTHONUTF8="1")
    for cmd in ([os.path.join(ALIGN, "scripts", "gen_kavacham_player.py"), str(other)],
                [os.path.join(CHANT, "review", "scripts", "build_review.py"), str(other)]):
        subprocess.run([sys.executable] + cmd, check=True, capture_output=True, env=env)
    proc, url = start_server(str(tmp_path))
    try:
        ctx = browser.new_context()
        pg = ctx.new_page()
        for name, current in (("player.html", "Player"), ("review.html", "Accuracy review")):
            pg.goto(f"{url}/rnd/kavacham-audio-alignment/second-chant/{name}")
            pg.wait_for_selector("nav.chant-tabs a")
            tabs = pg.locator("nav.chant-tabs a")
            assert [tabs.nth(i).inner_text() for i in range(tabs.count())] == ["Player", "Accuracy review", "Lab / book"]
            assert pg.locator('nav.chant-tabs a[aria-current="page"]').inner_text() == current
            assert "Second Chant" in pg.title()
        # a mark saved on the second chant goes under ITS key, not the Kavacham one
        pg.goto(f"{url}/rnd/kavacham-audio-alignment/second-chant/review.html#verse=1&day=6")
        pg.wait_for_selector("#vb1 .find")
        pg.click("#vb1 .find .vbtn.right")
        assert pg.evaluate("Object.keys(localStorage)") == ["secondChantReview.v1"]
        ctx.close()
    finally:
        proc.terminate()


CLIP_JS = """() => [...document.querySelectorAll('button')]
  .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.classList.contains('cell') && e.textContent.trim().length >= 3; })
  .map(e => { const g = document.createRange(); g.selectNodeContents(e);
    const tops = [...g.getClientRects()].filter(x => x.width > 0).map(x => x.top).sort((p, q) => p - q).filter((t, i, arr) => i === 0 || t - arr[i - 1] > 6);
    return {el: e.className + ' ' + e.textContent.trim().slice(0, 24), w: e.clientWidth, h: e.clientHeight,
            clip: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1, lines: tops.length}; })
  .filter(x => x.clip || x.lines > 2)"""


@pytest.mark.parametrize("name", ["review.html#verse=1&day=6", "review.html#verse=7&day=2", "review.html#verse=3&day=4",
                                  "player.html", "player.html#verse=4&day=1"])
def test_text_buttons_keep_their_natural_width_so_no_label_is_clipped_or_split_per_letter(browser, base, name):
    """Regression: a 40 px width rule meant for the player's round play button squashed 'Whole take' and 'Play from 2 s before'."""
    ctx = browser.new_context(viewport={"width": 390, "height": 800})
    pg = ctx.new_page()
    pg.goto(base + name)
    pg.wait_for_selector("nav.chant-tabs a")
    pg.wait_for_load_state("networkidle")
    assert pg.evaluate(CLIP_JS) == []
    for sel in ("button.btn-play", "button.play:has-text('Whole take')"):
        for b in pg.locator(sel).all():
            if b.is_visible():
                assert b.bounding_box()["width"] >= 100, (sel, b.bounding_box())
    ctx.close()


def test_a_days_score_is_rounded_the_same_on_the_player_and_the_review(page, base):
    page.goto(base + "review.html")
    page.wait_for_selector(".daytab .pill")
    rev = page.evaluate("[...document.querySelectorAll('.daytab tr')].slice(1).map(r => r.querySelector('.pill').textContent)")
    page.goto(base + "player.html")
    page.wait_for_selector(".tab .chant-dscore")
    ply = page.evaluate("[...document.querySelectorAll('.tab .chant-dscore')].map(e => e.textContent.replace(/[^0-9]/g, ''))")
    assert rev == ply and len(ply) == 6, (rev, ply)


def test_first_finding_points_at_the_collapsed_explanation_of_its_confidence(page, base):
    page.goto(base + "review.html#verse=1&day=6")
    page.wait_for_selector(".find .fconf")
    links = page.locator("#vb1 .find a.howlink")
    assert links.count() == 1, "only the first finding carries the pointer"
    assert not page.evaluate("document.getElementById('howdet').open")
    links.click()
    assert page.evaluate("document.getElementById('howdet').open")
