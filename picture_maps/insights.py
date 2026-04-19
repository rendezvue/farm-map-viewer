"""
Heuristic-based insights generator for farm picture sessions.

Produces insights.json alongside manifest.json after a build.
All scores are 0-100. source field is always "heuristic" unless overrides are merged.

External AI override format: see README for schema.
"""
from __future__ import annotations

import json
import re
import statistics
from datetime import datetime
from pathlib import Path
from typing import Any

CAMERA_ORDER = ("front_left", "front_right", "rear", "side")
SESSION_RE = re.compile(r"^(\d{8}_\d{6})$")

# Gap is flagged when spacing > this multiple of the median step
GAP_THRESHOLD_MULT = 2.5


def _parse_session_dt(session_name: str) -> datetime | None:
    if not SESSION_RE.match(session_name):
        return None
    try:
        return datetime.strptime(session_name, "%Y%m%d_%H%M%S")
    except ValueError:
        return None


def _find_prev_insights(build_root: Path, device_name: str, session_name: str) -> dict[str, Any] | None:
    """Find the most recent prior session's insights for delta calculation."""
    current_dt = _parse_session_dt(session_name)
    if current_dt is None:
        return None

    best_dt: datetime | None = None
    best_insights: dict[str, Any] | None = None

    for build_dir in build_root.iterdir():
        if not build_dir.is_dir():
            continue
        name = build_dir.name
        # Build key format: <session_name>_<hash>  e.g. 20260304_170949_31900c0e
        # Session names are YYYYMMDD_HHMMSS (15 chars), hash is 8 chars, total 24
        if len(name) < 24 or name[15] != "_":
            continue
        candidate_session = name[:15]
        # Check it matches same device by looking at manifest
        insights_path = build_dir / "insights.json"
        if not insights_path.exists():
            continue
        candidate_dt = _parse_session_dt(candidate_session)
        if candidate_dt is None or candidate_dt >= current_dt:
            continue
        try:
            data = json.loads(insights_path.read_text(encoding="utf-8"))
            if data.get("session", {}).get("device") != device_name:
                continue
            if best_dt is None or candidate_dt > best_dt:
                best_dt = candidate_dt
                best_insights = data
        except Exception:
            continue

    return best_insights


def _compute_frame_insights(
    frames: list[dict[str, Any]],
    global_step_m: float,
    alerts: list[dict[str, Any]],
    alert_counter: list[int],  # mutable counter
) -> dict[str, Any]:
    """Compute per-frame heuristics. Mutates alerts list."""
    frame_insights: dict[str, Any] = {}

    # Group by rail for gap detection
    rail_frames: dict[str, list[dict[str, Any]]] = {}
    for frame in frames:
        rail_frames.setdefault(frame["rail_name"], []).append(frame)

    # --- Per-frame: missing camera detection ---
    for frame in frames:
        fid = str(frame["id"])
        cameras = frame.get("cameras", {})
        missing = [c for c in CAMERA_ORDER if c not in cameras]
        flags: list[str] = []
        frame_alert_ids: list[str] = []

        if missing:
            flags.append("missing_camera")
            alert_counter[0] += 1
            aid = f"alert_{alert_counter[0]:04d}"
            alerts.append({
                "id": aid,
                "severity": "warning",
                "category": "missing_camera",
                "title": "카메라 누락",
                "message": (
                    f"{frame['rail_name']} @ {frame['odom_x']:.1f}m: "
                    f"{', '.join(missing)} 카메라 이미지 없음"
                ),
                "rail_name": frame["rail_name"],
                "frame_id": frame["id"],
                "odom_x": frame["odom_x"],
                "source": "heuristic",
            })
            frame_alert_ids.append(aid)

        score = max(0, 100 - len(missing) * 22)
        rec = (
            f"카메라 누락 프레임 점검 필요: {', '.join(missing)}"
            if missing else None
        )

        frame_insights[fid] = {
            "frame_id": frame["id"],
            "rail_name": frame["rail_name"],
            "odom_x": frame["odom_x"],
            "score": score,
            "flags": flags,
            "alert_ids": frame_alert_ids,
            "recommendation": rec,
            "source": "heuristic",
        }

    # --- Per-rail: odom_x gap detection ---
    for rail_name, rf in rail_frames.items():
        sorted_rf = sorted(rf, key=lambda f: f["odom_x"])
        xs = [f["odom_x"] for f in sorted_rf]
        if len(xs) < 2:
            continue
        diffs = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]
        med = statistics.median(diffs)
        threshold = max(med * GAP_THRESHOLD_MULT, global_step_m * GAP_THRESHOLD_MULT)

        for i, diff in enumerate(diffs):
            if diff <= threshold:
                continue
            f_before = sorted_rf[i]
            f_after = sorted_rf[i + 1]
            alert_counter[0] += 1
            aid = f"alert_{alert_counter[0]:04d}"
            alerts.append({
                "id": aid,
                "severity": "info",
                "category": "data_gap",
                "title": "데이터 공백",
                "message": (
                    f"{rail_name}: {f_before['odom_x']:.1f}m ~ {f_after['odom_x']:.1f}m "
                    f"구간 캡처 공백 ({diff:.1f}m, 정상 {med:.1f}m)"
                ),
                "rail_name": rail_name,
                "frame_id": f_before["id"],
                "odom_x": f_before["odom_x"],
                "source": "heuristic",
            })
            fid = str(f_before["id"])
            if fid in frame_insights:
                fi = frame_insights[fid]
                fi["flags"].append("data_gap")
                fi["alert_ids"].append(aid)
                fi["score"] = max(0, fi["score"] - 10)
                if fi["recommendation"] is None:
                    fi["recommendation"] = (
                        f"캡처 공백 구간 재수집 권장: 이후 {diff:.1f}m 구간"
                    )

    return frame_insights


def _compute_rail_insights(
    rails_meta: list[dict[str, Any]],
    frames: list[dict[str, Any]],
    frame_insights: dict[str, Any],
) -> tuple[dict[str, Any], int, int]:
    """Returns (rail_insights, priority_rail_count, total_gap_count)."""
    rail_frames: dict[str, list[dict[str, Any]]] = {}
    for frame in frames:
        rail_frames.setdefault(frame["rail_name"], []).append(frame)

    rail_insights: dict[str, Any] = {}
    priority_rail_count = 0
    total_gap_count = 0

    for rail_meta in rails_meta:
        rail_name = rail_meta["name"]
        rf = rail_frames.get(rail_name, [])
        frame_count = len(rf)

        rail_fi = [frame_insights[str(f["id"])] for f in rf if str(f["id"]) in frame_insights]
        missing_count = sum(1 for fi in rail_fi if "missing_camera" in fi["flags"])
        gap_count = sum(1 for fi in rail_fi if "data_gap" in fi["flags"])
        total_gap_count += gap_count
        issue_count = missing_count + gap_count

        if rail_fi:
            health_score = round(statistics.mean(fi["score"] for fi in rail_fi))
        else:
            health_score = 0

        coverage_score = (
            round(100 * (frame_count - missing_count) / frame_count)
            if frame_count > 0 else 0
        )

        issue_density = issue_count / frame_count if frame_count > 0 else 0
        priority_score = round(min(100, issue_density * 150 + max(0, 60 - health_score) * 0.5))

        is_priority = priority_score >= 20 or issue_count >= 2
        if is_priority:
            priority_rail_count += 1

        flags: list[str] = []
        if missing_count > 0:
            flags.append("missing_camera")
        if gap_count > 0:
            flags.append("data_gap")

        rec_parts: list[str] = []
        if missing_count > 0:
            rec_parts.append(f"카메라 누락 {missing_count}개 프레임 점검 필요")
        if gap_count > 0:
            rec_parts.append(f"캡처 공백 {gap_count}개 구간 재수집 권장")

        rail_insights[rail_name] = {
            "rail_name": rail_name,
            "health_score": health_score,
            "coverage_score": coverage_score,
            "priority_score": priority_score,
            "issue_count": issue_count,
            "frame_count": frame_count,
            "missing_camera_count": missing_count,
            "gap_count": gap_count,
            "flags": flags,
            "recommendation": "; ".join(rec_parts) if rec_parts else None,
            "delta": None,
            "source": "heuristic",
        }

    return rail_insights, priority_rail_count, total_gap_count


def _merge_overrides(
    overrides: dict[str, Any],
    alerts: list[dict[str, Any]],
    frame_insights: dict[str, Any],
    rail_insights: dict[str, Any],
    session_summary: dict[str, Any],
) -> None:
    """Merge external AI results in-place. source changes to heuristic+<ext_source>."""
    ext_source = overrides.get("source", "external")

    for alert in overrides.get("alerts", []):
        alert.setdefault("source", ext_source)
        alerts.append(alert)

    for fid, ext in overrides.get("frames", {}).items():
        if fid not in frame_insights:
            continue
        fi = frame_insights[fid]
        fi["flags"] = list(set(fi["flags"] + ext.get("flags", [])))
        if "score" in ext:
            fi["score"] = min(fi["score"], ext["score"])
        if ext.get("recommendation"):
            fi["recommendation"] = ext["recommendation"]
        fi["source"] = f"heuristic+{ext_source}"

    for rail_name, ext in overrides.get("rails", {}).items():
        if rail_name not in rail_insights:
            continue
        ri = rail_insights[rail_name]
        for key in ("health_score", "priority_score", "coverage_score"):
            if key in ext:
                ri[key] = ext[key]
        ri["flags"] = list(set(ri.get("flags", []) + ext.get("flags", [])))
        if ext.get("recommendation"):
            ri["recommendation"] = ext["recommendation"]
        ri["source"] = f"heuristic+{ext_source}"

    ext_session = overrides.get("session", {})
    for key in ("health_score", "coverage_score"):
        if key in ext_session:
            session_summary[key] = ext_session[key]


def compute_insights(
    manifest: dict[str, Any],
    frames_payload: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    frames: list[dict[str, Any]] = frames_payload.get("items", [])
    rails_meta: list[dict[str, Any]] = manifest.get("rails", [])
    device_name = manifest.get("device_name", "")
    session_name = manifest.get("session_name", "")
    global_step_m = manifest.get("world", {}).get("sample_step_m", 0.5)

    alerts: list[dict[str, Any]] = []
    alert_counter = [0]

    frame_insights = _compute_frame_insights(frames, global_step_m, alerts, alert_counter)
    rail_insights, priority_rail_count, gap_count = _compute_rail_insights(
        rails_meta, frames, frame_insights
    )

    # Session summary
    all_scores = [fi["score"] for fi in frame_insights.values()]
    session_health = round(statistics.mean(all_scores)) if all_scores else 0
    all_coverage = [ri["coverage_score"] for ri in rail_insights.values()]
    session_coverage = round(statistics.mean(all_coverage)) if all_coverage else 0
    missing_frame_count = sum(1 for fi in frame_insights.values() if "missing_camera" in fi["flags"])

    sev_order = {"error": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: (sev_order.get(a["severity"], 9), a.get("rail_name", ""), a.get("odom_x", 0)))

    session_summary: dict[str, Any] = {
        "device": device_name,
        "session": session_name,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source": "heuristic",
        "rail_count": len(rails_meta),
        "frame_count": len(frames),
        "health_score": session_health,
        "coverage_score": session_coverage,
        "alert_count": len(alerts),
        "priority_rail_count": priority_rail_count,
        "gap_count": gap_count,
        "missing_camera_frame_count": missing_frame_count,
        "delta": None,
    }

    # Report
    key_findings: list[str] = []
    actions: list[str] = []
    if missing_frame_count > 0:
        key_findings.append(f"카메라 누락 프레임 {missing_frame_count}개 발견")
        actions.append(f"누락 카메라 프레임 {missing_frame_count}개 현장 점검")
    if gap_count > 0:
        key_findings.append(f"데이터 공백 구간 {gap_count}개 감지")
        actions.append(f"공백 구간 {gap_count}개 재수집 권장")
    if priority_rail_count > 0:
        key_findings.append(f"우선 점검 rail {priority_rail_count}개")
        actions.append(f"우선순위 rail {priority_rail_count}개 집중 확인")
    if session_health < 70:
        key_findings.append(f"전체 health score 낮음 ({session_health}점)")

    report: dict[str, Any] = {
        "session_overview": (
            f"{session_name} 세션: rail {len(rails_meta)}개, frame {len(frames)}개, "
            f"health {session_health}점, coverage {session_coverage}점"
        ),
        "key_findings": key_findings,
        "rail_status": [
            {
                "rail_name": ri["rail_name"],
                "health_score": ri["health_score"],
                "coverage_score": ri["coverage_score"],
                "priority_score": ri["priority_score"],
                "issue_count": ri["issue_count"],
                "flags": ri["flags"],
                "recommendation": ri["recommendation"],
            }
            for ri in rail_insights.values()
        ],
        "recommended_actions": actions,
        "alert_summary": {
            "total": len(alerts),
            "error": sum(1 for a in alerts if a["severity"] == "error"),
            "warning": sum(1 for a in alerts if a["severity"] == "warning"),
            "info": sum(1 for a in alerts if a["severity"] == "info"),
        },
    }

    if overrides:
        _merge_overrides(overrides, alerts, frame_insights, rail_insights, session_summary)
        if overrides.get("source"):
            session_summary["source"] = f"heuristic+{overrides['source']}"

    return {
        "session": session_summary,
        "rails": rail_insights,
        "frames": frame_insights,
        "alerts": alerts,
        "report": report,
    }


def _apply_delta(insights: dict[str, Any], prev: dict[str, Any]) -> None:
    """Mutate insights in-place to add delta vs previous session."""
    prev_s = prev.get("session", {})
    insights["session"]["delta"] = {
        "compared_session": prev_s.get("session"),
        "health_score": insights["session"]["health_score"] - prev_s.get("health_score", insights["session"]["health_score"]),
        "coverage_score": insights["session"]["coverage_score"] - prev_s.get("coverage_score", insights["session"]["coverage_score"]),
        "alert_count": insights["session"]["alert_count"] - prev_s.get("alert_count", insights["session"]["alert_count"]),
    }
    prev_rails = prev.get("rails", {})
    for rail_name, ri in insights["rails"].items():
        pr = prev_rails.get(rail_name)
        if not pr:
            continue
        ri["delta"] = {
            "health_score": ri["health_score"] - pr.get("health_score", ri["health_score"]),
            "coverage_score": ri["coverage_score"] - pr.get("coverage_score", ri["coverage_score"]),
            "compared_session": prev_s.get("session"),
        }


def build_insights(config: "BuildConfig") -> dict[str, Any]:  # type: ignore[name-defined]
    """Generate insights.json for a built session. Called by builder after tile pyramid."""
    from .config import BuildConfig  # local import avoids circular at module level

    manifest = json.loads(config.manifest_path.read_text(encoding="utf-8"))
    frames_payload = json.loads(config.frames_path.read_text(encoding="utf-8"))

    overrides: dict[str, Any] | None = None
    overrides_path = config.dataset_dir / "insights_override.json"
    if overrides_path.exists():
        try:
            overrides = json.loads(overrides_path.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"  [insights] override load failed: {exc}", flush=True)

    insights = compute_insights(manifest, frames_payload, overrides=overrides)

    prev = _find_prev_insights(config.build_root, manifest.get("device_name", ""), manifest.get("session_name", ""))
    if prev:
        _apply_delta(insights, prev)

    config.insights_path.write_text(
        json.dumps(insights, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    s = insights["session"]
    print(
        f"  [insights] health={s['health_score']} coverage={s['coverage_score']} "
        f"alerts={s['alert_count']} priority_rails={s['priority_rail_count']}",
        flush=True,
    )
    return insights
