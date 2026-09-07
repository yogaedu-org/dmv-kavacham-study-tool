# PENDING TASK

**Nothing in flight.** #40 is committed on `swarm/20260907-32` (local only — swarm
agents do not push). #32's two units are on the same branch.

## What landed on this branch

| commit | subject | issue |
|---|---|---|
| `77293ac` | fix: keyboard path for the search autocomplete (a11y) | #32 |
| `491eb1c` | docs: document the autocomplete-keyboard test in README checks | #32 |
| `d94ed56` | fix: resolve filter state through the category registry | #32 |
| `7b22eb4` | docs: document the category-registry test in README checks | #32 |
| `8ca56e5` | chore: PM state for the category-registry unit | #32 |
| `a29e204` | test: guard the CSS custom-property contract | #40 |
| `e17627c` | docs: document the css-tokens check in README checks | #40 |

Gate run in the same turn as `e17627c`, all four green:
`node tests/validate-data.js` · `node tests/autocomplete-keyboard.mjs` ·
`node tests/category-registry.mjs` · `node tests/css-tokens.mjs`

## Waiting on KA

1. Review + push the branch:
   `git push -u origin swarm/20260907-32`
   Nothing is pushed; `main` is also still **1 commit ahead of origin** from before
   these runs (`b5e857c`, pre-existing — not a swarm agent's).
2. **#32 has no known remaining work.** Do not close until KA has clicked through
   the filters and the autocomplete in a browser.
3. **#40 is a tripwire, not a fix** — it landed green. Close once reviewed.
4. Anything reaching `main` needs `python tools/stamp-version.py` first (deploy
   protocol, #30).

## Next unit (proposed)

**Wire the four checks into a single command + CI (`no-ci` risk flag).** There is no
`package.json` and `.github/` holds only `ISSUE_TEMPLATE/`, so the four guards run
only when someone remembers each filename — and the README **Checks** block is the
sole record that they exist. Named failure: a change reaches `main` (which
auto-deploys to Pages) with a red guard, because nothing ran it. Smallest useful
step is a `tests/run-all.mjs` plus a GitHub Actions workflow on push/PR. Needs an
issue first. Sonnet / medium.

Note: `CLAUDE.md` points at **#30** for an optional pre-push hook or GH Action, but
#30 is CLOSED — that pointer dangles and the CI work has no open home.

## Standing constraints

Never touch KA's untracked paths: `.claude/settings.json.bak-*`, `.claude/worktrees/`,
`.vscode/`, `graphify-out/`, `player-current.png`.
