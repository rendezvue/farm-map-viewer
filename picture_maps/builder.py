from __future__ import annotations

import json
import math
import os
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any
from concurrent.futures import ThreadPoolExecutor

import torch
import torch.nn.functional as F
import torchvision.transforms.functional as TF
from PIL import Image, ImageColor, ImageDraw, ImageOps

from .config import BuildConfig
from .dataset import CAMERA_ORDER, scan_dataset


try:
    RESAMPLE_LANCZOS = Image.Resampling.LANCZOS
except AttributeError:
    RESAMPLE_LANCZOS = Image.LANCZOS

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def draw_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], *, fill: str | None = None, outline: str | None = None, radius: int = 0, width: int = 1) -> None:
    if hasattr(draw, "rounded_rectangle"):
        draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    else:
        draw.rectangle(box, fill=fill, outline=outline, width=width)


def text_size(draw: ImageDraw.ImageDraw, text: str) -> tuple[int, int]:
    if hasattr(draw, "textbbox"):
        bbox = draw.textbbox((0, 0), text)
        return bbox[2] - bbox[0], bbox[3] - bbox[1]
    return draw.textsize(text)


def draw_shadow_text(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, *, fill: str = "#fbfaf5", shadow: str = "#09100c") -> None:
    shadow_offsets = [(-1, 0), (1, 0), (0, -1), (0, 1), (1, 1)]
    for dx, dy in shadow_offsets:
        draw.text((x + dx, y + dy), text, fill=shadow)
    draw.text((x, y), text, fill=fill)


def draw_corner_label(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, *, corner: str, padding: int = 8, fill: str = "#fbfaf5", shadow: str = "#09100c") -> None:
    left, top, right, bottom = box
    width, height = text_size(draw, text)
    if corner.endswith("left"):
        x = left + padding
    else:
        x = right - padding - width
    if corner.startswith("top"):
        y = top + padding
    else:
        y = bottom - padding - height
    draw_shadow_text(draw, x, y, text, fill=fill, shadow=shadow)


def draw_center_label(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, *, edge: str = "top", padding: int = 8, fill: str = "#fbfaf5", shadow: str = "#09100c") -> None:
    left, top, right, bottom = box
    width, height = text_size(draw, text)
    x = left + max(0, (right - left - width) // 2)
    if edge == "bottom":
        y = bottom - padding - height
    else:
        y = top + padding
    draw_shadow_text(draw, x, y, text, fill=fill, shadow=shadow)


def load_image_tensor(path: str, device: torch.device) -> torch.Tensor:
    with Image.open(path) as img:
        return TF.to_tensor(img.convert("RGB")).to(device)


def render_contact_sheet_gpu(
    frame: dict[str, Any],
    destination: Path,
    cell_width: int,
    cell_height: int,
    device: torch.device,
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    sub_w = cell_width // 2
    sub_h = cell_height // 2
    bg = torch.tensor([0.918, 0.902, 0.855], device=device).view(3, 1, 1)
    sheet = bg.expand(3, cell_height, cell_width).clone()

    positions = {
        "front_left": (0, 0),
        "front_right": (sub_w, 0),
        "rear": (0, sub_h),
        "side": (sub_w, sub_h),
    }
    for camera_name in CAMERA_ORDER:
        x, y = positions[camera_name]
        info = frame["cameras"].get(camera_name)
        if info:
            try:
                t = load_image_tensor(info["path"], device)
                t = t.unsqueeze(0)
                t = F.interpolate(t, size=(sub_h, sub_w), mode="bilinear", align_corners=False, antialias=True)
                sheet[:, y:y + sub_h, x:x + sub_w] = t.squeeze(0)
            except Exception:
                pass

    arr = (sheet.permute(1, 2, 0).mul(255).clamp(0, 255).byte().cpu().numpy())
    Image.fromarray(arr).save(destination, format="JPEG", quality=84)


def build_dataset(config: BuildConfig) -> dict[str, Any]:
    config.output_dir.mkdir(parents=True, exist_ok=True)
    config.tiles_dir.mkdir(parents=True, exist_ok=True)
    config.cells_dir.mkdir(parents=True, exist_ok=True)

    device_name = config.dataset_dir.parent.name
    session_name = config.dataset_dir.name

    print(f"  [{device_name}/{session_name}] scanning ...", flush=True)
    dataset = scan_dataset(config.dataset_dir, config.rail_spacing_m)
    layout = compute_layout(config, dataset)
    print(f"  [{device_name}/{session_name}] building {len(dataset['frames'])} frames on {DEVICE} ...", flush=True)
    public_frames, server_index = build_contact_sheets(config, dataset, layout, device_name, session_name)
    print(f"  [{device_name}/{session_name}] building tile pyramid ...", flush=True)
    zooms = build_tile_pyramid(config, public_frames, layout)

    manifest = {
        "title": f"Picture Maps - {session_name}",
        "dataset_dir": str(config.dataset_dir),
        "dataset_name": session_name,
        "device_name": device_name,
        "session_name": session_name,
        "dataset_key": config.dataset_key,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "tile_size": config.tile_size,
        "min_zoom": 0,
        "max_zoom": max(int(zoom) for zoom in zooms),
        "image_width": layout["width_px"],
        "image_height": layout["height_px"],
        "background": config.background,
        "tile_url_template": f"/tiles/{device_name}/{session_name}/{{z}}/{{x}}/{{y}}.png",
        "frames_url": f"/api/devices/{device_name}/sessions/{session_name}/frames",
        "rails": dataset["rails"],
        "summary": {
            "rail_count": len(dataset["rails"]),
            "frame_count": len(public_frames),
            "camera_image_count": sum(len(frame["cameras"]) for frame in public_frames),
        },
        "world": {
            "rail_spacing_m": config.rail_spacing_m,
            "odom_x_min": dataset["odom_x_min"],
            "odom_x_max": dataset["odom_x_max"],
            "sample_step_m": dataset["step_m"],
        },
        "layout": layout,
        "zoom_dimensions": zooms,
    }

    config.manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    config.frames_path.write_text(
        json.dumps({"items": public_frames}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    config.server_index_path.write_text(
        json.dumps(server_index, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return manifest


def compute_layout(config: BuildConfig, dataset: dict[str, Any]) -> dict[str, Any]:
    px_per_meter_x = (config.cell_width + config.gap_x) / config.rail_spacing_m
    px_per_meter_y = (config.cell_height + config.gap_y) / max(dataset["step_m"], 0.1)
    rails = dataset["rails"]
    width_px = config.margin_x * 2
    height_px = config.margin_y * 2
    if rails:
        last_rail_y = float(rails[-1]["rail_y_m"])
        width_px = math.ceil(last_rail_y * px_per_meter_x + config.cell_width + config.margin_x * 2)
    odom_span = max(dataset["odom_x_max"] - dataset["odom_x_min"], 0.0)
    height_px = math.ceil(odom_span * px_per_meter_y + config.cell_height + config.margin_y * 2)
    return {
        "cell_width": config.cell_width,
        "cell_height": config.cell_height,
        "gap_x": config.gap_x,
        "gap_y": config.gap_y,
        "margin_x": config.margin_x,
        "margin_y": config.margin_y,
        "px_per_meter_x": px_per_meter_x,
        "px_per_meter_y": px_per_meter_y,
        "width_px": width_px,
        "height_px": height_px,
    }


def frame_rect_px(frame: dict[str, Any], dataset: dict[str, Any], layout: dict[str, Any]) -> dict[str, int]:
    left = round(layout["margin_x"] + frame["rail_y_m"] * layout["px_per_meter_x"])
    top = round(layout["margin_y"] + (frame["odom_x"] - dataset["odom_x_min"]) * layout["px_per_meter_y"])
    return {
        "left": left,
        "top": top,
        "right": left + layout["cell_width"],
        "bottom": top + layout["cell_height"],
        "width": layout["cell_width"],
        "height": layout["cell_height"],
        "center_x": left + layout["cell_width"] // 2,
        "center_y": top + layout["cell_height"] // 2,
    }


def build_contact_sheets(
    config: BuildConfig,
    dataset: dict[str, Any],
    layout: dict[str, Any],
    device_name: str,
    session_name: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    public_frames: list[dict[str, Any]] = []
    server_frames: dict[str, Any] = {}

    frames_with_paths: list[tuple[dict[str, Any], Path]] = []
    for frame in dataset["frames"]:
        rect = frame_rect_px(frame, dataset, layout)
        cell_path = config.cells_dir / f'{frame["id"]:05d}.jpg'
        frames_with_paths.append((frame, cell_path))

        cameras_public: dict[str, Any] = {}
        cameras_private: dict[str, Any] = {}
        for camera_name, info in frame["cameras"].items():
            cameras_public[camera_name] = {
                "filename": info["filename"],
                "width": info["width"],
                "height": info["height"],
                "url": f'/api/devices/{device_name}/sessions/{session_name}/image/{frame["id"]}/{camera_name}.jpg',
            }
            cameras_private[camera_name] = {
                "path": info["path"],
                "filename": info["filename"],
            }

        public_frames.append(
            {
                "id": frame["id"],
                "label": frame["label"],
                "rail_name": frame["rail_name"],
                "rail_number": frame["rail_number"],
                "rail_column": frame["rail_column"],
                "rail_y_m": frame["rail_y_m"],
                "odom_x": frame["odom_x"],
                "odom_source": frame.get("odom_source"),
                "seq_index": frame["seq_index"],
                "rect_px": rect,
                "contact_sheet_url": f'/api/devices/{device_name}/sessions/{session_name}/contact-sheet/{frame["id"]}.jpg',
                "cameras": cameras_public,
            }
        )
        server_frames[str(frame["id"])] = {
            "contact_sheet_path": str(cell_path),
            "cameras": cameras_private,
        }

    # GPU로 contact sheet 병렬 생성
    def render_job(args: tuple[dict[str, Any], Path]) -> None:
        frame, cell_path = args
        if not cell_path.exists():
            render_contact_sheet_gpu(frame, cell_path, layout["cell_width"], layout["cell_height"], DEVICE)

    max_workers = min(8, os.cpu_count() or 4)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        list(executor.map(render_job, frames_with_paths))

    return public_frames, {"dataset_dir": str(config.dataset_dir), "frames": server_frames}


def build_tile_pyramid(config: BuildConfig, frames: list[dict[str, Any]], layout: dict[str, Any]) -> dict[str, Any]:
    W = layout["width_px"]
    H = layout["height_px"]
    bg_rgb = ImageColor.getrgb(config.background)
    bg = torch.tensor([c / 255.0 for c in bg_rgb], dtype=torch.float32, device=DEVICE).view(3, 1, 1)

    # 전체 캔버스를 GPU 텐서로 구성
    canvas = bg.expand(3, H, W).clone()

    for frame in frames:
        cell_path = config.cells_dir / f'{frame["id"]:05d}.jpg'
        if not cell_path.exists():
            continue
        with Image.open(cell_path) as img:
            t = TF.to_tensor(img.convert("RGB")).to(DEVICE)
        rect = frame["rect_px"]
        t_h = rect["bottom"] - rect["top"]
        t_w = rect["right"] - rect["left"]
        if t.shape[1] != t_h or t.shape[2] != t_w:
            t = F.interpolate(t.unsqueeze(0), size=(t_h, t_w), mode="bilinear", align_corners=False, antialias=True).squeeze(0)
        canvas[:, rect["top"]:rect["bottom"], rect["left"]:rect["right"]] = t

    max_dimension = max(W, H, config.tile_size)
    max_zoom = max(0, math.ceil(math.log2(max_dimension / config.tile_size)))

    tiles_x = math.ceil(W / config.tile_size)
    tiles_y = math.ceil(H / config.tile_size)
    level_dimensions: dict[int, tuple[int, int]] = {max_zoom: (tiles_x, tiles_y)}

    # 최대 줌 타일 저장
    ts = config.tile_size
    for ty in range(tiles_y):
        for tx in range(tiles_x):
            x0, y0 = tx * ts, ty * ts
            x1 = min(x0 + ts, W)
            y1 = min(y0 + ts, H)
            tile = canvas[:, y0:y1, x0:x1]
            if tile.shape[1] < ts or tile.shape[2] < ts:
                pad = torch.zeros(3, ts, ts, device=DEVICE)
                pad[:, :tile.shape[1], :tile.shape[2]] = tile
                tile = pad
            arr = (tile.permute(1, 2, 0).mul(255).clamp(0, 255).byte().cpu().numpy())
            path = config.tiles_dir / str(max_zoom) / str(tx) / f"{ty}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            Image.fromarray(arr).save(path, format="PNG", compress_level=6)

    # 줌 레벨 다운샘플링
    current_canvas = canvas.unsqueeze(0)  # (1, 3, H, W)
    for zoom in range(max_zoom - 1, -1, -1):
        child_tiles_x, child_tiles_y = level_dimensions[zoom + 1]
        parent_tiles_x = math.ceil(child_tiles_x / 2)
        parent_tiles_y = math.ceil(child_tiles_y / 2)
        level_dimensions[zoom] = (parent_tiles_x, parent_tiles_y)

        new_H = parent_tiles_y * ts
        new_W = parent_tiles_x * ts
        downsampled = F.interpolate(
            current_canvas,
            size=(new_H, new_W),
            mode="bilinear",
            align_corners=False,
            antialias=True,
        )
        current_canvas = downsampled

        zoom_canvas = downsampled.squeeze(0)
        for ty in range(parent_tiles_y):
            for tx in range(parent_tiles_x):
                x0, y0 = tx * ts, ty * ts
                tile = zoom_canvas[:, y0:y0 + ts, x0:x0 + ts]
                arr = (tile.permute(1, 2, 0).mul(255).clamp(0, 255).byte().cpu().numpy())
                path = config.tiles_dir / str(zoom) / str(tx) / f"{ty}.png"
                path.parent.mkdir(parents=True, exist_ok=True)
                Image.fromarray(arr).save(path, format="PNG", compress_level=6)

    return {
        str(zoom): {"tiles_x": dims[0], "tiles_y": dims[1]}
        for zoom, dims in sorted(level_dimensions.items())
    }
