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


IMAGE_ROUTE_RE = re.compile(r"^/api/image/(\d+)/([a-z_]+)\.jpg$")
CONTACT_ROUTE_RE = re.compile(r"^/api/contact-sheet/(\d+)\.jpg$")


class PictureMapsHandler(SimpleHTTPRequestHandler):
    server_version = "PictureMaps/0.1"

    def __init__(self, *args, web_root: Path, config: BuildConfig, manifest: dict[str, Any], frames: dict[str, Any], server_index: dict[str, Any], **kwargs):
        self.web_root = web_root
        self.config = config
        self.manifest = manifest
        self.frames = frames
        self.server_index = server_index
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

        if path == "/api/manifest":
            self.serve_json(self.manifest, send_body=send_body)
            return
        if path == "/api/frames":
            self.serve_json(self.frames, send_body=send_body)
            return
        if path.startswith("/tiles/"):
            rel = path[len("/tiles/") :]
            tile_path = self.config.tiles_dir / rel
            if tile_path.exists():
                self.serve_file(tile_path, send_body=send_body)
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "Tile not found")
            return

        image_match = IMAGE_ROUTE_RE.match(path)
        if image_match:
            frame_id, camera_name = image_match.groups()
            frame = self.server_index["frames"].get(frame_id)
            if not frame:
                self.send_error(HTTPStatus.NOT_FOUND, "Frame not found")
                return
            camera = frame["cameras"].get(camera_name)
            if not camera:
                self.send_error(HTTPStatus.NOT_FOUND, "Camera not found")
                return
            self.serve_file(Path(camera["path"]), send_body=send_body)
            return

        contact_match = CONTACT_ROUTE_RE.match(path)
        if contact_match:
            frame_id = contact_match.group(1)
            frame = self.server_index["frames"].get(frame_id)
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
        root = self.web_root
        parsed_path = urlparse(path).path
        normalized = posixpath.normpath(parsed_path).lstrip("/")
        return str(root / normalized)

    def serve_json(self, payload: dict[str, Any], *, send_body: bool = True) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
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
        self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()
        if send_body:
            self.wfile.write(data)


def serve(config: BuildConfig, host: str, port: int, web_root: Path) -> None:
    manifest = json.loads(config.manifest_path.read_text(encoding="utf-8"))
    frames = json.loads(config.frames_path.read_text(encoding="utf-8"))
    server_index = json.loads(config.server_index_path.read_text(encoding="utf-8"))
    handler = partial(
        PictureMapsHandler,
        web_root=web_root,
        config=config,
        manifest=manifest,
        frames=frames,
        server_index=server_index,
    )
    with ThreadingHTTPServer((host, port), handler) as httpd:
        print(f"Picture Maps server listening on http://{host}:{port}")
        print(f"Dataset: {config.dataset_dir}")
        print(f"Build:   {config.output_dir}")
        httpd.serve_forever()
