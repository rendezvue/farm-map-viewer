from __future__ import annotations

import json
import mimetypes
import posixpath
import re
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .config import BuildConfig


TILE_RE = re.compile(r"^/tiles/([^/]+)/([^/]+)/(\d+)/(\d+)/(\d+)\.png$")
IMAGE_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/image/(\d+)/([a-z_]+)\.jpg$")
CONTACT_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/contact-sheet/(\d+)\.jpg$")
SESSION_MANIFEST_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/manifest$")
SESSION_FRAMES_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/frames$")


class SessionData:
    def __init__(self, config: BuildConfig):
        self.config = config
        self.manifest: dict[str, Any] = json.loads(config.manifest_path.read_text(encoding="utf-8"))
        self.frames: dict[str, Any] = json.loads(config.frames_path.read_text(encoding="utf-8"))
        self.server_index: dict[str, Any] = json.loads(config.server_index_path.read_text(encoding="utf-8"))


class PictureMapsHandler(SimpleHTTPRequestHandler):
    server_version = "PictureMaps/0.1"

    def __init__(self, *args, web_root: Path, sessions: dict[tuple[str, str], SessionData], **kwargs):
        self.web_root = web_root
        self.sessions = sessions
        super().__init__(*args, directory=str(web_root), **kwargs)

    def log_message(self, format: str, *args) -> None:
        return

    def do_GET(self) -> None:
        self.handle_request(send_body=True)

    def do_HEAD(self) -> None:
        self.handle_request(send_body=False)

    def handle_request(self, *, send_body: bool) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/devices":
            devices: dict[str, list[dict[str, Any]]] = {}
            for (device, session), data in sorted(self.sessions.items()):
                m = data.manifest
                devices.setdefault(device, []).append({
                    "name": session,
                    "rail_count": m["summary"]["rail_count"],
                    "frame_count": m["summary"]["frame_count"],
                    "generated_at": m.get("generated_at"),
                })
            result = [{"name": d, "sessions": sessions} for d, sessions in sorted(devices.items())]
            self.serve_json({"devices": result}, send_body=send_body)
            return

        manifest_match = SESSION_MANIFEST_RE.match(path)
        if manifest_match:
            device, session = manifest_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            self.serve_json(data.manifest, send_body=send_body)
            return

        frames_match = SESSION_FRAMES_RE.match(path)
        if frames_match:
            device, session = frames_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            self.serve_json(data.frames, send_body=send_body)
            return

        tile_match = TILE_RE.match(path)
        if tile_match:
            device, session, z, x, y = tile_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            tile_path = data.config.tiles_dir / z / x / f"{y}.png"
            if tile_path.exists():
                self.serve_file(tile_path, send_body=send_body)
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "Tile not found")
            return

        image_match = IMAGE_RE.match(path)
        if image_match:
            device, session, frame_id, camera_name = image_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            frame = data.server_index["frames"].get(frame_id)
            if not frame:
                self.send_error(HTTPStatus.NOT_FOUND, "Frame not found")
                return
            camera = frame["cameras"].get(camera_name)
            if not camera:
                self.send_error(HTTPStatus.NOT_FOUND, "Camera not found")
                return
            self.serve_file(Path(camera["path"]), send_body=send_body)
            return

        contact_match = CONTACT_RE.match(path)
        if contact_match:
            device, session, frame_id = contact_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            frame = data.server_index["frames"].get(frame_id)
            if not frame:
                self.send_error(HTTPStatus.NOT_FOUND, "Frame not found")
                return
            self.serve_file(Path(frame["contact_sheet_path"]), send_body=send_body)
            return

        if path == "/":
            self.path = "/index.html"
        elif path.startswith("/api/"):
            self.send_error(HTTPStatus.NOT_FOUND, "API not found")
            return

        if send_body:
            super().do_GET()
        else:
            super().do_HEAD()

    def translate_path(self, path: str) -> str:
        parsed_path = urlparse(path).path
        normalized = posixpath.normpath(parsed_path).lstrip("/")
        return str(self.web_root / normalized)

    def serve_json(self, payload: dict[str, Any], *, send_body: bool = True) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if send_body:
            self.wfile.write(raw)

    def serve_file(self, path: Path, *, send_body: bool = True) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return
        mime_type, _ = mimetypes.guess_type(str(path))
        data = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if send_body:
            self.wfile.write(data)


def serve(
    sessions: dict[tuple[str, str], SessionData],
    lock: "threading.Lock",
    host: str,
    port: int,
    web_root: Path,
) -> None:
    import threading
    handler = partial(PictureMapsHandler, web_root=web_root, sessions=sessions)
    with ThreadingHTTPServer((host, port), handler) as httpd:
        print(f"Picture Maps server listening on http://{host}:{port}", flush=True)
        for device, session in sorted(sessions):
            print(f"  {device}/{session}", flush=True)
        httpd.serve_forever()
