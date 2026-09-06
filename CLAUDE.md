# dmv-kavacham-study-tool

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

Global rules live in ~/.claude/CLAUDE.md (mooladhara config/global) and apply in full.
