"""Static server for the chant-lab book (dmv #57): the #56 server (HTTP Range, 127.0.0.1 only) plus a text type for .md.

    pythonw rnd/57-chant-lab/tools/serve.py --port 8772        # serves the repo root; open /rnd/57-chant-lab/index.html

The book needs the repo root as the web root because it mounts ../56-audio-sources/ and the bundled font in /fonts/.
"""
import argparse, mimetypes, os, sys
from http.server import ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
import importlib.util  # noqa: E402
_spec = importlib.util.spec_from_file_location("serve56", os.path.join(REPO, "rnd", "56-audio-sources", "tools", "serve.py"))
base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)

mimetypes.add_type("text/plain; charset=utf-8", ".md")

def start(root=REPO, port=0):
    return base.start(root, port)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=REPO)
    ap.add_argument("--port", type=int, default=8772)
    a = ap.parse_args()
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), base.make_handler(a.root, False))
    if sys.stdout is not None:
        print("serving %s on http://127.0.0.1:%d/rnd/57-chant-lab/" % (a.root, a.port), flush=True)
    srv.serve_forever()
