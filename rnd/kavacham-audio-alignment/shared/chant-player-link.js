/* chant-player-link.js -- the player's half of the player <-> accuracy-review links (#55). Needs chant-nav.js.
 * Expects the player markup of gen_kavacham_player.py: li.v[data-day][data-i] rows (data-i is the 0-based verse),
 * <audio data-day data-i>, the global functions showDay(n) and playRange(day,i,start,end,chain,btn), and
 * (optional) window.audioReady, the promise that settles when the clip URLs have been settled.
 *
 *  1. every verse row gets "See the accuracy review for this verse" (-> review page, that verse, that day opened)
 *     and a badge from results.json: clean / N findings, with the confidence;
 *  2. a deep link  player.html#verse=7&day=2&t=4.2&s=15-16  opens that day, scrolls to and outlines that verse,
 *     seeks its clip to t minus lead_in_s and offers a Play button (a browser will not autoplay in a fresh tab).
 *     There is no per-akshara display in this player, so s= only names the flagged syllables in the notice. */
(function () {
  "use strict";
  var N = window.ChantNav;

  N.ready.then(function (cfg) {
    N.loadResults().catch(function () { return null; }).then(function (R) {
      document.querySelectorAll("li.v").forEach(function (li) {
        var day = +li.getAttribute("data-day"), verse = +li.getAttribute("data-i") + 1;
        var row = document.createElement("div");
        row.className = "chant-xrow";
        var a = document.createElement("a");
        a.className = "chant-xlink";
        a.href = N.buildLink("review", { verse: verse, day: day });
        a.textContent = "See the accuracy review for this verse";
        row.appendChild(a);
        var s = R && N.takeSummary(R, day, verse);
        if (s) {
          var b = document.createElement("span");
          b.className = "chant-badge " + s.band;
          b.textContent = s.label;
          b.title = "Automatic review of this take: " + s.label + ". An estimate, not a verdict; open the review to listen and judge.";
          row.appendChild(b);
        }
        var box = li.querySelector(".txt");
        if (box) box.appendChild(row);
      });
    });
  }, function () {});

  function visibleDay() {
    var p = document.querySelector(".panel[style*='block']");
    return p ? +p.id.replace("panel", "") : null;
  }
  function syllText(R, verse, s) {
    var sy = R && R.syllables && R.syllables[String(verse)];
    if (!sy || !s) return "";
    return sy.slice(s[0], s[1] + 1).map(function (x) { return x.deva; }).join("");
  }

  N.onLink(function (link, cfg) {
    document.querySelectorAll(".chant-target").forEach(function (e) { e.classList.remove("chant-target"); });
    if (!link || link.error) return;
    var day = link.day != null ? link.day : visibleDay();
    if (link.day != null && typeof showDay === "function") showDay(link.day);
    if (link.verse == null) return;
    var li = document.querySelector('li.v[data-day="' + day + '"][data-i="' + (link.verse - 1) + '"]');
    if (!li) { N.notice("This player has no verse " + link.verse + " for " + (cfg.set_word || "set") + " " + day + ".", "bad"); return; }
    li.classList.add("chant-target");
    li.scrollIntoView({ block: "center" });
    var label = (cfg.sets.filter(function (s) { return s.id === day; })[0] || {}).label || ("Day " + day);
    if (link.t == null) { N.notice("Opened verse " + link.verse + ", " + label + "."); return; }
    var start = Math.max(0, link.t - cfg.lead_in_s);
    var a = li.querySelector("audio");
    var settled = window.audioReady || Promise.resolve();
    Promise.all([settled, N.loadResults().catch(function () { return null; })]).then(function (x) {
      var fl = syllText(x[1], link.verse, link.s);
      var msg = "Opened verse " + link.verse + ", " + label + ", at " + link.t.toFixed(1) + " s" + (start !== link.t ? " (starting " + cfg.lead_in_s + " s earlier, at " + start.toFixed(1) + " s)" : "") +
        (fl ? ". Flagged: " + fl : "") + ". ";
      N.notice(msg);
      var el = document.getElementById("chantMsg");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "▶ Play from " + start.toFixed(1) + " s";
      btn.onclick = function () { playRange(day, link.verse - 1, start, null, false); };
      el.appendChild(btn);
      if (!a) return;
      var seek = function () {
        if (isFinite(a.duration) && start > a.duration) {
          N.notice("This link asks for " + link.t.toFixed(1) + " s, but the clip is only " + a.duration.toFixed(1) + " s long. Showing the start of the verse.", "bad");
          start = 0;
          btn.textContent = "▶ Play from the start";
          el.appendChild(btn);
          return;
        }
        a.currentTime = start;
      };
      if (a.readyState >= 1) seek();
      else { a.addEventListener("loadedmetadata", seek, { once: true }); a.preload = "metadata"; a.load(); }
    });
  });
})();
