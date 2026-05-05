#!/usr/bin/env python3
"""Cardinal Editor static server.

Serves the editor/ directory at http://localhost:3001.
"""
import http.server
import os
import socketserver

PORT = 3001
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EDITOR_DIR = os.path.join(ROOT, "editor")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=EDITOR_DIR, **kwargs)


if __name__ == "__main__":
    with socketserver.TCPServer(("localhost", PORT), Handler) as httpd:
        print(f"[cardinal-editor] Serving {EDITOR_DIR} at http://localhost:{PORT}", flush=True)
        httpd.serve_forever()
