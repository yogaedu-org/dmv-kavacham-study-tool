"""Browser tests for the #56 side page (Playwright for Python, Chromium). Run:

    python -I -m pytest rnd/56-audio-sources/tests/test_side_page.py -q -p no:cacheprovider

Self-contained: a temp copy of the page, synthetic WAV tones as audio (no real audio, nothing from git), two origins on
ephemeral ports (page + offline folder, and a mock cloud with CORS). Each test is named for the failure it catches.
"""
import json, math, os, shutil, struct, sys, tempfile, wave

import pytest
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SIDE = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(SIDE, "tools"))
import serve  # noqa: E402


def tone(path, hz, secs=4.0, rate=16000):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(9000 * math.sin(2 * math.pi * hz * i / rate))) for i in range(int(secs * rate))))


@pytest.fixture(scope="module")
def env():
    tmp = tempfile.mkdtemp(prefix="dmv56-")
    site = os.path.join(tmp, "site"); cloud = os.path.join(tmp, "cloud")
    shutil.copytree(SIDE, site, ignore=shutil.ignore_patterns("local-audio", "tests", "tools", "__pycache__", ".pytest_cache"))
    os.makedirs(os.path.join(site, "off")); os.makedirs(cloud); os.makedirs(os.path.join(tmp, "own"))
    for n in (1, 14):
        tone(os.path.join(site, "off", "verse%02d.wav" % n), 220 + n * 10)
        tone(os.path.join(cloud, "verse%02d.wav" % n), 330 + n * 10)
    for n, hz in ((7, 440), (1, 450), (14, 460)):
        tone(os.path.join(tmp, "own", "verse-%02d.wav" % n), hz)
    s_page = serve.start(site, 0)
    s_cloud = serve.start(cloud, 0, cors=True)
    page_url = "http://127.0.0.1:%d/" % s_page.server_address[1]
    cloud_url = "http://127.0.0.1:%d/" % s_cloud.server_address[1]
    base = json.load(open(os.path.join(SIDE, "audio-config.json"), encoding="utf-8"))
    for v in base["verses"]:
        v["file"] = {"offline": "verse%02d.wav" % v["id"], "cloud": "verse%02d.wav" % v["id"]}

    def write_cfg(name, kinds):
        c = json.loads(json.dumps(base))
        c["sources"] = [s for s in c["sources"] if s["kind"] in kinds]
        for s in c["sources"]:
            if s["kind"] == "offline":
                s["base"] = "off/"
            if s["kind"] == "cloud":
                s["base"] = cloud_url
        c["order"] = [k for k in c["order"] if k in kinds]
        json.dump(c, open(os.path.join(site, name), "w"))

    write_cfg("cfg-custom.json", ["custom"])
    write_cfg("cfg-offline.json", ["offline"])
    write_cfg("cfg-cloud.json", ["cloud"])
    write_cfg("cfg-chain.json", ["custom", "offline", "cloud"])
    c = json.load(open(os.path.join(site, "cfg-offline.json")))
    c["verses"] = [v for v in c["verses"] if v["id"] != 14]  # verse 14 absent from the manifest
    json.dump(c, open(os.path.join(site, "cfg-missing14.json"), "w"))
    yield {"page": page_url, "own": os.path.join(tmp, "own"), "cloud": cloud_url, "site": site}
    s_page.shutdown()
    s_cloud.shutdown()
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
        yield b
        b.close()


def open_page(browser, env, cfg):
    pg = browser.new_page()
    pg.goto("%sindex.html?config=%s" % (env["page"], cfg))
    pg.wait_for_selector("body[data-ready='1']")
    return pg


def play_and_check(pg, n, kind):
    pg.click("button.play[data-id='%d']" % n)
    pg.wait_for_function("() => { const a = document.getElementById('player'); return !a.paused && a.currentTime > 0.05; }", timeout=10000)
    line = pg.locator("#played-%d" % n)
    assert line.get_attribute("data-source") == kind, line.inner_text()
    assert "[%s]" % kind in line.inner_text()
    pg.click("button.play[data-id='%d']" % n)  # stop


@pytest.mark.parametrize("kind", ["cloud", "offline", "custom"])
@pytest.mark.parametrize("n", [1, 14])
def test_same_player_plays_verse_from_each_source_kind_when_only_the_config_changes(browser, env, kind, n):
    """Failure caught: the player is tied to one source kind, so swapping the config does not change where audio comes from."""
    pg = open_page(browser, env, "cfg-%s.json" % kind)
    if kind == "custom":
        pg.set_input_files("#files", [os.path.join(env["own"], "verse-01.wav"), os.path.join(env["own"], "verse-14.wav")])
    play_and_check(pg, n, kind)
    pg.close()


def test_cloud_is_a_real_cross_origin_request(browser, env):
    """Failure caught: the 'cloud' test passes only because everything is the same origin."""
    pg = open_page(browser, env, "cfg-cloud.json")
    assert pg.evaluate("location.origin") != env["cloud"].rstrip("/")
    pg.click("button.play[data-id='1']")
    pg.wait_for_function("() => document.getElementById('player').currentTime > 0.05")
    assert pg.evaluate("document.getElementById('player').src").startswith(env["cloud"])
    pg.close()


def test_chain_order_custom_beats_offline_beats_cloud(browser, env):
    """Failure caught: the resolver ignores the custom > offline > cloud priority."""
    pg = open_page(browser, env, "cfg-chain.json")
    play_and_check(pg, 1, "offline")  # no custom file yet: offline wins over cloud
    pg.set_input_files("#files", [os.path.join(env["own"], "verse-01.wav")])
    play_and_check(pg, 1, "custom")  # a custom file now wins
    pg.close()


def test_source_switcher_forces_one_kind(browser, env):
    """Failure caught: the cloud/offline/custom switcher does not restrict the chain."""
    pg = open_page(browser, env, "cfg-chain.json")
    pg.check("input[name=mode][value=cloud]")
    play_and_check(pg, 14, "cloud")
    pg.check("input[name=mode][value=custom]")
    pg.click("button.play[data-id='14']")
    pg.wait_for_function("() => document.getElementById('played-14').classList.contains('err')")
    assert "no custom files chosen" in pg.locator("#played-14").inner_text()
    pg.close()


def test_missing_file_shows_a_visible_message_naming_what_was_tried(browser, env):
    """Failure caught: a verse with no audio fails silently."""
    pg = open_page(browser, env, "cfg-missing14.json")
    pg.click("button.play[data-id='14']")
    pg.wait_for_function("() => document.getElementById('played-14').classList.contains('err')")
    msg = pg.locator("#played-14").inner_text()
    assert "No audio for verse 14" in msg and "offline" in msg and "not in the config" in msg
    play_and_check(pg, 1, "offline")  # the other verses still play
    pg.close()


def test_missing_file_on_server_reports_http_status(browser, env):
    """Failure caught: a 404 from the server is reported as a vague error (or as success)."""
    pg = open_page(browser, env, "cfg-offline.json")
    pg.click("button.play[data-id='5']")  # verse 5 is in the manifest but the file is not on the server
    pg.wait_for_function("() => document.getElementById('played-5').classList.contains('err')")
    assert "HTTP 404" in pg.locator("#played-5").inner_text()
    pg.close()


def test_custom_file_named_verse_07_wav_maps_to_verse_7(browser, env):
    """Failure caught: file-name matching puts a custom file on the wrong verse."""
    pg = open_page(browser, env, "cfg-custom.json")
    pg.set_input_files("#files", [os.path.join(env["own"], "verse-07.wav")])
    assert "verse 7 = verse-07.wav" in pg.locator("#customlist").inner_text()
    play_and_check(pg, 7, "custom")
    pg.click("button.play[data-id='8']")
    pg.wait_for_function("() => document.getElementById('played-8').classList.contains('err')")
    assert "no custom file for verse 8" in pg.locator("#played-8").inner_text()
    pg.close()


def test_page_shows_both_scripts_and_confidence_at_every_level(browser, env):
    """Failure caught: the page drops IAST or Devanagari, or shows a verse without its #55 confidence."""
    pg = open_page(browser, env, "cfg-offline.json")
    assert pg.locator("article.verse").count() == 14
    assert "Day 2 overall confidence" in pg.locator("#overall").inner_text()
    for n in (1, 14):
        card = pg.locator("#verse-%d" % n)
        assert "confidence" in card.inner_text() and card.locator(".dev").inner_text().strip() and card.locator(".iast").inner_text().strip()
    assert "Day 2, recommended by the #55 analysis" in pg.locator("#setline").inner_text()
    pg.close()


def test_page_has_no_horizontal_scroll_at_phone_width(browser, env):
    """Failure caught: the test page is unusable at 360 px."""
    pg = browser.new_page(viewport={"width": 360, "height": 740})
    pg.goto("%sindex.html?config=cfg-offline.json" % env["page"])
    pg.wait_for_selector("body[data-ready='1']")
    assert pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    pg.close()
