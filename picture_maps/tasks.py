from __future__ import annotations

import hashlib
from typing import Any


TASK_DEFS: dict[str, dict[str, dict[str, Any]]] = {
    "disease_pest_risk": {
        "high": {
            "title": "병충해 의심 구간 현장 확인",
            "reason": "흰가루병 또는 진딧물 의심 패턴 감지",
            "recommended_action": "즉시 방제 약제 살포 검토 및 격리 조치",
            "due_label": "12시간 내",
            "task_type": "disease_check",
        },
        "medium": {
            "title": "병충해 주의 구간 순찰",
            "reason": "경미한 병반 흔적, 추가 확인 권장",
            "recommended_action": "방제 일정 앞당기기",
            "due_label": "이번 주",
            "task_type": "disease_check",
        },
    },
    "growth_status": {
        "high": {
            "title": "생육 정체 구간 즉시 점검",
            "reason": "3회 연속 생육 정체, 환경 요인 점검 필요",
            "recommended_action": "온·습도 및 양액 농도 즉시 점검",
            "due_label": "12시간 내",
            "task_type": "growth_check",
        },
        "medium": {
            "title": "생육 둔화 구간 모니터링 강화",
            "reason": "생육 속도 평균 대비 15% 이하",
            "recommended_action": "환경 데이터 추이 모니터링 강화",
            "due_label": "48시간 내",
            "task_type": "growth_check",
        },
    },
    "data_reliability": {
        "high": {
            "title": "데이터 공백 구간 재촬영 필요",
            "reason": "복수 카메라 누락 또는 연속 프레임 공백",
            "recommended_action": "해당 구간 재촬영 및 카메라 점검",
            "due_label": "오늘",
            "task_type": "reshot",
        },
        "medium": {
            "title": "카메라 이상 구간 점검",
            "reason": "단일 카메라 누락 또는 odom 이상",
            "recommended_action": "다음 촬영 시 카메라 상태 확인",
            "due_label": "48시간 내",
            "task_type": "camera_check",
        },
    },
    "harvest_readiness": {
        "high": {
            "title": "수확 임박 구간 즉시 수확",
            "reason": "당도 및 색도 기준 초과, 즉시 수확 권장",
            "recommended_action": "수확 팀 즉시 투입",
            "due_label": "오늘",
            "task_type": "harvest",
        },
        "medium": {
            "title": "수확 준비 구간 일정 조정",
            "reason": "수확 기준 접근 중, 3~5일 내 수확 예상",
            "recommended_action": "수확 일정 3일 이내로 조정",
            "due_label": "이번 주",
            "task_type": "harvest",
        },
    },
    "action_priority": {
        "high": {
            "title": "우선 점검 필요 구간 현장 확인",
            "reason": "생육 정체 및 병충해 복합 신호 감지",
            "recommended_action": "12시간 내 현장 확인 및 방제 검토",
            "due_label": "12시간 내",
            "task_type": "priority_check",
        },
    },
}

LAYER_ORDER = ["action_priority", "disease_pest_risk", "harvest_readiness", "growth_status", "data_reliability"]
PRIORITY_RANK = {"high": 0, "medium": 1}
MAX_PER_LAYER_SEV: dict[str, int] = {"high": 3, "medium": 2}


def _pseudo_rand_int(seed_str: str, lo: int, hi: int) -> int:
    n = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
    return lo + (n % max(1, hi - lo + 1))


def generate_tasks(session_key: str, layers: dict[str, Any]) -> dict[str, Any]:
    tasks: list[dict[str, Any]] = []
    seen_segment_ids: set[str] = set()

    for layer_id in LAYER_ORDER:
        layer = next((l for l in layers.get("layers", []) if l["id"] == layer_id), None)
        if not layer:
            continue
        tdef_map = TASK_DEFS.get(layer_id, {})

        for sev in ("high", "medium"):
            if sev not in tdef_map:
                continue
            tdef = tdef_map[sev]
            candidates = [
                item for item in layer["items"]
                if item["severity"] == sev and item["id"] not in seen_segment_ids
            ]
            if not candidates:
                continue

            candidates.sort(key=lambda x: -x["value"])
            limit = MAX_PER_LAYER_SEV.get(sev, 2)
            for seg in candidates[:limit]:
                seen_segment_ids.add(seg["id"])
                task_id = f"task_{layer_id}_{sev}_{seg['id']}"
                r = _pseudo_rand_int(f"{session_key}_{task_id}_status", 0, 99)
                if r < 5:
                    status = "done"
                elif r < 20:
                    status = "in_progress"
                else:
                    status = "todo"

                tasks.append({
                    "id": task_id,
                    "title": tdef["title"],
                    "priority": sev,
                    "task_type": tdef["task_type"],
                    "rail_name": seg["rail_name"],
                    "start_m": seg["start_m"],
                    "end_m": seg["end_m"],
                    "reason": tdef["reason"],
                    "recommended_action": tdef["recommended_action"],
                    "due_label": tdef["due_label"],
                    "source": "demo",
                    "status": status,
                    "layer_id": layer_id,
                    "frame_ids": seg.get("frame_ids", []),
                    "value": seg["value"],
                    "confidence": seg["confidence"],
                })

    def _sort_key(t: dict[str, Any]) -> tuple:
        status_order = {"todo": 0, "in_progress": 1, "done": 2}
        return (status_order.get(t["status"], 3), PRIORITY_RANK.get(t["priority"], 2), -t["value"])

    tasks.sort(key=_sort_key)

    return {
        "source": "demo",
        "session": session_key,
        "tasks": tasks,
        "summary": {
            "total": len(tasks),
            "high_open": sum(1 for t in tasks if t["priority"] == "high" and t["status"] != "done"),
            "medium_open": sum(1 for t in tasks if t["priority"] == "medium" and t["status"] != "done"),
            "todo": sum(1 for t in tasks if t["status"] == "todo"),
            "in_progress": sum(1 for t in tasks if t["status"] == "in_progress"),
            "done": sum(1 for t in tasks if t["status"] == "done"),
        },
    }
