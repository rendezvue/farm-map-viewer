from __future__ import annotations

import re
import statistics
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError


CAMERA_ORDER = ("front_left", "front_right", "rear", "side")
CAMERA_NAMES = set(CAMERA_ORDER)
USER_COMMENT_TAG = 37510
IMAGE_DESCRIPTION_TAG = 270
ODOM_X_RE = re.compile(r"odom_x\s*[:=]\s*([-+]?\d+(?:\.\d+)?)", re.IGNORECASE)
FILENAME_X_RE = re.compile(r"snap_([+-]?\d+(?:\.\d+)?)m", re.IGNORECASE)
SEQ_RE = re.compile(r"^(\d+)_")


def parse_rail_number(name: str) -> int:
    digits = "".join(ch for ch in name if ch.isdigit())
    return int(digits) if digits else 0


def parse_camera_name(stem: str) -> str | None:
    for camera in CAMERA_ORDER:
        if stem.endswith(f"_{camera}"):
            return camera
    return None


def parse_seq_index(stem: str) -> int | None:
    match = SEQ_RE.match(stem)
    if not match:
        return None
    return int(match.group(1))


def parse_exif_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        text = value.decode("utf-8", errors="ignore")
    else:
        text = str(value)
    if text.startswith("ASCII\x00\x00\x00"):
        text = text[8:]
    return text.replace("\x00", "").strip()


def filename_odom_x(path: Path) -> float | None:
    match = FILENAME_X_RE.search(path.stem)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def extract_image_metadata(image_path: Path) -> dict[str, Any]:
    try:
        with Image.open(image_path) as image:
            exif = image.getexif()
            comment = parse_exif_text(exif.get(USER_COMMENT_TAG) or exif.get(IMAGE_DESCRIPTION_TAG))
            odom_x = None
            if comment:
                match = ODOM_X_RE.search(comment)
                if match:
                    odom_x = float(match.group(1))
            filename_x = filename_odom_x(image_path)
            source = "exif"
            if filename_x is not None and (odom_x is None or abs(odom_x - filename_x) > 0.25):
                odom_x = filename_x
                source = "filename"
            return {
                "odom_x": odom_x,
                "comment": comment,
                "source": source,
                "width": image.size[0],
                "height": image.size[1],
            }
    except (OSError, UnidentifiedImageError):
        filename_x = filename_odom_x(image_path)
        return {
            "odom_x": filename_x,
            "comment": "",
            "source": "filename" if filename_x is not None else "unknown",
            "width": None,
            "height": None,
        }


def infer_step_m(values: list[float]) -> float:
    unique = sorted({round(value, 4) for value in values})
    deltas = [round(unique[idx + 1] - unique[idx], 4) for idx in range(len(unique) - 1)]
    deltas = [delta for delta in deltas if delta > 0.0001]
    if not deltas:
        return 0.5
    return float(statistics.median(deltas))


def scan_dataset(dataset_dir: Path, rail_spacing_m: float) -> dict[str, Any]:
    rail_dirs = sorted(
        [path for path in dataset_dir.iterdir() if path.is_dir() and path.name.startswith("rail_")],
        key=lambda path: parse_rail_number(path.name),
    )
    rails: list[dict[str, Any]] = []
    grouped_frames: dict[tuple[str, int | str], dict[str, Any]] = {}

    for column, rail_dir in enumerate(rail_dirs):
        rail_number = parse_rail_number(rail_dir.name)
        rail_y_m = column * rail_spacing_m
        rails.append(
            {
                "name": rail_dir.name,
                "number": rail_number,
                "column": column,
                "rail_y_m": rail_y_m,
            }
        )
        images_dir = rail_dir / "images"
        if not images_dir.exists():
            continue

        for image_path in sorted(images_dir.glob("*.jpg")):
            camera_name = parse_camera_name(image_path.stem)
            if camera_name not in CAMERA_NAMES:
                continue
            meta = extract_image_metadata(image_path)
            odom_x = meta["odom_x"]
            if odom_x is None:
                continue
            seq_index = parse_seq_index(image_path.stem)
            key_tail: int | str = seq_index if seq_index is not None else f"{odom_x:.4f}"
            frame_key = (rail_dir.name, key_tail)
            frame = grouped_frames.setdefault(
                frame_key,
                {
                    "rail_name": rail_dir.name,
                    "rail_number": rail_number,
                    "rail_column": column,
                "rail_y_m": rail_y_m,
                "odom_x": odom_x,
                "seq_index": seq_index,
                "odom_source": meta["source"],
                "cameras": {},
            },
            )
            if frame["seq_index"] is None and seq_index is not None:
                frame["seq_index"] = seq_index
            frame["odom_x"] = odom_x
            frame["odom_source"] = meta["source"]
            frame["cameras"][camera_name] = {
                "name": camera_name,
                "filename": image_path.name,
                "path": str(image_path),
                "width": meta["width"],
                "height": meta["height"],
                "comment": meta["comment"],
            }

    frames = sorted(
        grouped_frames.values(),
        key=lambda item: (item["rail_column"], item["odom_x"], item["seq_index"] or 0),
    )
    for index, frame in enumerate(frames, start=1):
        frame["id"] = index
        frame["label"] = f'{frame["rail_name"]} @ {frame["odom_x"]:.1f}m'

    x_values = [float(frame["odom_x"]) for frame in frames]
    x_min = min(x_values) if x_values else 0.0
    x_max = max(x_values) if x_values else 0.0
    step_m = infer_step_m(x_values) if x_values else 0.5
    frame_count_by_rail = {rail["name"]: 0 for rail in rails}
    for frame in frames:
        frame_count_by_rail[frame["rail_name"]] += 1
    for rail in rails:
        rail["frame_count"] = frame_count_by_rail.get(rail["name"], 0)

    return {
        "dataset_dir": str(dataset_dir),
        "rails": rails,
        "frames": frames,
        "odom_x_min": x_min,
        "odom_x_max": x_max,
        "step_m": step_m,
    }
