// tasks.js: the heavy calls, run in worker.js when module workers exist, else inline. Uses the #56 modules unchanged.
import { features, f0Track, compareTake } from '../../56-audio-sources/compare.js';

/** Frame level (dB, 10 ms) and F0 (Hz, 0 = unvoiced) of a 16 kHz mono clip. */
export function analyse({ pcm }) {
  const f = features(pcm);
  return { db: f.db, f0: f0Track(pcm, f.db) };
}
export function compare({ ref, usr, verse }) { return compareTake(ref, usr, verse); }
