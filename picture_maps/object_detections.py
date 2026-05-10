from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import BuildConfig


MODEL_IDS = ("yolo11s", "yolo11m", "yolo11l", "yolo11x")
MODEL_LABELS = {
    "yolo11s": "YOLO11s",
    "yolo11m": "YOLO11m",
    "yolo11l": "YOLO11l",
    "yolo11x": "YOLO11x",
}
DEFAULT_MODEL_ID = "yolo11l"


def normalize_model_id(value: Any) -> str | None:
    text = str(value or "").strip().lower()
    aliases = {
        "s": "yolo11s",
        "m": "yolo11m",
        "l": "yolo11l",
        "x": "yolo11x",
        "11s": "yolo11s",
        "11m": "yolo11m",
        "11l": "yolo11l",
        "11x": "yolo11x",
    }
    text = aliases.get(text, text)
    return text if text in MODEL_IDS else None


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


def _detection_path(config: BuildConfig, kind: str, model_id: str | None) -> Path:
    suffix = f"_{model_id}" if model_id else ""
    return config.dataset_dir / f"{kind}_detections{suffix}.json"


def _candidate_paths(config: BuildConfig, kind: str, model_id: str | None = None) -> tuple[Path, ...]:
    model_id = normalize_model_id(model_id)
    if model_id:
        return (
            config.output_dir / f"{kind}_detections_{model_id}.json",
            _detection_path(config, kind, model_id),
        )
    return (
        config.output_dir / f"{kind}_detections.json",
        config.dataset_dir / f"{kind}_detections.json",
        config.output_dir / "object_detections.json",
        config.dataset_dir / "object_detections.json",
    )


def list_object_detection_models(config: BuildConfig, *, kind: str = "growth") -> dict[str, Any]:
    models: list[dict[str, Any]] = []
    for model_id in MODEL_IDS:
        paths = (
            config.output_dir / f"{kind}_detections_{model_id}.json",
            _detection_path(config, kind, model_id),
        )
        path = next((candidate for candidate in paths if candidate.exists()), None)
        models.append(
            {
                "id": model_id,
                "label": MODEL_LABELS.get(model_id, model_id),
                "available": path is not None,
                "data_path": path.name if path is not None else None,
            }
        )
    default_path = next((candidate for candidate in _candidate_paths(config, kind) if candidate.exists()), None)
    default_model = DEFAULT_MODEL_ID if any(model["id"] == DEFAULT_MODEL_ID and model["available"] for model in models) else None
    if default_model is None and any(model["id"] == "yolo11s" and model["available"] for model in models):
        default_model = "yolo11s"
    if default_model is None:
        default_model = next((model["id"] for model in models if model["available"]), None)
    return {
        "available": any(model["available"] for model in models) or default_path is not None,
        "default_model": default_model,
        "fallback_data_path": default_path.name if default_path is not None else None,
        "models": models,
    }


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
    if abs(float(nearest.get("odom_x", 0.0)) - odom_x) > threshold_m:
        return None
    return nearest


def load_object_detections(
    config: BuildConfig,
    manifest: dict[str, Any],
    frames_payload: dict[str, Any] | list[dict[str, Any]],
    *,
    kind: str = "growth",
    model_id: str | None = None,
) -> dict[str, Any]:
    frames = frames_payload.get("items", []) if isinstance(frames_payload, dict) else frames_payload
    frame_by_id: dict[int, dict[str, Any]] = {}
    frames_by_rail: dict[str, list[dict[str, Any]]] = {}
    frame_by_image_path: dict[str, tuple[dict[str, Any], str]] = {}

    for frame in frames:
        frame_id = _coerce_int(frame.get("id"))
        if frame_id is None:
            continue
        frame_by_id[frame_id] = frame
        rail_name = str(frame.get("rail_name") or "")
        if rail_name:
            frames_by_rail.setdefault(rail_name, []).append(frame)
        for camera_name, camera in (frame.get("cameras") or {}).items():
            camera_path = str(camera.get("path") or "")
            if not camera_path:
                continue
            frame_by_image_path[str(Path(camera_path).resolve())] = (frame, str(camera_name))

    sample_step_m = float(manifest.get("world", {}).get("sample_step_m", 0.5) or 0.5)
    matching_threshold = max(0.35, sample_step_m * 1.6)

    source_path: Path | None = None
    payload: dict[str, Any] | list[Any] | None = None
    selected_model = normalize_model_id(model_id)
    for candidate in _candidate_paths(config, kind, selected_model):
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
        "model": None,
        "model_id": selected_model,
        "detections": [],
    }
    if payload is None or source_path is None:
        return response

    raw_items = payload.get("detections", []) if isinstance(payload, dict) else payload
    if not isinstance(raw_items, list):
        raw_items = []

    payload_source = payload.get("source") if isinstance(payload, dict) else None
    model = payload.get("model") if isinstance(payload, dict) else None
    normalized: list[dict[str, Any]] = []

    for index, item in enumerate(raw_items):
        if not isinstance(item, dict):
            continue

        frame_id = _coerce_int(item.get("frame_id"))
        rail_name = str(item.get("rail_name") or "").strip() or None
        odom_x = _coerce_float(item.get("odom_x"))
        camera = str(item.get("camera") or "").strip() or None

        frame = frame_by_id.get(frame_id) if frame_id is not None else None
        image_path = str(item.get("image_path") or "").strip()
        if frame is None and image_path:
            matched = frame_by_image_path.get(str(Path(image_path).expanduser().resolve()))
            if matched:
                frame, matched_camera = matched
                camera = camera or matched_camera
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

        label = str(item.get("label") or item.get("class_name") or item.get("category") or "object").strip()
        class_id = _coerce_int(item.get("class_id"))
        bbox = _normalize_bbox(item.get("bbox"))

        normalized.append(
            {
                "id": str(item.get("id") or f"{kind}_{frame_id}_{index + 1:03d}"),
                "frame_id": frame_id,
                "rail_name": rail_name,
                "odom_x": round(odom_x, 3),
                "label": label,
                "class_id": class_id,
                "confidence": confidence,
                "camera": camera,
                "bbox": bbox,
                "source": str(item.get("source") or payload_source or "external"),
            }
        )

    normalized.sort(
        key=lambda item: (
            item["rail_name"],
            item["odom_x"],
            item["camera"] or "",
            item["label"],
            item["id"],
        )
    )

    return {
        "available": True,
        "session": session_name,
        "source": str(payload_source or "external"),
        "data_path": source_path.name,
        "model": model,
        "model_id": selected_model,
        "detections": normalized,
    }
