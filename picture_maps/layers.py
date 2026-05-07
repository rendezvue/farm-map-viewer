from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime
from typing import Any

from .config import BuildConfig


LAYER_DEFS = [
    {
        "id": "action_priority",
        "label": "오늘 조치 우선순위",
        "description": "당일 현장 점검 및 조치가 필요한 구간",
        "unit": "score",
        "range": [0, 100],
        "color_scheme": "yellow_red",
    },
    {
        "id": "disease_pest_risk",
        "label": "병충해 위험",
        "description": "병충해 발생 가능성이 높은 구간",
        "unit": "score",
        "range": [0, 100],
        "color_scheme": "green_red",
    },
    {
        "id": "growth_status",
        "label": "생육 상태",
        "description": "생육 정체 또는 이상이 감지된 구간",
        "unit": "score",
        "range": [0, 100],
        "color_scheme": "growth",
    },
    {
        "id": "data_reliability",
        "label": "데이터 신뢰도",
        "description": "촬영 누락 또는 데이터 공백 구간",
        "unit": "score",
        "range": [0, 100],
        "color_scheme": "blue_warn",
    },
    {
        "id": "harvest_readiness",
        "label": "수확 준비도",
        "description": "수확 가능 판단 구간",
        "unit": "score",
        "range": [0, 100],
        "color_scheme": "harvest",
    },
]

SEVERITY_HIGH_TITLES = {
    "action_priority": "우선 점검 필요",
    "disease_pest_risk": "병충해 고위험",
    "growth_status": "생육 심각 정체",
    "data_reliability": "데이터 공백 심각",
    "harvest_readiness": "수확 즉시 필요",
}
SEVERITY_MED_TITLES = {
    "action_priority": "주의 관찰 필요",
    "disease_pest_risk": "병충해 주의",
    "growth_status": "생육 정체 징후",
    "data_reliability": "촬영 이상 구간",
    "harvest_readiness": "수확 준비 중",
}
SEVERITY_LOW_TITLES = {
    "action_priority": "정상",
    "disease_pest_risk": "위험 낮음",
    "growth_status": "정상 생육",
    "data_reliability": "데이터 양호",
    "harvest_readiness": "수확 불필요",
}

SUMMARIES = {
    "action_priority": {
        "high": "생육 정체 및 병충해 의심 신호가 복합적으로 감지됨",
        "medium": "일부 카메라 이상 및 생육 둔화 징후",
        "low": "이상 없음, 정기 모니터링 유지",
    },
    "disease_pest_risk": {
        "high": "흰가루병 또는 진딧물 의심 패턴 다수 검출",
        "medium": "경미한 병반 흔적, 추가 확인 권장",
        "low": "병충해 징후 없음",
    },
    "growth_status": {
        "high": "3회 연속 생육 정체, 환경 요인 점검 필요",
        "medium": "생육 속도 평균 대비 15% 이하",
        "low": "정상 생육 진행 중",
    },
    "data_reliability": {
        "high": "복수 카메라 누락 또는 연속 프레임 공백",
        "medium": "단일 카메라 누락 또는 odom 이상",
        "low": "모든 카메라 정상 수집",
    },
    "harvest_readiness": {
        "high": "당도 및 색도 기준 초과, 즉시 수확 권장",
        "medium": "수확 기준 접근 중, 3~5일 내 수확 예상",
        "low": "수확 기준 미달",
    },
}

ACTIONS = {
    "action_priority": {
        "high": "12시간 내 현장 확인 및 방제 검토",
        "medium": "48시간 내 순시 점검",
        "low": "정기 일정대로 관리",
    },
    "disease_pest_risk": {
        "high": "즉시 방제 약제 살포 검토 및 격리 조치",
        "medium": "방제 일정 앞당기기",
        "low": "예방적 방제 일정 유지",
    },
    "growth_status": {
        "high": "온·습도 및 양액 농도 즉시 점검",
        "medium": "환경 데이터 추이 모니터링 강화",
        "low": "현 재배 환경 유지",
    },
    "data_reliability": {
        "high": "해당 구간 재촬영 필요, 카메라 점검",
        "medium": "다음 촬영 시 카메라 상태 확인",
        "low": "정상 운영 중",
    },
    "harvest_readiness": {
        "high": "수확 팀 즉시 투입",
        "medium": "수확 일정 3일 이내로 조정",
        "low": "수확 일정 유지",
    },
}

REASONS = {
    "action_priority": {
        "high": ["growth_stagnation", "powdery_mildew_risk", "camera_missing"],
        "medium": ["growth_slowdown", "minor_anomaly"],
        "low": [],
    },
    "disease_pest_risk": {
        "high": ["powdery_mildew_risk", "aphid_pattern", "leaf_discoloration"],
        "medium": ["minor_leaf_spots", "early_mildew"],
        "low": [],
    },
    "growth_status": {
        "high": ["growth_stagnation", "consecutive_low_growth", "environmental_stress"],
        "medium": ["growth_slowdown", "below_avg_height"],
        "low": [],
    },
    "data_reliability": {
        "high": ["camera_missing", "frame_gap", "odom_anomaly"],
        "medium": ["single_camera_missing", "irregular_interval"],
        "low": [],
    },
    "harvest_readiness": {
        "high": ["brix_above_threshold", "color_index_ripe", "size_target_met"],
        "medium": ["approaching_threshold", "partial_ripening"],
        "low": [],
    },
}


def _seed_int(seed_str: str) -> int:
    return int(hashlib.md5(seed_str.encode()).hexdigest(), 16)


def _pseudo_rand(seed_str: str, lo: float = 0.0, hi: float = 1.0) -> float:
    n = _seed_int(seed_str)
    return lo + (n % 100000) / 100000.0 * (hi - lo)


def _severity(value: float) -> str:
    if value >= 70:
        return "high"
    if value >= 40:
        return "medium"
    return "low"


def _build_layer_items(
    layer_id: str,
    rails: list[dict[str, Any]],
    frames: list[dict[str, Any]],
    session_key: str,
    odom_x_min: float,
    odom_x_max: float,
    step_m: float,
) -> list[dict[str, Any]]:
    seg_size = max(2.0, step_m * 8)
    items: list[dict[str, Any]] = []
    expected_camera_count = max((len(f.get("cameras", {})) for f in frames), default=4)

    frames_by_rail: dict[str, list[dict[str, Any]]] = {}
    for f in frames:
        frames_by_rail.setdefault(f["rail_name"], []).append(f)
    for rname in frames_by_rail:
        frames_by_rail[rname].sort(key=lambda f: f["odom_x"])

    for rail in rails:
        rname = rail["name"]
        rail_frames = frames_by_rail.get(rname, [])
        if not rail_frames:
            continue

        x_min = min(f["odom_x"] for f in rail_frames)
        x_max = max(f["odom_x"] for f in rail_frames)
        n_segs = max(1, math.ceil((x_max - x_min) / seg_size))

        # Create "hot zones" seeded by rail name for realistic clustering
        n_hot = max(1, int(_pseudo_rand(f"{session_key}_{rname}_nhot", 1, 4)))
        hot_positions = [
            _pseudo_rand(f"{session_key}_{rname}_hot{i}", x_min, x_max)
            for i in range(n_hot)
        ]

        for seg_i in range(n_segs):
            start_m = x_min + seg_i * seg_size
            end_m = min(start_m + seg_size, x_max + step_m)
            seg_frames = [
                f for f in rail_frames if start_m <= f["odom_x"] < end_m
            ]
            if not seg_frames:
                seg_frames = [
                    f for f in rail_frames
                    if abs(f["odom_x"] - (start_m + end_m) / 2) < seg_size
                ]

            seg_center = (start_m + end_m) / 2
            base_rand = _pseudo_rand(f"{session_key}_{rname}_{layer_id}_{seg_i}", 0, 100)

            # Proximity boost from hot zones
            hot_boost = 0.0
            for hp in hot_positions:
                dist = abs(seg_center - hp)
                if dist < seg_size * 3:
                    hot_boost = max(hot_boost, (1 - dist / (seg_size * 3)) * 55)

            # Layer-specific modulation
            missing_cam_ratio = 0.0
            if seg_frames:
                missing_cam_ratio = sum(
                    1 for f in seg_frames if len(f.get("cameras", {})) < expected_camera_count
                ) / len(seg_frames)

            if layer_id == "action_priority":
                disease_val = _pseudo_rand(f"{session_key}_{rname}_disease_pest_risk_{seg_i}", 0, 100)
                growth_val = _pseudo_rand(f"{session_key}_{rname}_growth_status_{seg_i}", 0, 100)
                raw = base_rand * 0.25 + hot_boost * 0.9 + disease_val * 0.15 + (100 - growth_val) * 0.15
                raw = raw * 0.85  # normalize down slightly
            elif layer_id == "disease_pest_risk":
                raw = base_rand * 0.3 + hot_boost * 1.1
            elif layer_id == "growth_status":
                disease_val = _pseudo_rand(f"{session_key}_{rname}_disease_pest_risk_{seg_i}", 0, 100)
                raw = base_rand * 0.4 + hot_boost * 0.8 + disease_val * 0.2
            elif layer_id == "data_reliability":
                # Add structural noise even without missing cameras
                pos_noise = _pseudo_rand(f"{session_key}_{rname}_dr_noise_{seg_i}", 0, 40)
                gap_score = missing_cam_ratio * 80
                # Gaps along odom axis (large segment spacing)
                frame_density = len(seg_frames) / max(1, (end_m - start_m) / max(0.1, step_m))
                density_score = max(0, (1 - frame_density) * 50)
                raw = base_rand * 0.15 + pos_noise + gap_score + density_score + hot_boost * 0.3
            elif layer_id == "harvest_readiness":
                # Harvest varies by position along the odom axis
                pos_ratio = (seg_center - odom_x_min) / max(1, odom_x_max - odom_x_min)
                wave = abs(math.sin(pos_ratio * math.pi * 2.5 + _pseudo_rand(f"{session_key}_{rname}_phase", 0, 6))) * 65
                raw = base_rand * 0.3 + wave * 0.7
            else:
                raw = base_rand + hot_boost * 0.5

            value = round(min(100.0, max(0.0, raw)))
            sev = _severity(value)

            # Confidence lower when fewer frames in segment
            n_frames = len(seg_frames)
            conf_base = _pseudo_rand(f"{session_key}_{rname}_{layer_id}_{seg_i}_conf", 0.5, 0.98)
            if n_frames == 0:
                confidence = round(_pseudo_rand(f"{session_key}_{rname}_{layer_id}_{seg_i}_conf2", 0.2, 0.5), 2)
            elif n_frames < 3:
                confidence = round(conf_base * 0.7, 2)
            else:
                confidence = round(conf_base, 2)

            seg_id = f"{rname}_{int(start_m*10):05d}_{int(end_m*10):05d}"
            frame_ids = [f["id"] for f in seg_frames]

            title_map = SEVERITY_HIGH_TITLES if sev == "high" else (SEVERITY_MED_TITLES if sev == "medium" else SEVERITY_LOW_TITLES)
            title = title_map.get(layer_id, sev)
            summary = SUMMARIES.get(layer_id, {}).get(sev, "")
            action = ACTIONS.get(layer_id, {}).get(sev, "")
            reasons = REASONS.get(layer_id, {}).get(sev, [])

            items.append({
                "id": seg_id,
                "rail_name": rname,
                "rail_column": rail["column"],
                "start_m": round(start_m, 2),
                "end_m": round(end_m, 2),
                "value": value,
                "severity": sev,
                "confidence": confidence,
                "status": "critical" if sev == "high" else ("warning" if sev == "medium" else "ok"),
                "source": "demo",
                "title": title,
                "summary": summary,
                "recommended_action": action,
                "reasons": reasons,
                "frame_ids": frame_ids,
            })

    return items


def build_layers(config: BuildConfig, public_frames: list[dict[str, Any]], dataset: dict[str, Any]) -> dict[str, Any]:
    session_key = config.dataset_key
    rails = dataset["rails"]
    odom_x_min = dataset["odom_x_min"]
    odom_x_max = dataset["odom_x_max"]
    step_m = dataset["step_m"]

    layers_out = []
    for layer_def in LAYER_DEFS:
        items = _build_layer_items(
            layer_id=layer_def["id"],
            rails=rails,
            frames=public_frames,
            session_key=session_key,
            odom_x_min=odom_x_min,
            odom_x_max=odom_x_max,
            step_m=step_m,
        )
        layers_out.append({
            **layer_def,
            "items": items,
        })

    result: dict[str, Any] = {
        "source": "demo",
        "generated_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "session": config.dataset_key,
        "layers": layers_out,
    }
    config.layers_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return result


def generate_demo_layers_runtime(
    session_key: str,
    rails: list[dict[str, Any]],
    frames: list[dict[str, Any]],
    odom_x_min: float,
    odom_x_max: float,
    step_m: float,
) -> dict[str, Any]:
    """Runtime fallback: generate demo layers without a BuildConfig."""
    layers_out = []
    for layer_def in LAYER_DEFS:
        items = _build_layer_items(
            layer_id=layer_def["id"],
            rails=rails,
            frames=frames,
            session_key=session_key,
            odom_x_min=odom_x_min,
            odom_x_max=odom_x_max,
            step_m=step_m,
        )
        layers_out.append({**layer_def, "items": items})

    return {
        "source": "demo",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "session": session_key,
        "layers": layers_out,
    }
