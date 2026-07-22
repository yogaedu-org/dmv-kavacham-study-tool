# RESUME — sung-translation R&D (#35)

Everything is committed + pushed to `main`. Safe to clear the conversation; a fresh
session needs only this file + `gh issue list`.

## Where things are
- **Live app**: deployed from `main` via GitHub Pages (https://yogaedu-org.github.io/dmv-kavacham-study-tool/).
  All of #10/#22/#28/#32/#34 shipped. Deploy protocol: `python tools/stamp-version.py`
  before pushing **app** changes to main (see repo CLAUDE.md). R&D commits (this folder)
  don't touch the app → no stamp needed.
- **This R&D** lives in `rnd/35-sung-translation/`:
  - `editor.html` — the published editor artifact → https://claude.ai/code/artifact/82b110cf-c66e-49dc-a59e-27e875225cee
  - `singable.json` — **source of truth**: per verse `sa/it/en`, `words` (padaccheda,
    token-level: `{sa, toks:[{it,g}]}`), `singable` (4 lines/verse), `history`.
  - `build.py` — regenerates `editor.html` from `editor.template.html` + `singable.json`.
    **Iterate loop:** edit `singable.json` (or the `SINGABLE`/`WORDS` dicts in build.py) →
    `python build.py` → re-publish `editor.html` to the SAME artifact URL (pass `url=…`).
  - Prosody-transfer PoC (audio): `pitch_transfer.py` + `say.ps1` (parselmouth, CPU).
    Placeholder melody until real chant audio arrives.
- 1min.ai API key: `.secrets/1min-key.txt` (gitignored).

## Editor features (current)
14 verses. Per verse: Devanāgarī word-row (toggle **Word-by-word: off/verse/detailed**
reveals per-word IAST+gloss beneath each word), transliteration line, app meaning,
and 4 editable singable lines with syllable counters. **Copy-JSON** round-trips edits;
paste back → update `singable.json` + append to `history` → rebuild → republish.

## Open threads
- Singable lines are **v0.1 Claude drafts**; user is editing toward natural + on-tune.
- **Verse 10** singable softened the explicit anatomy — user's call.
- Word-by-word glosses = Claude's analysis; **cross-check with a Sanskritist** before the live app.
- Issues: **#21/#24** audio (blocked on `yogic-approach/navaratri-sadhana#1`),
  **#33** Vite single-file, **#36** word-by-word in the live app + i18n-pluggable glosses,
  **#37** community competition (multilingual singable), **#26** Google Form, **#29** master slides,
  **#32** autocomplete-keyboard a11y remainder.
