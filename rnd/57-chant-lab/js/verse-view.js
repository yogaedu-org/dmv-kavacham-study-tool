// verse-view.js: mount one verse: the ribbon, its audio, its energy band and its pitch line. Used by most pages.
import { createRibbon } from './ribbon.js';
import { getClip, analyseClip, medianHz, cents, verseOf, esc, fmt } from './lib.js';

export function pitchSeries(f0, cls, med = medianHz(f0), tOf = (k) => k * 0.01 + 0.0125) {
  const t = [], c = [];
  for (let k = 0; k < f0.length; k++) { t.push(tOf(k)); c.push(cents(f0[k], med)); }
  return { cls, t, c };
}

/** Returns { ribbon, verse, clip, analysis } (clip/analysis are null if the audio is missing; status says why). */
export async function mountVerse({ chant, verseId, setId = chant.reference_set, ribbonEl, audioEl, statusEl, badgeEl, withPitch = true }) {
  const verse = verseOf(chant, verseId);
  const ribbon = createRibbon(ribbonEl, { verse });
  const say = (t, err) => { if (statusEl) { statusEl.textContent = t; statusEl.classList.toggle('err', !!err); } };
  say('Finding the audio...');
  let clip = null, analysis = null;
  try {
    clip = await getClip(setId, verse.id);
    if (audioEl) { audioEl.src = clip.url; audioEl.load(); }
    ribbon.setAudio(audioEl);
    if (badgeEl) badgeEl.textContent = `audio from ${clip.label}`;
    say('');
    if (withPitch) {
      say('Reading the pitch, a few seconds...');
      analysis = await analyseClip(`${setId}:${verse.id}`, clip.pcm);
      ribbon.setEnergy(analysis.db);
      ribbon.setPitch([pitchSeries(analysis.f0, 'ref')], { range: 400 });
      say('');
    }
  } catch (e) { say(e.message, true); if (badgeEl) badgeEl.textContent = 'no audio'; }
  return { ribbon, verse, clip, analysis };
}

/** A line of plain words for the text summary of the sample. */
export const verseLine = (verse) => `${verse.syllables.length} syllables, ${fmt(verse.analysis_span[1] - verse.analysis_span[0])} s`;

/** The standard stage: #verse select, #ribbon, #audio, #status, #badge, #summary. Remounts on a verse change. */
export async function initStage(chant, { onMount, setId, withPitch = true, defaultVerse = 1 } = {}) {
  const { fillVerseSelect, urlParam } = await import('./lib.js');
  const $ = (id) => document.getElementById(id), sel = $('verse');
  const start = Number(urlParam('verse')) || defaultVerse;
  fillVerseSelect(sel, chant, { value: chant.verses.some((v) => v.id === start) ? start : 1 });
  let token = 0, cur = null;
  async function mount() {
    const my = ++token;
    $('ribbon').innerHTML = '';
    const audio = $('audio'); audio.pause();
    const r = await mountVerse({ chant, verseId: Number(sel.value), setId, ribbonEl: $('ribbon'), audioEl: audio, statusEl: $('status'), badgeEl: $('badge'), withPitch });
    if (my !== token) return cur;
    cur = r;
    if ($('summary')) $('summary').textContent = r.ribbon.summary();
    if (onMount) await onMount(r);
    if ($('summary') && my === token) $('summary').textContent = r.ribbon.summary() + (r.extraSummary ? ' ' + r.extraSummary : '');
    window.__chantlab = Object.assign(window.__chantlab || {}, { ribbon: r.ribbon, verse: r.verse });
    return r;
  }
  sel.addEventListener('change', mount);
  await mount();
  return { mount, current: () => cur, select: sel };
}
