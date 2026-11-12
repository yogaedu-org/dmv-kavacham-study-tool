import { ready } from './chrome.js';
import { mountVerse } from './verse-view.js';

const STEPS = [
  'Your recording is the starting point: a few seconds of sound with the verse in it. The verse itself is known in advance, which is what makes this easier than recognising speech from scratch.',
  'The sound model listens. For every small slice of the recording it says how likely each speech sound is. Nothing is decided yet; it is a table of likelihoods.',
  'The written verse is turned into the sounds it should contain, and those are matched to the recording in time, so each syllable gets its own stretch of the recording.',
  'Each syllable gets a score: how clearly its expected sound was heard against the best competing sound. A syllable with a low score is one to listen to again. Every syllable is scored, so passes count as much as flags.',
];
const chant = await ready;
if (chant) {
  const $ = (id) => document.getElementById(id);
  const r = await mountVerse({ chant, verseId: 1, ribbonEl: $('ribbon'), audioEl: $('audio'), statusEl: $('status'), withPitch: true });
  let step = 0;
  const paint = () => {
    document.querySelectorAll('#pipe li').forEach((li) => { const k = Number(li.dataset.step); li.classList.toggle('on', k === step); li.classList.toggle('done', k < step); if (k === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    $('pipe-text').textContent = `Step ${step + 1} of ${STEPS.length}. ${STEPS[step]}`;
    $('back').disabled = step === 0; $('next').disabled = step === STEPS.length - 1;
    r.ribbon.setMarks(step === 3 ? r.verse.syllables.map((s) => ({ i: s.i, kind: 'heard', label: 'scored', title: 'gets a score' })) : []);
    $('summary').textContent = r.ribbon.summary();
  };
  $('back').addEventListener('click', () => { step = Math.max(0, step - 1); paint(); });
  $('next').addEventListener('click', () => { step = Math.min(STEPS.length - 1, step + 1); paint(); });
  paint();
}
