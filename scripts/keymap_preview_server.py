#!/usr/bin/env python3
"""Keymap preview server with auto-refresh.

Watches config/Recollection.keymap and keymap_drawer.yaml for changes,
regenerates keymap.svg via keymap-drawer, and serves an HTML preview
page at http://localhost:3000.
"""

import http.server
import os
import subprocess
import sys
import threading
import time

PORT = 3000
WATCH_FILES = [
    "config/Recollection.keymap",
    "keymap_drawer.yaml",
]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Recollection Keymap Preview</title>
  <style>
    body {{ background: #1a1a2e; color: #eee; font-family: monospace;
           display: flex; flex-direction: column; align-items: center;
           padding: 24px; margin: 0; }}
    h1 {{ font-size: 1rem; letter-spacing: 0.2em; color: #7ecfff; margin-bottom: 16px; }}
    #status {{ font-size: 0.75rem; color: #888; margin-bottom: 12px; }}
    #keymap {{ max-width: 100%; }}
  </style>
</head>
<body>
  <h1>&lt;&lt; RELEASE RECOLLECTION &gt;&gt; — Keymap Preview</h1>
  <div id="status">Watching for changes...</div>
  <div id="keymap">{svg}</div>
  <script>
    let lastMtime = {mtime};
    setInterval(async () => {{
      const r = await fetch('/mtime');
      const t = parseInt(await r.text());
      if (t > lastMtime) {{ lastMtime = t; location.reload(); }}
    }}, 1500);
  </script>
</body>
</html>
"""


def regenerate():
    """Run keymap parse + draw and return (success, message)."""
    try:
        result = subprocess.run(
            ["keymap", "-c", "keymap_drawer.yaml", "parse",
             "-z", "config/Recollection.keymap"],
            capture_output=True, text=True, cwd=ROOT
        )
        if result.returncode != 0:
            return False, result.stderr.strip()

        raw_yaml = result.stdout

        with open(os.path.join(ROOT, "keymap.yaml"), "w") as f:
            f.write(raw_yaml)

        subprocess.run(
            [sys.executable, "scripts/reorder_keymap.py", "keymap.yaml"],
            capture_output=True, text=True, cwd=ROOT
        )

        result2 = subprocess.run(
            ["keymap", "-c", "keymap_drawer.yaml", "draw", "keymap.yaml",
             "--qmk-info-json", "config/Recollection.json",
             "--layout-name", "default_layout"],
            capture_output=True, text=True, cwd=ROOT
        )
        if result2.returncode != 0:
            return False, result2.stderr.strip()

        with open(os.path.join(ROOT, "keymap.svg"), "w") as f:
            f.write(result2.stdout)

        return True, "OK"
    except Exception as e:
        return False, str(e)


def get_mtime():
    """Latest mtime among watched files (as int ms)."""
    t = 0.0
    for rel in WATCH_FILES:
        p = os.path.join(ROOT, rel)
        try:
            t = max(t, os.path.getmtime(p))
        except FileNotFoundError:
            pass
    return int(t * 1000)


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # suppress default access log

    def do_GET(self):
        if self.path == "/mtime":
            body = str(get_mtime()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        elif self.path in ("/", "/index.html"):
            svg_path = os.path.join(ROOT, "keymap.svg")
            try:
                with open(svg_path) as f:
                    svg = f.read()
            except FileNotFoundError:
                svg = "<p style='color:#f88'>keymap.svg not found — generating...</p>"

            html = HTML_TEMPLATE.format(svg=svg, mtime=get_mtime()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)

        else:
            self.send_response(404)
            self.end_headers()


def watch_loop():
    """Poll watched files and regenerate SVG on change."""
    last = get_mtime()
    while True:
        time.sleep(1)
        cur = get_mtime()
        if cur != last:
            last = cur
            print(f"[watch] change detected — regenerating...", flush=True)
            ok, msg = regenerate()
            if ok:
                print(f"[watch] keymap.svg updated", flush=True)
            else:
                print(f"[watch] ERROR: {msg}", flush=True)


if __name__ == "__main__":
    print(f"[preview] Initial generation...", flush=True)
    ok, msg = regenerate()
    print(f"[preview] {'OK' if ok else 'WARN: ' + msg}", flush=True)

    watcher = threading.Thread(target=watch_loop, daemon=True)
    watcher.start()

    server = http.server.HTTPServer(("localhost", PORT), Handler)
    print(f"[preview] Serving at http://localhost:{PORT}", flush=True)
    print(f"[preview] Watching: {', '.join(WATCH_FILES)}", flush=True)
    server.serve_forever()
