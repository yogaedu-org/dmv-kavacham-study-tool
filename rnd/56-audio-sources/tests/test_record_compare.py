"""Browser tests for the #57 record-and-compare section of the side page (Playwright for Python, Chromium). Run:

    python -I -m pytest rnd/56-audio-sources/tests/test_record_compare.py -q -p no:cacheprovider

These use the REAL Day 2 clips from rnd/56-audio-sources/local-audio/offline (copied there by tools/populate-local-audio.py;
never in git). Without them, and without ffmpeg for the fake-microphone file, the tests skip rather than pass vacuously.
Each test is named for the failure it catches.
"""
import json, os, shutil, subprocess, sys, tempfile

import pytest
from playwright.sync_api import sync_playwright

os.environ.setdefault("SERVE_QUIET", "1")
HERE = os.path.dirname(os.path.abspath(__file__))
SIDE = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(SIDE, "tools"))
import serve  # noqa: E402

REAL = os.path.join(SIDE, "local-audio", "offline")
FFMPEG = shutil.which("ffmpeg") or "C:/Users/kaanchan/bin/FFmpeg/ffmpeg-latest/bin/ffmpeg.exe"
pytestmark = pytest.mark.skipif(not os.path.isfile(os.path.join(REAL, "verse01.mp3")), reason="local audio not populated (tools/populate-local-audio.py)")


@pytest.fixture(scope="module")
def env():
    tmp = tempfile.mkdtemp(prefix="dmv57-")
    site, nocors = os.path.join(tmp, "site"), os.path.join(tmp, "nocors")
    shutil.copytree(SIDE, site, ignore=shutil.ignore_patterns("local-audio", "tests", "tools", "__pycache__", ".pytest_cache"))
    repo_js = os.path.join(SIDE, "..", "..", "js", "audio-source.js")
    if os.path.isfile(repo_js):  # the app's one copy, when the page imports ../../js/audio-source.js
        os.makedirs(os.path.join(site, "js"), exist_ok=True)
        shutil.copyfile(repo_js, os.path.join(site, "js", "audio-source.js"))
    shutil.copytree(REAL, os.path.join(site, "off"))
    os.makedirs(nocors)
    shutil.copyfile(os.path.join(REAL, "verse01.mp3"), os.path.join(nocors, "verse01.mp3"))
    s_nocors = serve.start(nocors, 0, cors=False)
    cfg = json.load(open(os.path.join(SIDE, "audio-config.json"), encoding="utf-8"))
    cfg["sources"] = [s for s in cfg["sources"] if s["kind"] == "offline"]
    cfg["sources"][0]["base"] = "off/"
    cfg["order"] = ["offline"]
    json.dump(cfg, open(os.path.join(site, "cfg-offline.json"), "w"))
    cfg2 = json.load(open(os.path.join(SIDE, "audio-config.json"), encoding="utf-8"))
    cfg2["sources"] = [s for s in cfg2["sources"] if s["kind"] == "cloud"]
    cfg2["sources"][0]["base"] = "http://127.0.0.1:%d/" % s_nocors.server_address[1]
    cfg2["order"] = ["cloud"]
    json.dump(cfg2, open(os.path.join(site, "cfg-nocors.json"), "w"))
    mic = os.path.join(tmp, "mic.wav")
    ok = os.path.isfile(FFMPEG) and subprocess.run([FFMPEG, "-v", "error", "-y", "-i", os.path.join(REAL, "verse01.mp3"), "-ac", "1", "-ar", "48000", mic]).returncode == 0
    s_page = serve.start(site, 0)
    yield {"page": "http://127.0.0.1:%d/" % s_page.server_address[1], "mic": mic if ok else None}
    s_page.shutdown(); s_nocors.shutdown()
    shutil.rmtree(tmp, ignore_errors=True)


def launch(p, mic=None):
    args = ["--autoplay-policy=no-user-gesture-required"]
    if mic:
        args += ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-file-for-fake-audio-capture=%s%%noloop" % mic]
    return p.chromium.launch(args=args)


def test_recording_a_take_through_the_microphone_path_gives_a_high_match_to_the_same_chant(env):
    """Failure caught: the record, decode and compare chain breaks (permission, MediaRecorder blob, decode) or a faithful take scores low."""
    if not env["mic"]:
        pytest.skip("ffmpeg not available to make the fake-microphone file")
    with sync_playwright() as p:
        b = launch(p, env["mic"])
        pg = b.new_context(permissions=["microphone"]).new_page()
        pg.goto(env["page"] + "index.html?config=cfg-offline.json"); pg.wait_for_selector("body[data-ready='1']")
        pg.click("#rec")
        pg.wait_for_timeout(15500)  # the clip is 13.2 s
        pg.click("#recstop")
        pg.wait_for_function("() => !document.getElementById('analyse').disabled", timeout=20000)
        assert "echoCancellation=false" in pg.locator("#micinfo").inner_text()   # we asked for processing off and read back what the browser did
        assert pg.locator("#takeaudio").is_visible()
        pg.click("#analyse")
        pg.wait_for_selector("#result:not([hidden])", timeout=30000)
        assert pg.locator("#aktable tr[data-i]").count() == 33
        text = pg.locator("#overallscore").inner_text()
        score = int(text.split("reference:")[1].split("/")[0])
        flagged = pg.locator("#aktable tr[data-flagged='1']").count()
        print(" | ".join(text.splitlines()) + " | flagged=%d" % flagged)
        assert score >= 85 and flagged <= 3, text
        # the importable compare() result carries a confidence at every level (akshara, line, verse, overall)
        shape = pg.evaluate("(() => { const r = window.__lastCompare; return {a: r.aksharas.every(a => Number.isFinite(a.confidence) && 'timingRatio' in a && 'pitchCents' in a && 'cost' in a), l: r.lines.length > 0 && r.lines.every(l => Number.isFinite(l.confidence)), v: Number.isFinite(r.verse.confidence), o: Number.isFinite(r.overall.confidence)}; })()")
        assert shape == {"a": True, "l": True, "v": True, "o": True}, shape
        b.close()


def test_calibration_locates_the_silenced_and_the_replaced_akshara_and_leaves_the_unmodified_clip_alone(env):
    """Failure caught: the difference view stops flagging a deliberately damaged akshara, or flags a clean clip."""
    with sync_playwright() as p:
        b = launch(p)
        pg = b.new_page()
        pg.goto(env["page"] + "index.html?config=cfg-offline.json"); pg.wait_for_selector("body[data-ready='1']")
        pg.click("#calib")
        pg.wait_for_function("() => window.__calibration", timeout=300000)
        out = pg.evaluate("window.__calibration")
        print("\n" + out["text"])
        for kind in ("silence", "replace"):
            r = out[kind]
            assert r["hit"] >= 0.8 * r["m"], out["text"]            # the stage-1 promote bar in report 01
        assert sum(c["flagged"] for c in out["controls"]) == 0, out["text"]
        b.close()


def test_a_reference_on_a_server_without_cors_is_reported_as_a_cors_problem_not_a_crash(env):
    """Failure caught: a cloud source that plays but cannot be read for analysis gives a silent failure."""
    with sync_playwright() as p:
        b = launch(p)
        pg = b.new_page()
        pg.goto(env["page"] + "index.html?config=cfg-nocors.json"); pg.wait_for_selector("body[data-ready='1']")
        pg.set_input_files("#takefile", os.path.join(REAL, "verse01.mp3"))
        pg.wait_for_function("() => !document.getElementById('analyse').disabled")
        pg.click("#analyse")
        pg.wait_for_function("() => /CORS/.test(document.getElementById('status').textContent)", timeout=15000)
        b.close()
