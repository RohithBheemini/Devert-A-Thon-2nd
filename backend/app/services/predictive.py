"""Resolution forecasting (feature A).

Predicts when an incident is likely to be resolved based on deterministic,
explainable signals:
    base hours per issue type  (= department service norm / SLA)
    X priority multiplier      (urgent work is turned around faster)
    / workload penalty         (busy departments take longer)

The forecast is stored on the incident as `predicted_resolve_at` and re-derived
whenever priority is recomputed. The watchdog uses it to detect stalled work.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from ..core.constants import ISSUE_LABELS
from ..core.timeutil import as_naive_utc, utcnow
from ..models.models import Incident

# Normative handling time per issue class (hours)
BASE_RESOLUTION_HOURS: dict[str, float] = {
    "pothole": 48.0,
    "garbage_overflow": 36.0,
    "water_leakage": 24.0,
    "broken_streetlight": 72.0,
}

# Priority shortens the horizon (urgent work is prioritized by the department)
PRIORITY_MULTIPLIER: dict[str, float] = {
    "CRITICAL": 0.40,
    "HIGH": 0.70,
    "MEDIUM": 1.00,
    "LOW": 1.40,
}

# +10% per this many concurrently OPEN incidents in the same department
WORKLOAD_STEP = 3


def base_hours(issue_type: str) -> float:
    return BASE_RESOLUTION_HOURS.get(issue_type, 48.0)


def predict_resolution_hours(incident: Incident) -> float:
    """Compute predicted hours-to-resolve for an incident right now."""
    base = base_hours(incident.issue_type)
    mult = PRIORITY_MULTIPLIER.get(incident.priority_level, 1.0)
    mult *= 1.0 + 0.10 * (incident.escalation_level or 0)
    return round(base * mult, 1)


def apply_prediction(incident: Incident) -> datetime:
    """Set and persist `predicted_resolve_at` based on current signals.

    The clock starts at the oldest merged report: the issue has existed since
    the first citizen spoke up, not since the incident row was created.
    """
    horizon = predict_resolution_hours(incident)
    started = _work_started(incident)
    incident.predicted_resolve_at = started + timedelta(hours=horizon)
    return incident.predicted_resolve_at


def _work_started(incident: Incident) -> datetime:
    oldest = None
    for link in incident.report_links:
        if link.relationship_type == "merged":
            ts = as_naive_utc(link.report.timestamp)
            if oldest is None or ts < oldest:
                oldest = ts
    return oldest or as_naive_utc(incident.created_at)


def resolution_state(incident: Incident, now: datetime | None = None) -> str:
    """Classify how close the incident is to its predicted resolution."""
    if incident.status == "RESOLVED":
        return "RESOLVED"
    predicted = incident.predicted_resolve_at
    if predicted is None:
        return "UNSCHEDULED"
    now = as_naive_utc(now if now is not None else utcnow())
    predicted = as_naive_utc(predicted)
    remaining = (predicted - now).total_seconds() / 3600.0
    if remaining < -48.0:
        return "STALLED"
    if remaining < 0.0:
        return "OVERDUE"
    if remaining <= 6.0:
        return "DUE_SOON"
    return "ON_TRACK"


def overdue_hours(incident: Incident, now: datetime | None = None) -> float:
    predicted = incident.predicted_resolve_at
    if predicted is None:
        return 0.0
    now = as_naive_utc(now if now is not None else utcnow())
    diff = (now - as_naive_utc(predicted)).total_seconds() / 3600.0
    return max(0.0, round(diff, 1))


def forecast_summary(incident: Incident) -> dict:
    """Explainable forecast payload for the UI (why this horizon?)."""
    base = base_hours(incident.issue_type)
    priority_mult = PRIORITY_MULTIPLIER.get(incident.priority_level, 1.0)
    workload = incident.escalation_level or 0
    total = predict_resolution_hours(incident)
    return {
        "issue_label": ISSUE_LABELS.get(incident.issue_type, incident.issue_type),
        "base_hours": base,
        "priority_multiplier": priority_mult,
        "workload_penalty": workload,
        "predicted_hours": total,
        "predicted_resolve_at": (
            incident.predicted_resolve_at.isoformat()
            if incident.predicted_resolve_at
            else None
        ),
        "state": resolution_state(incident),
        "overdue_hours": overdue_hours(incident),
    }