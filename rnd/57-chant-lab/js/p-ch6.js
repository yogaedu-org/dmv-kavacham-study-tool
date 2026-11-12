import { ready } from './chrome.js';
import { mountVerse } from './verse-view.js';
import { expectedSounds, reportNote } from './sounds.js';
import { esc } from './lib.js';

const chant = await ready;
if (chant) {
  const $ = (id) => document.getElementById(id);
  const r = await mountVerse({ chant, verseId: 1, ribbonEl: $('ribbon'), audioEl: $('audio'), statusEl: $('status'), withPitch: false });
  r.ribbon.onSelect = (i) => {
    const s = r.verse.syllables[i], snd = expectedSounds(s.iast);
    r.ribbon.setMarks([{ i, kind: 'heard', label: snd.join(' '), title: `expected sounds: ${snd.join(' ')}` }]);
    $('soundcard').innerHTML = `<span lang="sa" class="deva" style="font-size:1.6rem">${esc(s.deva)}</span> <i>${esc(s.iast)}</i><br>Should contain the sounds <b>${esc(snd.join(' + '))}</b>.<br><span class="small mute">${esc(reportNote(s.iast))}</span>`;
    $('summary').textContent = r.ribbon.summary();
  };
  $('summary').textContent = r.ribbon.summary();
}
