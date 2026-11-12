// sounds.js: the fixed table from the deeper-check probe that turns a syllable's IAST into the speech sounds it should contain.
// Ported from the probe's ipa() (research/zipa_gop_probe.json was made with it). The probe also dropped characters the model
// has no symbol for; this page does not know the model's 127 symbols, so it shows every character.
const DIG = [['kh', 'kʰ'], ['gh', 'ɡʰ'], ['ch', 'tʃʰ'], ['jh', 'dʒʰ'], ['ṭh', 'ʈʰ'], ['ḍh', 'ɖʰ'], ['th', 'tʰ'], ['dh', 'dʰ'], ['ph', 'pʰ'], ['bh', 'bʰ'], ['ai', 'ai'], ['au', 'au']];
const ONE = { 'ā': 'aː', 'ī': 'iː', 'ū': 'uː', 'ṛ': 'ri', 'ṝ': 'riː', 'e': 'eː', 'ē': 'eː', 'o': 'oː', 'ō': 'oː', 'ṁ': 'm', 'ṃ': 'm', 'ḥ': 'h', 'ṅ': 'ŋ', 'ñ': 'ɲ', 'ṇ': 'ɳ', 'ṭ': 'ʈ', 'ḍ': 'ɖ', 'ś': 'ʃ', 'ṣ': 'ʃ', 'c': 'tʃ', 'j': 'dʒ', 'y': 'j', 'g': 'ɡ' };

export function expectedSounds(iast) {
  const s = iast.normalize('NFC').toLowerCase(); const out = []; let i = 0;
  while (i < s.length) {
    const d = DIG.find(([a]) => s.startsWith(a, i));
    if (d) { out.push(d[1]); i += d[0].length; } else { out.push(ONE[s[i]] || s[i]); i += 1; }
  }
  return out;
}
/** What the report observed, if it observed anything about this kind of syllable. */
export function reportNote(iast) {
  const s = iast.normalize('NFC').toLowerCase();
  if (/[śṣ]/.test(s)) return 'The report observed that the model heard ś and ṣ as the same sound (ʃ), on two clips. The expected sounds here are also the same for both, so this table cannot tell them apart either.';
  if (/dh/.test(s)) return 'The report observed that the model dropped the breath from dhū, hearing d̪oː, on two clips.';
  return 'The report did not observe anything about this kind of syllable.';
}
