from __future__ import annotations

import hashlib
import math
from typing import Any


def _pseudo_rand_f(seed_str: str, lo: float = 0.0, hi: float = 1.0) -> float:
    n = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
    return lo + (n % 100_000) / 100_000.0 * (hi - lo)


def _make_trend(session_key: str, rail_name: str, metric: str, current_val: float, n: int = 6) -> list[float]:
    """Generate a plausible n-point trend ending at current_val."""
    seed = f"{session_key}_{rail_name}_{metric}"
    start_offset = _pseudo_rand_f(f"{seed}_start", -22, 22)
    start_val = max(0.0, min(100.0, current_val + start_offset))

    values: list[float] = []
    for i in range(n):
        t = i / (n - 1)
        base = start_val + (current_val - start_val) * t
        noise = _pseudo_rand_f(f"{seed}_noise_{i}", -6, 6)
        # Additional "event" bump in the middle to add interest
        bump_t = _pseudo_rand_f(f"{seed}_bump_t", 0.2, 0.7)
        bump_size = _pseudo_rand_f(f"{seed}_bump_size", -12, 12)
        bump = bump_size * max(0, 1 - abs(t - bump_t) * 4)
        values.append(round(max(0.0, min(100.0, base + noise + bump)), 1))

    values[-1] = round(current_val, 1)
    return values


def _trend_summary(vals: list[float], higher_is_bad: bool = False) -> str:
    if len(vals) < 2:
        return ""
    delta = vals[-1] - vals[-2]
    is_worsening = (delta > 0) if higher_is_bad else (delta < 0)
    is_improving = (delta < 0) if higher_is_bad else (delta > 0)

    if len(vals) >= 3:
        last3 = vals[-3:]
        all_worse = all(
            (last3[i] > last3[i - 1]) if higher_is_bad else (last3[i] < last3[i - 1])
            for i in range(1, 3)
        )
        all_better = all(
            (last3[i] < last3[i - 1]) if higher_is_bad else (last3[i] > last3[i - 1])
            for i in range(1, 3)
        )
        if all_worse:
            return "최근 3회 연속 악화 주의"
        if all_better:
            return "최근 3회 연속 개선 중"

    if abs(delta) < 2:
        return "안정적 유지"
    if is_worsening:
        return f"직전 대비 {'+' if delta > 0 else ''}{delta:.0f} 악화"
    if is_improving:
        return f"직전 대비 {'+' if delta > 0 else ''}{delta:.0f} 개선"
    return ""


def generate_trends(session_key: str, layers: dict[str, Any], manifest: dict[str, Any]) -> dict[str, Any]:
    rails = manifest.get("rails", [])

    layer_avgs: dict[str, dict[str, float]] = {}
    for layer in layers.get("layers", []):
        lid = layer["id"]
        by_rail: dict[str, list[float]] = {}
        for item in layer.get("items", []):
            by_rail.setdefault(item["rail_name"], []).append(float(item["value"]))
        for rname, vals in by_rail.items():
            layer_avgs.setdefault(rname, {})[lid] = round(sum(vals) / len(vals), 1) if vals else 50.0

    n = 6
    session_labels = [f"S-{n - 1 - i}" for i in range(n - 1)] + ["현재"]

    rail_trends: dict[str, Any] = {}
    for rail in rails:
        rname = rail["name"]
        cur = layer_avgs.get(rname, {})
        cur_disease = cur.get("disease_pest_risk", 50.0)
        cur_growth = cur.get("growth_status", 50.0)
        cur_reliability = cur.get("data_reliability", 50.0)
        cur_harvest = cur.get("harvest_readiness", 50.0)
        cur_health = round(
            max(0, min(100,
                (100 - cur_disease) * 0.35 + cur_growth * 0.35 + cur_reliability * 0.20 + (100 - cur_harvest) * 0.10
            )), 1
        )

        t_disease = _make_trend(session_key, rname, "disease_pest_risk", cur_disease, n)
        t_growth = _make_trend(session_key, rname, "growth_status", cur_growth, n)
        t_reliability = _make_trend(session_key, rname, "data_reliability", cur_reliability, n)
        t_harvest = _make_trend(session_key, rname, "harvest_readiness", cur_harvest, n)
        t_health = [
            round(max(0, min(100,
                (100 - t_disease[i]) * 0.35 + t_growth[i] * 0.35 + t_reliability[i] * 0.20 + (100 - t_harvest[i]) * 0.10
            )), 1)
            for i in range(n)
        ]

        rail_trends[rname] = {
            "sessions": session_labels,
            "trends": {
                "health_score": t_health,
                "disease_pest_risk": t_disease,
                "growth_status": t_growth,
                "data_reliability": t_reliability,
            },
            "summaries": {
                "health_score": _trend_summary(t_health, higher_is_bad=False),
                "disease_pest_risk": _trend_summary(t_disease, higher_is_bad=True),
                "growth_status": _trend_summary(t_growth, higher_is_bad=False),
                "data_reliability": _trend_summary(t_reliability, higher_is_bad=False),
            },
            "current": {
                "health_score": cur_health,
                "disease_pest_risk": cur_disease,
                "growth_status": cur_growth,
                "data_reliability": cur_reliability,
            },
        }

    return {
        "source": "demo",
        "session": session_key,
        "session_labels": session_labels,
        "rails": rail_trends,
    }
