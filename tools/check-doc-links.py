"""Read-only relative-link checker for the docs inventory.

Checks markdown links ](target), <a href="target">, and backtick repo paths
(tokens containing '/' or ending in .html/.js/.mjs/.py/.md/.json/.css).
Relative links resolve against the file's own directory; backtick paths are
tried against the file's directory first, then the repo root.
Usage: python tools/check-doc-links.py   (root is derived from this script's location; exit 1 if any broken)

Known non-paths are skipped: URL schemes (`file://`), gitignored paths (git check-ignore),
bare names that live under js/ (README module table), and the ALLOW list below.
"""
import glob
import os
import re
import subprocess
import sys
import urllib.parse

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # <root>/tools -> <root>

# Mentions that are not live paths: branch names (BRANCH_PREFIXES) and a file that existed before the js/ split.
ALLOW = {"app.js"}
BRANCH_PREFIXES = ("swarm/", "fix/", "feat/")

MD_LINK = re.compile(r'\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)')
HTML_A = re.compile(r'<a\s[^>]*?href\s*=\s*["\']([^"\']+)["\']', re.I)
BACKTICK = re.compile(r"`([^`\s]+)`")
PATH_EXT = re.compile(r"\.(html|js|mjs|py|md|json|css)$", re.I)
GLOB_OR_PLACEHOLDER = set("*?<>{}$|=(),")


def collect_files():
    found = set()
    for name in os.listdir(ROOT):
        if re.match(r"(?i)start[-_ ]?here", name) and os.path.isfile(os.path.join(ROOT, name)):
            found.add(os.path.join(ROOT, name))
    for fixed in ["README.md", "CLAUDE.md", "CHANGELOG.md", os.path.join(".claude", "pm", "PENDING-TASK.md"),
                  os.path.join("rnd", "README.md"), os.path.join("tools", "README.md"),
                  os.path.join("reports", "README.md")]:
        p = os.path.join(ROOT, fixed)
        if os.path.isfile(p):
            found.add(p)
    docs = os.path.join(ROOT, "docs")
    if os.path.isdir(docs):
        for name in os.listdir(docs):
            if re.match(r"(?i)(index|readme)", name) and os.path.isfile(os.path.join(docs, name)):
                found.add(os.path.join(docs, name))
    for pattern in ["rnd/*/README.md", "tools/*/README.md", "reports/*/README.md"]:
        found.update(glob.glob(os.path.join(ROOT, *pattern.split("/"))))
    return sorted(os.path.normpath(p) for p in found)


def is_external_or_anchor(t):
    return t.startswith(("http://", "https://", "mailto:", "data:", "//", "#")) or not t.strip()


def resolve(base_dir, target):
    p = urllib.parse.unquote(target).split("#", 1)[0].split("?", 1)[0]
    if not p:
        return None
    if p.startswith("/"):
        return os.path.normpath(os.path.join(ROOT, p.lstrip("/")))
    return os.path.normpath(os.path.join(base_dir, p))


def backtick_candidate(tok):
    if "://" in tok or tok.startswith(("~", "/")) or re.match(r"^[A-Za-z]:", tok):
        return None
    t = tok.split("::", 1)[0]
    t = re.sub(r":\d+(-\d+)?$", "", t)
    t = t.rstrip(".,;:")
    if not t or any(c in GLOB_OR_PLACEHOLDER for c in t):
        return None
    if "/" in t or PATH_EXT.search(t):
        return t
    return None


def gitignored(full):
    r = subprocess.run(["git", "-C", ROOT, "check-ignore", "-q", full], capture_output=True)
    return r.returncode == 0


def main():
    files = collect_files()
    broken = []
    checked = 0
    for path in files:
        base_dir = os.path.dirname(path)
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        with open(path, encoding="utf-8", errors="replace") as fh:
            lines = fh.read().splitlines()
        for lineno, line in enumerate(lines, start=1):
            seen = set()
            for m in MD_LINK.finditer(line):
                seen.add(("md", m.group(1)))
            for m in HTML_A.finditer(line):
                seen.add(("html", m.group(1)))
            for m in BACKTICK.finditer(line):
                cand = backtick_candidate(m.group(1))
                if cand:
                    seen.add(("tick", cand))
            for kind, target in sorted(seen):
                if kind != "tick" and is_external_or_anchor(target):
                    continue
                if kind == "tick" and target.startswith("#"):
                    continue
                full = resolve(base_dir, target)
                if full is None:
                    continue
                checked += 1
                if target in ALLOW or target.startswith(BRANCH_PREFIXES):
                    continue
                if kind == "tick":
                    bare = urllib.parse.unquote(target).split("#", 1)[0]
                    ok = (os.path.exists(full) or os.path.exists(os.path.normpath(os.path.join(ROOT, bare)))
                          or os.path.exists(os.path.join(ROOT, "js", bare)) or gitignored(full + ("/" if target.endswith("/") else "")))
                else:
                    ok = os.path.exists(full)
                if not ok:
                    broken.append((rel, lineno, target))
    for rel, lineno, target in broken:
        print(f"{rel}:{lineno} -> {target}")
    print(f"broken={len(broken)} checked={checked}")
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
