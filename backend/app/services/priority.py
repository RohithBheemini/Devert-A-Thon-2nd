"""Deterministic, explainable priority engine (PRD FR-7, Addendum section 8).

Priority is a weighted formula over deterministic signals. The result is
always accompanied by a per-signal breakdown so the dashboard can show
"WHY HIGH PRIORITY?" and never a black-box number.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from ..core.constants import IssueType


class PriorityLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# Weights exactly as spec'd: 35/25/20/10/10 (%)
WEIGHTS = {
    "severity": 0.35,
    "reportRepetition": 0.25,
    "affectedArea": 0.20,
    "locationImportance": 0.10,
    "age": 0.10,
}

MERGE_BAND = 0.85
RELATED_BAND = 0.65


def level_from_score(score: float) -> PriorityLevel:
    if score >= 80:
        return PriorityLevel.CRITICAL
    if score >= 65:
        return PriorityLevel.HIGH
    if score >= 45:
        return PriorityLevel.MEDIUM
    return PriorityLevel.LOW


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def severity_score(
    vision_confidences: list[float],
    severity_hints: Optional[list[float]] = None,
) -> float:
    """Visual severity drives the 35% share.

    Real per-photo severity hints (feature D) win; otherwise we fall back to
    vision confidence as a weaker defect proxy. No visual evidence at all
    scores a neutral 0.5 rather than 0 so text-only reports still get a fair
    base severity.
    """
    if severity_hints:
        return _clamp(max(severity_hints))
    if not vision_confidences:
        return 0.5
    return _clamp(max(vision_confidences))


def report_repetition_score(report_count: int) -> float:
    """More corroborating reports raise repetition score, saturating at 5+."""
    if report_count <= 1:
        return 0.0
    return _clamp((report_count - 1) / 4.0)


def affected_area_score(
    image_count: int,
    has_voice: bool,
    detection_masks: Optional[list[dict]] = None,
) -> float:
    """Affected-area estimate drives the 20% share.

    Uses the fraction of frame occupied by detections when masks/boxes are
    present, otherwise falls back to evidence-volume heuristic.
    """
    if detection_masks:
        size_tokens = [
            (1.0 if d.get("area_fraction", 0) > 0.2 else 0.5)
            for d in detection_masks
            if isinstance(d.get("area_fraction"), (int, float))
        ]
        if size_tokens:
            return _clamp(sum(size_tokens) / len(size_tokens))

    base = 0.3
    base += 0.2 * min(image_count, 3)
    if has_voice:
        base += 0.1
    return _clamp(base)


LOCATION_IMPORTANCE: dict[str, float] = {
    "metro": 0.9,
    "station": 0.9,
    "market": 0.85,
    "hospital": 1.0,
    "school": 1.0,
    "college": 0.8,
    "university": 0.8,
    "junction": 0.8,
    "crossing": 0.8,
    "highway": 0.9,
    "main road": 0.9,
    "bridge": 0.9,
    "temple": 0.7,
    "park": 0.6,
    "residential": 0.5,
    "colony": 0.5,
}

DEFAULT_LOCATION_IMPORTANCE = 0.6


def location_importance_score(label: Optional[str]) -> float:
    if not label:
        return DEFAULT_LOCATION_IMPORTANCE
    label_lower = label.lower()
    score = DEFAULT_LOCATION_IMPORTANCE
    for keyword, importance in LOCATION_IMPORTANCE.items():
        if keyword in label_lower and importance > score:
            score = importance
    return score


def age_score(created_at: datetime, now: Optional[datetime] = None) -> float:
    """Fresher incidents score higher. Decays linearly over 48 hours."""
    if now is None:
        now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_hours = max(0.0, (now - created_at).total_seconds() / 3600.0)
    return _clamp(1.0 - age_hours / 48.0)


def compute_priority(
    *,
    issue_type: IssueType | str,
    report_count: int,
    image_count: int,
    has_voice: bool,
    vision_confidences: list[float],
    location_label: Optional[str],
    created_at: datetime,
    detection_masks: Optional[list[dict]] = None,
    severity_hints: Optional[list[float]] = None,
    now: Optional[datetime] = None,
) -> dict:
    issue = issue_type.value if isinstance(issue_type, IssueType) else issue_type

    severity = severity_score(vision_confidences, severity_hints) * 100
    repetition = report_repetition_score(report_count) * 100
    affected = affected_area_score(image_count, has_voice, detection_masks) * 100
    loc_importance = location_importance_score(location_label) * 100
    age = age_score(created_at, now) * 100

    score = (
        severity * WEIGHTS["severity"]
        + repetition * WEIGHTS["reportRepetition"]
        + affected * WEIGHTS["affectedArea"]
        + loc_importance * WEIGHTS["locationImportance"]
        + age * WEIGHTS["age"]
    )
    score = round(score)

    breakdown = {
        "severity": round(severity * WEIGHTS["severity"]),
        "reportRepetition": round(repetition * WEIGHTS["reportRepetition"]),
        "affectedArea": round(affected * WEIGHTS["affectedArea"]),
        "locationImportance": round(loc_importance * WEIGHTS["locationImportance"]),
        "age": round(age * WEIGHTS["age"]),
    }

    return {
        "score": score,
        "level": level_from_score(score).value,
        "breakdown": breakdown,
    }