# sung-translation-rnd (scratch)

R&D for **yogaedu-org/dmv-kavacham-study-tool #35**: sing an English (and later Nepali)
translation to the **same tune** as the chanted Sanskrit verse. Method: **prosody / F0
transfer** — impose the chant's pitch contour on synthesized English speech. Also paves
the way for **Saundarya Lahari**. Scratch for now; formalize into a repo once proven.

The shipped app translations are NOT touched — these are separate *singable* R&D lyrics.

## Approach (CPU-only, deterministic — no GPU)
1. **English voice** — Windows SAPI now (`say.ps1`); swap in Piper/FastPitch later.
2. **Pitch transfer** — `pitch_transfer.py`: Praat Manipulation + PitchTier → PSOLA
   resynthesis (via `parselmouth`). Replaces the speech's pitch with a melody.
3. **The melody** — a placeholder chant contour for now. When the real recitation lands
   (navaratri-sadhana#1), extract its F0 (parselmouth `To Pitch` / pyworld) and feed that
   contour in instead of `MELODY_ST`.

## The creative crux
Write English whose **syllables land on the chant's notes**. Sanskrit and English have
different syllable counts, so the singable lyric is fitted to the melody, not a literal
translation. See `singable-drafts.md`.

## Files
- `say.ps1` — SAPI → `refs/eng_v1.wav`
- `pitch_transfer.py` — F0 transfer → `out/sung_v1.wav`
- `singable-drafts.md` — R&D singable translations
- `refs/`, `out/` — audio (gitignored when formalized)

## Next
- Feed the REAL chant F0 once audio is available (the only placeholder here is the melody).
- Better English TTS (Piper) for a warmer voice.
- Time-align syllables → notes (not just re-pitch): map each English syllable to a note
  with the right duration.
