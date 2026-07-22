# Chant Dissection Protocol — spec for silence-aware, repeat-aware chant segmentation

Reusable methodology for turning a chanted/recited text + its recording into a set of
verse-, line-, and repeat-level audio segments suitable for an educational playback tool
(play the whole thing through, loop one verse, loop one line, hear a repeated refrain once
or in full). First built out against the **Das Mahāvidyā Kavacham** (14 shlokas, 6 recorded
days — git-bug `#9`); this document generalizes it.

**Status:** spec confirmed by KA (2026-07-21). Applying it to other chants in the current
program, and to past programs, is **explicitly gated on his separate go-ahead** — do not
generalize the scripts or re-run this pipeline against another chant until asked.

## Terminology

- **Verse** — one full shloka/couplet, the unit a devotee would call "one verse."
- **Pāda** (line) — half of a verse, split at the daṇḍa (।). Most classical Sanskrit verses
  are two pādas; a text in a different tradition may have a different natural sub-unit
  (a phrase, a hemistich) — the split point is whatever the text's own punctuation marks.
- **Refrain / repeat** — a pāda that is traditionally chanted more than once in sequence
  (e.g. the Kavacham's closing line, traditionally repeated). The RECORDED repeat count can
  vary by performance — verify it per recording, don't assume the textual tradition's count.
- **Whole-chant** — every verse played back to back, exactly as recorded (all repeats included).

## Pipeline

1. **Verse-level forced alignment.** Feed the known reference text (Devanāgarī master,
   IAST reconstructed from it — never the reverse, per `reference/chants/README.md`) to
   `torchaudio`'s `MMS_FA` bundle against the actual recording. Produces `start_abs`/`end_abs`
   per verse plus a per-word confidence score. **Flag, don't trust, low-confidence verses**
   (a threshold like < 0.85 average) — a low score can mean genuine content mismatch (the
   recording doesn't say what the reference text says at that point), which forced alignment
   cannot self-diagnose; it will force-fit regardless and just report a bad score. Verify a
   flagged verse independently (e.g. a separate ASR pass transcribing the actual clip) before
   trusting anything downstream of it.

2. **Pāda-level split.** Re-align each verse's own (already-correct) clip against its text
   split at the daṇḍa. This is cheap (~seconds of GPU time per verse) since the clip is
   already isolated — no need to re-run the expensive whole-chant alignment.

3. **Repeat-count detection — verify, don't guess from silence-gap counting.** A repeated
   pāda's aligned span runs far longer than its word-count-scaled share of the other pāda's
   pace — that ratio is the trigger. To find the ACTUAL count, re-align with the pāda's words
   repeated K=2,3,4× and keep whichever K the forced-aligner's own confidence score fits best.
   **Do not** count raw silence gaps inside the span — a natural mid-phrase breath sits INSIDE
   a single repetition too, so a gap count systematically overcounts (verified: 4 silence gaps
   detected inside a span that only contains 2 actual repetitions). The wrong K forces an
   implausible stretch or compression and the aligner's score visibly collapses relative to
   the right K — that collapse is usually decisive, occasionally close (~0.002-0.02 apart),
   in which case flag it as "probably X, worth an ear-check" rather than certain.

4. **Standalone invocational syllables.** A verse may open with a sustained syllable
   (e.g. "Oṁ") that is conceptually its own unit, distinct from the pāda it prefixes — flag
   it as its own sub-segment (`om_end_abs` or equivalent) so a line-alone loop doesn't
   re-say it every cycle, while whole-verse/whole-chant playback still includes it naturally
   (it's really there in the recording).
   **Known limitation, not further automatable with this method:** a resonant/sustained
   syllable's ACOUSTIC decay can extend past where a forced-aligner places the phonetic word
   boundary, and because it flows continuously into the next syllable (no real silence gap
   to exploit), there's no signal left to auto-refine this boundary further. This is a
   genuine precision ceiling — the fix is manual, via the review tool (Step 6), not more
   alignment cleverness.

5. **Playback-scope rule: only whole-chant playback includes every repetition.** A
   standalone verse play/loop or a standalone line play/loop uses ONE occurrence of a
   repeated refrain (how you'd actually study it verse-by-verse); whole-chant play/loop
   plays the refrain exactly as many times as it was actually recorded. Offer an explicit
   "all repetitions" control too, for direct comparison — don't just hide the full version.

6. **Silence-centered boundary padding, for natural-sounding loops.** A boundary cut tight
   against the last phoneme sounds abruptly chopped when looped. Take the MEASURED gap
   between two adjacent aligned segments (pāda↔pāda, verse↔verse, repeat↔repeat — these
   naturally exist from the alignment, no extra detection needed) and split it in half:
   each segment gets half the natural pause as trailing/leading room. This is a
   presentation-layer computation done at playback-build time, not written into the
   underlying alignment JSON — keep the raw aligned timestamps as ground truth, apply
   padding only where segments are actually assembled for playback.

7. **Manual correction, exposed at every granularity.** Automation has real limits (steps 3
   and 4 above). The fix is a waveform review tool where EVERY level — verse, pāda, and
   repeat boundary — is a draggable/snappable marker, with an apply/write-back step that
   parses each marker's ID to know which JSON field it corrects. Don't build a tool that
   only exposes verse-level correction and call the job done; "is the tool ready for
   line-level fixes" is a real question each time this is applied to a new chant, and the
   answer needs to be yes before you rely on manual QA to close the gap.

## Reference implementation (Kavacham, git-bug `#9`)

| stage | script |
|---|---|
| 1. verse-level alignment | `tools/youtube/align_kavacham_allday.py <day> <start_s> <end_s>` |
| 2-4. pāda + repeat-count + Om split | `tools/youtube/align_kavacham_padas.py <day>` |
| 6. playback-scope + padding + loop | `tools/youtube/gen_kavacham_player.py` → `reference/chants/dmv-kavacham/player.html` |
| 7. manual correction (any granularity) | `tools/youtube/build_kavacham_review.py <day>` (loads into `tools/navaratri-cue-review`) + `tools/youtube/apply_kavacham_review.py <day> <exported.json>` (writes corrections back) |

Canonical output schema (`kavacham-verse-timings-dayN.json`):

```json
{
  "day": 5, "chant_span_abs": [4195.3, 4403.7],
  "verses": [{
    "n": 14, "start_abs": 4357.52, "end_abs": 4375.82, "align_score": 0.954,
    "clip": "audio/day5/verse14.mp3", "dev": "...", "iast": "...",
    "padas": [
      {"line": 1, "start_abs": 4357.52, "end_abs": 4363.11, "om_end_abs": 4357.9},
      {"line": 2, "start_abs": 4363.81, "end_abs": 4375.82,
       "repeats": [{"start_abs": 4363.81, "end_abs": 4369.13}, {"start_abs": 4369.95, "end_abs": 4375.82}]}
    ]
  }]
}
```

This schema already supports every playback mode a study app needs without further
changes: whole-chant (`chant_span_abs`), any verse or subset looped (per-verse
`start_abs`/`end_abs`), line-alone (`padas[i]`), and repeat-aware study-vs-full modes
(`padas[1].repeats`).

## Prior art (researched 2026-07-21)

The closest analogs are Quran study apps (word/ayah-level repeat looping — Quran Loop,
House of Quran, Quran Word by Word) and, more precisely, **Memorize Shloka**, whose repeat
UX already distinguishes "single line, two lines, or whole verse" — validating this
protocol's verse/pāda granularity as a sound, independently-arrived-at pattern. Its
**shadowing mode** (a pause inserted after each repetition long enough to repeat the line
aloud yourself) is a feature this protocol doesn't yet have and is worth considering for a
future revision. A US patent (10,565,997) covers forced-alignment of Torah cantillation
audio for click-to-learn trope lessons — the one documented precedent for this pipeline's
overall shape (align → verse/word timing → pedagogical playback).

**What appears genuinely novel here**, per that research: the specific combination of
auto-aligned pāda boundaries + repeat-count-VERIFIED (not assumed) refrain handling +
silence-gap-centered (not zero-crossing-centered) cut placement. No named tool or paper
documents this combination.

## Open follow-ups

- Shadowing/repeat-pause mode (per Memorize Shloka) — not yet built, worth a future pass.
- Applying this protocol to the rest of the current Navaratri program's chants, then past
  programs — **holds until KA confirms**, per the gate stated at the top of this document.
