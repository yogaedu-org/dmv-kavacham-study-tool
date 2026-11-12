// recorder.js: record a take from the microphone and decode audio to analysis PCM (dmv #57). No DOM, no page assumptions.
//
//   const rec = await startRecording({ constraints, onSettings });   // asks for the mic
//   const take = await rec.stop();                                   // -> { pcm, sampleRate, blob, mimeType, settings, seconds }
//   const pcm  = await decodeToPcm(arrayBuffer);                     // any browser-readable audio -> mono 16 kHz Float32Array
//
// The three speech-processing features are requested OFF (they smear sustained chant pitch: a hypothesis, see README); the
// browser may ignore the request, so `take.settings` is what the browser reports it actually applied.
export const ANALYSIS_RATE = 16000;

export async function decodeToPcm(arrayBuffer, rate = ANALYSIS_RATE) {
  const ctx = new AudioContext({ sampleRate: rate });
  try {
    const buf = await ctx.decodeAudioData(arrayBuffer);
    const ch = buf.getChannelData(0).slice();
    for (let c = 1; c < buf.numberOfChannels; c++) { const o = buf.getChannelData(c); for (let i = 0; i < ch.length; i++) ch[i] += o[i]; }
    if (buf.numberOfChannels > 1) for (let i = 0; i < ch.length; i++) ch[i] /= buf.numberOfChannels;
    return ch;
  } finally { ctx.close(); }
}

export async function startRecording({ constraints, onSettings } = {}) {
  const audio = constraints || { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };
  const stream = await navigator.mediaDevices.getUserMedia({ audio });   // rejects with NotAllowedError etc.; the caller shows it
  const settings = stream.getAudioTracks()[0].getSettings();
  if (onSettings) onSettings(settings);
  const chunks = [], recorder = new MediaRecorder(stream), t0 = performance.now();
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.start();
  return {
    settings,
    stop: () => new Promise((resolve, reject) => {
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType });
        try { const pcm = await decodeToPcm(await blob.arrayBuffer()); resolve({ pcm, sampleRate: ANALYSIS_RATE, blob, mimeType: recorder.mimeType, settings, seconds: (performance.now() - t0) / 1000 }); }
        catch (e) { reject(e); }
      };
      if (recorder.state !== "inactive") recorder.stop(); else recorder.onstop();
    }),
  };
}
