"""Fail when the footer build stamp is stale (#46, complements #30).

Deploy protocol: commit the change, run tools/stamp-version.py, commit the stamp on
top. So on `main` the footer `buildCommit` is an ancestor of HEAD, and everything
after it may touch only non-runtime files plus the stamp spans themselves.

Stale = a runtime file (or index.html outside the two stamp spans) changed between
`buildCommit` and HEAD. Needs full history (actions/checkout fetch-depth: 0).

    python tools/check-stamp.py
"""
import io, re, subprocess, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Files/dirs the live site actually runs from (matches sw.js precache + shell).
RUNTIME = ("styles.css", "sw.js", "config.json", "manifest.webmanifest",
           "js/", "data/", "i18n/", "fonts/", "icons/", "figures/")

def git(*args):
    return subprocess.check_output(("git",) + args, encoding="utf-8").strip()

def normalise(html):
    html = re.sub(r'(<time id="buildWhen">)[^<]*(</time>)', r"\1\2", html)
    return re.sub(r'(<code id="buildCommit">)[^<]*(</code>)', r"\1\2", html)

html = io.open("index.html", encoding="utf-8", newline="").read()
m = re.search(r'<code id="buildCommit">([0-9a-f]{7,40})</code>', html)
if not m:
    sys.exit("FAIL: buildCommit span not found in index.html")
stamp = m.group(1)

try:
    git("cat-file", "-e", stamp + "^{commit}")
    git("merge-base", "--is-ancestor", stamp, "HEAD")
except subprocess.CalledProcessError:
    sys.exit("FAIL: stamped commit %s is not an ancestor of HEAD (shallow clone, or a wrong stamp)" % stamp)

changed = [f for f in git("diff", "--name-only", stamp, "HEAD").splitlines()
           if f != "index.html" and f.startswith(RUNTIME)]
old = normalise(git("show", stamp + ":index.html"))
index_changed = old != normalise(html)

if changed or index_changed:
    print("FAIL: footer stamp %s is stale; changed since then:" % stamp)
    for f in changed + (["index.html (outside the stamp spans)"] if index_changed else []):
        print("  -", f)
    print("Run python tools/stamp-version.py, commit, push (CLAUDE.md deploy protocol, #30).")
    sys.exit(1)
print("stamp OK: %s is current for all runtime files" % stamp)
