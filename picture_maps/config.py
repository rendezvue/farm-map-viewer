from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path


DEFAULT_DATASET = Path("/home/nas/rdv_md3/uv_camera_db/ubuntu/20260416_235959")
DEFAULT_DB_ROOT = Path("/mnt/nas_rdv_md3/uv_camera_db")
LAYOUT_ORIENTATION = "meter_x_rail_y"


@dataclass(frozen=True)
class BuildConfig:
    dataset_dir: Path
    build_root: Path
    rail_spacing_m: float = 3.0
    tile_size: int = 256
    cell_width: int = 320
    cell_height: int = 180
    gap_x: int = 24
    gap_y: int = 144
    rail_track_margin_y: int = 30
    rail_track_min_tile_height: int = 20
    rail_track_max_height: int = 84
    margin_x: int = 160
    margin_y: int = 140
    background: str = "#050505"

    @property
    def dataset_key(self) -> str:
        payload = "|".join(
            [
                str(self.dataset_dir.resolve()),
                str(self.rail_spacing_m),
                str(self.cell_width),
                str(self.cell_height),
                str(self.gap_x),
                str(self.gap_y),
                str(self.rail_track_margin_y),
                str(self.rail_track_min_tile_height),
                str(self.rail_track_max_height),
                str(self.margin_x),
                str(self.margin_y),
                "rail-track-v5-u-turn",
            ]
        )
        digest = hashlib.sha1(payload.encode("utf-8")).hexdigest()[:8]
        return f"{self.dataset_dir.name}_{digest}"

    @property
    def output_dir(self) -> Path:
        return self.build_root / self.dataset_key

    @property
    def tiles_dir(self) -> Path:
        return self.output_dir / "tiles"

    @property
    def cells_dir(self) -> Path:
        return self.output_dir / "cells"

    @property
    def manifest_path(self) -> Path:
        return self.output_dir / "manifest.json"

    @property
    def frames_path(self) -> Path:
        return self.output_dir / "frames.json"

    @property
    def server_index_path(self) -> Path:
        return self.output_dir / "server_index.json"

    @property
    def insights_path(self) -> Path:
        return self.output_dir / "insights.json"

    @property
    def layers_path(self) -> Path:
        return self.output_dir / "layers.json"
