import { ready } from './chrome.js';
import { initStage } from './verse-view.js';
import { chart } from './charts.js';
import { drawBars } from './charts.js';
import { findClip } from './lib.js';
const chant = await ready;
if (chant) {
  const ev = chant.evidence, ref = ev.recommended_day;
  chart(document.getElementById('days'), 210, (c) => drawBars(c, ev.days.map((d) => ({ label: `Day ${d.day}${d.day === ref ? ' (reference)' : ''}`, value: d.mean, hi: d.day === ref }))));
  const best = ev.days.find((d) => d.day === ref), others = ev.days.filter((d) => d.day !== ref);
  document.getElementById('days-summary').innerHTML = `<b>Mean confidence per day.</b> Day ${ref} scores highest at ${best.mean}, with all ${best.n_scored} verses scoring and every line at 70 or more in ${best.n_above_70} of them. The others: ${others.map((d) => `Day ${d.day} ${d.mean} (${d.n_above_70} of ${d.n_scored} scored verses at 70 or more)`).join('; ')}. ${ev.days_note}.`;
  await initStage(chant, {
    onMount: async (r) => {
      const a2 = document.getElementById('audio2'); a2.pause();
      const other = chant.sets.find((s) => s.role !== 'reference');
      try { a2.src = (await findClip(other.id, r.verse.id)).url; a2.load(); r.extraSummary = `Second player: ${other.label}, same verse.`; }
      catch (e) { document.getElementById('status').textContent = e.message; document.getElementById('status').classList.add('err'); }
    },
  });
}
