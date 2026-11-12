"""Browser tests for the verse audio feature (#56): Playwright for Python, Chromium. Run:

    python -I -m pytest tests/test_verse_audio.py -q -p no:cacheprovider

Self-contained: a temp copy of the app, synthetic WAV tones as the audio (nothing real, nothing from git), the app on one
ephemeral port and a mock cloud with CORS on another (a real cross-origin fetch). The mock cloud has the HOSTED layout
(sets/index.json, sets/<set>/manifest.json, sets/<set>/verse-NN.wav): Day 2 (recommended) and a second LOCAL fixture set,
Day 5, with verse 14 missing for the missing-verse test. Only Day 2 is public in reality; Day 5 here is a fixture.
Each test is named for the failure it catches.
"""
import hashlib, json, math, os, shutil, struct, sys, tempfile, wave

os.environ.setdefault("SERVE_QUIET", "1")

import pytest
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "rnd", "56-audio-sources", "tools"))
import serve  # noqa: E402

APP_FILES = ["index.html", "styles.css", "config.json", "manifest.webmanifest", "sw.js", "js", "data", "i18n", "fonts", "icons", "figures"]


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def write_index(root, sets):
    json.dump({"schema": 1, "sets": [{"id": i, "label": "Day %s" % i[-1], "recommended": r, "manifest": "%s/manifest.json" % i} for i, r in sets]},
              open(os.path.join(root, "sets", "index.json"), "w"))


def tone(path, hz, secs=4.0, rate=16000):
    n = int(secs * rate)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(struct.pack("<%dh" % n, *[int(9000 * math.sin(2 * math.pi * hz * i / rate)) for i in range(n)]))


@pytest.fixture(scope="module")
def env():
    tmp = tempfile.mkdtemp(prefix="dmv56app-")
    site, cloud = os.path.join(tmp, "site"), os.path.join(tmp, "cloud")
    os.makedirs(site); os.makedirs(cloud)
    for f in APP_FILES:
        src, dst = os.path.join(ROOT, f), os.path.join(site, f)
        shutil.copytree(src, dst) if os.path.isdir(src) else shutil.copyfile(src, dst)
    sets = os.path.join(cloud, "sets")
    for sid, hz, verses in (("day2", 300, (1, 14)), ("day5", 500, (1,))):
        os.makedirs(os.path.join(sets, sid))
        for n in verses:
            tone(os.path.join(sets, sid, "verse-%02d.wav" % n), hz + n * 5)
        m = {"schema": 1, "set": sid, "version": "test", "label": "Day %s" % sid[-1], "base": "./",
             "verses": {str(n): {"key": "verse-%02d.wav" % n, "sha256": sha(os.path.join(sets, sid, "verse-%02d.wav" % n)) if n in verses else "0" * 64,
                             "bytes": 1, "duration": 4.0, "codec": "audio/wav"} for n in range(1, 15) if not (sid == "day5" and n == 14)}}
        json.dump(m, open(os.path.join(sets, sid, "manifest.json"), "w"))
    write_index(cloud, [("day2", True), ("day5", False)])
    os.makedirs(os.path.join(site, "fx"))
    tone(os.path.join(site, "fx", "clip.wav"), 400)
    # an offline mirror (same layout, same-origin) holding verse 1 of Day 2
    os.makedirs(os.path.join(site, "off", "sets", "day2"))
    tone(os.path.join(site, "off", "sets", "day2", "verse-01.wav"), 600)
    s_cloud = serve.start(cloud, 0, cors=True, ranges=False)  # like Cloudflare Pages: Range ignored, 200 + full body
    cloud_url = "http://127.0.0.1:%d/" % s_cloud.server_address[1]

    def write_config(cloud_base, offline_base=""):
        c = json.load(open(os.path.join(ROOT, "config.json"), encoding="utf-8"))
        c["audio"]["cloudBase"] = cloud_base
        c["audio"]["offlineBase"] = offline_base
        json.dump(c, open(os.path.join(site, "config.json"), "w", encoding="utf-8"))

    write_config(cloud_url)
    s_app = serve.start(site, 0)
    app_url = "http://127.0.0.1:%d/" % s_app.server_address[1]
    yield {"app": app_url, "cloud": cloud_url, "site": site, "write_config": write_config, "cloud_dir": cloud}
    s_app.shutdown(); s_cloud.shutdown()
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        yield b
        b.close()


@pytest.fixture
def page(browser, env):
    ctx = browser.new_context()           # fresh storage per test
    pg = ctx.new_page()
    pg.goto(env["app"])
    pg.wait_for_selector("article.verse")
    yield pg
    ctx.close()


def playing(pg, src_part, blob=True):
    pg.wait_for_function("() => { const a = document.getElementById('verseAudio'); return !a.paused && a.currentTime > 0.05; }", timeout=10000)
    assert src_part in pg.evaluate("document.getElementById('verseAudio').dataset.sourceUrl")
    if blob:  # cloud clips are fetched whole and played from a blob: URL (the host ignores Range)
        assert pg.evaluate("document.getElementById('verseAudio').src").startswith("blob:")


def test_day2_is_the_default_and_plays_verse_1_and_verse_14_from_the_cloud_base(page, env):
    """Failure caught: the recommended set is not the default, or a verse button does not reach audible playback."""
    assert page.locator("#audioSetSelect").input_value() == "day2"
    for n in (1, 14):
        page.click(".verse-play[data-verse='%d']" % n)
        playing(page, "%ssets/day2/verse-%02d.wav" % (env["cloud"], n))
        page.click(".verse-play[data-verse='%d']" % n)  # stop


def test_switching_to_day5_makes_the_same_button_play_the_day5_file(page, env):
    """Failure caught: the recitation switcher changes the label but the button keeps playing the old set."""
    page.click(".verse-play[data-verse='1']")
    playing(page, "/sets/day2/verse-01.wav")
    before = page.evaluate("document.getElementById('verseAudio').dataset.sourceUrl")
    page.select_option("#audioSetSelect", "day5")
    assert page.evaluate("document.getElementById('verseAudio').paused")      # switching stops the old recitation
    page.click(".verse-play[data-verse='1']")
    playing(page, "/sets/day5/verse-01.wav")
    assert page.evaluate("document.getElementById('verseAudio').dataset.sourceUrl") != before


def test_chosen_set_survives_a_reload(page):
    """Failure caught: the reader's recitation choice is forgotten on every visit."""
    page.select_option("#audioSetSelect", "day5")
    page.reload(); page.wait_for_selector("article.verse")
    assert page.locator("#audioSetSelect").input_value() == "day5"
    page.click(".verse-play[data-verse='1']")
    playing(page, "/sets/day5/verse-01.wav")


def test_unknown_saved_set_falls_back_to_the_recommended_one(page):
    """Failure caught: a stale saved choice (a set that was removed) leaves the app with no set and no audio."""
    page.evaluate("localStorage.setItem('dmv-audio-set', 'gone')")
    page.reload(); page.wait_for_selector("article.verse")
    assert page.locator("#audioSetSelect").input_value() == "day2"


def test_verse_missing_from_the_chosen_set_shows_a_visible_message(page):
    """Failure caught: a verse with no audio in the chosen set fails silently."""
    page.select_option("#audioSetSelect", "day5")
    page.click(".verse-play[data-verse='14']")
    status = page.locator("#audioStatus-14")
    page.wait_for_function("() => document.getElementById('audioStatus-14').textContent.length > 0")
    text = status.inner_text()
    assert "No audio for verse 14" in text and "Day 5" in text
    assert page.locator(".verse-play[data-verse='14']").get_attribute("aria-pressed") == "false"
    assert not page.evaluate("document.getElementById('verseAudio').getAttribute('src')")


def test_file_listed_in_the_manifest_but_absent_on_the_host_reports_the_http_status(page):
    """Failure caught: a manifest that is ahead of the uploaded files gives a button that does nothing."""
    page.click(".verse-play[data-verse='5']")                 # verse 5 is in the Day 2 manifest, not on the mock cloud
    page.wait_for_function("() => document.getElementById('audioStatus-5').textContent.length > 0")
    assert "HTTP 404" in page.locator("#audioStatus-5").inner_text()


def test_play_button_has_a_screen_reader_label_and_works_from_the_keyboard(page):
    """Failure caught: the play control is mouse-only or announced as an unlabeled button."""
    btn = page.locator(".verse-play[data-verse='1']")
    assert btn.get_attribute("aria-label") == "Play verse 1" and btn.get_attribute("aria-pressed") == "false"
    btn.focus()
    page.keyboard.press("Enter")
    page.wait_for_function("() => !document.getElementById('verseAudio').paused")
    assert btn.get_attribute("aria-label") == "Stop verse 1" and btn.get_attribute("aria-pressed") == "true"
    page.keyboard.press("Space")
    assert btn.get_attribute("aria-pressed") == "false" and page.evaluate("document.getElementById('verseAudio').paused")


def test_labels_follow_the_interface_language(page):
    """Failure caught: the new strings exist only in English (the app ships en, es and ne)."""
    page.select_option("#localeSelect", "es")
    page.wait_for_function("() => document.querySelector('.verse-play') && document.querySelector('.verse-play').getAttribute('aria-label').startsWith('Reproducir')")
    assert "Reproducir el verso 1" == page.locator(".verse-play[data-verse='1']").get_attribute("aria-label")
    assert "recomendada" in page.locator("#audioSetSelect option[value='day2']").inner_text()


def test_one_shared_audio_element_and_one_button_per_verse(page):
    """Failure caught: each verse gets its own audio element, so two recitations can play at once."""
    assert page.locator("audio").count() == 1
    assert page.locator(".verse-play").count() == 14
    page.click(".verse-play[data-verse='1']"); playing(page, "sets/day2/verse-01.wav")
    page.click(".verse-play[data-verse='14']"); playing(page, "sets/day2/verse-14.wav")
    assert page.locator(".verse-play[aria-pressed='true']").count() == 1


def test_feature_is_off_when_no_audio_base_is_configured(browser, env):
    """Failure caught: shipping the code before the host is chosen leaves dead play buttons in the live app."""
    env["write_config"]("")
    try:
        ctx = browser.new_context(); pg = ctx.new_page()
        pg.goto(env["app"]); pg.wait_for_selector("article.verse")
        assert pg.locator(".verse-play").count() == 0
        assert pg.locator("#audioSetGroup").is_hidden()
        ctx.close()
    finally:
        env["write_config"](env["cloud"])


def test_no_horizontal_scroll_at_phone_width_with_audio_controls(browser, env):
    """Failure caught: the new switcher or buttons push the layout wider than a phone screen."""
    ctx = browser.new_context(viewport={"width": 360, "height": 740}); pg = ctx.new_page()
    pg.goto(env["app"]); pg.wait_for_selector("article.verse")
    assert pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    ctx.close()


def test_app_update_keeps_a_downloaded_audio_cache_and_still_removes_old_shell_caches(browser, env):
    """Failure caught: sw.js cleanup deletes every cache but its own, so each app release erases offline audio (report 02)."""
    ctx = browser.new_context(); pg = ctx.new_page()
    pg.goto(env["app"]); pg.wait_for_selector("article.verse")
    pg.evaluate("navigator.serviceWorker.ready.then(() => 0)")
    pg.evaluate("""async () => { await caches.open('dmv-audio-day2@1'); await caches.open('dmv-kavacham-v1-old'); }""")
    sw = os.path.join(env["site"], "sw.js")
    src = open(sw, encoding="utf-8").read()
    open(sw, "w", encoding="utf-8").write(src.replace("'dmv-kavacham-v12'", "'dmv-kavacham-v99'"))
    try:
        pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
        pg.evaluate("""async () => {                       // wait until the new worker has installed AND finished its cleanup
            for (let i = 0; i < 150; i++) {
                const k = await caches.keys();
                if (k.includes('dmv-kavacham-v99') && !k.includes('dmv-kavacham-v1-old') && !k.includes('dmv-kavacham-v12')) return;
                await new Promise((r) => setTimeout(r, 100));
            }
        }""")
        keys = pg.evaluate("caches.keys()")
        assert "dmv-audio-day2@1" in keys, keys
        assert "dmv-kavacham-v12" not in keys, keys
    finally:
        open(sw, "w", encoding="utf-8").write(src)
        ctx.close()


def test_service_worker_does_not_answer_a_range_request_from_a_cached_whole_file(browser, env):
    """Failure caught: a downloaded (cached, 200) clip answers a media Range request with the whole file, which Safari rejects."""
    ctx = browser.new_context(); pg = ctx.new_page()
    pg.goto(env["app"]); pg.wait_for_selector("article.verse")
    pg.evaluate("navigator.serviceWorker.ready.then(() => 0)")
    pg.reload(); pg.wait_for_selector("article.verse")           # now controlled by the SW
    pg.evaluate("""async () => { const c = await caches.open('dmv-kavacham-v12'); await c.put('fx/clip.wav', await fetch('fx/clip.wav')); }""")
    status = pg.evaluate("fetch('fx/clip.wav', {headers: {Range: 'bytes=0-99'}}).then(r => r.status)")
    assert status == 206
    ctx.close()


def test_adding_a_set_on_the_host_is_data_only(browser, env):
    """Failure caught: a new recitation set needs a code change or an app release before it shows up in the switcher."""
    sid = "day6"
    os.makedirs(os.path.join(env["cloud_dir"], "sets", sid), exist_ok=True)
    tone(os.path.join(env["cloud_dir"], "sets", sid, "verse-01.wav"), 800)
    json.dump({"schema": 1, "set": sid, "version": "t", "label": "Another reciter", "base": "./",
               "verses": {"1": {"key": "verse-01.wav", "sha256": sha(os.path.join(env["cloud_dir"], "sets", sid, "verse-01.wav")), "bytes": 1, "duration": 4.0, "codec": "audio/wav"}}},
              open(os.path.join(env["cloud_dir"], "sets", sid, "manifest.json"), "w"))
    index = os.path.join(env["cloud_dir"], "sets", "index.json")
    original = open(index).read()
    d = json.loads(original); d["sets"].append({"id": sid, "label": "Another reciter", "recommended": False, "manifest": "day6/manifest.json"})
    open(index, "w").write(json.dumps(d))
    try:
        ctx = browser.new_context(); pg = ctx.new_page()
        pg.goto(env["app"]); pg.wait_for_selector("article.verse")
        assert pg.locator("#audioSetSelect option[value='day6']").inner_text() == "Another reciter"
        pg.select_option("#audioSetSelect", "day6")
        pg.click(".verse-play[data-verse='1']")
        playing(pg, "/sets/day6/verse-01.wav")
        ctx.close()
    finally:
        open(index, "w").write(original)


def test_unreachable_audio_host_leaves_the_app_working_without_audio_controls(browser, env):
    """Failure caught: a dead or not-yet-deployed audio host breaks the app or leaves dead play buttons."""
    env["write_config"]("http://127.0.0.1:1/")
    try:
        ctx = browser.new_context(); pg = ctx.new_page()
        pg.goto(env["app"]); pg.wait_for_selector("article.verse")
        assert pg.locator("article.verse").count() == 14
        assert pg.locator(".verse-play").count() == 0 and pg.locator("#audioSetGroup").is_hidden()
        ctx.close()
    finally:
        env["write_config"](env["cloud"])


def test_offline_mirror_supplies_the_index_and_the_audio_when_the_cloud_is_unreachable(browser, env):
    """Failure caught: the second source (offline folder) is configured but is never used, so offline readers get nothing."""
    env["write_config"]("http://127.0.0.1:1/", "off/")
    try:
        ctx = browser.new_context(); pg = ctx.new_page()
        with open(os.path.join(env["site"], "off", "sets", "index.json"), "w") as f:
            json.dump({"schema": 1, "sets": [{"id": "day2", "label": "Day 2", "recommended": True, "manifest": "day2/manifest.json"}]}, f)
        shutil.copyfile(os.path.join(env["cloud_dir"], "sets", "day2", "manifest.json"), os.path.join(env["site"], "off", "sets", "day2", "manifest.json"))
        pg.goto(env["app"]); pg.wait_for_selector(".verse-play")
        pg.click(".verse-play[data-verse='1']")
        playing(pg, "/off/sets/day2/verse-01.wav", blob=False)
        ctx.close()
    finally:
        env["write_config"](env["cloud"])


def test_cloud_that_ignores_range_plays_from_a_blob_url_and_a_corrupt_clip_is_refused(browser, env):
    """Failure caught: the host answers Range with 200 + full body (Cloudflare Pages), or serves a clip that does not match its manifest."""
    ctx = browser.new_context(); pg = ctx.new_page()
    res = pg.request.get(env["cloud"] + "sets/day2/verse-01.wav", headers={"Range": "bytes=0-99"})
    assert res.status == 200 and "accept-ranges" not in res.headers and len(res.body()) > 1000   # the mock really ignores Range
    pg.goto(env["app"]); pg.wait_for_selector("article.verse")
    pg.click(".verse-play[data-verse='1']")
    playing(pg, "/sets/day2/verse-01.wav")
    ctx.close()
    # corrupt the clip on the host: the manifest hash no longer matches
    clip = os.path.join(env["cloud_dir"], "sets", "day2", "verse-14.wav")
    good = open(clip, "rb").read()
    open(clip, "wb").write(good[:-2] + b"")
    try:
        ctx = browser.new_context(); pg = ctx.new_page()
        pg.goto(env["app"]); pg.wait_for_selector("article.verse")
        pg.click(".verse-play[data-verse='14']")
        pg.wait_for_function("() => document.getElementById('audioStatus-14').textContent.length > 0")
        assert "sha256 mismatch for verse-14.wav" in pg.locator("#audioStatus-14").inner_text()
        assert not pg.evaluate("document.getElementById('verseAudio').getAttribute('src')")
        ctx.close()
    finally:
        open(clip, "wb").write(good)
