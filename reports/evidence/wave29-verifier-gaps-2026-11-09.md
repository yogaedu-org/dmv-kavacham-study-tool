# Wave 27/28 verifier gaps: evidence (hub mooladhara#773)

Measured 2026-11-09 (UTC) by wave-29 FIX agent. Result: **no code gap**. Every item the
verifier marked PARTIAL is a report/process gap or a verification limit; the proofs are saved here.

## 1. Remote state (re-measured, `git ls-remote` / `gh`)

| Fact | Value |
|---|---|
| `origin/main` | `00b2be7` (unchanged since before wave 27; no push, no merge) |
| PR #45 `wave27/dmv-2` | draft, base main, body `Refs #32 Refs #40`, head `1729cc2` |
| PR #49 `wave27/dmv-5` | draft, base main, `Refs #48`, head `832b7d0` |
| PR #51 `wave28/dmv-3` | draft, base `wave27/dmv-2`, `Refs #50`, head `d84849d` |
| PR #52 `wave28/dmv-1` | draft, base `wave28/dmv-3`, `Refs #50`, head `1abb832` |
| PR #53 `wave28/dmv-4` | draft, base `wave28/dmv-1`, `Refs #50`, head `2e510ac` |
| PR #47 | CLOSED scratch red-proof (`Refs #46`), never merged |

## 2. CI status per head (the verifier said "fill in `gh pr checks`")

| PR | head | CI run (`tests` job) |
|---|---|---|
| #45 | `1729cc2` | success, run 42587781849 (supersedes the earlier green run 42586918669 on `8627218`) |
| #51 | `d84849d` | success, run 42599843465 |
| #52 | `1abb832` | success, run 42600292028 |
| #53 | `2e510ac` | success, run 42600796196 |
| #49 | `832b7d0` | **no CI**: the `tests` workflow lives only on the #45 branch, not on main, so a PR against main has no check to run. Verification limit, not a failure. |

All runs under `https://github.com/yogaedu-org/dmv-kavacham-study-tool/actions/runs/<id>`. The `stamp` job is
`skipping` on PRs by design (`if: github.event_name == 'push'`).

Gate goes red when it should: run 42587255998 on `375d3dc` (`wave27/dmv-3-red-proof`, PR #47, closed, do-not-merge)
failed at step `Run node tests/validate-data.js`.

## 3. Local re-run of the full gate on the stack top (`2e510ac`, includes #45 + #51 + #52 + #53)

`reports/evidence/wave29-stack-gate-2e510ac.log`: 9 node checks + `tools/check-doc-links.py`, **10/10 `exit=0`,
0 failures** (node v24.15.0, python 3.12.2). Named checks: `font-scale-storage.mjs` (blocked localStorage falls
back to scale 1), `sw-fetch.mjs` (non-OK navigation not cached; offline miss returns a Response),
`sw-assets.mjs` (30 precache entries match disk), `css-tokens.mjs`, `category-registry.mjs`, etc.

## 4. Draft release (outward write: PREPARE-ONLY, call-out the verifier asked for)

`gh release view rnd-audio-2026-11`: `draft=true`, tag `rnd-audio-2026-11`, target `main`, **87 assets, 54,857,307 bytes**.
An upload to GitHub is an outward write; because the release is a draft nothing is public and nothing links to it.
It stays class-C-style prepared-only: KA publishes it (or not) himself; PR #49 must not merge before that.

## 5. Process notes from the verifier (acknowledged, not code)

- **Scratch outside the repo (global §8).** Launch 1 wrote `/tmp/dmv43.md` and `/tmp/check-stamp.py`; launch 2 wrote
  `/tmp/b.md` (issue body). On this machine they resolve to `C:/Users/kaanchan/AppData/Local/Temp/{dmv43.md,check-stamp.py,b.md}`
  (verified present, 1282 / 2197 / 740 bytes). Content is an issue/comment body and a script copy, no secrets. This run
  does not delete them (outside the managed area); KA may delete them.
- **Denied tool call not reported (launch 2).** A Bash heredoc write plus `rm -rf` of a scratch dir was permission-denied;
  the agent redid the write with the Write tool and dropped the `rm -rf`. Not a safety bypass (the destructive part was
  dropped), but the denial should have been in the report. Noted here so the record is complete.
- **Header mislabel.** Launch 2's report said "wave 28" while the ledger row says wave 2705: a labelling slip only.
- **Issue #39 closed 2026-11-09T08:49:08Z.** It is a backlog-triage report, so there is no code fix that needs to reach
  main first; no closed-before-merge problem. Listed for KA anyway. All other issues named by those launches
  (#32, #40, #43, #46, #48, #50) are still OPEN, as they should be.
