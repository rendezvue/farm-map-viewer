#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path


DEFAULT_SOURCE = Path("/root/docker_share/raw_video_datas/tomato_tokuiten_frames_jpg")
DEFAULT_DB_ROOT = Path("/mnt/nas_rdv_md3/uv_camera_db")
DEFAULT_HOST = "tomato_tokuiten_host"
DEFAULT_SESSION = "20260507_130000"
FRAME_NUMBER_RE = re.compile(r"frame_(\d+)", re.IGNORECASE)


def frame_number(path: Path) -> int:
    match = FRAME_NUMBER_RE.search(path.stem)
    if match:
        return int(match.group(1))
    digits = "".join(ch for ch in path.stem if ch.isdigit())
    return int(digits) if digits else 0


def stride_order(files: list[Path], stride: int) -> list[Path]:
    ordered: list[Path] = []
    for offset in range(stride):
        ordered.extend(files[offset::stride])
    return ordered


def odom_for_position(position: int, count: int, rail_length_m: float) -> float:
    if count <= 1:
        return 0.0
    return position * rail_length_m / (count - 1)


def build_session(args: argparse.Namespace) -> Path:
    source = args.source.expanduser().resolve()
    if not source.exists():
        raise SystemExit(f"Source directory not found: {source}")

    files = sorted(source.glob("*.jpg"), key=frame_number)
    needed = args.rails * args.frames_per_rail
    selected = stride_order(files, args.stride)[:needed]
    if len(selected) < needed:
        raise SystemExit(f"Need {needed} images, found {len(selected)}")

    session_dir = args.db_root.expanduser().resolve() / args.host / args.session
    if session_dir.exists():
        if not args.replace:
            raise SystemExit(f"Session already exists: {session_dir}. Use --replace to refresh it.")
        shutil.rmtree(session_dir)

    for rail_index in range(args.rails):
        images_dir = session_dir / f"rail_{rail_index + 1:03d}" / "images"
        images_dir.mkdir(parents=True, exist_ok=True)
        for position in range(args.frames_per_rail):
            source_image = selected[rail_index * args.frames_per_rail + position]
            source_number = frame_number(source_image)
            odom_x = odom_for_position(position, args.frames_per_rail, args.rail_length_m)
            dest_name = f"{source_number:06d}_snap_{odom_x:.3f}m_{args.camera}.jpg"
            (images_dir / dest_name).symlink_to(source_image)

    manifest = {
        "source": str(source),
        "host": args.host,
        "session": args.session,
        "camera": args.camera,
        "rails": args.rails,
        "frames_per_rail": args.frames_per_rail,
        "stride": args.stride,
        "rail_length_m": args.rail_length_m,
        "mapping": [
            {
                "rail": f"rail_{idx // args.frames_per_rail + 1:03d}",
                "position": idx % args.frames_per_rail,
                "odom_x": odom_for_position(idx % args.frames_per_rail, args.frames_per_rail, args.rail_length_m),
                "source": image.name,
            }
            for idx, image in enumerate(selected)
        ],
    }
    (session_dir / "virtual_session_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return session_dir


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a portrait single-camera tomato sample session.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--db-root", type=Path, default=DEFAULT_DB_ROOT)
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--session", default=DEFAULT_SESSION)
    parser.add_argument("--rails", type=int, default=10)
    parser.add_argument("--frames-per-rail", type=int, default=51)
    parser.add_argument("--stride", type=int, default=40)
    parser.add_argument("--rail-length-m", type=float, default=50.0)
    parser.add_argument("--camera", default="front_left")
    parser.add_argument("--replace", action="store_true")
    return parser.parse_args()


def main() -> None:
    session_dir = build_session(parse_args())
    print(session_dir)


if __name__ == "__main__":
    main()
