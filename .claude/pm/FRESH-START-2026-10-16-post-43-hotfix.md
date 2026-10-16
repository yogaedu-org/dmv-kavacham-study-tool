Paste this whole file as the first prompt of a new session in `C:\Users\kaanchan\Projects\Yoga\Das Mahavidya artifact\dmv-kavacham-study-tool`. It is self-contained.
Pre-flight for KA: none needed — session default model; `/effort medium` is enough.

# Fresh start — after the #43 dropdown hotfix (2026-10-16)

## What you are doing

The live p0 bug [#43](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/43) (filter
dropdowns clipped, nothing selectable) is **fixed, deployed and verified live**. It stays OPEN
until KA runs the test in the issue's deploy comment. Next session's work is whatever KA picks
from the open items below, most likely the **player.html** design, which is still waiting on KA's vision.

## Starting state (verified 2026-10-16 22:37 NST) — confirm with `git status` before acting

| Fact | Command |
|---|---|
| On `main`, level with `origin/main` at `8a9cc3b` (stamp) ← `4196326` (CLAUDE.md cleanup) ← `78a0317` (stamp) ← `fa932f4` (merge PR #44) | `git status -sb; git log --oneline -4` |
| Tracked tree clean; untracked only: `.claude/settings.json.bak-*`, `.claude/worktrees/`, `.vscode/`, `graphify-out/`, `player-current.png` | `git status --short` |
| Live footer stamp `4196326`; live `sw.js` cache `dmv-kavacham-v11`; live `styles.css` has `.controls { overflow: visible }` | `curl -s https://yogaedu-org.github.io/dmv-kavacham-study-tool/ \| grep -o 'buildCommit">[^<]*'` |
| #43 OPEN (reopened after GitHub auto-closed it via "Fixes #43"); PR #44 merged | `gh issue view 43 --json state` |
| Tests: 3 scripts, all green at `fa84f43` | `node tests/controls-overflow.mjs; node tests/feedback-prefill.mjs; node tests/validate-data.js` |

## Open items (DONE / PARTIAL / NOT DONE)

- DONE — #43 root cause, fix, regression guard, deploy, live verification (6/6 list×theme checks).
- PARTIAL — #43 closure: waiting on KA's live test. Do not close it yourself (live work).
- NOT DONE — narrow filter lists show a small horizontal scrollbar (pre-existing, cosmetic). **No issue filed yet**: file one if KA wants it.
- NOT DONE — player.html (`rnd/`, Day 5/6 audio): KA's vision still owed. Options last offered:
  (A) match the editor's Chant ↔ Study View look, (B) playback controls/loop/day picker/layout, (C) other.
- NOT DONE — `player-current.png` untracked in repo root: KA to say delete or gitignore.

## Rules for this session (each earned here)

- **Never put "Fixes #N" in a PR body for live work.** GitHub auto-closed #43 on merge,
  bypassing the closure protocol. Write "Refs #N" instead.
- **Deploy = merge/push to `main`.** Stamp each one with `python tools/stamp-version.py`, then commit
  `chore(deploy): stamp version (#30)` and push. The auto-mode classifier blocks `gh pr merge` unless KA
  has said to merge *in that turn*. If it blocks, stop and ask; don't route around it.
- **The service worker is cache-first for CSS/JS.** Bump `CACHE` in `sw.js` whenever shipped assets change.
  Returning visitors get new CSS only on the load *after* the new SW claims, so verify live with a second load.
- **Kill processes by PID or TaskStop, never by name** (the kill_by_name_guard hook blocks `pkill`).
- The Chrome extension was not connected. Use the Playwright MCP for browser checks.

## Deliver (next session)

1. Run the resume orientation, then ask KA which open item to take (one question).
2. Whatever is built: issue first, branch off `origin/main`, test → fix → docs as separate commits
   (`test(#N)`/`fix(#N)`/`docs(#N)`), PR with "Refs #N", merge only on KA's explicit go, stamp, push,
   verify live.
3. Sign off per the `sign-off` skill, with the citation list after it.

## References

- Repo: https://github.com/yogaedu-org/dmv-kavacham-study-tool — live: https://yogaedu-org.github.io/dmv-kavacham-study-tool/
- #43 deploy evidence + KA test: https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/43#issuecomment-6220112724
- PR #44: https://github.com/yogaedu-org/dmv-kavacham-study-tool/pull/44
- Fix: `styles.css` `.controls` rule (~L250), popup backgrounds (`.dropdown-content`, `.autocomplete-dropdown`), `sw.js` L16
- Guard: `tests/controls-overflow.mjs`
