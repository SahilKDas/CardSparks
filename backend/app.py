"""Sidekick AI's zero-dependency HTTP API and production static server."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


class SidekickHandler(BaseHTTPRequestHandler):
    server_version = "SidekickAI/0.1"

    def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        path = urlparse(self.path).path
        if path == "/api/health":
            self.send_json(200, {"status": "ok", "service": "sidekick"})
            return
        self.serve_frontend(path)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5173")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def serve_frontend(self, path: str) -> None:
        dist = ROOT / "dist"
        requested = dist / path.lstrip("/")
        target = requested if requested.is_file() else dist / "index.html"
        if not target.is_file():
            self.send_json(404, {"error": "Frontend not built. Run npm run build."})
            return
        mime = "text/html" if target.suffix == ".html" else (
            "text/css" if target.suffix == ".css" else "application/javascript"
        )
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[sidekick] {fmt % args}")


def create_server(host: str = "127.0.0.1", port: int = 8000) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), SidekickHandler)


if __name__ == "__main__":
    print("Sidekick AI is running at http://localhost:8000")
    create_server().serve_forever()

