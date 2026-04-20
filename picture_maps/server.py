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
from .crop_stats import build_crop_summary_payload
from .layers import generate_demo_layers_runtime
from .pest_detections import load_pest_detections
from .tasks import generate_tasks
from .trends import generate_trends


TILE_RE = re.compile(r"^/tiles/([^/]+)/([^/]+)/(\d+)/(\d+)/(\d+)\.(png|jpg)$")
IMAGE_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/image/(\d+)/([a-z_]+)\.jpg$")
CONTACT_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/contact-sheet/(\d+)\.jpg$")
SESSION_MANIFEST_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/manifest$")
SESSION_FRAMES_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/frames$")
SESSION_INSIGHTS_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/insights$")
SESSION_REPORT_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/report$")
SESSION_LAYERS_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/layers$")
SESSION_TASKS_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/tasks$")
SESSION_TRENDS_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/trends$")
SESSION_CROP_SUMMARY_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/crop-summary$")
SESSION_PEST_DETECTIONS_RE = re.compile(r"^/api/devices/([^/]+)/sessions/([^/]+)/pest-detections$")


class SessionData:
    def __init__(self, config: BuildConfig):
        self.config = config
        self.manifest: dict[str, Any] = json.loads(config.manifest_path.read_text(encoding="utf-8"))
        self.frames: dict[str, Any] = json.loads(config.frames_path.read_text(encoding="utf-8"))
        self.server_index: dict[str, Any] = json.loads(config.server_index_path.read_text(encoding="utf-8"))
        self.insights: dict[str, Any] | None = None
        if config.insights_path.exists():
            try:
                self.insights = json.loads(config.insights_path.read_text(encoding="utf-8"))
            except Exception:
                pass
        self.layers: dict[str, Any] | None = None
        if config.layers_path.exists():
            try:
                self.layers = json.loads(config.layers_path.read_text(encoding="utf-8"))
            except Exception:
                pass
        self.tasks: dict[str, Any] | None = None
        self.trends: dict[str, Any] | None = None
        self.crop_counts: dict[str, Any] | None = None


class PictureMapsHandler(SimpleHTTPRequestHandler):
    server_version = "PictureMaps/0.1"
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, web_root: Path, sessions: dict[tuple[str, str], SessionData], **kwargs):
        self.web_root = web_root
        self.sessions = sessions
        super().__init__(*args, directory=str(web_root), **kwargs)

    def log_message(self, format: str, *args) -> None:
        return

    def end_headers(self) -> None:
        if getattr(self, "_serving_static", False):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        self.handle_request(send_body=True)

    def do_HEAD(self) -> None:
        self.handle_request(send_body=False)

    def handle_request(self, *, send_body: bool) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/debug":
            debug_info = {}
            for (device, session), data in sorted(self.sessions.items()):
                key = f"{device}/{session}"
                tiles_dir = str(data.config.tiles_dir)
                sample = data.config.tiles_dir / "3" / "0" / "0.jpg"
                debug_info[key] = {
                    "tiles_dir": tiles_dir,
                    "tiles_dir_exists": data.config.tiles_dir.exists(),
                    "sample_tile_exists": sample.exists(),
                    "dataset_dir": str(data.config.dataset_dir),
                    "dataset_key": data.config.dataset_key,
                }
            self.serve_json(debug_info, send_body=send_body)
            return

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

        insights_match = SESSION_INSIGHTS_RE.match(path)
        if insights_match:
            device, session = insights_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            if data.insights is None:
                self.serve_json({"available": False, "session": {}, "rails": {}, "frames": {}, "alerts": [], "report": {}}, send_body=send_body)
            else:
                self.serve_json({"available": True, **data.insights}, send_body=send_body)
            return

        report_match = SESSION_REPORT_RE.match(path)
        if report_match:
            device, session = report_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            if data.insights is None:
                self.serve_json({"available": False, "report": {}}, send_body=send_body)
            else:
                self.serve_json({"available": True, "report": data.insights.get("report", {}), "session": data.insights.get("session", {})}, send_body=send_body)
            return

        layers_match = SESSION_LAYERS_RE.match(path)
        if layers_match:
            device, session = layers_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            if data.layers is not None:
                self.serve_json(data.layers, send_body=send_body)
            else:
                # Runtime fallback: generate demo layers from manifest + frames
                manifest = data.manifest
                frames = data.frames.get("items", [])
                rails = manifest.get("rails", [])
                world = manifest.get("world", {})
                generated = generate_demo_layers_runtime(
                    session_key=manifest.get("dataset_key", session),
                    rails=rails,
                    frames=frames,
                    odom_x_min=world.get("odom_x_min", 0.0),
                    odom_x_max=world.get("odom_x_max", 10.0),
                    step_m=world.get("sample_step_m", 0.5),
                )
                data.layers = generated
                self.serve_json(generated, send_body=send_body)
            return

        tasks_match = SESSION_TASKS_RE.match(path)
        if tasks_match:
            device, session = tasks_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            if data.tasks is None:
                # Ensure layers are generated first
                if data.layers is None:
                    manifest = data.manifest
                    frames = data.frames.get("items", [])
                    rails = manifest.get("rails", [])
                    world = manifest.get("world", {})
                    data.layers = generate_demo_layers_runtime(
                        session_key=manifest.get("dataset_key", session),
                        rails=rails,
                        frames=frames,
                        odom_x_min=world.get("odom_x_min", 0.0),
                        odom_x_max=world.get("odom_x_max", 10.0),
                        step_m=world.get("sample_step_m", 0.5),
                    )
                data.tasks = generate_tasks(
                    session_key=data.manifest.get("dataset_key", session),
                    layers=data.layers,
                )
            self.serve_json(data.tasks, send_body=send_body)
            return

        trends_match = SESSION_TRENDS_RE.match(path)
        if trends_match:
            device, session = trends_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            if data.trends is None:
                if data.layers is None:
                    manifest = data.manifest
                    frames = data.frames.get("items", [])
                    rails = manifest.get("rails", [])
                    world = manifest.get("world", {})
                    data.layers = generate_demo_layers_runtime(
                        session_key=manifest.get("dataset_key", session),
                        rails=rails,
                        frames=frames,
                        odom_x_min=world.get("odom_x_min", 0.0),
                        odom_x_max=world.get("odom_x_max", 10.0),
                        step_m=world.get("sample_step_m", 0.5),
                    )
                data.trends = generate_trends(
                    session_key=data.manifest.get("dataset_key", session),
                    layers=data.layers,
                    manifest=data.manifest,
                )
            self.serve_json(data.trends, send_body=send_body)
            return

        crop_summary_match = SESSION_CROP_SUMMARY_RE.match(path)
        if crop_summary_match:
            device, session = crop_summary_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            payload = build_crop_summary_payload(
                device_name=device,
                session_name=session,
                manifest=data.manifest,
                cached_counts=data.crop_counts,
                sessions=self.sessions,
            )
            data.crop_counts = {
                "source": payload.get("source", "runtime"),
                "counts": payload.get("counts", {}),
            }
            self.serve_json(payload, send_body=send_body)
            return

        pest_detections_match = SESSION_PEST_DETECTIONS_RE.match(path)
        if pest_detections_match:
            device, session = pest_detections_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            payload = load_pest_detections(
                config=data.config,
                manifest=data.manifest,
                frames_payload=data.frames,
            )
            self.serve_json(payload, send_body=send_body)
            return

        tile_match = TILE_RE.match(path)
        if tile_match:
            device, session, z, x, y, _ext = tile_match.groups()
            data = self.sessions.get((device, session))
            if not data:
                self.send_error(HTTPStatus.NOT_FOUND, "Session not found")
                return
            tile_path = data.config.tiles_dir / z / x / f"{y}.jpg"
            if tile_path.exists():
                self.serve_file(tile_path, send_body=send_body, cache_seconds=3600)
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
            self.serve_file(Path(camera["path"]), send_body=send_body, cache_seconds=3600)
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
            self.serve_file(Path(frame["contact_sheet_path"]), send_body=send_body, cache_seconds=3600)
            return

        if path == "/":
            self.path = "/index.html"
        elif path.startswith("/api/"):
            self.send_error(HTTPStatus.NOT_FOUND, "API not found")
            return

        self._serving_static = True
        if send_body:
            super().do_GET()
        else:
            super().do_HEAD()
        self._serving_static = False

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

    def serve_file(self, path: Path, *, send_body: bool = True, cache_seconds: int = 0) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return
        mime_type, _ = mimetypes.guess_type(str(path))
        stat = path.stat()
        etag = f'"{int(stat.st_mtime)}-{stat.st_size}"'

        if self.headers.get("If-None-Match") == etag:
            self.send_response(HTTPStatus.NOT_MODIFIED)
            self.end_headers()
            return

        data = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("ETag", etag)
        if cache_seconds > 0:
            self.send_header("Cache-Control", f"public, max-age={cache_seconds}")
        else:
            self.send_header("Cache-Control", "no-store")
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
