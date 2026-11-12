import { ready } from './chrome.js';
import { initStage } from './verse-view.js';
import { chart, drawWave } from './charts.js';
import { findPauses, fmt } from './lib.js';
const chant = await ready;
if (chant) {
  const wave = document.getElementById('wave');
  let redraw = null;
  await initStage(chant, {
    onMount: async (r) => {
      const ws = document.getElementById('wave-summary');
      if (!r.clip || !r.analysis) { wave.style.display = 'none'; ws.textContent = ''; return; }
      wave.style.display = '';
      const dur = r.clip.pcm.length / 16000, { pauses, threshold } = findPauses(r.analysis.db);
      const v = r.verse, ls = [...new Set(v.syllables.map((s) => s.line))];
      const gap = ls.length > 1 ? [v.syl_t[v.syllables.filter((s) => s.line === ls[0]).pop().i][1], v.syl_t[v.syllables.find((s) => s.line === ls[1]).i][0]] : null;
      const where = (p) => (gap && p.t1 > gap[0] - 0.05 && p.t0 < gap[1] + 0.05 ? 'between the lines' : 'inside a line');
      redraw = chart(wave, 200, (c) => drawWave(c, { pcm: r.clip.pcm, sr: 16000, db: r.analysis.db, threshold, pauses, dur }));
      const longest = pauses.reduce((m, p) => Math.max(m, p.t1 - p.t0), 0);
      ws.innerHTML = pauses.length
        ? `<b>Pauses.</b> ${pauses.length} of 0.30 s or longer in ${fmt(dur)} s of audio: ${pauses.map((p) => `${fmt(p.t0, 2)} to ${fmt(p.t1, 2)} s (${where(p)})`).join('; ')}. Longest ${fmt(longest, 2)} s.`
        : `<b>Pauses.</b> None of 0.30 s or longer in ${fmt(dur)} s of audio.`;
      if (v.analysis_note) ws.innerHTML += ` Note: ${v.analysis_note}.`;
    },
  });
}
