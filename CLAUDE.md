# dmv-kavacham-study-tool

## Per-turn issue declaration (mooladhara#131) — NON-NEGOTIABLE

Every assistant turn MUST begin with a leading tag as the first token of the first line:

| Tag | Meaning |
|---|---|
| `[#123]` | Work bound to issue 123. **The normal case.** |
| `[unbound]` | **WORK with no issue yet — a TRIPWIRE, not a resting state.** File an issue. |
| `[status]` | Not work: a status/progress/report answer. Legitimate, no issue needed. |
| `[chat]` | Not work: conversation, clarification, a question answered. Legitimate. |
| `[meta]` | Not work: a quick command/lookup with no work product. Legitimate. |

ONE primary issue per turn. A turn spanning two issues is a signal to **split the turn**.

**Why:** it converts issue↔work attribution from *inference* to *declaration*. Unbound work
is unbillable and untraceable. `[status]`/`[chat]`/`[meta]` exist so that non-work turns do
not have to lie (`[#N]` on a status query) or trip a false alarm — a convention people must
game is a convention they will ignore.

A Stop hook (`.claude/hooks/check_issue_tag.py`) enforces the tag's presence. It is
**advisory** — it warns, it never blocks.

## Deploy protocol (#30) — NON-NEGOTIABLE

GitHub Pages deploys `main` on push. **Every deploy MUST refresh the footer build
stamp** (`Last updated · <date> · <commit>` at the very bottom of `index.html`).

Deploy sequence to main:

1. Commit the actual content/code change(s).
2. **Stamp:** `python tools/stamp-version.py` — rewrites the `buildWhen`/`buildCommit`
   spans with the local date/time + `git rev-parse --short HEAD`. Never hand-edit them.
3. `git commit -am "chore(deploy): stamp version"` (or fold into the release commit).
4. `git push origin main` → Pages rebuilds; verify the stamp is current on the live site.

**Why:** a visible, honest "what's live right now" marker — so a stale CDN edge or a
half-applied deploy is caught at a glance instead of silently serving old content.
The stamp is inline (offline-safe for the PWA), so it must be re-stamped by hand each
deploy; the script makes that one command. Optional hardening (a pre-push hook or GH
Action) is tracked in #30.
