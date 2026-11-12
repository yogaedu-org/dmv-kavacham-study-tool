import { ready } from './chrome.js';
import { initStage } from './verse-view.js';
import { chart, drawSplice } from './charts.js';

const chant = await ready;
if (chant) {
  const $ = (id) => document.getElementById(id), ev = chant.evidence;
  const dtw = ev.splice_dtw, zipa = ev.splice_zipa;
  const rowsD = dtw.rows, rowsZ = zipa.rows;
  chart($('splice1'), 260, (c) => drawSplice(c, { rows: rowsD, key: 'score', max: 10, lines: [[dtw.summary.control_top_score_max, `worst clean take ${dtw.summary.control_top_score_max.toFixed(2)}`, c.col.ink]] }));
  chart($('splice2'), 260, (c) => drawSplice(c, { rows: rowsZ, key: 'z', max: 8, lines: [[zipa.summary.control_top_z_max, `worst clean take ${zipa.summary.control_top_z_max.toFixed(2)}`, c.col.ink], [2.79, 'second-worst 2.79', c.col.muted]] }));
  const s = dtw.summary, z = zipa.summary;
  $('splice1-summary').innerHTML = `<b>Quick check, top score per verse.</b> The worst clean take scores ${s.control_top_score_max.toFixed(2)} and the median clean take ${s.control_top_score_median.toFixed(2)}. Omissions: the top flag is on the slip in ${s.omission.top1} of ${s.omission.n}, and above the worst clean take in ${s.omission.above_max_control_and_located}. Substitutions: ${s.substitution.top1} of ${s.substitution.n} and ${s.substitution.above_max_control_and_located}.`;
  $('splice2-summary').innerHTML = `<b>Deeper check, top score per verse.</b> The worst clean take scores ${z.control_top_z_max.toFixed(2)}, a spike on the first syllable, and the median ${z.control_top_z_median.toFixed(2)}. Omissions: top flag on the slip in ${z.omission.top1} of ${z.omission.n}. Substitutions: ${z.substitution.top1} of ${z.substitution.n}. None of the 26 is above the worst clean take.`;

  const ids = rowsD.map((r) => r.verse);
  const stage = await initStage(chant, {
    onMount: async (r) => {
      const kind = $('kind').value, tier = $('tier').value, row = (tier === 'dtw' ? rowsD : rowsZ).find((q) => q.verse === r.verse.id), out = $('slip-summary');
      if (!row) { out.textContent = `Verse ${r.verse.id} was not in the planted-slip test (the test covered verses ${ids[0]} to ${ids[ids.length - 1]}).`; r.ribbon.setMarks([]); return; }
      const slip = dtw.rows.find((q) => q.verse === r.verse.id)[kind].slip, top = row[kind].top, sy = r.verse.syllables;
      const marks = [], same = slip.includes(top);
      for (const i of slip) if (sy[i]) marks.push({ i, kind: 'slip', label: same && i === top ? 'planted, top flag' : 'planted', title: 'planted slip' });
      if (!same && sy[top]) marks.push({ i: top, kind: 'heard', label: 'top flag', title: 'highest-scoring syllable' });
      r.ribbon.setMarks(marks);
      const score = row[kind][tier === 'dtw' ? 'score' : 'z'], ctl = row.control[tier === 'dtw' ? 'score' : 'z'];
      out.innerHTML = `<b>${kind[0].toUpperCase() + kind.slice(1)} in verse ${r.verse.id}.</b> Planted at syllables ${slip.map((i) => i + 1).join(' and ')} (${slip.map((i) => sy[i] ? sy[i].iast : '?').join(', ')}). The ${tier === 'dtw' ? 'quick check' : 'deeper check'} top flag was syllable ${top + 1}${sy[top] ? ` (${sy[top].iast})` : ''}, with a score of ${score}; ${row[kind].hit ? 'that is within one before to two after the slip, a hit' : 'that is outside the window, a miss'}. The clean take of this verse scored ${ctl} at its top syllable.`;
    },
  });
  for (const id of ['kind', 'tier']) $(id).addEventListener('change', () => stage.mount());
}
