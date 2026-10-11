"""Live hotspot outbreak detection (feature B).

Not a duplicate counter — a leading indicator. Reports are bucketed into
~440m cells (0.004 deg) over a rolling window; a cell whose report rate in
the last 24h spikes well above that cell's own historical baseline is a
hotspot, even if the reports never merged into one incident.

Cluster signature:
    cell key, centroid, recent_24h count, baseline rate, spike ratio,
    issue mix, +intensity ranking. Ward names resolved from known anchors.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from math import ceil

from sqlalchemy.orm import Session

from ..core.constants import ISSUE_LABELS
from ..core.timeutil import as_naive_utc, utcnow
from ..models.models import Incident, IncidentReport, Report

CELL_DEG = 0.004  # ~440 m at Hyderabad's latitude
WINDOW_HOURS = 72
RECENT_HOURS = 24
BASELINE_HOURS = 240  # capped history used to build a cell baseline

# Known Hyderabad anchors for turning a cell into a readable label.
WARD_ANCHORS: list[tuple[float, float, str]] = [
    (17.4849, 78.3897, "Kukatpally"),
    (17.4669, 78.3530, "Miyapur"),
    (17.4623, 78.4300, "Moosapet"),
    (17.4439, 78.3929, "Ameerpet"),
    (17.4401, 78.3489, "Nizampet"),
    (17.4397, 78.3934, "SR Nagar"),
    (17.4419, 78.3739, "Erragadda"),
    (17.4320, 78.4240, "Balkampet"),
    (17.4241, 78.4384, "Sanathnagar"),
    (17.4283, 78.4475, "Begumpet"),
    (17.4462, 78.4508, "Somajiguda"),
    (17.4006, 78.4739, "Khairtabad"),
    (17.3850, 78.4867, "Abids"),
    (17.3616, 78.4016, "Gachibowli"),
    (17.3910, 78.4773, "Basheerbagh"),
    (17.3833, 78.5011, "Charminar"),
    (17.3678, 78.5248, "Amberpet"),
    (17.3927, 78.4359, "Mehdipatnam"),
    (17.3758, 78.4094, "Gachibowli"),
    (17.4479, 78.4406, "Banjara Hills"),
    (17.3800, 78.4170, "Kondapur"),
]


def _cell_key(lat: float, lng: float) -> str:
    return f"{ceil(lat / CELL_DEG):04d}:{ceil(lng / CELL_DEG):04d}"


def _cell_center(key: str) -> tuple[float, float]:
    parts = key.split(":")
    lat = (int(parts[0]) - 0.5) * CELL_DEG
    lng = (int(parts[1]) - 0.5) * CELL_DEG
    return round(lat, 5), round(lng, 5)


def nearest_area(lat: float, lng: float, max_delta: float = 0.055) -> str:
    best, best_d = None, max_delta
    for a_lat, a_lng, name in WARD_ANCHORS:
        d = ((a_lat - lat) ** 2 + (a_lng - lng) ** 2) ** 0.5
        if d < best_d:
            best, best_d = name, d
    return best or "Hyderabad — unknown area"


def detect_hotspots(
    db: Session,
    window_hours: int = WINDOW_HOURS,
    recent_hours: int = RECENT_HOURS,
    min_reports: int = 2,
) -> dict:
    """Scan the rolling window and flag emerging cells.

    Returns outage-ready payload: hotspots sorted by intensity descending
    plus the aggregate 24h report series for context.
    """
    now = as_naive_utc(utcnow())
    window_start = now - timedelta(hours=window_hours)
    recent_start = now - timedelta(hours=recent_hours)
    baseline_start = now - timedelta(hours=BASELINE_HOURS)

    reports = (
        db.query(Report)
        .filter(Report.timestamp >= baseline_start, Report.timestamp <= now)
        .all()
    )

    cell_total: dict[str, int] = defaultdict(int)
    cell_recent: dict[str, int] = defaultdict(int)
    cell_window: dict[str, int] = defaultdict(int)
    cell_issues: defaultdict[str, dict] = defaultdict(lambda: defaultdict(int))
    cell_lats: defaultdict[str, list] = defaultdict(list)
    cell_lngs: defaultdict[str, list] = defaultdict(list)
    report_ids: defaultdict[str, set] = defaultdict(set)

    for r in reports:
        if r.latitude is None or r.longitude is None:
            continue
        key = _cell_key(r.latitude, r.longitude)
        ts = as_naive_utc(r.timestamp)
        cell_total[key] += 1
        cell_lats[key].append(r.latitude)
        cell_lngs[key].append(r.longitude)
        report_ids[key].add(r.id)
        if ts >= window_start:
            cell_window[key] += 1
            cell_issues[key][r.issue_type or "unknown"] += 1
        if ts >= recent_start:
            cell_recent[key] += 1

    hotspots = []
    for key, recent in cell_recent.items():
        if recent < min_reports:
            continue
        total = cell_total[key]
        baseline_daily = total / (BASELINE_HOURS / 24.0)
        expected_recent = max(0.5, baseline_daily)  # daily rate over the 24h window
        ratio = recent / expected_recent if expected_recent else float("inf")
        if recent < max(2, ceil(expected_recent * 1.5)):
            continue

        lat, lng = _cell_center(key)
        issue_mix = dict(cell_issues[key])
        intensity = min(1.0, (ratio / 5.0) * 0.6 + (recent / 8.0) * 0.4)

        hotspots.append(
            {
                "cell": key,
                "area": nearest_area(lat, lng),
                "latitude": round(lat, 5),
                "longitude": round(lng, 5),
                "reports_window": cell_window[key],
                "reports_recent": recent,
                "baseline_daily": round(baseline_daily, 2),
                "spike_ratio": round(ratio, 2),
                "intensity": round(intensity, 3),
                "issue_mix": issue_mix,
                "report_ids": sorted(report_ids[key]),
            }
        )

    hotspots.sort(key=lambda h: h["intensity"], reverse=True)

    series_24h = _recent_series(recent_start, now, reports)

    return {
        "generated_at": now.isoformat(),
        "window_hours": window_hours,
        "recent_hours": recent_hours,
        "hotspots": hotspots[:10],
        "hotspot_count": len(hotspots),
        "series_24h": series_24h,
    }


def _recent_series(start: datetime, end: datetime, reports: list) -> list[dict]:
    by_hour: defaultdict[str, int] = defaultdict(int)
    cursor = start.replace(minute=0, second=0, microsecond=0)
    while cursor <= end:
        by_hour.setdefault(cursor.isoformat(), 0)
        cursor += timedelta(hours=1)
    for r in reports:
        ts = as_naive_utc(r.timestamp)
        if start <= ts <= end:
            hour = ts.replace(minute=0, second=0, microsecond=0).isoformat()
            by_hour[hour] += 1
    return [{"hour": h, "reports": n} for h, n in sorted(by_hour.items())]


def incident_counts(db: Session) -> list[dict]:
    """Cross-link: how many open incidents each hotspot corresponds to."""
    incidents = db.query(Incident).all()
    rows = []
    for inc in incidents:
        merged: list[int] = []
        for link in inc.report_links:
            r = link.report
            lat, lng = r.latitude, r.longitude
            if lat is None or lng is None:
                continue
            merged.append(_cell_key(lat, lng))
        rows.append(
            {
                "incident_id": inc.id,
                "issue_label": inc.issue_label,
                "cells": merged,
            }
        )
    return rows