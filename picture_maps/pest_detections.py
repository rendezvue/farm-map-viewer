from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import BuildConfig


def _coerce_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _coerce_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_bbox(value: Any) -> list[float] | None:
    if not isinstance(value, (list, tuple)) or len(value) < 4:
        return None
    coords: list[float] = []
    for item in value[:4]:
        numeric = _coerce_float(item)
        if numeric is None:
            return None
        coords.append(numeric)
    return coords


def _normalize_severity(value: Any, confidence: float | None) -> str:
    text = str(value or "").strip().lower()
    if text in {"high", "critical", "severe"}:
        return "high"
    if text in {"medium", "warn", "warning", "mid"}:
        return "medium"
    if text in {"low", "info", "minor"}:
        return "low"
    if confidence is None:
        return "medium"
    if confidence >= 0.8:
        return "high"
    if confidence >= 0.45:
        return "medium"
    return "low"


def _candidate_paths(config: BuildConfig) -> tuple[Path, ...]:
    repo_fixture = (
        Path(__file__).resolve().parents[1]
        / "demo_data"
        / "pest_detections"
        / config.dataset_dir.parent.name
        / f"{config.dataset_dir.name}.json"
    )
    return (
        config.output_dir / "pest_detections.json",
        config.dataset_dir / "pest_detections.json",
        repo_fixture,
    )


def _load_payload(path: Path) -> dict[str, Any] | list[Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _nearest_frame(
    frames_by_rail: dict[str, list[dict[str, Any]]],
    rail_name: str | None,
    odom_x: float | None,
    threshold_m: float,
) -> dict[str, Any] | None:
    if not rail_name or odom_x is None:
        return None
    candidates = frames_by_rail.get(rail_name, [])
    if not candidates:
        return None
    nearest = min(
        candidates,
        key=lambda frame: abs(float(frame.get("odom_x", 0.0)) - odom_x),
    )
    distance = abs(float(nearest.get("odom_x", 0.0)) - odom_x)
    if distance > threshold_m:
        return None
    return nearest


def load_pest_detections(
    config: BuildConfig,
    manifest: dict[str, Any],
    frames_payload: dict[str, Any] | list[dict[str, Any]],
) -> dict[str, Any]:
    frames = frames_payload.get("items", []) if isinstance(frames_payload, dict) else frames_payload
    frame_by_id: dict[int, dict[str, Any]] = {}
    frames_by_rail: dict[str, list[dict[str, Any]]] = {}
    for frame in frames:
        frame_id = _coerce_int(frame.get("id"))
        if frame_id is None:
            continue
        frame_by_id[frame_id] = frame
        rail_name = str(frame.get("rail_name") or "")
        if rail_name:
            frames_by_rail.setdefault(rail_name, []).append(frame)

    sample_step_m = float(manifest.get("world", {}).get("sample_step_m", 0.5) or 0.5)
    matching_threshold = max(0.35, sample_step_m * 1.6)

    source_path: Path | None = None
    payload: dict[str, Any] | list[Any] | None = None
    for candidate in _candidate_paths(config):
        if not candidate.exists():
            continue
        parsed = _load_payload(candidate)
        if parsed is None:
            continue
        source_path = candidate
        payload = parsed
        break

    session_name = manifest.get("session_name", config.dataset_dir.name)
    response = {
        "available": False,
        "session": session_name,
        "source": None,
        "data_path": None,
        "detections": [],
    }
    if payload is None or source_path is None:
        return response

    raw_items = payload.get("detections", []) if isinstance(payload, dict) else payload
    if not isinstance(raw_items, list):
        raw_items = []

    payload_source = payload.get("source") if isinstance(payload, dict) else None
    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(raw_items):
        if not isinstance(item, dict):
            continue

        frame_id = _coerce_int(item.get("frame_id"))
        rail_name = str(item.get("rail_name") or "").strip() or None
        odom_x = _coerce_float(item.get("odom_x"))

        frame = frame_by_id.get(frame_id) if frame_id is not None else None
        if frame is None:
            frame = _nearest_frame(frames_by_rail, rail_name, odom_x, matching_threshold)
        if frame is None:
            continue

        frame_id = int(frame["id"])
        rail_name = rail_name or str(frame.get("rail_name") or "")
        odom_x = odom_x if odom_x is not None else float(frame.get("odom_x", 0.0) or 0.0)

        confidence = _coerce_float(item.get("confidence"))
        if confidence is not None:
            confidence = max(0.0, min(1.0, confidence))

        camera = str(item.get("camera") or "").strip() or None
        bbox = _normalize_bbox(item.get("bbox"))
        label = str(
            item.get("label")
            or item.get("title")
            or item.get("category")
            or "병충해"
        ).strip()
        note = str(item.get("note") or item.get("message") or "").strip() or None
        severity = _normalize_severity(item.get("severity"), confidence)

        normalized.append(
            {
                "id": str(item.get("id") or f"pest_{frame_id}_{index + 1:03d}"),
                "frame_id": frame_id,
                "rail_name": rail_name,
                "odom_x": round(odom_x, 3),
                "severity": severity,
                "label": label,
                "confidence": confidence,
                "camera": camera,
                "bbox": bbox,
                "note": note,
                "source": str(item.get("source") or payload_source or "external"),
            }
        )

    severity_order = {"high": 0, "medium": 1, "low": 2}
    normalized.sort(
        key=lambda item: (
            item["rail_name"],
            item["odom_x"],
            severity_order.get(item["severity"], 9),
            item["id"],
        )
    )

    return {
        "available": True,
        "session": session_name,
        "source": str(payload_source or "external"),
        "data_path": source_path.name,
        "detections": normalized,
    }
