from __future__ import annotations

import json
import multiprocessing
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from .config import BuildConfig, LAYOUT_ORIENTATION

COOLDOWN_HOURS = 1


def _read_upload_status(session_dir: Path) -> dict[str, Any] | None:
    path = session_dir / "session_upload_status.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _status_snapshot(status: dict[str, Any]) -> dict[str, Any]:
    uploaded_bytes = 0
    for rail in status.get("rails", {}).values():
        uploaded_bytes += rail.get("uploaded_bytes", 0)
    return {
        "updated_at": status.get("updated_at"),
        "uploaded_bytes": uploaded_bytes,
    }


def _read_watcher_state(config: BuildConfig) -> dict[str, Any] | None:
    path = config.output_dir / "watcher.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _write_watcher_state(config: BuildConfig, snapshot: dict[str, Any]) -> None:
    built_at = datetime.now()
    state = {
        "built_at": built_at.isoformat(timespec="seconds"),
        "next_check_after": (built_at + timedelta(hours=COOLDOWN_HOURS)).isoformat(timespec="seconds"),
        "status_snapshot": snapshot,
    }
    config.output_dir.mkdir(parents=True, exist_ok=True)
    (config.output_dir / "watcher.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _needs_build(session_dir: Path, config: BuildConfig) -> bool:
    if not config.manifest_path.exists():
        return True
    try:
        manifest = json.loads(config.manifest_path.read_text(encoding="utf-8"))
        if manifest.get("layout", {}).get("orientation") != LAYOUT_ORIENTATION:
            return True
    except Exception:
        return True
    state = _read_watcher_state(config)
    if state is None:
        return True
    try:
        if datetime.now() < datetime.fromisoformat(state["next_check_after"]):
            return False
    except (KeyError, ValueError):
        pass
    status = _read_upload_status(session_dir)
    if status is None:
        return False
    return _status_snapshot(status) != state.get("status_snapshot", {})


def _discover_sessions(db_root: Path) -> list[Path]:
    sessions = []
    try:
        device_dirs = sorted(db_root.iterdir())
    except OSError:
        return sessions
    for device_dir in device_dirs:
        if not device_dir.is_dir():
            continue
        try:
            session_dirs = sorted(device_dir.iterdir())
        except OSError:
            continue
        for session_dir in session_dirs:
            if not session_dir.is_dir():
                continue
            try:
                has_rail = any(
                    c.is_dir() and c.name.startswith("rail_")
                    for c in session_dir.iterdir()
                )
            except OSError:
                continue
            if has_rail:
                sessions.append(session_dir)
    return sessions


def _watcher_process(
    db_root: Path,
    build_root: Path,
    queue: multiprocessing.Queue,
    scan_interval: int,
    rail_spacing: float,
    cell_width: int,
    cell_height: int,
    gap_y: int,
    rail_track_margin_y: int,
    rail_track_min_tile_height: int,
    rail_track_max_height: int,
) -> None:
    """별도 프로세스에서 실행 - GIL 완전 분리."""
    # 임포트를 여기서 해야 spawn 방식에서 안전
    from .builder import build_dataset

    def make_config(session_dir: Path) -> BuildConfig:
        return BuildConfig(
            dataset_dir=session_dir.resolve(),
            build_root=build_root,
            rail_spacing_m=rail_spacing,
            cell_width=cell_width,
            cell_height=cell_height,
            gap_y=gap_y,
            rail_track_margin_y=rail_track_margin_y,
            rail_track_min_tile_height=rail_track_min_tile_height,
            rail_track_max_height=rail_track_max_height,
        )

    print(f"[watcher] process started (pid={__import__('os').getpid()}, scan every {scan_interval}s)", flush=True)

    while True:
        try:
            for session_dir in _discover_sessions(db_root):
                device = session_dir.parent.name
                session = session_dir.name
                config = make_config(session_dir)

                if not _needs_build(session_dir, config):
                    continue

                print(f"[watcher] building {device}/{session} ...", flush=True)
                try:
                    status = _read_upload_status(session_dir)
                    snapshot = _status_snapshot(status) if status else {}
                    build_dataset(config)
                    _write_watcher_state(config, snapshot)
                    queue.put((device, session))
                    print(f"[watcher] {device}/{session} ready", flush=True)
                except Exception as exc:
                    print(f"[watcher] build failed {device}/{session}: {exc}", flush=True)
                finally:
                    try:
                        import torch
                        if torch.cuda.is_available():
                            torch.cuda.empty_cache()
                    except Exception:
                        pass
        except Exception as exc:
            print(f"[watcher] scan error: {exc}", flush=True)

        time.sleep(scan_interval)


class SessionWatcher:
    """watcher를 별도 프로세스로 실행해 서버 GIL과 완전히 분리."""

    def __init__(
        self,
        db_root: Path,
        build_root: Path,
        sessions: dict,
        lock: threading.Lock,
        scan_interval: int = 120,
        rail_spacing: float = 3.0,
        cell_width: int = 320,
        cell_height: int = 180,
        gap_y: int = 144,
        rail_track_margin_y: int = 30,
        rail_track_min_tile_height: int = 20,
        rail_track_max_height: int = 84,
    ):
        self.db_root = db_root
        self.build_root = build_root
        self.sessions = sessions
        self.lock = lock
        self.scan_interval = scan_interval
        self.rail_spacing = rail_spacing
        self.cell_width = cell_width
        self.cell_height = cell_height
        self.gap_y = gap_y
        self.rail_track_margin_y = rail_track_margin_y
        self.rail_track_min_tile_height = rail_track_min_tile_height
        self.rail_track_max_height = rail_track_max_height

        ctx = multiprocessing.get_context("spawn")
        self._queue: multiprocessing.Queue = ctx.Queue()
        self._process = ctx.Process(
            target=_watcher_process,
            args=(
                db_root,
                build_root,
                self._queue,
                scan_interval,
                rail_spacing,
                cell_width,
                cell_height,
                gap_y,
                rail_track_margin_y,
                rail_track_min_tile_height,
                rail_track_max_height,
            ),
            daemon=True,
            name="session-watcher",
        )
        # 큐에서 완료 신호를 받아 서버 sessions dict에 등록하는 스레드
        self._reader = threading.Thread(target=self._queue_reader, daemon=True, name="watcher-queue-reader")

    def start(self) -> None:
        import atexit
        self._process.start()
        self._reader.start()
        atexit.register(self.stop)
        print(f"Session watcher started (pid={self._process.pid}, scan every {self.scan_interval}s, cooldown {COOLDOWN_HOURS}h)", flush=True)

    def stop(self) -> None:
        if self._process.is_alive():
            self._process.terminate()
            self._process.join(timeout=3)
            if self._process.is_alive():
                self._process.kill()

    def _queue_reader(self) -> None:
        from .server import SessionData

        while True:
            try:
                device, session = self._queue.get()
                session_dir = self.db_root / device / session
                config = BuildConfig(
                    dataset_dir=session_dir.resolve(),
                    build_root=self.build_root,
                    rail_spacing_m=self.rail_spacing,
                    cell_width=self.cell_width,
                    cell_height=self.cell_height,
                    gap_y=self.gap_y,
                    rail_track_margin_y=self.rail_track_margin_y,
                    rail_track_min_tile_height=self.rail_track_min_tile_height,
                    rail_track_max_height=self.rail_track_max_height,
                )
                data = SessionData(config)
                with self.lock:
                    self.sessions[(device, session)] = data
                print(f"[server] session registered: {device}/{session}", flush=True)
            except Exception as exc:
                print(f"[server] queue reader error: {exc}", flush=True)
