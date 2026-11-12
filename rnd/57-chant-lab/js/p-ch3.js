import { ready } from './chrome.js';
import { initStage } from './verse-view.js';
import { chart, drawWarp, drawStrip } from './charts.js';
import { compareSets, marksFrom } from './compare-view.js';
import { setLabel } from './lib.js';

const chant = await ready;
if (chant) {
  const $ = (id) => document.getElementById(id);
  for (const id of ['refset', 'otherset']) $(id).innerHTML = chant.sets.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
  $('refset').value = chant.reference_set;
  $('otherset').value = (chant.sets.find((s) => s.id !== chant.reference_set) || chant.sets[0]).id;

  const b = chant.evidence.dtw_boundary, med = Math.round(b.median_ms), p90 = Math.round(b.p90_ms);
  const meds = chant.evidence.dtw_per_take.map((t) => t.median_ms);
  chart($('strip'), 360, (c) => drawStrip(c, { takes: chant.evidence.dtw_per_take, med, p90 }));
  $('strip-summary').innerHTML = `<b>Timing error of the carried-over syllable moments.</b> Over ${b.n_onsets.toLocaleString('en-US')} syllable starts in ${b.n_takes} takes: median ${med} ms, 90th percentile ${p90} ms, ${(b.within_100ms * 100).toFixed(1)} % within 100 ms. The takes' own medians run from ${Math.min(...meds)} to ${Math.max(...meds)} ms.`;

  const stage = await initStage(chant, {
    onMount: async (r) => {
      const warp = $('warp'), sum = $('warp-summary'), ref = $('refset').value, other = $('otherset').value;
      if (ref !== chant.reference_set) { sum.textContent = `This page's ribbon and audio use the reference set (${setLabel(chant, chant.reference_set)}); choose it as the reference.`; warp.style.display = 'none'; return; }
      if (other === ref) { sum.textContent = 'Choose two different days.'; warp.style.display = 'none'; return; }
      if (!r.clip) { warp.style.display = 'none'; sum.textContent = ''; return; }
      $('status').textContent = 'Lining the takes up, a few seconds...'; $('status').classList.remove('err');
      try {
        const o = await compareSets(chant, r.verse.id, ref, other), res = o.res;
        warp.style.display = '';
        const t0 = res.refExcerpt.t0, t1 = res.refExcerpt.t1, path = [];
        for (let f = 0; f < res.usrMap.length; f += 2) path.push([t0 + f / 100, res.usrMap[f] / 100]);
        const bad = res.aksharas.filter((a) => a.flags.some((x) => x === 'held longer' || x === 'shorter')).map((a) => a.refSpan);
        chart(warp, 240, (c) => drawWarp(c, { path, tx: [t0, t1], ticks: r.verse.syl_t.map((s) => s[0]).filter((t) => t >= t0 && t <= t1), bad }));
        const marks = marksFrom(res, ['timing']);
        r.ribbon.setMarks(marks);
        const over = marks.filter((m) => m.label === 'held longer').length, under = marks.length - over;
        const which = marks.map((m) => `${r.verse.syllables[m.i].iast} (${m.label})`).join(', ');
        sum.innerHTML = `<b>Warp path.</b> ${setLabel(chant, other)} is ${res.durRatio} times as long as ${setLabel(chant, ref)}, and its overall tempo is ${res.tempo.toFixed(2)} times the reference. ${marks.length ? `${over} syllable${over === 1 ? '' : 's'} held much longer and ${under} much shorter than the take's own tempo: ${which}.` : "No syllable is held much longer or shorter than the take's own tempo."} The path's overall fit cost is ${res.alignCost} (lower is closer).`;
        $('summary').textContent = r.ribbon.summary() + ' Marks show timing only.';
        $('status').textContent = '';
      } catch (e) { $('status').textContent = e.message; $('status').classList.add('err'); warp.style.display = 'none'; }
    },
  });
  for (const id of ['refset', 'otherset']) $(id).addEventListener('change', () => stage.mount());
}
