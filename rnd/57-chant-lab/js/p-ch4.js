import { ready } from './chrome.js';
import { initStage, pitchSeries } from './verse-view.js';
import { chart, drawContours } from './charts.js';
import { compareSets, marksFrom } from './compare-view.js';
import { setLabel, medianHz, median, fmt } from './lib.js';

const chant = await ready;
if (chant) {
  const $ = (id) => document.getElementById(id);
  for (const id of ['refset', 'otherset']) $(id).innerHTML = chant.sets.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
  $('refset').value = chant.reference_set;
  $('otherset').value = (chant.sets.find((s) => s.id !== chant.reference_set) || chant.sets[0]).id;
  const stage = await initStage(chant, {
    onMount: async (r) => {
      const cv = $('contour'), sum = $('contour-summary'), ref = $('refset').value, other = $('otherset').value;
      cv.style.display = 'none'; sum.textContent = '';
      if (ref !== chant.reference_set) { sum.textContent = `This page's audio uses the reference set (${setLabel(chant, chant.reference_set)}); choose it as the reference.`; return; }
      if (other === ref) { sum.textContent = 'Choose two different days.'; return; }
      if (!r.clip) return;
      $('status').textContent = 'Lining the takes up and tracking pitch, a few seconds...'; $('status').classList.remove('err');
      try {
        const o = await compareSets(chant, r.verse.id, ref, other), res = o.res;
        const refMed = medianHz(o.refAn.f0), usrMed = medianHz(o.usrAn.f0);
        const k0 = Math.round(res.refExcerpt.t0 * 100), refS = pitchSeries(o.refAn.f0, 'ref', refMed);
        const takeS = { cls: 'take', t: [], c: [] };
        for (let f = 0; f < res.usrMap.length; f++) {
          const u = res.usrMap[f], hz = o.usrAn.f0[u];
          takeS.t.push((k0 + f) * 0.01 + 0.0125);
          takeS.c.push(hz > 0 ? (((1200 * Math.log2(hz / usrMed) + 600) % 1200) + 1200) % 1200 - 600 : NaN);
        }
        r.ribbon.setPitch([refS, takeS], { range: 400 });
        const marks = marksFrom(res, ['pitch']);
        r.ribbon.setMarks(marks);
        cv.style.display = '';
        chart(cv, 240, (c) => drawContours(c, { ref: refS, take: takeS, t0: res.refExcerpt.t0, t1: res.refExcerpt.t1, range: 400 }));
        const rated = res.aksharas.filter((a) => a.cents !== null && a.conf.pitch >= 0.4), dev = rated.map((a) => Math.abs(a.cents));
        sum.innerHTML = `<b>Pitch.</b> The reference's median pitch is ${fmt(refMed, 0)} Hz and the other take's is ${fmt(usrMed, 0)} Hz; the take sits ${res.keyOffsetCents} cents from the reference overall, which is removed before comparing. Of ${res.aksharas.length} syllables, ${rated.length} had enough voiced sound to judge; their median difference is ${fmt(median(dev), 0)} cents. ${marks.length ? `${marks.length} differ by 150 cents or more: ${marks.map((m) => `${r.verse.syllables[m.i].iast} (${m.label})`).join(', ')}.` : 'None differ by 150 cents or more.'}`;
        $('summary').textContent = r.ribbon.summary() + ' Marks show pitch only.';
        $('status').textContent = '';
      } catch (e) { $('status').textContent = e.message; $('status').classList.add('err'); }
    },
  });
  for (const id of ['refset', 'otherset']) $(id).addEventListener('change', () => stage.mount());
}
