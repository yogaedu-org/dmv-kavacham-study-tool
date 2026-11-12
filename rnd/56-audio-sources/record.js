// record.js: the #57 side section: record a take (or choose a file), play it back, compare it to the Day 2 reference.
import { compare, compareTake, SR } from "./compare.js";
import { startRecording, decodeToPcm } from "./recorder.js";
import { runCalibration } from "./calibration.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const band = (c) => (c >= 70 ? "hi" : c >= 40 ? "mid" : "lo");
const cchip = (label, c) => `<span class="chip ${band(c * 100)}" title="confidence ${c}">${label} ${c.toFixed(2)}</span>`;

export function initRecordSection({ src, pageData, getMode }) {
  let takePcm = null, takeUrl = null, recorder = null;
  const status = (t, err = false) => { $("status").textContent = t; $("status").style.color = err ? "var(--bad)" : ""; };
  const verseId = () => Number($("takeverse").value);
  const verse = () => pageData.verses.find((v) => v.id === verseId());

  /** The reference is read through the same swappable source (never the custom files: those are not the reference). */
  async function referencePcm(id) {
    const kinds = getMode() === "cloud" ? ["cloud"] : getMode() === "offline" ? ["offline"] : ["offline", "cloud"];
    const r = await src.resolve(id, { kinds });
    if (r.missing) throw new Error(`reference clip for verse ${id} not found. Tried: ${r.tried.map((t) => `${t.kind} (${t.reason})`).join("; ")}`);
    let resp;
    try { resp = await fetch(r.url); } catch (e) { throw new Error(`the reference at ${r.sourceUrl || r.url} cannot be read for analysis (a cross-origin source needs CORS headers): ${e.message}`); }
    if (!resp.ok) throw new Error(`reference ${r.url}: HTTP ${resp.status}`);
    return { pcm: await decodeToPcm(await resp.arrayBuffer()), from: `${r.label} [${r.source}]` };
  }

  function setTake(pcm, blob, note) {
    takePcm = pcm;
    if (takeUrl) URL.revokeObjectURL(takeUrl);
    takeUrl = URL.createObjectURL(blob);
    const a = $("takeaudio"); a.src = takeUrl; a.hidden = false;
    $("analyse").disabled = false;
    status(`${note}: ${(pcm.length / SR).toFixed(1)} s ready.`);
  }

  $("rec").addEventListener("click", async () => {
    try {
      recorder = await startRecording({ onSettings: (s) => { $("micinfo").textContent = `Mic settings the browser reports: echoCancellation=${s.echoCancellation}, noiseSuppression=${s.noiseSuppression}, autoGainControl=${s.autoGainControl} (we asked for all three off; a browser may ignore that).`; } });
    } catch (e) { status(`Microphone not available: ${e.name}: ${e.message}`, true); return; }
    $("rec").disabled = true; $("recstop").disabled = false; status("Recording...");
  });
  $("recstop").addEventListener("click", async () => {
    if (!recorder) return;
    try { const take = await recorder.stop(); setTake(take.pcm, take.blob, "Recorded"); } catch (e) { status("Could not read the recording: " + e.message, true); }
    recorder = null; $("rec").disabled = false; $("recstop").disabled = true;
  });
  $("takefile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { setTake(await decodeToPcm(await f.arrayBuffer()), f, `Loaded ${f.name}`); } catch (er) { status(`Could not decode ${f.name}: ${er.message}`, true); }
  });

  $("analyse").addEventListener("click", async () => {
    if (!takePcm) return;
    status("Reading the reference...");
    try {
      const ref = await referencePcm(verseId());
      status("Aligning...");
      await new Promise((r) => setTimeout(r, 20));          // let the status paint before the (about 1 s) computation
      const full = compare(takePcm, ref.pcm, verse());   // the importable entry point; the page draws its `details`
      window.__lastCompare = full;
      showResult(full.details, ref.from, full);
      status(`Done. Reference from ${ref.from}.`);
    } catch (e) { status(e.message, true); }
  });

  function showResult(res, refFrom, full) {
    $("result").hidden = false;
    const o = res.overall, flagged = res.aksharas.filter((a) => a.flagged);
    $("overallscore").innerHTML = `<b>Overall similarity to the Day 2 reference: ${o.score} / 100</b> <span class="chip ${band(o.confidence)}">confidence ${o.confidence}</span><br>
      <span class="mute">${flagged.length} of ${res.aksharas.length} aksharas flagged. Tempo ${res.tempo.toFixed(2)}x the reference, key offset ${res.keyOffsetCents} cents, take is ${res.durRatio}x the reference length. ${esc(o.note)}. Hypothesis, not a verdict.</span>`;
    $("aktable").innerHTML = `<tr><th>#</th><th>Akshara</th><th>Timing (x ref)</th><th>Pitch (cents)</th><th>Match z</th><th>Flag</th></tr>` + res.aksharas.map((a) =>
      `<tr class="${a.flagged ? "flag" : ""}" data-i="${a.i}" data-flagged="${a.flagged ? 1 : 0}"><td>${a.i + 1}</td><td lang="sa">${esc(a.deva)} ${esc(a.iast)}</td>
        <td>${a.ratio.toFixed(2)} ${cchip("c", a.conf.timing)}</td><td>${a.cents === null ? "n/a" : Math.round(a.cents)} ${cchip("c", a.conf.pitch)}</td>
        <td>${a.z.toFixed(1)} ${cchip("c", a.conf.match)}</td><td>${esc(a.flags.join("; ")) || "-"}</td></tr>`).join("");
    const row = (label, x, extra) => `<tr><td>${label}</td><td>${x.score} / 100</td><td><span class="chip ${band(x.confidence)}">confidence ${x.confidence}</span></td><td>${extra}</td></tr>`;
    $("levels").innerHTML = `<tr><th>Level</th><th>Score</th><th>Confidence</th><th>Flagged</th></tr>` +
      row("Overall", full.overall, `${flagged.length} of ${res.aksharas.length} aksharas`) +
      row("Verse", full.verse, `${full.verse.flagged} of ${full.verse.of}`) +
      full.lines.map((l) => row(`Line ${l.line + 1} (aksharas ${l.from + 1}-${l.to + 1})`, l, `${l.flagged} of ${l.of}`)).join("");
    const poor = res.fitFactor < 1 ? `<br><b>Poor overall match:</b> the take is far from the reference sound (median spectral distance ${res.medianCost}; ordinary takes sit near 0.6-0.7), so every score is scaled down (x${res.fitFactor}).` : "";
    $("overallscore").insertAdjacentHTML("beforeend", poor);
    const low = o.confidence < 30 ? `<br><b>Low confidence (${o.confidence}):</b> the take did not align well to the reference, so the score and the flags are not meaningful for this recording.` : "";
    $("overallscore").insertAdjacentHTML("beforeend", low);
    drawOverlay(res);
  }

  function drawOverlay(res) {
    const cv = $("overlay"), dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    const col = (n) => css.getPropertyValue(n).trim() || "#888";
    const n = res.refExcerpt.frames, t0 = res.refExcerpt.t0, fps = 100;
    const env = (db) => { let m = -100; for (const x of db) m = Math.max(m, x); return (x) => Math.max(0, Math.min(1, (x - (m - 45)) / 45)); };
    const er = env(res.refDb), eu = env(res.usrDb), mid = H / 2;
    const xOf = (f) => (f / n) * W;
    for (const a of res.aksharas) {                          // akshara bands
      const x0 = xOf(Math.max(0, Math.round((a.refSpan[0] - t0) * fps))), x1 = xOf(Math.min(n, Math.round((a.refSpan[1] - t0) * fps)));
      if (a.flagged) { g.fillStyle = "rgba(164,38,44,.22)"; g.fillRect(x0, 0, Math.max(2, x1 - x0), H); }
      g.fillStyle = col("--mute"); g.fillRect(x0, 0, 1, H);
    }
    g.fillStyle = col("--ref");
    for (let f = 0; f < n; f++) { const h = er(res.refDb[f]) * (mid - 6); g.fillRect(xOf(f), mid - h, Math.max(1, W / n), h); }
    g.fillStyle = col("--take");
    for (let f = 0; f < n; f++) { const u = res.usrMap[f]; const h = eu(res.usrDb[u] ?? -100) * (mid - 6); g.fillRect(xOf(f), mid, Math.max(1, W / n), h); }
    g.fillStyle = col("--fg"); g.font = "11px system-ui"; g.fillText("reference", 4, 12); g.fillText("your take (stretched)", 4, H - 4);
  }

  $("calib").addEventListener("click", async () => {
    $("calib").disabled = true; $("calibout").textContent = "";
    try {
      const out = await runCalibration({
        pageData, onProgress: (t) => { $("calibstatus").textContent = t; },
        loadRef: async (id) => (await referencePcm(id)).pcm,
        loadOther: async (id) => { const r = await src.resolve(id, { kinds: ["cloud"] }); if (r.missing) return null; const u = new URL(`day5/verse${String(id).padStart(2, "0")}.mp3`, r.sourceUrl || r.url).href; const resp = await fetch(u); return resp.ok ? decodeToPcm(await resp.arrayBuffer()) : null; },
      });
      $("calibout").textContent = out.text; window.__calibration = out;
      $("calibstatus").textContent = "Done.";
    } catch (e) { $("calibstatus").textContent = "Calibration failed: " + e.message; $("calibstatus").style.color = "var(--bad)"; }
    $("calib").disabled = false;
  });

  window.__side = { compare, compareTake, decodeToPcm, referencePcm };   // test hook
}
