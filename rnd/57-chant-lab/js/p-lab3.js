import { ready } from './chrome.js';
import { initStage } from './verse-view.js';
import { marksFrom } from './compare-view.js';
import { getClip, work, wavBlob, store, storeSet, verseOf, esc } from './lib.js';
import { damage } from '../../56-audio-sources/calibration.js';

const chant = await ready;
if (chant) {
  const $ = (id) => document.getElementById(id);
  const say = (t, err) => { $('status').textContent = t; $('status').classList.toggle('err', !!err); };
  const stage = await initStage(chant, { withPitch: false });
  const T0 = { slips: 0, caught: 0, top: 0, extra: 0, clean: 0, cleanFlagged: 0 };
  let tally = { ...T0, ...store('tally', {}) };
  let damagedUrl = null;

  function paintTally() {
    $('t-caught').textContent = `${tally.caught} of ${tally.slips}`; $('t-top').textContent = `${tally.top} of ${tally.slips}`; $('t-extra').textContent = String(tally.extra);
    $('t-clean').textContent = `${tally.cleanFlagged} of ${tally.clean}`;
    $('tally-summary').textContent = tally.slips || tally.clean
      ? `So far ${tally.caught} of ${tally.slips} planted slips were flagged on the right syllable, ${tally.top} of them as the single strongest flag. On those runs ${tally.extra} other syllable${tally.extra === 1 ? ' was' : 's were'} flagged. ${tally.cleanFlagged} of ${tally.clean} clean clips had any flag. The tally is kept in this browser until you reset it.`
      : 'Nothing planted yet. The tally starts at 0 of 0.';
    window.__chantlab = Object.assign(window.__chantlab || {}, { tally: { ...tally } });
  }
  const save = () => { storeSet('tally', tally); paintTally(); };
  paintTally();
  for (const id of ['plant', 'clean', 'all']) $(id).disabled = false;

  const sylCount = () => stage.current().verse.syl_t.length;
  const clampPos = () => { const n = sylCount(); $('pos').max = String(n); if (Number($('pos').value) > n) $('pos').value = String(n); if (Number($('pos').value) < 1) $('pos').value = '1'; };
  $('verse').addEventListener('change', () => setTimeout(clampPos, 0));
  $('surprise').addEventListener('click', () => { const n = sylCount(); $('pos').value = String(3 + Math.floor(Math.random() * (n - 5))); $('kind').value = Math.random() < 0.5 ? 'silence' : 'replace'; });

  async function trial(verse, ref, k, kind) {
    const dmg = damage(ref, verse, k, kind);
    const res = await work('compare', { ref, usr: dmg, verse });
    const flagged = res.aksharas.filter((a) => a.flagged).map((a) => a.i), top = res.aksharas.reduce((b, a) => (a.z > b.z ? a : b)).i;
    return { dmg, res, flagged, top, hit: flagged.includes(k), topHit: top === k, extra: flagged.filter((i) => i !== k).length };
  }

  $('plant').addEventListener('click', async () => {
    const cur = stage.current(); if (!cur.clip) { say('No reference audio is loaded for this verse, so there is nothing to damage. See the message above.', true); return; }
    clampPos(); const k = Number($('pos').value) - 1, kind = $('kind').value, verse = cur.verse;
    $('plant').disabled = true; say('Planting the slip and comparing, a few seconds...');
    try {
      const t = await trial(verse, cur.clip.pcm, k, kind);
      tally.slips++; if (t.hit) tally.caught++; if (t.topHit) tally.top++; tally.extra += t.extra; save();
      const marks = marksFrom(t.res, null).filter((m) => m.i !== k).map((m) => ({ ...m, kind: 'heard', label: 'also flagged' }));
      marks.push({ i: k, kind: 'slip', label: t.hit ? 'planted, caught' : 'planted, missed', title: t.hit ? 'the tool flagged this syllable' : 'the tool did not flag this syllable' });
      cur.ribbon.setMarks(marks);
      if (damagedUrl) URL.revokeObjectURL(damagedUrl);
      damagedUrl = URL.createObjectURL(wavBlob(t.dmg)); $('damaged').src = damagedUrl;
      $('summary').textContent = cur.ribbon.summary();
      const s = verse.syllables[k];
      $('result').innerHTML = `<b>${kind === 'silence' ? 'Silenced' : 'Replaced'} syllable ${k + 1} (${esc(s.iast)}) of verse ${verse.id}.</b> The tool ${t.hit ? 'flagged it' : 'did not flag it'}${t.topHit ? ' and it was the single strongest difference' : `; the strongest difference was syllable ${t.top + 1} (${esc(verse.syllables[t.top].iast)})`}. ${t.extra ? `${t.extra} other syllable${t.extra > 1 ? 's were' : ' was'} flagged too.` : 'No other syllable was flagged.'} Overall similarity ${t.res.overall.score} of 100.`;
      say('');
      window.__chantlab.last = { hit: t.hit, topHit: t.topHit, extra: t.extra, k };
    } catch (e) { say(e.message, true); }
    $('plant').disabled = false;
  });

  $('clean').addEventListener('click', async () => {
    const cur = stage.current(); if (!cur.clip) { say('No reference audio is loaded for this verse. See the message above.', true); return; }
    say('Comparing the clip with itself...');
    const res = await work('compare', { ref: cur.clip.pcm, usr: cur.clip.pcm, verse: cur.verse });
    const n = res.aksharas.filter((a) => a.flagged).length;
    tally.clean++; if (n) tally.cleanFlagged++; save();
    cur.ribbon.setMarks(marksFrom(res, null));
    $('result').innerHTML = `<b>Clean clip, verse ${cur.verse.id}.</b> ${n ? `${n} syllable${n > 1 ? 's were' : ' was'} flagged, which should not happen.` : 'No syllable was flagged, as expected.'} Similarity ${res.overall.score} of 100.`;
    say('');
  });

  $('all').addEventListener('click', async () => {
    $('all').disabled = true; $('plant').disabled = true;
    try {
      let n = 0; const total = chant.verses.length * 2;
      for (const v of chant.verses) {
        const ref = (await getClip(chant.reference_set, v.id)).pcm, k = 2 + ((7 * v.id + 3) % (v.syl_t.length - 5));
        for (const kind of ['silence', 'replace']) {
          say(`Trial ${++n} of ${total}: verse ${v.id}, ${kind}, syllable ${k + 1}...`);
          const t = await trial(v, ref, k, kind);
          tally.slips++; if (t.hit) tally.caught++; if (t.topHit) tally.top++; tally.extra += t.extra; storeSet('tally', tally);
        }
      }
      save(); say(`Done: ${total} trials added to the tally.`);
    } catch (e) { save(); say(e.message, true); }
    $('all').disabled = false; $('plant').disabled = false;
  });

  $('reset').addEventListener('click', () => { tally = { ...T0 }; save(); });
}
