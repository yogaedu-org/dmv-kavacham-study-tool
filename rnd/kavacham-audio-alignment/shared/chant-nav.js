/* chant-nav.js -- shared by every page of a chant folder (player.html, review.html, ...).
 *
 * One config file per chant folder, chant.json, read from the page's own folder. This module:
 *   - renders the shared tab bar (real links between pages, aria-current on the current one);
 *   - owns the ONE deep-link scheme: a URL hash  #verse=7&day=2&t=4.2&s=15-16
 *       verse  1-based verse number            (1..verse_count)
 *       day    set id from chant.json "sets"   (the recording; named "day" for the Kavacham)
 *       t      seconds into that verse's clip, the time of interest (a player starts lead_in_s earlier)
 *       s      akshara index range "a-b" (or "a"), as in results.json "syllables"
 *     every key is optional; a link that names a verse/day/t that does not exist is reported, not ignored;
 *   - loads results.json once and summarises a take (clean / N findings, confidence) for badges;
 *   - resolves a clip's URL (relative file, or the release asset listed in audio-manifest.json).
 *
 * Usage:  <link rel="stylesheet" href="../shared/chant-nav.css">
 *         <script src="../shared/chant-nav.js" data-page="player"></script>
 * data-page is the tab id of the page it sits on. Everything is on window.ChantNav.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var PAGE = (script && script.getAttribute("data-page")) || "";
  var CONFIG_URL = (script && script.getAttribute("data-config")) || "chant.json";
  var cfgCache = null, resultsCache = null, audioProbe = null;

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + " returned HTTP " + r.status);
      return r.json();
    });
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function normalise(c) {
    c.sets = c.sets || [];
    c.pages = c.pages || {};
    c.lead_in_s = typeof c.lead_in_s === "number" ? c.lead_in_s : 1;
    c.tabs = c.tabs || [
      { id: "player", label: "Player", href: c.pages.player || "player.html" },
      { id: "review", label: "Accuracy review", href: c.pages.review || "review.html" }
    ];
    return c;
  }

  var ready = fetchJson(CONFIG_URL).then(normalise);
  ready.then(function (c) { cfgCache = c; }, function () {});

  /* ---------- messages: plain text, never a blank page ---------- */
  function notice(text, kind) {
    var el = document.getElementById("chantMsg");
    if (!el) {
      el = document.createElement("div");
      el.id = "chantMsg";
      el.setAttribute("role", "alert");
      var nav = document.querySelector("nav.chant-tabs");
      if (nav && nav.parentNode) nav.parentNode.insertBefore(el, nav.nextSibling);
      else document.body.insertBefore(el, document.body.firstChild);
    }
    el.className = "chant-msg" + (kind ? " " + kind : "");
    el.textContent = text;
    el.hidden = !text;
  }
  function clearNotice() { var el = document.getElementById("chantMsg"); if (el) el.hidden = true; }

  /* ---------- tab bar ---------- */
  function mount(cfg) {
    var old = document.querySelector("nav.chant-tabs");
    if (old) old.remove();
    var nav = document.createElement("nav");
    nav.className = "chant-tabs";
    nav.setAttribute("aria-label", (cfg.title ? cfg.title + " sections" : "Chant sections"));
    cfg.tabs.forEach(function (t) {
      var a = document.createElement("a");
      a.className = "chant-tab";
      a.href = t.href;
      a.textContent = t.label;
      a.setAttribute("data-tab", t.id);
      if (t.id === PAGE) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    document.body.insertBefore(nav, document.body.firstChild);
  }
  function start() {
    ready.then(mount, function (e) {
      notice("Could not load " + CONFIG_URL + " (" + e.message + "). Open this page through a web server, not as a file.", "bad");
    });
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);

  /* ---------- deep links ---------- */
  function parseLink(cfg, hash) {
    var h = (hash === undefined ? location.hash : hash).replace(/^#/, "");
    if (!h) return null;
    var o = {}, known = false;
    h.split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i < 1) return;
      var k = kv.slice(0, i), v = decodeURIComponent(kv.slice(i + 1));
      if (k === "verse" || k === "day" || k === "t" || k === "s") { o[k] = v; known = true; }
    });
    if (!known) return null;
    var res = {}, n = cfg.verse_count || 0;
    if ("verse" in o) {
      if (!/^\d+$/.test(o.verse) || +o.verse < 1 || (n && +o.verse > n))
        return { error: 'This link names verse "' + o.verse + '", but this chant has verses 1 to ' + n + "." };
      res.verse = +o.verse;
    }
    if ("day" in o) {
      var ids = cfg.sets.map(function (s) { return s.id; });
      if (!/^\d+$/.test(o.day) || ids.indexOf(+o.day) < 0)
        return { error: 'This link names ' + (cfg.set_word || "set").toLowerCase() + ' "' + o.day + '", but the available ones are ' + ids.join(", ") + "." };
      res.day = +o.day;
    }
    if ("t" in o) {
      if (!/^\d+(\.\d+)?$/.test(o.t)) return { error: 'This link names the time "' + o.t + '", which is not a number of seconds.' };
      res.t = parseFloat(o.t);
    }
    if ("s" in o) {
      var m = /^(\d+)(?:-(\d+))?$/.exec(o.s);
      if (!m) return { error: 'This link names the akshara range "' + o.s + '", which is not "a" or "a-b".' };
      res.s = [+m[1], m[2] === undefined ? +m[1] : +m[2]];
    }
    return res;
  }
  function buildLink(cfg, pageId, o) {
    var tab = cfg.tabs.filter(function (t) { return t.id === pageId; })[0];
    var href = (tab && tab.href) || cfg.pages[pageId] || pageId + ".html";
    var q = [];
    if (o.verse != null) q.push("verse=" + o.verse);
    if (o.day != null) q.push("day=" + o.day);
    if (o.t != null && isFinite(o.t)) q.push("t=" + (Math.round(o.t * 100) / 100));
    if (o.s) q.push("s=" + (o.s[0] === o.s[1] ? o.s[0] : o.s[0] + "-" + o.s[1]));
    return href + (q.length ? "#" + q.join("&") : "");
  }
  /* cb(link|null, cfg) now and on every hash change; link = {verse,day,t,s} or {error} */
  function onLink(cb) {
    ready.then(function (cfg) {
      var run = function () { clearNotice(); var l = parseLink(cfg); if (l && l.error) notice(l.error, "bad"); cb(l, cfg); };
      run();
      window.addEventListener("hashchange", run);
    }, function () {});
  }

  /* ---------- results and per-take summary ---------- */
  function loadResults() {
    if (!resultsCache) resultsCache = ready.then(function (c) { return fetchJson(c.results || "results.json"); });
    return resultsCache;
  }
  function bandOf(x) { return x === null || x === undefined ? "na" : (x >= 85 ? "high" : (x >= 70 ? "ok" : (x >= 50 ? "low" : "bad"))); }
  function takeSummary(R, day, verse, sc) {
    var t = R && R.takes && R.takes[day + "." + verse];
    if (!t) return null;
    var n = (t.probable || 0) + (t.judge || 0), conf = sc ? sc.verseConf(day, verse).mean : (t.conf && t.conf.mean != null ? t.conf.mean : null), label;
    if (t.defect_whole) label = "bad cut";
    else if (n === 0) label = "clean";
    else label = n + (n === 1 ? " finding" : " findings");
    if (!t.defect_whole && conf !== null) label += ", confidence " + fmtScore(conf);
    return { findings: n, probable: t.probable || 0, judge: t.judge || 0, defect: !!t.defect_whole, conf: conf, band: t.defect_whole ? "na" : bandOf(conf), label: label };
  }


  /* ---------- scores: one implementation for every page (mirrors step3_merge.py; the review's browser test checks it) ---------- */
  function fmtScore(x) { return x === null || x === undefined ? "n/a" : String(Math.round(x)); }
  function scorer(R, getStore) {
    var CF = R.conf_params, cfg = cfgCache, VERSES = [], i;
    for (i = 1; i <= cfg.verse_count; i++) VERSES.push(i);
    function store() { try { return getStore() || {}; } catch (e) { return {}; } }
    function take(d, v) { return R.takes[d + "." + v]; }
    function togOf(v) {
      var out = [], st = store();
      (R.consistent_differences[String(v)] || []).forEach(function (n) { var s = st["ign." + v + "." + n.syll]; if (s && s.v === "mine") out.push(n.syll); });
      return out;
    }
    function padaConf(p, tog) {
      if (p.na) return null;
      var n = p.syl.length, i, sB = 0, sC = 0, cleanB = true, cleanC = true, tg = 0;
      for (i = 0; i < n; i++) {
        var inT = tog.indexOf(p.syl[i]) >= 0, xB = p.exclB[i] && !inT, xC = p.exclC[i] && !inT;
        if (!xB) sB += Math.min(1, p.costB[i]); if (!xC) sC += Math.min(1, p.costC[i]);
        if (p.costB[i] >= 1 && !xB) cleanB = false; if (p.costC[i] >= 1 && !xC) cleanC = false;
        if (inT && (p.costB[i] >= 1 || p.costC[i] >= 1) && (p.exclB[i] || p.exclC[i])) tg++;
      }
      var D = ((1 - sB / n) + (1 - sC / n)) / 2, runs = [cleanB, cleanC]; if (p.a_ran) runs.push(!p.a_flag);
      var N = runs.filter(Boolean).length / runs.length, wP = (p.P === null) ? 0 : CF.w_P;
      var base = (wP * (p.P || 0) + CF.w_D * D + CF.w_N * N) / (wP + CF.w_D + CF.w_N);
      var pen = Math.min(CF.pen_cap, CF.pen_probable * p.pen.probable + CF.pen_judge * (p.pen.judge + tg));
      return Math.max(0, Math.min(CF.cap, 100 * base - pen));
    }
    function verseConf(d, v) {
      var t = take(d, v), tog = togOf(v), cs = t.padas.map(function (p) { return padaConf(p, tog); });
      var na = t.padas.filter(function (p) { return p.na; })[0];
      if (na) return { mean: null, min: null, na: na.na, lines: cs };
      var m = cs.reduce(function (a, b) { return a + b; }, 0) / cs.length;
      return { mean: m, min: Math.min.apply(null, cs), na: null, lines: cs };
    }
    function dayConf(d) {
      var s = 0, n = 0, ab = 0;
      VERSES.forEach(function (v) { var c = verseConf(d, v); if (c.mean !== null) { s += c.mean; n++; if (c.min >= CF.thresh) ab++; } });
      return { mean: n ? s / n : null, n: n, above: ab };
    }
    return { padaConf: padaConf, verseConf: verseConf, dayConf: dayConf, fmt: fmtScore };
  }
  /* KA's "how I say it" answers, as saved by the review page (same key); the player reads them so both pages show one number */
  function savedMarks() {
    try { return JSON.parse(localStorage.getItem((cfgCache && cfgCache.review_storage_key) || "") || "{}"); } catch (e) { return {}; }
  }

  /* ---------- clip URLs ---------- */
  function audioPath(cfg, day, verse) {
    var s = cfg.sets.filter(function (x) { return x.id === day; })[0];
    return s ? s.audio.replace("{vv}", pad2(verse)).replace("{v}", String(verse)) : null;
  }
  /* The clips are repo-external (release assets, #48): the relative path when it exists, else the manifest's asset URL. */
  function audioSrc(cfg, rel) {
    if (!audioProbe) {
      audioProbe = (function () {
        if (location.protocol === "file:") return Promise.resolve(null);
        var first = audioPath(cfg, cfg.sets[0].id, 1);
        return fetch(first, { method: "HEAD" }).then(function (r) {
          if (r.ok) return null;
          throw new Error("missing");
        }).catch(function () {
          return fetchJson(cfg.audio_manifest || "audio-manifest.json").catch(function () { return null; });
        });
      })();
    }
    return audioProbe.then(function (m) {
      if (!m) return rel;
      var it = m.files.filter(function (f) { return f.path.slice(-(rel.length + 1)) === "/" + rel; })[0];
      return it ? m.base_url + it.asset : rel;
    });
  }

  window.ChantNav = {
    page: PAGE, ready: ready,
    config: function () { return cfgCache; },
    notice: notice, clearNotice: clearNotice,
    parseLink: parseLink, buildLink: function (p, o) { return buildLink(cfgCache, p, o); },
    onLink: onLink, loadResults: loadResults, takeSummary: takeSummary, scorer: scorer, fmtScore: fmtScore, savedMarks: savedMarks,
    audioPath: function (d, v) { return audioPath(cfgCache, d, v); },
    audioSrc: function (rel) { return audioSrc(cfgCache, rel); }
  };
})();
