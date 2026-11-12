import { ready } from './chrome.js';
import { initStage, pitchSeries } from './verse-view.js';
import { compareToReference, marksFrom, levels, band } from './compare-view.js';
import { decodeToPcm, getClip, kvGet, medianHz, fmt, esc, urlParam, setLabel, store, storeSet } from './lib.js';

const chant = await ready;
if (chant) {
  const $ = (id) => document.getElementById(id);
  const say = (t, err) => { $('status').textContent = t; $('status').classList.toggle('err', !!err); };
  const other = chant.sets.find((s) => s.id !== chant.reference_set);
  $('otherlabel').textContent = `${other ? other.label : 'another day'}'s take of this verse`;
  let last = null;
  try { last = await kvGet('lastTake'); } catch { /* storage blocked: the "last take" option stays unavailable */ }
  const lastRadio = document.querySelector('input[name="src"][value="last"]');
  if (last) { $('lastinfo').textContent = `(verse ${last.verse}, ${last.name})`; } else { lastRadio.disabled = true; $('lastinfo').textContent = '(none yet: record one in Lab 1)'; }
  const want = urlParam('source');
  const pick = want && !(want === 'last' && !last) ? want : (last ? 'last' : 'other');
  document.querySelector(`input[name="src"][value="${pick}"]`).checked = true;
  const startVerse = Number(urlParam('verse')) || (pick === 'last' && last ? last.verse : 1);
  const stage = await initStage(chant, { defaultVerse: startVerse });
  const SESSION = 'compared';
  const session = () => { try { return JSON.parse(sessionStorage.getItem('chantlab57:' + SESSION) || '{}'); } catch { return {}; } };

  async function takePcm(verseId) {
    const src = document.querySelector('input[name="src"]:checked').value;
    if (src === 'ref') return { pcm: (await getClip(chant.reference_set, verseId)).pcm, key: `${chant.reference_set}:${verseId}`, name: 'the reference itself' };
    if (src === 'other') return { pcm: (await getClip(other.id, verseId)).pcm, key: `${other.id}:${verseId}`, name: `${other.label} (stand-in)` };
    if (src === 'file') { const f = $('file').files[0]; if (!f) throw new Error('Choose a file first, then press Compare.'); return { pcm: await decodeToPcm(await f.arrayBuffer()), key: `file:${Date.now()}`, name: f.name }; }
    if (!last) throw new Error('No take saved yet. Record one in Lab 1, or choose another option.');
    if (last.verse !== verseId) say(`Your last take was verse ${last.verse}, but verse ${verseId} is selected; comparing anyway.`);
    return { pcm: await decodeToPcm(await last.blob.arrayBuffer()), key: `last:${Date.now()}`, name: `your Lab 1 take (${last.name})` };
  }

  async function compare() {
    const cur = stage.current();
    if (!cur) { say('The verse is still loading. Try again in a moment.', true); return; }
    const verse = cur.verse;
    $('go').disabled = true; $('results').hidden = true;
    try {
      say('Reading the take...');
      const t = await takePcm(verse.id);
      say('Lining up and comparing, a few seconds...');
      const o = await compareToReference(chant, verse.id, t.pcm, t.key);
      const res = o.res, L = levels(res, verse), marks = marksFrom(res, null);
      const k0 = Math.round(res.refExcerpt.t0 * 100), usrMed = medianHz(o.usrAn.f0);
      const take = { cls: 'take', t: [], c: [] };
      for (let f = 0; f < res.usrMap.length; f++) { const hz = o.usrAn.f0[res.usrMap[f]]; take.t.push((k0 + f) * 0.01 + 0.0125); take.c.push(hz > 0 ? (((1200 * Math.log2(hz / usrMed) + 600) % 1200) + 1200) % 1200 - 600 : NaN); }
      cur.ribbon.setPitch([pitchSeries(o.refAn.f0, 'ref'), take], { range: 400 });
      cur.ribbon.setMarks(marks);
      $('summary').textContent = cur.ribbon.summary();

      const all = session(); all[verse.id] = { score: L.verse.score, conf: L.verse.conf, take: t.name }; try { sessionStorage.setItem('chantlab57:' + SESSION, JSON.stringify(all)); } catch { /* session storage blocked: overall stays at this verse */ }
      const done = Object.entries(all), oScore = Math.round(done.reduce((s, [, v]) => s + v.score, 0) / done.length), oConf = Math.round(done.reduce((s, [, v]) => s + v.conf, 0) / done.length);
      const row = (name, sc, cf, marked) => `<tr><td>${esc(name)}</td><td class="num">${sc}</td><td class="num">${cf} (${band(cf)})</td><td class="num">${esc(marked)}</td></tr>`;
      const rows = [row('Overall', oScore, oConf, `${done.length} verse${done.length > 1 ? 's' : ''}`),
        row(`Verse ${verse.id}`, L.verse.score, L.verse.conf, `${L.flagged} of ${res.aksharas.length}`)];
      for (const l of L.lines) rows.push(row(`Line ${l.line + 1}`, l.score, l.conf, `${l.flagged} of ${l.n}`));
      $('levels').querySelector('tbody').innerHTML = rows.join('');
      $('levels-summary').innerHTML = `<b>${esc(t.name)} against ${esc(setLabel(chant, chant.reference_set))}, verse ${verse.id}.</b> Similarity ${L.verse.score} of 100 with ${band(L.verse.conf)} confidence (${L.verse.conf}). Your take is ${res.durRatio} times the reference's length and its tempo is ${res.tempo.toFixed(2)} times; its pitch sits ${res.keyOffsetCents} cents from the reference overall (not counted as an error). ${L.flagged ? `${L.flagged} syllable${L.flagged > 1 ? 's are' : ' is'} marked.` : 'No syllable is marked.'} Every syllable has a score below, marked or not. Overall is the mean over the ${done.length} verse${done.length > 1 ? 's' : ''} compared in this browser session; Marked counts syllables flagged. Confidence bands: 70 or more is high, 40 to 69 medium, under 40 low.`;
      const byI = Object.fromEntries(L.ak.map((a) => [a.i, a]));
      $('aktable').querySelector('tbody').innerHTML = res.aksharas.map((a) => `<tr class="${a.flagged ? 'flag' : ''}" data-i="${a.i}"><td class="num">${a.i + 1}</td><td><span lang="sa" class="deva">${esc(a.deva)}</span> <i>${esc(a.iast)}</i></td>
        <td class="num">${byI[a.i].score}</td><td class="num">${byI[a.i].conf}</td><td class="num">${a.ratio.toFixed(2)}</td><td class="num">${a.cents === null ? 'not judged' : Math.round(a.cents)}</td><td class="num">${a.z.toFixed(1)}</td><td>${a.flags.length ? esc(a.flags.join('; ')) : 'no'}</td></tr>`).join('');
      $('results').hidden = false;
      say('');
      window.__chantlab = Object.assign(window.__chantlab || {}, { lab2: { levels: L, flagged: res.aksharas.filter((a) => a.flagged).map((a) => a.i), overall: { score: oScore, conf: oConf, n: done.length } } });
    } catch (e) { say(e.message, true); }
    $('go').disabled = false;
  }
  $('go').addEventListener('click', compare);
  $('go').disabled = false;
  $('file').addEventListener('change', () => { document.querySelector('input[name="src"][value="file"]').checked = true; });
}
