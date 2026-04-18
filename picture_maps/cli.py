from __future__ import annotations

import argparse
import threading
from pathlib import Path

from .builder import build_dataset
from .config import BuildConfig, DEFAULT_DATASET, DEFAULT_DB_ROOT
from .server import SessionData, serve
from .watcher import SessionWatcher, _discover_sessions


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build and serve a tiled farm picture map.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    build_sub = subparsers.add_parser("build", help="scan the dataset and build tile pyramid output")
    add_common_args(build_sub)

    serve_sub = subparsers.add_parser("serve", help="serve the map with background auto-build")
    add_common_args(serve_sub)
    serve_sub.add_argument("--host", default="0.0.0.0", help="bind host")
    serve_sub.add_argument("--port", default=8090, type=int, help="bind port")
    serve_sub.add_argument(
        "--db-root",
        type=Path,
        default=None,
        help=f"scan all devices/sessions under this directory (default: {DEFAULT_DB_ROOT})",
    )
    serve_sub.add_argument(
        "--scan-interval",
        type=int,
        default=120,
        help="seconds between NAS scans for new sessions (default: 120)",
    )
    return parser


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--dataset", type=Path, default=None, help="single session directory")
    parser.add_argument(
        "--build-root",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "build",
        help="directory where generated tiles and manifests are written",
    )
    parser.add_argument("--rail-spacing", default=3.0, type=float)
    parser.add_argument("--cell-width", default=320, type=int)
    parser.add_argument("--cell-height", default=180, type=int)


def make_config(dataset_dir: Path, args: argparse.Namespace) -> BuildConfig:
    return BuildConfig(
        dataset_dir=dataset_dir.expanduser().resolve(),
        build_root=args.build_root.expanduser().resolve(),
        rail_spacing_m=args.rail_spacing,
        cell_width=args.cell_width,
        cell_height=args.cell_height,
    )


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    build_root = args.build_root.expanduser().resolve()
    web_root = Path(__file__).resolve().parents[1] / "web"

    if args.command == "build":
        dataset_dir = (args.dataset or DEFAULT_DATASET).expanduser().resolve()
        if not dataset_dir.exists():
            raise SystemExit(f"Dataset not found: {dataset_dir}")
        config = make_config(dataset_dir, args)
        manifest = build_dataset(config)
        print(f'Built {manifest["summary"]["frame_count"]} frames into {config.output_dir}')
        return

    if args.command == "serve":
        db_root = args.db_root
        if db_root is None and args.dataset is None:
            db_root = DEFAULT_DB_ROOT

        sessions: dict[tuple[str, str], SessionData] = {}
        lock = threading.Lock()

        if db_root is not None:
            db_root = db_root.expanduser().resolve()
            if not db_root.exists():
                raise SystemExit(f"DB root not found: {db_root}")

            # 이미 빌드된 세션만 즉시 로드
            for session_dir in _discover_sessions(db_root):
                device = session_dir.parent.name
                session = session_dir.name
                config = BuildConfig(
                    dataset_dir=session_dir.resolve(),
                    build_root=build_root,
                    rail_spacing_m=args.rail_spacing,
                    cell_width=args.cell_width,
                    cell_height=args.cell_height,
                )
                if config.manifest_path.exists():
                    sessions[(device, session)] = SessionData(config)

            # 백그라운드 watcher 시작 (새 세션 감지 + 빌드)
            watcher = SessionWatcher(
                db_root=db_root,
                build_root=build_root,
                sessions=sessions,
                lock=lock,
                scan_interval=args.scan_interval,
                rail_spacing=args.rail_spacing,
                cell_width=args.cell_width,
                cell_height=args.cell_height,
            )
            watcher.start()

        else:
            dataset_dir = args.dataset.expanduser().resolve()
            if not dataset_dir.exists():
                raise SystemExit(f"Dataset not found: {dataset_dir}")
            config = make_config(dataset_dir, args)
            device = dataset_dir.parent.name
            session = dataset_dir.name
            if config.manifest_path.exists():
                sessions[(device, session)] = SessionData(config)
            # 단일 세션도 watcher로 관리
            watcher = SessionWatcher(
                db_root=dataset_dir.parent.parent,
                build_root=build_root,
                sessions=sessions,
                lock=lock,
                scan_interval=args.scan_interval,
            )
            watcher.start()

        serve(sessions, lock, host=args.host, port=args.port, web_root=web_root)
        return

    raise SystemExit(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()
