# PENDING TASK

Updated 2026-11-09 (wave 27). Read this first.

## Waiting on KA
1. **#43 live test** (p0, fixed + deployed 2026-10-16): steps are in the 2026-11-09 comment on the issue. Only KA closes.
2. **PR #45 (draft)** wave27/dmv-2: stranded #32 a11y + registry fix, #40 css-token guard, check-doc-links, sw.js CACHE v12, CI workflow (#46). Merging deploys live: keyboard-click the filters/autocomplete first, then after merge `python tools/stamp-version.py`, commit, push (CLAUDE.md deploy protocol, #30).
3. `player-current.png` (untracked, repo root): delete or gitignore?
4. Remote branches to delete once PR #45 is merged: `fix/41-prefill-correction-form`, `fix/43-dropdown-clipping`, `feat/config-layer` (0 ahead), `swarm/20260907-32`, `swarm/20261012-wave`, wave27/dmv-3-red-proof. `worktree-agent-abd6766363faef7cc` (#33 Vite bundle, 1 ahead / 30 behind) is kept until KA decides on #33.

## Not started
- Player design (rnd/kavacham-audio-alignment/out/player.html): needs KA's direction (match editor look vs. playback features).
- Small scrollbar on the narrow filter lists: no issue yet.
