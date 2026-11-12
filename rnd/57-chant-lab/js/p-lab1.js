import { ready } from './chrome.js';
import { initStage } from './verse-view.js';
import { chart, drawWave } from './charts.js';
import { decodeToPcm, analyseClip, findPauses, kvPut, fmt, esc } from './lib.js';

const chant = await ready;
if (chant) {
  const $ = (id) => document.getElementById(id);
  const say = (t, err) => { $('recstatus').textContent = t; $('recstatus').classList.toggle('err', !!err); };
  const stage = await initStage(chant, { withPitch: false });
  let recorder = null, stream = null, takeUrl = null, settings = null;

  async function showTake(blob, name) {
    say('Reading your take...');
    let pcm;
    try { pcm = await decodeToPcm(await blob.arrayBuffer()); }
    catch (e) { say(`Could not read ${name}: ${e.message}. Try a WAV or MP3 file, or record again.`, true); return; }
    const verseId = Number($('verse').value);
    if (takeUrl) URL.revokeObjectURL(takeUrl);
    takeUrl = URL.createObjectURL(blob);
    const a = $('takeaudio'); a.src = takeUrl; a.hidden = false;
    const an = await analyseClip(`take:${Date.now()}`, pcm), dur = pcm.length / 16000, { pauses, threshold } = findPauses(an.db);
    const cv = $('wave'); cv.hidden = false;
    chart(cv, 200, (c) => drawWave(c, { pcm, sr: 16000, db: an.db, threshold, pauses, dur }));
    const v = chant.verses.find((x) => x.id === verseId), refDur = v.analysis_span[1] - v.analysis_span[0];
    $('wave-summary').innerHTML = `<b>Your take.</b> ${fmt(dur)} s long; the reference verse spans about ${fmt(refDur)} s. ${pauses.length ? `${pauses.length} pause${pauses.length > 1 ? 's' : ''} of 0.30 s or longer: ${pauses.map((p) => `${fmt(p.t0, 2)} to ${fmt(p.t1, 2)} s`).join('; ')}.` : 'No pause of 0.30 s or longer.'}`;
    say(`${name}: ${fmt(dur)} s ready to play.`);
    try { await kvPut('lastTake', { blob, verse: verseId, name, settings, saved: new Date().toISOString() }); $('next').hidden = false; $('tolab2').href = `lab2.html?verse=${verseId}&source=last`; }
    catch (e) { $('next').hidden = false; $('tolab2').href = `lab2.html?verse=${verseId}`; say(`${name} is ready, but this browser would not keep it for Lab 2 (${e.message}). Use "choose a file" in Lab 2 instead.`, true); }
  }

  $('rec').addEventListener('click', async () => {
    if (!navigator.mediaDevices || !window.isSecureContext) { say('Recording needs a secure page. Open this site as http://localhost or over https, not as a file or a plain network address.', true); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    } catch (e) {
      const why = { NotAllowedError: 'The microphone is blocked for this page. Allow it from the lock or site icon in the address bar, then press Record again.', NotFoundError: 'No microphone was found. Plug one in or check that the system sees it, then press Record again.', NotReadableError: 'The microphone is in use by another program. Close that program, then press Record again.' }[e.name] || `The browser refused the microphone (${e.name}). ${e.message}`;
      say(why, true); return;
    }
    const s = stream.getAudioTracks()[0].getSettings(); settings = { echoCancellation: s.echoCancellation, noiseSuppression: s.noiseSuppression, autoGainControl: s.autoGainControl, channelCount: s.channelCount, sampleRate: s.sampleRate };
    const keys = ['echoCancellation', 'noiseSuppression', 'autoGainControl'], names = { echoCancellation: 'echo cancellation', noiseSuppression: 'noise suppression', autoGainControl: 'automatic volume levelling' };
    const state = (v) => (v === true ? 'on' : v === false ? 'off' : 'not reported by this browser');
    const on = keys.filter((k) => settings[k] === true), unknown = keys.filter((k) => settings[k] === undefined);
    $('micinfo').textContent = `The browser reports: ${keys.map((k) => `${names[k]} ${state(settings[k])}`).join(', ')}; ${settings.channelCount === undefined ? 'channels not reported by this browser' : `${settings.channelCount} channel${settings.channelCount === 1 ? '' : 's'}`}. We asked for all three to be off. ${on.length ? `Still on: ${on.map((k) => names[k]).join(', ')}. The browser ignored the request, and that may flatten sustained pitch (hypothesis).` : unknown.length ? `We cannot confirm ${unknown.map((k) => names[k]).join(', ')}: not reported by this browser.` : 'All three are off.'}`;
    const chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      $('rec').disabled = false; $('stop').disabled = true;
      await showTake(new Blob(chunks, { type: recorder.mimeType }), 'Recording');
    };
    recorder.start(); $('rec').disabled = true; $('stop').disabled = false; say('Recording. Press Stop when you have finished the verse.');
  });
  $('stop').addEventListener('click', () => { if (recorder && recorder.state !== 'inactive') recorder.stop(); });
  $('file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) showTake(f, f.name); });
  window.__chantlab = Object.assign(window.__chantlab || {}, { lab1: { showTake } });
}
