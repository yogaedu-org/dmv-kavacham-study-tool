import { ready } from './chrome.js';
import { mountVerse } from './verse-view.js';

const chant = await ready;
if (chant) {
  const $ = (id) => document.getElementById(id);
  const r = await mountVerse({ chant, verseId: 1, ribbonEl: $('ribbon'), audioEl: $('audio'), statusEl: $('status'), withPitch: false });
  const marks = [];
  for (const s of r.verse.syllables) {
    if (/[śṣ]/.test(s.iast)) marks.push({ i: s.i, kind: 'heard', label: 'heard as ʃ', title: 'the report: ś and ṣ both came out as ʃ' });
    else if (/dh/.test(s.iast)) marks.push({ i: s.i, kind: 'heard', label: 'aspiration lost', title: 'the report: dhū came out as d̪oː' });
  }
  r.ribbon.setMarks(marks);
  $('summary').textContent = r.ribbon.summary() + ' These marks are the report\'s observation on two clips, not a measurement of this verse; the greedy output quoted above is the only per-syllable evidence shown.';
}
