from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from .config import BuildConfig
from .insights import compute_insights
from .layers import generate_demo_layers_runtime


SESSION_RE = re.compile(r"^(\d{8}_\d{6})$")
TASK_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}
TASK_STATUS_ORDER = {"todo": 0, "in_progress": 1, "done": 2}

METRIC_DEFS = {
    "health_score": {
        "label": "Health score",
        "direction": "up_good",
        "summary_label": "건강도",
    },
    "disease_pest_risk": {
        "label": "Disease / Pest risk",
        "direction": "down_good",
        "summary_label": "병충해 위험",
    },
    "growth_status": {
        "label": "Growth status",
        "direction": "up_good",
        "summary_label": "생육 안정성",
    },
    "data_reliability": {
        "label": "Data reliability",
        "direction": "up_good",
        "summary_label": "데이터 신뢰도",
    },
}


def _seed_int(seed_str: str) -> int:
    return int(hashlib.sha1(seed_str.encode("utf-8")).hexdigest(), 16)


def _pseudo_rand(seed_str: str, lo: float = 0.0, hi: float = 1.0) -> float:
    base = _seed_int(seed_str) % 100000
    return lo + (base / 100000.0) * (hi - lo)


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def _round(value: float) -> int:
    return int(round(_clamp(value)))


def _parse_session_dt(session_name: str) -> datetime | None:
    if not SESSION_RE.match(session_name):
        return None
    try:
        return datetime.strptime(session_name, "%Y%m%d_%H%M%S")
    except ValueError:
        return None


def _session_label(session_name: str) -> str:
    dt = _parse_session_dt(session_name)
    if not dt:
        return session_name
    return dt.strftime("%m/%d")


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _list_related_sessions(build_root: Path, device_name: str, current_session_name: str) -> list[dict[str, Any]]:
    sessions: dict[str, datetime | None] = {}

    if build_root.exists():
        for manifest_path in build_root.glob("*/manifest.json"):
            try:
                payload = json.loads(manifest_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if payload.get("device_name") != device_name:
                continue
            session_name = payload.get("session_name")
            if not session_name:
                continue
            sessions[session_name] = _parse_session_dt(session_name)

    sessions.setdefault(current_session_name, _parse_session_dt(current_session_name))
    ordered = sorted(
        sessions.items(),
        key=lambda item: (item[1] is None, item[1] or datetime.max, item[0]),
    )
    names = [name for name, _dt in ordered]
    if current_session_name in names:
        current_idx = names.index(current_session_name)
        names = names[max(0, current_idx - 5): current_idx + 1]

    if len(names) >= 4:
        return [
            {
                "session": name,
                "label": _session_label(name),
                "is_current": name == current_session_name,
                "date": sessions.get(name).isoformat(timespec="seconds") if sessions.get(name) else None,
            }
            for name in names
        ]

    base_dt = _parse_session_dt(current_session_name) or datetime.now()
    synthetic: list[str] = []
    for offset in range(5, 0, -1):
        synthetic.append((base_dt - timedelta(days=offset)).strftime("%Y%m%d_%H%M%S"))
    synthetic.append(current_session_name)
    return [
        {
            "session": name,
            "label": _session_label(name),
            "is_current": name == current_session_name,
            "date": (_parse_session_dt(name) or base_dt).isoformat(timespec="seconds"),
        }
        for name in synthetic
    ]


def _segment_lookup(layers: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    segments: dict[str, dict[str, Any]] = {}
    rail_segments: dict[str, list[dict[str, Any]]] = {}

    for layer in layers.get("layers", []):
        layer_id = layer["id"]
        for item in layer.get("items", []):
            profile = segments.setdefault(
                item["id"],
                {
                    "id": item["id"],
                    "rail_name": item["rail_name"],
                    "start_m": item["start_m"],
                    "end_m": item["end_m"],
                    "frame_ids": list(item.get("frame_ids", [])),
                    "metrics": {},
                },
            )
            profile["metrics"][layer_id] = item

    for profile in segments.values():
        action = profile["metrics"].get("action_priority", {})
        disease = profile["metrics"].get("disease_pest_risk", {})
        growth_issue = profile["metrics"].get("growth_status", {})
        reliability_issue = profile["metrics"].get("data_reliability", {})
        harvest = profile["metrics"].get("harvest_readiness", {})

        action_value = action.get("value", 0)
        disease_value = disease.get("value", 0)
        growth_issue_value = growth_issue.get("value", 0)
        reliability_issue_value = reliability_issue.get("value", 0)
        harvest_value = harvest.get("value", 0)

        profile["derived"] = {
            "action_priority": action_value,
            "health_score": _round(
                100
                - (
                    action_value * 0.34
                    + disease_value * 0.27
                    + growth_issue_value * 0.2
                    + reliability_issue_value * 0.19
                )
            ),
            "disease_pest_risk": _round(disease_value),
            "growth_status": _round(100 - growth_issue_value),
            "growth_issue": _round(growth_issue_value),
            "data_reliability": _round(100 - reliability_issue_value),
            "data_issue": _round(reliability_issue_value),
            "harvest_readiness": _round(harvest_value),
            "severity_rank": round(
                action_value * 0.38
                + disease_value * 0.24
                + growth_issue_value * 0.18
                + reliability_issue_value * 0.14
                + harvest_value * 0.06,
                1,
            ),
        }
        profile["focus_frame_id"] = profile["frame_ids"][len(profile["frame_ids"]) // 2] if profile["frame_ids"] else None
        profile["headline"] = action.get("title") or disease.get("title") or "운영 점검 구간"
        rail_segments.setdefault(profile["rail_name"], []).append(profile)

    for items in rail_segments.values():
        items.sort(key=lambda item: item["start_m"])

    return segments, rail_segments


def _task_candidate(profile: dict[str, Any], insights: dict[str, Any]) -> list[dict[str, Any]]:
    derived = profile["derived"]
    rail_name = profile["rail_name"]
    start_m = profile["start_m"]
    end_m = profile["end_m"]
    focus_frame_id = profile.get("focus_frame_id")
    frame_ids = profile.get("frame_ids", [])
    frames = insights.get("frames", {}) if insights else {}

    related_flags = set()
    for frame_id in frame_ids:
        related_flags.update(frames.get(str(frame_id), {}).get("flags", []))

    tasks: list[dict[str, Any]] = []
    range_label = f"{start_m:.1f}m-{end_m:.1f}m"

    if derived["disease_pest_risk"] >= 45:
        score = derived["disease_pest_risk"] + derived["action_priority"] * 0.25
        priority = "high" if derived["disease_pest_risk"] >= 72 else "medium" if derived["disease_pest_risk"] >= 58 else "low"
        tasks.append({
            "type": "disease_check",
            "score": round(score, 1),
            "priority": priority,
            "title": "병충해 의심 구간 현장 확인",
            "reason": f"병충해 위험 {derived['disease_pest_risk']}점으로 {range_label}에서 재진입 신호가 보입니다.",
            "recommended_action": "현장 사진 재확인 후 방제 필요 여부를 관리자에게 보고하세요.",
            "rail_name": rail_name,
            "start_m": start_m,
            "end_m": end_m,
            "segment_id": profile["id"],
            "focus_frame_id": focus_frame_id,
            "due_label": "오늘" if priority == "high" else "24시간 내",
        })

    if derived["growth_issue"] >= 45 and derived["action_priority"] >= 40:
        score = derived["growth_issue"] * 0.7 + derived["action_priority"] * 0.3
        priority = "high" if derived["growth_issue"] >= 75 else "medium" if derived["growth_issue"] >= 58 else "low"
        tasks.append({
            "type": "growth_check",
            "score": round(score, 1),
            "priority": priority,
            "title": "생육 정체 구간 점검",
            "reason": f"생육 안정성 {derived['growth_status']}점으로 낮아졌고, 운영 우선순위가 상승했습니다.",
            "recommended_action": "양액, 온습도, 차광 조건을 우선 점검하고 담당자 메모를 남기세요.",
            "rail_name": rail_name,
            "start_m": start_m,
            "end_m": end_m,
            "segment_id": profile["id"],
            "focus_frame_id": focus_frame_id,
            "due_label": "오늘" if priority == "high" else "이번 주",
        })

    if derived["data_issue"] >= 35:
        priority = "high" if derived["data_issue"] >= 72 else "medium" if derived["data_issue"] >= 50 else "low"
        missing_hint = " 카메라 누락 징후가 함께 감지되었습니다." if "missing_camera" in related_flags else ""
        tasks.append({
            "type": "recapture",
            "score": round(derived["data_issue"] * 0.9 + derived["action_priority"] * 0.2, 1),
            "priority": priority,
            "title": "데이터 공백 구간 재촬영",
            "reason": f"데이터 신뢰도 {derived['data_reliability']}점으로 낮아졌습니다.{missing_hint}",
            "recommended_action": "다음 주행 전에 공백 구간을 우선 재촬영하고 누락 프레임 여부를 검수하세요.",
            "rail_name": rail_name,
            "start_m": start_m,
            "end_m": end_m,
            "segment_id": profile["id"],
            "focus_frame_id": focus_frame_id,
            "due_label": "12시간 내" if priority == "high" else "24시간 내",
        })

    if "missing_camera" in related_flags or derived["data_issue"] >= 68:
        score = derived["data_issue"] + (12 if "missing_camera" in related_flags else 0)
        priority = "high" if score >= 78 else "medium"
        tasks.append({
            "type": "camera_check",
            "score": round(score, 1),
            "priority": priority,
            "title": "카메라 이상 점검",
            "reason": f"{rail_name} {range_label} 구간에서 촬영 누락 또는 연속 이상 패턴이 반복됩니다.",
            "recommended_action": "해당 레일 카메라 상태와 저장 경로를 확인하고 점검 결과를 공유하세요.",
            "rail_name": rail_name,
            "start_m": start_m,
            "end_m": end_m,
            "segment_id": profile["id"],
            "focus_frame_id": focus_frame_id,
            "due_label": "오늘" if priority == "high" else "이번 주",
        })

    if derived["harvest_readiness"] >= 55:
        priority = "high" if derived["harvest_readiness"] >= 82 else "medium" if derived["harvest_readiness"] >= 68 else "low"
        tasks.append({
            "type": "harvest_check",
            "score": round(derived["harvest_readiness"] * 0.8 + derived["action_priority"] * 0.15, 1),
            "priority": priority,
            "title": "수확 임박 구간 확인",
            "reason": f"수확 준비도 {derived['harvest_readiness']}점으로, 작업 우선순위와 함께 확인이 필요합니다.",
            "recommended_action": "수확팀과 일정을 조정하고 현장 품질 샘플을 함께 확인하세요.",
            "rail_name": rail_name,
            "start_m": start_m,
            "end_m": end_m,
            "segment_id": profile["id"],
            "focus_frame_id": focus_frame_id,
            "due_label": "오늘" if priority == "high" else "이번 주",
        })

    return tasks


def _assign_task_status(task_id: str, priority: str, order_index: int) -> str:
    if priority == "high":
        cycle = ["todo", "in_progress", "todo", "done", "todo"]
        return cycle[order_index % len(cycle)]
    if priority == "medium":
        cycle = ["in_progress", "todo", "done", "todo"]
        return cycle[order_index % len(cycle)]
    cycle = ["done", "todo", "in_progress", "done"]
    return cycle[order_index % len(cycle)]


def _assign_task_status_seeded(task_id: str, priority: str) -> str:
    roll = _pseudo_rand(f"{task_id}:status")
    if priority == "high":
        if roll < 0.14:
            return "done"
        if roll < 0.38:
            return "in_progress"
        return "todo"
    if priority == "medium":
        if roll < 0.22:
            return "done"
        if roll < 0.5:
            return "in_progress"
        return "todo"
    if roll < 0.35:
        return "done"
    if roll < 0.6:
        return "in_progress"
    return "todo"


def _build_tasks(segments: dict[str, dict[str, Any]], insights: dict[str, Any]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    for profile in segments.values():
        for candidate in _task_candidate(profile, insights):
            dedupe_key = (candidate["segment_id"], candidate["type"])
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            task_id = f"task:{candidate['type']}:{candidate['segment_id']}"
            candidate["id"] = task_id
            candidate["source"] = "demo"
            candidate["context_label"] = f"{candidate['rail_name']} · {candidate['start_m']:.1f}-{candidate['end_m']:.1f}m"
            items.append(candidate)

    items.sort(key=lambda item: (-item["score"], item["rail_name"], item["start_m"]))
    buckets = {
        "high": [item for item in items if item["priority"] == "high"],
        "medium": [item for item in items if item["priority"] == "medium"],
        "low": [item for item in items if item["priority"] == "low"],
    }
    selected = buckets["high"][:6] + buckets["medium"][:6] + buckets["low"][:4]
    if len(selected) < 16:
        selected_ids = {item["id"] for item in selected}
        for item in items:
            if item["id"] in selected_ids:
                continue
            selected.append(item)
            selected_ids.add(item["id"])
            if len(selected) >= 16:
                break

    items = selected
    for index, item in enumerate(items):
        item["status"] = _assign_task_status(item["id"], item["priority"], index)
        if item["priority"] == "high" and item["status"] == "done" and _assign_task_status_seeded(item["id"], item["priority"]) == "todo":
            item["status"] = "in_progress"

    items.sort(
        key=lambda item: (
            TASK_PRIORITY_ORDER.get(item["priority"], 9),
            TASK_STATUS_ORDER.get(item["status"], 9),
            -item["score"],
            item["rail_name"],
            item["start_m"],
        )
    )

    counts = {
        "total": len(items),
        "todo": sum(1 for item in items if item["status"] == "todo"),
        "in_progress": sum(1 for item in items if item["status"] == "in_progress"),
        "done": sum(1 for item in items if item["status"] == "done"),
        "high": sum(1 for item in items if item["priority"] == "high"),
        "medium": sum(1 for item in items if item["priority"] == "medium"),
        "low": sum(1 for item in items if item["priority"] == "low"),
    }
    counts["unresolved"] = counts["todo"] + counts["in_progress"]

    return {
        "generated_from": "demo",
        "summary": counts,
        "filters": [
            {"id": "all", "label": "전체"},
            {"id": "inspection_needed", "label": "오늘 점검"},
            {"id": "high_risk", "label": "고위험"},
            {"id": "unresolved", "label": "미해결"},
            {"id": "data_gap", "label": "데이터 공백"},
        ],
        "items": items,
    }


def _good_delta(metric_id: str, delta: float) -> float:
    return delta if METRIC_DEFS[metric_id]["direction"] == "up_good" else -delta


def _build_metric_series(
    *,
    metric_id: str,
    current_value: float,
    history: list[dict[str, Any]],
    seed_key: str,
) -> dict[str, Any]:
    metric_def = METRIC_DEFS[metric_id]
    direction = metric_def["direction"]
    current_good = current_value if direction == "up_good" else 100 - current_value
    amplitude = _pseudo_rand(f"{seed_key}:{metric_id}:amp", 5, 12)
    swing = _pseudo_rand(f"{seed_key}:{metric_id}:swing", 0.8, 1.6)

    if current_good >= 76:
        modes = ["stable", "improving", "stable", "volatile"]
    elif current_good >= 52:
        modes = ["volatile", "improving", "stable", "worsening"]
    else:
        modes = ["worsening", "reentry", "volatile", "worsening"]
    mode = modes[_seed_int(f"{seed_key}:{metric_id}:mode") % len(modes)]

    history_len = len(history)
    good_values: list[float] = []
    for idx in range(history_len - 1):
        distance = history_len - 1 - idx
        noise = _pseudo_rand(f"{seed_key}:{metric_id}:{history[idx]['session']}:noise", -4.8, 4.8)
        if mode == "improving":
            value = current_good - distance * amplitude + noise
        elif mode == "worsening":
            value = current_good + distance * amplitude + noise
        elif mode == "reentry":
            curve = math.sin((idx / max(1, history_len - 2)) * math.pi * swing)
            value = current_good + curve * amplitude * 1.8 + (distance - 2) * 1.8 + noise
        elif mode == "stable":
            value = current_good + noise * 0.55
        else:
            curve = math.sin((idx + 1) * swing + _pseudo_rand(f"{seed_key}:{metric_id}:phase", 0, math.pi))
            value = current_good + curve * amplitude + noise
        good_values.append(_clamp(value))
    good_values.append(_clamp(current_good))

    values = [round(100 - gv if direction == "down_good" else gv) for gv in good_values]
    points = [
        {
            "session": item["session"],
            "label": item["label"],
            "value": values[idx],
            "is_current": item["is_current"],
        }
        for idx, item in enumerate(history)
    ]

    delta = values[-1] - values[-2] if len(values) > 1 else 0
    good_delta = _good_delta(metric_id, delta)
    recent_good_values = [value if direction == "up_good" else 100 - value for value in values[-4:]]
    diffs = [recent_good_values[i + 1] - recent_good_values[i] for i in range(len(recent_good_values) - 1)]

    if len(diffs) >= 3 and all(diff >= 2 for diff in diffs[-3:]):
        summary = "최근 3회 연속 개선"
    elif len(diffs) >= 3 and all(diff <= -2 for diff in diffs[-3:]):
        summary = "최근 3회 연속 악화"
    elif good_delta >= 8:
        summary = f"지난 세션 대비 +{abs(delta)} 개선"
    elif good_delta <= -8:
        summary = f"지난 세션 대비 {abs(delta)} 악화"
    elif metric_id == "disease_pest_risk" and values[-1] >= 74 and values[-2] < 70:
        summary = "병충해 위험 고점 재진입"
    elif metric_id == "data_reliability" and values[-1] <= 60:
        summary = "데이터 신뢰도 회복 지연"
    else:
        summary = "큰 변동 없이 유지"

    status = "improving" if good_delta > 2 else "worsening" if good_delta < -2 else "steady"
    return {
        "label": metric_def["label"],
        "direction": direction,
        "current_value": values[-1],
        "delta": delta,
        "summary": summary,
        "status": status,
        "points": points,
    }


def _build_trends(
    manifest: dict[str, Any],
    segments: dict[str, dict[str, Any]],
    rail_segments: dict[str, list[dict[str, Any]]],
    tasks: dict[str, Any],
    insights: dict[str, Any],
    build_root: Path,
) -> dict[str, Any]:
    session_name = manifest.get("session_name", "")
    device_name = manifest.get("device_name", "")
    history = _list_related_sessions(build_root, device_name, session_name)

    task_ids_by_segment: dict[str, list[str]] = {}
    for task in tasks["items"]:
        task_ids_by_segment.setdefault(task["segment_id"], []).append(task["id"])

    rail_entries: dict[str, Any] = {}
    for rail_name, items in rail_segments.items():
        health = round(_mean([item["derived"]["health_score"] for item in items]))
        disease = round(_mean([item["derived"]["disease_pest_risk"] for item in items]))
        growth = round(_mean([item["derived"]["growth_status"] for item in items]))
        reliability = round(_mean([item["derived"]["data_reliability"] for item in items]))

        metrics = {
            "health_score": _build_metric_series(metric_id="health_score", current_value=health, history=history, seed_key=f"rail:{rail_name}"),
            "disease_pest_risk": _build_metric_series(metric_id="disease_pest_risk", current_value=disease, history=history, seed_key=f"rail:{rail_name}"),
            "growth_status": _build_metric_series(metric_id="growth_status", current_value=growth, history=history, seed_key=f"rail:{rail_name}"),
            "data_reliability": _build_metric_series(metric_id="data_reliability", current_value=reliability, history=history, seed_key=f"rail:{rail_name}"),
        }
        headline = metrics["health_score"]["summary"]
        if metrics["disease_pest_risk"]["status"] == "worsening" and disease >= 68:
            headline = "병충해 위험 재상승 구간"
        elif metrics["data_reliability"]["status"] == "worsening" and reliability <= 62:
            headline = "데이터 신뢰도 저하 구간"

        rail_entries[rail_name] = {
            "rail_name": rail_name,
            "headline": headline,
            "focus_frame_id": items[0].get("focus_frame_id") if items else None,
            "top_segment_ids": [item["id"] for item in sorted(items, key=lambda item: item["derived"]["severity_rank"], reverse=True)[:3]],
            "metrics": metrics,
        }

    segment_entries: dict[str, Any] = {}
    for segment_id, profile in segments.items():
        metrics = {
            "health_score": _build_metric_series(metric_id="health_score", current_value=profile["derived"]["health_score"], history=history, seed_key=f"segment:{segment_id}"),
            "disease_pest_risk": _build_metric_series(metric_id="disease_pest_risk", current_value=profile["derived"]["disease_pest_risk"], history=history, seed_key=f"segment:{segment_id}"),
            "growth_status": _build_metric_series(metric_id="growth_status", current_value=profile["derived"]["growth_status"], history=history, seed_key=f"segment:{segment_id}"),
            "data_reliability": _build_metric_series(metric_id="data_reliability", current_value=profile["derived"]["data_reliability"], history=history, seed_key=f"segment:{segment_id}"),
        }
        segment_entries[segment_id] = {
            "segment_id": segment_id,
            "rail_name": profile["rail_name"],
            "start_m": profile["start_m"],
            "end_m": profile["end_m"],
            "headline": profile["headline"],
            "focus_frame_id": profile.get("focus_frame_id"),
            "related_task_ids": task_ids_by_segment.get(segment_id, []),
            "metrics": metrics,
        }

    default_segment = None
    if tasks["items"]:
        default_segment = tasks["items"][0]["segment_id"]
    elif segments:
        default_segment = next(iter(segments))

    session_metrics: dict[str, Any] = {}
    for metric_id in METRIC_DEFS:
        per_index = []
        for idx in range(len(history)):
            values = [rail_entries[rail]["metrics"][metric_id]["points"][idx]["value"] for rail in rail_entries]
            per_index.append(round(_mean(values)))
        points = [
            {
                "session": history[idx]["session"],
                "label": history[idx]["label"],
                "value": per_index[idx],
                "is_current": history[idx]["is_current"],
            }
            for idx in range(len(history))
        ]
        delta = per_index[-1] - per_index[-2] if len(per_index) > 1 else 0
        session_metrics[metric_id] = {
            "label": METRIC_DEFS[metric_id]["label"],
            "direction": METRIC_DEFS[metric_id]["direction"],
            "points": points,
            "current_value": per_index[-1],
            "delta": delta,
        }

    return {
        "source": "demo",
        "history": history,
        "default_selection": {
            "rail_name": tasks["items"][0]["rail_name"] if tasks["items"] else (manifest.get("rails", [{}])[0].get("name") if manifest.get("rails") else None),
            "segment_id": default_segment,
        },
        "session_metrics": session_metrics,
        "rails": rail_entries,
        "segments": segment_entries,
    }


def _build_kpis(
    tasks: dict[str, Any],
    segments: dict[str, dict[str, Any]],
    trends: dict[str, Any],
    insights: dict[str, Any],
) -> list[dict[str, Any]]:
    high_risk_segments = sum(
        1
        for item in segments.values()
        if item["derived"]["action_priority"] >= 70 or item["derived"]["disease_pest_risk"] >= 72
    )
    inspection_needed = sum(
        1
        for item in segments.values()
        if item["derived"]["action_priority"] >= 55 or item["derived"]["growth_issue"] >= 60
    )
    data_gap_segments = sum(1 for item in segments.values() if item["derived"]["data_issue"] >= 50)
    unresolved_tasks = tasks["summary"]["unresolved"]

    session_delta = (insights.get("session") or {}).get("delta") if insights else None
    health_delta = session_delta.get("health_score", 0) if isinstance(session_delta, dict) else 0
    delta_value = f"{health_delta:+d}"
    delta_detail = "지난 세션 대비 health 변화"

    return [
        {
            "id": "inspection_needed",
            "label": "오늘 점검 필요 구간",
            "value": inspection_needed,
            "detail": f"고위험 {high_risk_segments}개 포함",
            "tone": "bad" if inspection_needed >= 8 else "warn" if inspection_needed >= 4 else "good",
            "action": "filter:inspection_needed",
        },
        {
            "id": "high_risk",
            "label": "고위험 구간",
            "value": high_risk_segments,
            "detail": "병충해 / 생육 악화 우선 확인",
            "tone": "bad" if high_risk_segments >= 5 else "warn" if high_risk_segments >= 2 else "good",
            "action": "filter:high_risk",
        },
        {
            "id": "unresolved_tasks",
            "label": "미해결 작업",
            "value": unresolved_tasks,
            "detail": f"진행 중 {tasks['summary']['in_progress']} / 완료 {tasks['summary']['done']}",
            "tone": "bad" if unresolved_tasks >= 8 else "warn" if unresolved_tasks >= 4 else "good",
            "action": "filter:unresolved",
        },
        {
            "id": "data_gap",
            "label": "데이터 공백 / 누락",
            "value": data_gap_segments,
            "detail": "재촬영 또는 카메라 점검 필요",
            "tone": "warn" if data_gap_segments >= 1 else "good",
            "action": "filter:data_gap",
        },
        {
            "id": "session_delta",
            "label": "지난 세션 대비",
            "value": delta_value,
            "detail": delta_detail,
            "tone": "good" if health_delta > 0 else "bad" if health_delta < 0 else "neutral",
            "action": "report:delta",
        },
    ]


def _build_report(
    manifest: dict[str, Any],
    tasks: dict[str, Any],
    trends: dict[str, Any],
    segments: dict[str, dict[str, Any]],
    rail_segments: dict[str, list[dict[str, Any]]],
    kpis: list[dict[str, Any]],
    insights: dict[str, Any],
) -> dict[str, Any]:
    session_name = manifest.get("session_name", "")
    session_delta = insights.get("session", {}).get("delta") if insights else None
    top_segments = sorted(
        segments.values(),
        key=lambda item: item["derived"]["severity_rank"],
        reverse=True,
    )[:5]

    risk_sections = [
        {
            "segment_id": item["id"],
            "rail_name": item["rail_name"],
            "range_label": f"{item['start_m']:.1f}-{item['end_m']:.1f}m",
            "headline": item["headline"],
            "reason": f"병충해 {item['derived']['disease_pest_risk']} / 생육 안정성 {item['derived']['growth_status']} / 데이터 신뢰도 {item['derived']['data_reliability']}",
            "recommended_action": next(
                (task["recommended_action"] for task in tasks["items"] if task["segment_id"] == item["id"]),
                "현장 확인 후 관리자 공유",
            ),
            "severity": "high" if item["derived"]["severity_rank"] >= 72 else "medium",
            "focus_frame_id": item.get("focus_frame_id"),
        }
        for item in top_segments
    ]

    rail_status = []
    for rail_name, items in rail_segments.items():
        rail_trend = trends["rails"].get(rail_name, {})
        unresolved = sum(
            1
            for task in tasks["items"]
            if task["rail_name"] == rail_name and task["status"] != "done"
        )
        best_action = next(
            (task["title"] for task in tasks["items"] if task["rail_name"] == rail_name and task["status"] != "done"),
            "정기 점검 유지",
        )
        rail_status.append({
            "rail_name": rail_name,
            "health_score": round(_mean([item["derived"]["health_score"] for item in items])),
            "disease_pest_risk": round(_mean([item["derived"]["disease_pest_risk"] for item in items])),
            "growth_status": round(_mean([item["derived"]["growth_status"] for item in items])),
            "data_reliability": round(_mean([item["derived"]["data_reliability"] for item in items])),
            "unresolved_tasks": unresolved,
            "trend_summary": rail_trend.get("headline", "변동 없음"),
            "recommendation": best_action,
        })

    rail_status.sort(key=lambda row: (row["health_score"], -row["unresolved_tasks"], row["rail_name"]))

    total_tasks = max(1, tasks["summary"]["total"])
    completion_rate = round(tasks["summary"]["done"] * 100 / total_tasks)
    session_metrics = trends.get("session_metrics", {})
    health_points = session_metrics.get("health_score", {}).get("points", [])
    disease_points = session_metrics.get("disease_pest_risk", {}).get("points", [])
    health_change = health_points[-1]["value"] - health_points[0]["value"] if len(health_points) >= 2 else 0
    disease_change = disease_points[-1]["value"] - disease_points[0]["value"] if len(disease_points) >= 2 else 0

    recommended_actions = []
    seen_actions = set()
    for task in tasks["items"]:
        if task["recommended_action"] in seen_actions:
            continue
        recommended_actions.append({
            "task_id": task["id"],
            "headline": task["title"],
            "detail": task["recommended_action"],
            "priority": task["priority"],
        })
        seen_actions.add(task["recommended_action"])
        if len(recommended_actions) >= 5:
            break

    if session_delta and session_delta.get("compared_session"):
        delta_summary = (
            f"{session_delta['compared_session']} 대비 health {session_delta['health_score']:+d}, "
            f"alerts {session_delta['alert_count']:+d}"
        )
    else:
        delta_summary = "직전 세션 비교 데이터는 데모 추이로 표시됩니다."

    return {
        "demo_notice": "DEMO operation data. 실제 센서/AI JSON으로 교체 가능합니다.",
        "headline": "이번 주 우선 조치 rail과 악화 구간을 한눈에 볼 수 있는 운영 리포트",
        "session_overview": {
            "title": "이번 세션 개요",
            "summary": (
                f"{session_name} 세션은 rail {manifest.get('summary', {}).get('rail_count', 0)}개, "
                f"frame {manifest.get('summary', {}).get('frame_count', 0)}개 기준으로 운영 위험과 작업 우선순위를 요약합니다."
            ),
            "source": "demo",
            "generated_at": datetime.now().isoformat(timespec="seconds"),
        },
        "weekly_summary": {
            "title": "주간 운영 요약",
            "summary": (
                f"최근 {len(health_points)}회 기준 health {health_change:+d}, "
                f"병충해 위험 {disease_change:+d} 변화가 관측되었습니다."
            ),
            "cards": [
                {"label": "Health 변화", "value": f"{health_change:+d}", "tone": "good" if health_change > 0 else "bad" if health_change < 0 else "neutral"},
                {"label": "병충해 위험 변화", "value": f"{disease_change:+d}", "tone": "bad" if disease_change > 0 else "good" if disease_change < 0 else "neutral"},
                {"label": "작업 완료율", "value": f"{completion_rate}%", "tone": "good" if completion_rate >= 60 else "warn"},
                {"label": "미해결 작업", "value": str(tasks['summary']['unresolved']), "tone": "bad" if tasks['summary']['unresolved'] >= 6 else "warn"},
            ],
        },
        "kpis": kpis,
        "risk_sections": risk_sections,
        "task_status": {
            "todo": tasks["summary"]["todo"],
            "in_progress": tasks["summary"]["in_progress"],
            "done": tasks["summary"]["done"],
            "completion_rate": completion_rate,
        },
        "rail_status": rail_status,
        "delta": {
            "compared_session": session_delta.get("compared_session") if session_delta else None,
            "health_score": session_delta.get("health_score") if session_delta else None,
            "alert_count": session_delta.get("alert_count") if session_delta else None,
            "summary": delta_summary,
        },
        "recommended_actions": recommended_actions,
        "manager_notes": [
            "점검 우선순위는 action_priority, 병충해 위험, 데이터 공백 점수를 결합한 deterministic demo 결과입니다.",
            "실제 운영 적용 시 동일한 JSON 구조에 실측 센서, 병해 판정, 작업 시스템 결과를 넣으면 바로 교체됩니다.",
        ],
    }


def generate_demo_dashboard_runtime(
    *,
    build_root: Path,
    manifest: dict[str, Any],
    frames_payload: dict[str, Any],
    insights: dict[str, Any] | None,
    layers: dict[str, Any] | None,
) -> dict[str, Any]:
    frames = frames_payload.get("items", [])
    if insights is None:
        insights = compute_insights(manifest, frames_payload, overrides=None)
    if layers is None:
        world = manifest.get("world", {})
        layers = generate_demo_layers_runtime(
            session_key=manifest.get("dataset_key", manifest.get("session_name", "")),
            rails=manifest.get("rails", []),
            frames=frames,
            odom_x_min=world.get("odom_x_min", 0.0),
            odom_x_max=world.get("odom_x_max", 10.0),
            step_m=world.get("sample_step_m", 0.5),
        )

    segments, rail_segments = _segment_lookup(layers)
    tasks = _build_tasks(segments, insights)
    trends = _build_trends(manifest, segments, rail_segments, tasks, insights, build_root)
    kpis = _build_kpis(tasks, segments, trends, insights)
    report = _build_report(manifest, tasks, trends, segments, rail_segments, kpis, insights)

    return {
        "source": "demo",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "session": {
            "device": manifest.get("device_name"),
            "session": manifest.get("session_name"),
            "dataset_key": manifest.get("dataset_key"),
            "demo_notice": "데모 운영 데이터입니다. 실제 센서/AI 결과를 같은 구조의 JSON으로 치환할 수 있습니다.",
        },
        "kpis": kpis,
        "tasks": tasks,
        "trends": trends,
        "report": report,
    }


def build_dashboard(config: BuildConfig) -> dict[str, Any]:
    manifest = json.loads(config.manifest_path.read_text(encoding="utf-8"))
    frames_payload = json.loads(config.frames_path.read_text(encoding="utf-8"))

    insights = None
    if config.insights_path.exists():
        insights = json.loads(config.insights_path.read_text(encoding="utf-8"))

    layers = None
    if config.layers_path.exists():
        layers = json.loads(config.layers_path.read_text(encoding="utf-8"))

    payload = generate_demo_dashboard_runtime(
        build_root=config.build_root,
        manifest=manifest,
        frames_payload=frames_payload,
        insights=insights,
        layers=layers,
    )
    config.dashboard_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return payload
