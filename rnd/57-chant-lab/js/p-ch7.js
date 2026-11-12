import { ready } from './chrome.js';
import { createRibbon } from './ribbon.js';
import { audioSource, fillVerseSelect, verseOf, urlParam, esc } from './lib.js';

const chant = await ready;
if (chant) {
  const $ = (id) => document.getElementById(id);
  const src = await audioSource(chant.reference_set);
  fillVerseSelect($('verse'), chant, { value: Number(urlParam('verse')) || 1 });
  let ribbon = null;
  const show = (html, err) => { $('status').innerHTML = html; $('status').classList.toggle('err', !!err); };

  $('files').addEventListener('change', (e) => {
    const { matched, rejected } = src.setCustomFiles(e.target.files);
    $('fileinfo').textContent = `${Object.keys(matched).length} matched to verses (${Object.keys(matched).join(', ') || 'none'})${rejected.length ? `; not used: ${rejected.map((r) => `${r.name} (${r.reason})`).join('; ')}` : ''}.`;
  });

  async function find() {
    const mode = document.querySelector('input[name="mode"]:checked').value, id = Number($('verse').value), verse = verseOf(chant, id);
    $('audio').pause(); show('Looking...');
    const r = await src.resolve(id, { mode });
    $('ribbon').innerHTML = ''; ribbon = createRibbon($('ribbon'), { verse });
    const tried = (t) => `<ul class="small">${t.map((x) => `<li><b>${esc(x.label)}</b>: ${esc(x.reason)}${x.url ? ` (<code>${esc(x.url.replace(location.origin, ''))}</code>)` : ''}</li>`).join('')}</ul>`;
    if (r.missing) {
      $('badge').textContent = 'no audio';
      show(`No audio found for verse ${id}. Here is what was tried:${tried(r.tried)}<span>To fix it: run <code>python rnd/57-chant-lab/tools/copy-clips.py</code> for the offline folder, or choose your own file.</span>`, true);
      $('summary').textContent = ribbon.summary();
      return;
    }
    $('audio').src = r.url; $('audio').load(); ribbon.setAudio($('audio'));
    $('badge').textContent = `audio from ${r.label}`;
    show(`Found in <b>${esc(r.label)}</b> (source kind: ${esc(r.source)}).${r.tried.length ? `<br>Skipped before it:${tried(r.tried)}` : ''}`);
    $('summary').textContent = ribbon.summary();
    window.__chantlab = Object.assign(window.__chantlab || {}, { found: { source: r.source, label: r.label, tried: r.tried } });
  }
  $('find').addEventListener('click', find);
  $('verse').addEventListener('change', find);
  await find();
}
