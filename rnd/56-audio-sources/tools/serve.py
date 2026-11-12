"""Tiny static server for the #56 side page: HTTP Range support, optional CORS, no dependency.

    python tools/serve.py --root <dir> --port 8770            # the page + the offline audio folder (same origin)
    python tools/serve.py --root <dir> --port 8771 --cors --no-range   # the mock "cloud": another origin, CORS on, Range ignored like Cloudflare Pages
    python tools/serve.py --root <repo> --port 8772 --map config.json=<file>   # serve a different file at one URL path (preview config)

Two ports on 127.0.0.1 are two origins, so the page's "cloud" source is a real cross-origin request.
Binds to 127.0.0.1 only. Not a production server.
"""
import argparse, email.utils, mimetypes, os, re, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

if sys.stdout is not None:  # pythonw has no console streams
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("audio/mpeg", ".mp3")
mimetypes.add_type("audio/wav", ".wav")
mimetypes.add_type("application/json", ".json")


def make_handler(root, cors, maps=None, ranges=True):
    root = os.path.realpath(root)
    maps = {"/" + k.lstrip("/"): os.path.realpath(v) for k, v in (maps or {}).items()}  # leading slash optional (Git-Bash rewrites it)

    class H(BaseHTTPRequestHandler):
        server_version = "dmv-side/1"

        def log_message(self, fmt, *a):
            if sys.stderr is not None and os.environ.get("SERVE_QUIET") != "1":
                sys.stderr.write("%s %s\n" % (self.address_string(), fmt % a))

        def _cors(self):
            if cors:
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Headers", "Range, Content-Type")
                self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                self.send_header("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges")

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors()
            self.send_header("Content-Length", "0")
            self.end_headers()

        def _path(self):
            urlpath = unquote(urlparse(self.path).path)
            if urlpath in maps and os.path.isfile(maps[urlpath]):
                return maps[urlpath]
            rel = urlpath.lstrip("/") or "index.html"
            full = os.path.realpath(os.path.join(root, rel))
            if os.path.commonpath([full, root]) != root:
                return None
            if os.path.isdir(full):
                full = os.path.join(full, "index.html")
            return full if os.path.isfile(full) else None

        def _serve(self, head):
            full = self._path()
            if not full:
                body = b"not found"
                self.send_response(404)
                self._cors()
                self.send_header("Content-Type", "text/plain")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if not head:
                    self.wfile.write(body)
                return
            size = os.path.getsize(full)
            ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
            start, end, status = 0, size - 1, 200
            m = re.match(r"bytes=(\d*)-(\d*)$", self.headers.get("Range", "").strip()) if ranges else None   # ranges=False models Cloudflare Pages: 200 + full body
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    start = int(m.group(1))
                    end = int(m.group(2)) if m.group(2) else size - 1
                else:
                    start = max(0, size - int(m.group(2)))
                end = min(end, size - 1)
                if start > end or start >= size:
                    self.send_response(416)
                    self._cors()
                    self.send_header("Content-Range", "bytes */%d" % size)
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                status = 206
            self.send_response(status)
            self._cors()
            self.send_header("Content-Type", ctype)
            if ranges:
                self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Last-Modified", email.utils.formatdate(os.path.getmtime(full), usegmt=True))
            if status == 206:
                self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
            self.send_header("Content-Length", str(end - start + 1))
            self.end_headers()
            if head:
                return
            try:
                with open(full, "rb") as f:
                    f.seek(start)
                    left = end - start + 1
                    while left > 0:
                        chunk = f.read(min(65536, left))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        left -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass  # the browser aborted a media request (seek); not an error

        def do_GET(self):
            self._serve(False)

        def do_HEAD(self):
            self._serve(True)

    return H


def start(root, port, cors=False, maps=None, ranges=True):
    """Start in a thread (used by the tests); returns the server (call .shutdown())."""
    srv = ThreadingHTTPServer(("127.0.0.1", port), make_handler(root, cors, maps, ranges))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--port", type=int, required=True)
    ap.add_argument("--cors", action="store_true")
    ap.add_argument("--no-range", action="store_true", help="ignore Range headers (200 + full body, no Accept-Ranges), like Cloudflare Pages")
    ap.add_argument("--map", action="append", default=[], help="URLPATH=FILE: serve FILE at URLPATH (repeatable)")
    a = ap.parse_args()
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), make_handler(a.root, a.cors, dict(m.split("=", 1) for m in a.map), not a.no_range))
    if sys.stdout is not None:
        print("serving %s on http://127.0.0.1:%d/ cors=%s" % (a.root, a.port, a.cors), flush=True)
    srv.serve_forever()
