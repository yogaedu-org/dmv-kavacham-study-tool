# Das Mahāvidyā Kavacham — study assets

Audio + canonical text for the **Das Mahāvidyā Kavacham** (the protective armour invoking the ten
wisdom goddesses across the directions and the body), gathered for a **DMV study tool**.

## What's here
| file | committed? | notes |
|---|---|---|
| `kavacham-verses.md` / `.json` | ✅ yes | the **14 numbered shlokas**, Devanāgarī + IAST, from KA's Drive corpus (`atha śrīmahāvidyākavacam` DEV/ROM docx). Devanāgarī is master. |
| `audio/day3-kavacham-full-chant.mp3` | ❌ gitignored (media) | **chant-level** clip — KA's full Kavacham recitation, Day 3 (2026-07-17), 1:01:54–1:05:06 (~194 s), cut from the Zoom recording. On disk, not in the repo. |
| `audio/verses/verse01.mp3` … `verse14.mp3` | ❌ gitignored (media) | **verse-level** clips, one per shloka — produced 2026-07-21 via forced alignment. |
| `kavacham-verse-timings.json` | ✅ yes | start/end/score + Devanāgarī/IAST per verse. |

## Verse-level audio — done
The Kavacham is chanted **continuously** (largest breath-gap in the 194 s is only ~0.7 s), so the
silence-gap method that isolates the ten deity mantras doesn't delimit these 14 verses. Solved via
**forced alignment**: `torchaudio`'s `MMS_FA` bundle (via Shruti's `bench/align.py`, langseg conda env)
aligned the 14 romanized shlokas to the Day-3 chant clip. All 14 verses aligned cleanly — scores
0.87–0.96 (threshold for concern is <0.30), **zero low-confidence verses**, 3.3 s of GPU time for the
194 s clip. Driver: `.claude/tmp/dmv-align/align_kavacham.py`. Advances git-bug `#9`.

## Structure of the armour (for the study tool)
Shlokas 1–4 cover the **ten directions** (each guarded by one Mahāvidyā); 5–11 cover the **body** head
to foot; 12–14 are the closing protection. Full mapping is in `kavacham-verses.json`.

## Provenance
- Text: `reference/chants/drive-corpus/atha śrīmahāvidyākavacam (DEV/ROM).docx` (KA's shared Drive).
- Audio: `2026 July - Ashadha Navaratri/Day 3 - 2026-07-17/recordings/` (Zoom recording, media gitignored).
