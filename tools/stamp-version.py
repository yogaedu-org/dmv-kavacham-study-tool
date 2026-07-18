"""Stamp index.html with the deploy date + current commit (#30).

Run as the LAST step before every deploy commit to main:

    python tools/stamp-version.py
    git add index.html && git commit -m "chore(deploy): stamp version" && ...

It rewrites the <time id="buildWhen"> and <code id="buildCommit"> spans in the
footer build-stamp. Offline-safe (inline, no runtime API). The commit shown is the
released content commit (HEAD at stamp time); the stamp commit itself rides on top.
"""
import io, re, sys, subprocess
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def run(*args):
    return subprocess.check_output(args, encoding="utf-8").strip()

sha = run("git", "rev-parse", "--short", "HEAD")
now = datetime.now().astimezone()
# Compact zone: multi-word names -> initials ("Nepal Standard Time" -> "NST").
zone = now.strftime("%Z") or "UTC"
if " " in zone:
    zone = "".join(w[0] for w in zone.split()).upper()
when = "%s (%s)" % (now.strftime("%Y-%m-%d %H:%M"), zone)

path = "index.html"
html = io.open(path, encoding="utf-8", newline="").read()

new = html
new = re.sub(r'(<time id="buildWhen">)[^<]*(</time>)', r'\g<1>' + when + r'\g<2>', new)
new = re.sub(r'(<code id="buildCommit">)[^<]*(</code>)', r'\g<1>' + sha + r'\g<2>', new)

if new == html:
    print("ERROR: build-stamp spans not found in index.html — was the markup changed?")
    sys.exit(1)

io.open(path, "w", encoding="utf-8", newline="").write(new)
print("stamped index.html  ·  %s  ·  %s" % (when, sha))
