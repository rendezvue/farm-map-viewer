from __future__ import annotations

import json
import math
import os
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageColor, ImageDraw, ImageOps

from .config import BuildConfig
from .dataset import CAMERA_ORDER, scan_dataset


try:
    RESAMPLE_LANCZOS = Image.Resampling.LANCZOS
except AttributeError:
    RESAMPLE_LANCZOS = Image.LANCZOS


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


def build_dataset(config: BuildConfig) -> dict[str, Any]:
    config.output_dir.mkdir(parents=True, exist_ok=True)
    config.tiles_dir.mkdir(parents=True, exist_ok=True)
    config.cells_dir.mkdir(parents=True, exist_ok=True)

    dataset = scan_dataset(config.dataset_dir, config.rail_spacing_m)
    layout = compute_layout(config, dataset)
    public_frames, server_index = build_contact_sheets(config, dataset, layout)
    zooms = build_tile_pyramid(config, public_frames, layout)

    manifest = {
        "title": f"Picture Maps - {config.dataset_dir.name}",
        "dataset_dir": str(config.dataset_dir),
        "dataset_name": config.dataset_dir.name,
        "dataset_key": config.dataset_key,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "tile_size": config.tile_size,
        "min_zoom": 0,
        "max_zoom": max(int(zoom) for zoom in zooms),
        "image_width": layout["width_px"],
        "image_height": layout["height_px"],
        "background": config.background,
        "tile_url_template": "/tiles/{z}/{x}/{y}.png",
        "frames_url": "/api/frames",
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


def render_missing_tile(size: tuple[int, int], label: str) -> Image.Image:
    image = Image.new("RGB", size, "#d9d2c3")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, size[0] - 1, size[1] - 1), outline="#b39a74", width=2)
    return image


def render_contact_sheet(frame: dict[str, Any], destination: Path, cell_width: int, cell_height: int) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    background = Image.new("RGB", (cell_width, cell_height), "#ebe6da")
    draw = ImageDraw.Draw(background)
    draw_panel(draw, (0, 0, cell_width - 1, cell_height - 1), radius=18, outline="#d6ccb8", width=2)

    sub_width = cell_width // 2
    sub_height = cell_height // 2
    positions = {
        "front_left": (0, 0),
        "front_right": (sub_width, 0),
        "rear": (0, sub_height),
        "side": (sub_width, sub_height),
    }
    for camera_name in CAMERA_ORDER:
        left, top = positions[camera_name]
        info = frame["cameras"].get(camera_name)
        if info:
            with Image.open(info["path"]) as image:
                tile = ImageOps.fit(image.convert("RGB"), (sub_width, sub_height), method=RESAMPLE_LANCZOS)
        else:
            tile = render_missing_tile((sub_width, sub_height), camera_name)
        background.paste(tile, (left, top))
        draw.rectangle((left, top, left + sub_width - 1, top + sub_height - 1), outline="#f6f1e7", width=1)
    background.save(destination, format="JPEG", quality=84)


def render_contact_sheet_job(job: tuple[dict[str, Any], Path, int, int]) -> None:
    frame, destination, cell_width, cell_height = job
    render_contact_sheet(frame, destination, cell_width, cell_height)


def build_contact_sheets(
    config: BuildConfig,
    dataset: dict[str, Any],
    layout: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    public_frames: list[dict[str, Any]] = []
    server_frames: dict[str, Any] = {}
    render_jobs: list[tuple[dict[str, Any], Path, int, int]] = []

    for frame in dataset["frames"]:
        rect = frame_rect_px(frame, dataset, layout)
        cell_path = config.cells_dir / f'{frame["id"]:05d}.jpg'
        render_jobs.append((frame, cell_path, layout["cell_width"], layout["cell_height"]))

        cameras_public: dict[str, Any] = {}
        cameras_private: dict[str, Any] = {}
        for camera_name, info in frame["cameras"].items():
            cameras_public[camera_name] = {
                "filename": info["filename"],
                "width": info["width"],
                "height": info["height"],
                "url": f'/api/image/{frame["id"]}/{camera_name}.jpg',
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
                "contact_sheet_url": f'/api/contact-sheet/{frame["id"]}.jpg',
                "cameras": cameras_public,
            }
        )
        server_frames[str(frame["id"])] = {
            "contact_sheet_path": str(cell_path),
            "cameras": cameras_private,
        }

    if render_jobs:
        max_workers = min(8, os.cpu_count() or 4)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            list(executor.map(render_contact_sheet_job, render_jobs))

    return public_frames, {"dataset_dir": str(config.dataset_dir), "frames": server_frames}


@lru_cache(maxsize=128)
def load_rgb_image(path_str: str) -> Image.Image:
    with Image.open(path_str) as image:
        return image.convert("RGB")


def blank_tile(size: int, background: str) -> Image.Image:
    return Image.new("RGB", (size, size), ImageColor.getrgb(background))


def save_tile(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", compress_level=6)


def build_tile_pyramid(config: BuildConfig, frames: list[dict[str, Any]], layout: dict[str, Any]) -> dict[str, Any]:
    max_dimension = max(layout["width_px"], layout["height_px"], config.tile_size)
    max_zoom = max(0, math.ceil(math.log2(max_dimension / config.tile_size)))

    tiles_x = math.ceil(layout["width_px"] / config.tile_size)
    tiles_y = math.ceil(layout["height_px"] / config.tile_size)
    level_dimensions: dict[int, tuple[int, int]] = {max_zoom: (tiles_x, tiles_y)}

    overlaps: dict[tuple[int, int], list[dict[str, Any]]] = {}
    for frame in frames:
        rect = frame["rect_px"]
        tx0 = rect["left"] // config.tile_size
        tx1 = (rect["right"] - 1) // config.tile_size
        ty0 = rect["top"] // config.tile_size
        ty1 = (rect["bottom"] - 1) // config.tile_size
        for tx in range(tx0, tx1 + 1):
            for ty in range(ty0, ty1 + 1):
                overlaps.setdefault((tx, ty), []).append(frame)

    for ty in range(tiles_y):
        for tx in range(tiles_x):
            canvas = blank_tile(config.tile_size, config.background)
            tile_left = tx * config.tile_size
            tile_top = ty * config.tile_size
            for frame in overlaps.get((tx, ty), []):
                rect = frame["rect_px"]
                inter_left = max(tile_left, rect["left"])
                inter_top = max(tile_top, rect["top"])
                inter_right = min(tile_left + config.tile_size, rect["right"])
                inter_bottom = min(tile_top + config.tile_size, rect["bottom"])
                if inter_left >= inter_right or inter_top >= inter_bottom:
                    continue
                cell = load_rgb_image(str(config.cells_dir / f'{frame["id"]:05d}.jpg'))
                crop = cell.crop(
                    (
                        inter_left - rect["left"],
                        inter_top - rect["top"],
                        inter_right - rect["left"],
                        inter_bottom - rect["top"],
                    )
                )
                canvas.paste(crop, (inter_left - tile_left, inter_top - tile_top))
            save_tile(canvas, config.tiles_dir / str(max_zoom) / str(tx) / f"{ty}.png")

    for zoom in range(max_zoom - 1, -1, -1):
        child_tiles_x, child_tiles_y = level_dimensions[zoom + 1]
        parent_tiles_x = math.ceil(child_tiles_x / 2)
        parent_tiles_y = math.ceil(child_tiles_y / 2)
        level_dimensions[zoom] = (parent_tiles_x, parent_tiles_y)
        for ty in range(parent_tiles_y):
            for tx in range(parent_tiles_x):
                canvas = Image.new("RGB", (config.tile_size * 2, config.tile_size * 2), ImageColor.getrgb(config.background))
                for child_dx in range(2):
                    for child_dy in range(2):
                        child_x = tx * 2 + child_dx
                        child_y = ty * 2 + child_dy
                        if child_x >= child_tiles_x or child_y >= child_tiles_y:
                            continue
                        child_path = config.tiles_dir / str(zoom + 1) / str(child_x) / f"{child_y}.png"
                        if not child_path.exists():
                            continue
                        with Image.open(child_path) as child_tile:
                            canvas.paste(child_tile.convert("RGB"), (child_dx * config.tile_size, child_dy * config.tile_size))
                parent = canvas.resize((config.tile_size, config.tile_size), RESAMPLE_LANCZOS)
                save_tile(parent, config.tiles_dir / str(zoom) / str(tx) / f"{ty}.png")

    return {
        str(zoom): {
            "tiles_x": dims[0],
            "tiles_y": dims[1],
        }
        for zoom, dims in sorted(level_dimensions.items())
    }
