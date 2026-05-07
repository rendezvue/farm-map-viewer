#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from picture_maps.dataset import CAMERA_NAMES, scan_dataset  # noqa: E402


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
DEFAULT_RUNS_DIR = Path(__file__).resolve().parent / "runs" / "infer"


@dataclass(frozen=True)
class ImageMeta:
    path: Path
    frame_id: int | None = None
    rail_name: str | None = None
    odom_x: float | None = None
    camera: str | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run YOLO object detection and emit map-compatible pest_detections.json.",
    )
    parser.add_argument("--model", required=True, help="YOLO checkpoint path, e.g. best.pt.")
    parser.add_argument("--source", type=Path, required=True, help="Image file, image folder, or map session folder.")
    parser.add_argument("--output", type=Path, default=None, help="Output JSON. Defaults to session/pest_detections.json.")
    parser.add_argument("--annotate-dir", type=Path, default=None, help="Optional directory for annotated preview images.")
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument(
        "--class-conf",
        default=None,
        help="Optional per-class thresholds, e.g. raw=0.08,midi=0.12,ripe=0.22.",
    )
    parser.add_argument("--iou", type=float, default=0.7)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--device", default=None)
    parser.add_argument("--limit", type=int, default=None, help="Limit image count for smoke tests.")
    parser.add_argument("--stride", type=int, default=1, help="Run every Nth image.")
    parser.add_argument("--chunk-size", type=int, default=32, help="Number of images submitted per predict call.")
    parser.add_argument("--classes", default=None, help="Comma-separated class names or IDs to keep.")
    parser.add_argument("--rail-spacing", type=float, default=3.0, help="Used when scanning map sessions.")
    parser.add_argument("--source-name", default="roboflow-yolo")
    return parser.parse_args()


def is_image(path: Path) -> bool:
    return path.suffix.lower() in IMAGE_EXTENSIONS


def is_map_session(path: Path) -> bool:
    if not path.is_dir():
        return False
    return any((child / "images").is_dir() for child in path.iterdir() if child.is_dir() and child.name.startswith("rail_"))


def collect_plain_images(source: Path) -> list[ImageMeta]:
    if source.is_file():
        if not is_image(source):
            raise SystemExit(f"Unsupported image type: {source}")
        return [ImageMeta(source.resolve())]

    images = [
        path.resolve()
        for path in source.rglob("*")
        if path.is_file() and is_image(path)
    ]
    return [ImageMeta(path) for path in sorted(images)]


def collect_session_images(source: Path, rail_spacing: float) -> list[ImageMeta]:
    payload = scan_dataset(source, rail_spacing)
    items: list[ImageMeta] = []
    for frame in payload.get("frames", []):
        for camera_name, camera in sorted(frame.get("cameras", {}).items()):
            if camera_name not in CAMERA_NAMES:
                continue
            image_path = Path(camera.get("path", "")).expanduser()
            if not image_path.exists():
                continue
            items.append(
                ImageMeta(
                    path=image_path.resolve(),
                    frame_id=int(frame["id"]),
                    rail_name=str(frame.get("rail_name") or ""),
                    odom_x=float(frame.get("odom_x", 0.0) or 0.0),
                    camera=camera_name,
                ),
            )
    return sorted(items, key=lambda item: (item.rail_name or "", item.odom_x or 0.0, item.camera or "", str(item.path)))


def collect_images(source: Path, rail_spacing: float) -> tuple[list[ImageMeta], bool]:
    source = source.expanduser().resolve()
    if not source.exists():
        raise SystemExit(f"Source not found: {source}")
    if is_map_session(source):
        return collect_session_images(source, rail_spacing), True
    return collect_plain_images(source), False


def default_output_path(source: Path, is_session: bool) -> Path:
    if is_session:
        return source.expanduser().resolve() / "growth_detections.json"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return DEFAULT_RUNS_DIR / timestamp / "detections.json"


def severity_from_confidence(confidence: float) -> str:
    if confidence >= 0.75:
        return "high"
    if confidence >= 0.45:
        return "medium"
    return "low"


def parse_class_filter(value: str | None) -> set[str] | None:
    if not value:
        return None
    return {item.strip().lower() for item in value.split(",") if item.strip()}


def parse_class_conf(value: str | None) -> dict[str, float]:
    thresholds: dict[str, float] = {}
    if not value:
        return thresholds
    for chunk in value.split(","):
        if "=" not in chunk:
            continue
        key, raw_threshold = chunk.split("=", 1)
        try:
            threshold = float(raw_threshold.strip())
        except ValueError:
            continue
        key = key.strip().lower()
        if key:
            thresholds[key] = max(0.0, min(1.0, threshold))
    return thresholds


def keep_class(class_id: int, class_name: str, allowed: set[str] | None) -> bool:
    if not allowed:
        return True
    return str(class_id) in allowed or class_name.lower() in allowed


def class_conf_threshold(class_id: int, class_name: str, thresholds: dict[str, float], default: float) -> float:
    return thresholds.get(class_name.lower(), thresholds.get(str(class_id), default))


def safe_stem(path: Path) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", path.stem).strip("_") or "image"


def iter_chunks(items: list[ImageMeta], chunk_size: int) -> list[ImageMeta]:
    step = max(1, chunk_size)
    for start in range(0, len(items), step):
        yield items[start : start + step]


def draw_annotations(image_path: Path, detections: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(image_path) as image:
        canvas = image.convert("RGB")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()

    for item in detections:
        bbox = item.get("bbox") or []
        if len(bbox) < 4:
            continue
        x1, y1, x2, y2 = [float(value) for value in bbox[:4]]
        label = f"{item.get('label', 'object')} {float(item.get('confidence') or 0.0):.2f}"
        color = (148, 255, 196)
        draw.rounded_rectangle((x1, y1, x2, y2), radius=6, outline=color, width=3)
        label_box = draw.textbbox((0, 0), label, font=font)
        label_w = label_box[2] - label_box[0] + 10
        label_h = label_box[3] - label_box[1] + 6
        label_y = max(y1 + 2, 2)
        draw.rounded_rectangle((x1 + 2, label_y, x1 + 2 + label_w, label_y + label_h), radius=4, fill=(226, 255, 239))
        draw.text((x1 + 7, label_y + 3), label, fill=(18, 35, 26), font=font)

    canvas.save(output_path, quality=92)


def main() -> None:
    args = parse_args()
    source = args.source.expanduser().resolve()
    image_items, source_is_session = collect_images(source, args.rail_spacing)
    if args.stride < 1:
        raise SystemExit("--stride must be >= 1")
    image_items = image_items[:: args.stride]
    if args.limit is not None:
        image_items = image_items[: args.limit]
    if not image_items:
        raise SystemExit(f"No images found in: {source}")

    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise SystemExit(
            "The ultralytics package is not installed. Run: pip install -r detection/requirements.txt",
        ) from exc

    model = YOLO(args.model)
    class_filter = parse_class_filter(args.classes)
    class_conf = parse_class_conf(args.class_conf)
    output_json = (args.output or default_output_path(source, source_is_session)).expanduser().resolve()
    output_json.parent.mkdir(parents=True, exist_ok=True)
    if args.annotate_dir:
        annotate_dir = args.annotate_dir.expanduser().resolve()
        annotate_dir.mkdir(parents=True, exist_ok=True)
    else:
        annotate_dir = None

    detections: list[dict[str, Any]] = []
    names = model.names if isinstance(model.names, dict) else {}

    for chunk in iter_chunks(image_items, args.chunk_size):
        image_by_path = {str(item.path): item for item in chunk}
        predict_args: dict[str, Any] = {
            "source": [str(item.path) for item in chunk],
            "conf": args.conf,
            "iou": args.iou,
            "imgsz": args.imgsz,
            "batch": max(1, args.batch),
            "stream": True,
            "verbose": False,
        }
        if args.device is not None:
            predict_args["device"] = args.device

        for result_index, result in enumerate(model.predict(**predict_args)):
            result_path = Path(result.path).resolve()
            meta = image_by_path.get(str(result_path))
            if meta is None and result_index < len(chunk):
                meta = chunk[result_index]
            if meta is None:
                meta = ImageMeta(path=result_path)
            image_detections: list[dict[str, Any]] = []
            boxes = result.boxes
            if boxes is None:
                continue

            for box_index, box in enumerate(boxes):
                class_id = int(box.cls.item())
                class_name = str(names.get(class_id, class_id))
                if not keep_class(class_id, class_name, class_filter):
                    continue
                confidence = float(box.conf.item())
                if confidence < class_conf_threshold(class_id, class_name, class_conf, args.conf):
                    continue
                coords = [round(float(value), 2) for value in box.xyxy[0].tolist()]
                detection_id = f"det_{safe_stem(meta.path)}_{box_index + 1:03d}"
                item: dict[str, Any] = {
                    "id": detection_id,
                    "class_id": class_id,
                    "severity": severity_from_confidence(confidence),
                    "label": class_name,
                    "confidence": round(confidence, 4),
                    "camera": meta.camera,
                    "bbox": coords,
                    "source": args.source_name,
                    "image_path": str(meta.path),
                }
                if meta.frame_id is not None:
                    item["frame_id"] = meta.frame_id
                if meta.rail_name:
                    item["rail_name"] = meta.rail_name
                if meta.odom_x is not None:
                    item["odom_x"] = round(meta.odom_x, 3)
                detections.append(item)
                image_detections.append(item)

            if annotate_dir and image_detections:
                relative_name = f"{safe_stem(meta.path)}_det.jpg"
                if meta.rail_name:
                    relative_name = f"{meta.rail_name}_{meta.odom_x:06.2f}m_{safe_stem(meta.path)}_det.jpg"
                draw_annotations(meta.path, image_detections, annotate_dir / relative_name)

        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass

    payload = {
        "source": args.source_name,
        "model": str(args.model),
        "image_count": len(image_items),
        "detection_count": len(detections),
        "detections": detections,
    }
    output_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Images: {len(image_items)}")
    print(f"Detections: {len(detections)}")
    print(f"Wrote: {output_json}")
    if annotate_dir:
        print(f"Annotated previews: {annotate_dir}")


if __name__ == "__main__":
    main()
