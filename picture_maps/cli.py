from __future__ import annotations

import argparse
from pathlib import Path

from .builder import build_dataset
from .config import BuildConfig, DEFAULT_DATASET
from .server import serve


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build and serve a tiled farm picture map.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    build_parser = subparsers.add_parser("build", help="scan the dataset and build tile pyramid output")
    add_common_args(build_parser)

    serve_parser = subparsers.add_parser("serve", help="serve the already-built map, optionally rebuilding first")
    add_common_args(serve_parser)
    serve_parser.add_argument("--host", default="0.0.0.0", help="bind host")
    serve_parser.add_argument("--port", default=8090, type=int, help="bind port")
    serve_parser.add_argument("--rebuild", action="store_true", help="rebuild before starting the server")
    return parser


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET,
        help=f"session directory containing rail_* folders (default: {DEFAULT_DATASET})",
    )
    parser.add_argument(
        "--build-root",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "build",
        help="directory where generated tiles and manifests are written",
    )
    parser.add_argument("--rail-spacing", default=3.0, type=float, help="distance between rails in meters")
    parser.add_argument("--cell-width", default=320, type=int, help="contact sheet cell width in pixels")
    parser.add_argument("--cell-height", default=180, type=int, help="contact sheet cell height in pixels")


def make_config(args: argparse.Namespace) -> BuildConfig:
    return BuildConfig(
        dataset_dir=args.dataset.expanduser().resolve(),
        build_root=args.build_root.expanduser().resolve(),
        rail_spacing_m=args.rail_spacing,
        cell_width=args.cell_width,
        cell_height=args.cell_height,
    )


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    config = make_config(args)

    if not config.dataset_dir.exists():
        raise SystemExit(f"Dataset not found: {config.dataset_dir}")

    if args.command == "build":
        manifest = build_dataset(config)
        print(f'Built {manifest["summary"]["frame_count"]} frames into {config.output_dir}')
        return

    if args.command == "serve":
        if args.rebuild or not config.manifest_path.exists():
            manifest = build_dataset(config)
            print(f'Built {manifest["summary"]["frame_count"]} frames into {config.output_dir}')
        web_root = Path(__file__).resolve().parents[1] / "web"
        serve(config, host=args.host, port=args.port, web_root=web_root)
        return

    raise SystemExit(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()
