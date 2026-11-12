// page.js: the verse player of the #56 side page. Knows nothing about where audio lives: it calls audio-source.js `resolve()`.
import { createAudioSource } from "./audio-source.js";
import { initRecordSection } from "./record.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const params = new URLSearchParams(location.search);
const cfgUrl = params.get("config") || "audio-config.json";
$("cfgurl").value = cfgUrl;

let src, pageData, mode = "auto", playingId = null;
const player = $("player");

const band = (c) => (c >= 85 ? "hi" : c >= 70 ? "mid" : "lo");
const chip = (label, c) => (c == null ? `<span class="chip">${label}: n/a</span>` : `<span class="chip ${band(c)}">${label} ${c}</span>`);

function findingsText(v) {
  if (!v.findings.length) return "No findings from the #55 analysis.";
  return v.findings.map((f) => `${f.kind}${f.tier && f.tier !== "defect" ? " (" + f.tier + ")" : ""}${f.expected ? `: expected "${f.expected}", heard "${f.heard}"` : f.heard ? `: ${f.heard}` : ""}`).join("; ");
}

function renderVerses() {
  $("setline").textContent = `Set: ${pageData.set_label}. Manifest: ${cfgUrl}`;
  const o = pageData.overall;
  $("overall").innerHTML = `<b>Day 2 overall confidence ${chip("mean", o.mean)}</b> over ${o.n_scored} verses (${o.n_above_70} of ${o.n_scored} with every line at 70 or more). <span class="mute">${esc(o.note)}.</span>`;
  $("verses").innerHTML = pageData.verses.map((v) => `
    <article class="card verse" id="verse-${v.id}">
      <header>
        <span><span class="num">Verse ${v.id}</span> ${chip("confidence", v.conf.mean)} <span class="mute">weakest line ${v.conf.min}; lines ${v.padas.map((p) => p.conf ?? "n/a").join(" / ")}</span></span>
        <button type="button" class="primary play" data-id="${v.id}" aria-label="Play verse ${v.id}">Play</button>
      </header>
      <div class="dev" lang="sa">${esc(v.sanskrit)}</div>
      <div class="iast" lang="sa-Latn">${esc(v.transliteration)}</div>
      <div class="mute">${esc(findingsText(v))}</div>
      <div class="played" id="played-${v.id}" role="status"></div>
    </article>`).join("");
  $("takeverse").innerHTML = pageData.verses.map((v) => `<option value="${v.id}">Verse ${v.id}</option>`).join("");
}

function setPlayed(id, text, { err = false, source = null } = {}) {
  const el = $(`played-${id}`);
  el.textContent = text;
  el.classList.toggle("err", err);
  if (source) el.dataset.source = source; else delete el.dataset.source;
}
function resetButtons() { document.querySelectorAll("button.play").forEach((b) => { b.textContent = "Play"; }); }

async function play(id) {
  if (playingId === id) { stop(); return; }
  stop();
  playingId = id;
  const btn = document.querySelector(`button.play[data-id="${id}"]`);
  btn.textContent = "Loading...";
  setPlayed(id, "Looking for the audio...");
  const r = await src.resolve(id, { mode });
  if (playingId !== id) return;                              // user pressed something else meanwhile
  if (r.missing) {
    playingId = null; btn.textContent = "Play";
    setPlayed(id, `No audio for verse ${id}. Tried: ` + r.tried.map((t) => `${t.kind} (${t.reason}${t.url ? " at " + t.url : ""})`).join("; "), { err: true });
    return;
  }
  player.src = r.url;
  try { await player.play(); } catch (e) {
    playingId = null; btn.textContent = "Play";
    setPlayed(id, `Found ${r.source} audio at ${r.url} but the browser would not play it: ${e.message}`, { err: true });
    return;
  }
  btn.textContent = "Stop";
  const dur = r.duration ? `, ${r.duration.toFixed(1)} s` : "";
  const skipped = r.tried.length ? ` (skipped: ${r.tried.map((t) => `${t.kind}: ${t.reason}`).join("; ")})` : "";
  setPlayed(id, `Played from ${r.label} [${r.source}] · ${r.setLabel || pageData.set_label}${dur}${skipped}`, { source: r.source });
}
function stop() {
  player.pause();
  if (playingId != null) player.removeAttribute("src");
  playingId = null; resetButtons();
}
player.addEventListener("ended", () => { playingId = null; resetButtons(); });

function showCustom(res) {
  const ids = src.customIds();
  const rej = (res && res.rejected) || [];
  $("customlist").textContent = ids.length
    ? `Custom files: ${ids.map((n) => `verse ${n} = ${res.matched[n] || "(kept)"}`).join(", ")}.${rej.length ? " Not used: " + rej.map((r) => `${r.name} (${r.reason})`).join("; ") + "." : ""}`
    : rej.length ? `Not used: ${rej.map((r) => `${r.name} (${r.reason})`).join("; ")}.` : "";
}
function takeFiles(files) { showCustom(src.setCustomFiles(files)); }

async function boot() {
  try {
    const [cfg, data] = await Promise.all([fetch(cfgUrl).then((r) => { if (!r.ok) throw new Error(`manifest ${cfgUrl}: HTTP ${r.status}`); return r.json(); }), fetch("page-data.json").then((r) => r.json())]);
    pageData = data; src = createAudioSource(cfg);
  } catch (e) { $("setline").textContent = "Could not start: " + e.message; $("setline").classList.add("err"); return; }
  const cfg = src.getConfig();
  $("srcinfo").textContent = cfg.sources.filter((s) => s.base).map((s) => `${s.kind}: ${s.base}`).join(" · ");
  renderVerses();
  $("verses").addEventListener("click", (e) => { const b = e.target.closest("button.play"); if (b) play(Number(b.dataset.id)); });
  document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => { mode = r.value; stop(); }));
  $("files").addEventListener("change", (e) => takeFiles(e.target.files));
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => takeFiles(e.dataTransfer.files));
  $("cfgload").addEventListener("click", () => { const u = new URL(location.href); u.searchParams.set("config", $("cfgurl").value.trim()); location.href = u.href; });
  initRecordSection({ src, pageData, getMode: () => mode });
  document.body.dataset.ready = "1";
}
boot();
