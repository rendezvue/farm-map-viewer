#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DEFAULT_WORKSPACE = "project-mtjqr"
DEFAULT_PROJECT = "tomato-czcyh"
DEFAULT_VERSION = 2
DEFAULT_FORMAT = "yolov8"
DEFAULT_OUTPUT_ROOT = SCRIPT_DIR / "datasets"


def load_local_env() -> None:
    """Load simple KEY=VALUE entries from local env files without overwriting shell env."""
    for env_path in (REPO_ROOT / ".env", SCRIPT_DIR / ".env"):
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            text = line.strip()
            if not text or text.startswith("#") or "=" not in text:
                continue
            key, value = text.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def parse_args() -> argparse.Namespace:
    load_local_env()
    parser = argparse.ArgumentParser(
        description="Download the tomato-czcyh v2 Roboflow dataset for local YOLO training.",
    )
    parser.add_argument("--workspace", default=DEFAULT_WORKSPACE)
    parser.add_argument("--project", default=DEFAULT_PROJECT)
    parser.add_argument("--version", type=int, default=DEFAULT_VERSION)
    parser.add_argument("--format", default=DEFAULT_FORMAT)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument(
        "--api-key",
        default=os.environ.get("ROBOFLOW_API_KEY") or os.environ.get("RF_API_KEY"),
        help="Roboflow API key. Defaults to ROBOFLOW_API_KEY or RF_API_KEY.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.api_key:
        raise SystemExit(
            "Missing Roboflow API key. Set ROBOFLOW_API_KEY or pass --api-key.",
        )

    try:
        from roboflow import Roboflow
    except ImportError as exc:
        raise SystemExit(
            "The roboflow package is not installed. Run: pip install -r detection/requirements.txt",
        ) from exc

    output_root = args.output_root.expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    location = output_root / f"{args.project}-v{args.version}"

    rf = Roboflow(api_key=args.api_key)
    project = rf.workspace(args.workspace).project(args.project)
    version = project.version(args.version)
    dataset = version.download(args.format, location=str(location))
    dataset_dir = Path(dataset.location).resolve()
    data_yaml = dataset_dir / "data.yaml"
    local_yaml = dataset_dir / "data.local.yaml"
    if data_yaml.exists():
        try:
            import yaml

            data = yaml.safe_load(data_yaml.read_text(encoding="utf-8")) or {}
            data["path"] = str(dataset_dir)
            data["train"] = "train/images"
            data["val"] = "valid/images"
            if (dataset_dir / "test" / "images").exists():
                data["test"] = "test/images"
            local_yaml.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
        except Exception:
            local_yaml.write_text(
                "\n".join(
                    [
                        f"path: {dataset_dir}",
                        "train: train/images",
                        "val: valid/images",
                        "test: test/images",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )

    print(f"Downloaded dataset to: {dataset.location}")
    print(f"Data YAML: {Path(dataset.location) / 'data.yaml'}")
    print(f"Local Data YAML: {local_yaml}")


if __name__ == "__main__":
    main()
