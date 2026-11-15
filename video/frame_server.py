"""Serve the built S1 page and collect its frames, then encode with ffmpeg. Python stdlib only.

    cd video && npm run build
    python3 frame_server.py            # http://127.0.0.1:8765/?shot=earthset&mode=render
Frames land in video/frames/<shot>/00000.png...; on /done the server runs
    ffmpeg -framerate <fps> -i frames/<shot>/%05d.png -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p out/<shot>.mp4
Binds 127.0.0.1 only.
"""
from __future__ import annotations

import re
import shutil
import subprocess
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
DIST, FRAMES, OUT = HERE / "dist", HERE / "frames", HERE / "out"
SHOT_RE = re.compile(r"^[a-z0-9-]{1,32}$")


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        shot = q.get("shot", "")
        if not SHOT_RE.match(shot):
            return self.send_error(400, "bad shot")
        if u.path == "/frame":
            i = int(q.get("i", "-1"))
            if not 0 <= i < 100000:
                return self.send_error(400, "bad index")
            d = FRAMES / shot
            if i == 0 and d.exists():
                shutil.rmtree(d)
            d.mkdir(parents=True, exist_ok=True)
            n = int(self.headers.get("Content-Length", 0))
            (d / f"{i:05d}.png").write_bytes(self.rfile.read(n))
            return self._ok()
        if u.path == "/done":
            fps = int(q.get("fps", "30"))
            OUT.mkdir(exist_ok=True)
            cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", str(FRAMES / shot / "%05d.png"),
                   "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", str(OUT / f"{shot}.mp4")]
            print(" ".join(cmd), flush=True)
            r = subprocess.run(cmd)
            print(f"{shot}: {'OK' if r.returncode == 0 else 'ffmpeg failed'} -> {OUT / f'{shot}.mp4'}", flush=True)
            return self._ok()
        self.send_error(404)

    def _ok(self):
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, fmt, *args):  # quiet per-frame logging
        if "/frame" not in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    a = ap.parse_args()
    if not (DIST / "index.html").exists():
        raise SystemExit("video/dist missing: run `npm run build` in video/ first")
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), partial(Handler, directory=str(DIST)))
    print(f"http://127.0.0.1:{a.port}/?shot=earthset&mode=render", flush=True)
    srv.serve_forever()
