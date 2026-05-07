#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path


DEFAULT_PROJECT_DIR = Path(__file__).resolve().parent / "runs" / "train"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a YOLO detector for the farm map viewer.")
    parser.add_argument("--data", type=Path, required=True, help="Path to Roboflow data.yaml.")
    parser.add_argument("--model", default="yolo11n.pt", help="Base YOLO model or checkpoint path.")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=-1, help="Ultralytics batch size. -1 auto-selects.")
    parser.add_argument("--device", default=None, help="CUDA device like 0, cpu, or leave unset for auto.")
    parser.add_argument("--project-dir", type=Path, default=DEFAULT_PROJECT_DIR)
    parser.add_argument("--name", default="tomato_czcyh_v2")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--patience", type=int, default=30)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_yaml = args.data.expanduser().resolve()
    if not data_yaml.exists():
        raise SystemExit(f"data.yaml not found: {data_yaml}")

    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise SystemExit(
            "The ultralytics package is not installed. Run: pip install -r detection/requirements.txt",
        ) from exc

    model = YOLO(args.model)
    train_args = {
        "data": str(data_yaml),
        "epochs": args.epochs,
        "imgsz": args.imgsz,
        "batch": args.batch,
        "project": str(args.project_dir.expanduser().resolve()),
        "name": args.name,
        "workers": args.workers,
        "patience": args.patience,
    }
    if args.device is not None:
        train_args["device"] = args.device

    result = model.train(**train_args)
    print(result)


if __name__ == "__main__":
    main()

