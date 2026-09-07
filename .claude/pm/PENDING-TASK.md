# PENDING TASK

**Nothing in flight.** The #32 autocomplete-keyboard unit is committed on
`swarm/20260907-32` (local only — swarm agents do not push).

## What landed

- `77293ac` fix(#32): keyboard path for the search autocomplete (a11y)
- `491eb1c` docs(#32): document the autocomplete-keyboard test in README checks

Gate run in the same turn, both green:
`node tests/validate-data.js` · `node tests/autocomplete-keyboard.mjs`

## Waiting on KA

1. Review + push the branch (see the report for the exact commands). Nothing is
   pushed; `main` is also still **1 commit ahead of origin** from before this run
   (`b5e857c`, pre-existing — not this agent's).
2. #32 has one remaining unchecked box this unit did NOT attempt: the residual
   `body` ↔ `bodyParts` naming split (`data-type="body"` in `js/filters.js` vs
   `bodyParts` in the data). It is a data-naming change with a wider blast radius
   and deserves its own unit. **Do not close #32** until that is settled.

## Next unit (proposed)

An undefined-CSS-variable guard in `tests/`. Named failure, hit for real during
this unit: a rule referencing `var(--accent-color)` (no such token; the real one is
`--color-accent`) silently renders with no value, so the keyboard cursor would have
been invisible with nothing failing. `styles.css` is currently clean — 40 tokens
defined, 39 used, zero undefined — so the guard goes in green. Needs an issue first.

## Standing constraints

Never touch KA's untracked paths: `.claude/settings.json.bak-*`, `.claude/worktrees/`,
`.vscode/`, `graphify-out/`, `player-current.png`.
