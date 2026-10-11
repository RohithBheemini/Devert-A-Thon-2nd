"""Agent layer (PRD section 23, Addendum section 27).

Each agent is a thin, single-responsibility wrapper over the deterministic
services. A Supervisor orchestrates the report-to-incident pipeline.

Principle: AI interprets evidence. Deterministic logic makes operational
decisions. Human authorities retain final control.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from ..core.constants import DEPARTMENT_LABELS, ISSUE_LABELS
from ..core.timeutil import utcnow


@dataclass
class IntakeInput:
    description: str
    latitude: float
    longitude: float
    accuracy_meters: float | None = None
    location_label: str | None = None
    voice_transcript: str | None = None
    image_path: str | None = None
    image_filename: str | None = None
    image_bytes: bytes | None = None
    timestamp: datetime = field(default_factory=utcnow)


class IntakeAgent:
    """Transforms multimodal citizen input into a normalized report."""

    def normalize(self, data: IntakeInput) -> IntakeInput:
        merged = f"{data.description} {data.voice_transcript or ''}".strip()
        return IntakeInput(
            description=merged or "Citizen report (no text)",
            latitude=data.latitude,
            longitude=data.longitude,
            accuracy_meters=data.accuracy_meters,
            location_label=data.location_label,
            voice_transcript=data.voice_transcript,
            image_path=data.image_path,
            image_filename=data.image_filename,
            image_bytes=data.image_bytes,
            timestamp=data.timestamp,
        )


class EvidenceAgent:
    """Combines text/image/voice evidence into one evidence profile."""

    def combine(self, *, has_text: bool, has_image: bool, has_voice: bool, has_location: bool) -> dict:
        return {
            "text": {"present": has_text, "confidence": 0.91 if has_text else 0.0},
            "image": {"present": has_image},
            "voice": {"present": has_voice},
            "location": {"present": has_location},
        }


class DuplicateAgent:
    """Wraps the duplicate engine for a single relation query."""

    def __init__(self, engine):
        self.engine = engine

    def relatedness(self, **kwargs) -> dict:
        # engine is the `compute_relatedness` callable from services.duplicates
        return self.engine(**kwargs)


class PriorityAgent:
    """Wraps the explainable priority engine."""

    def __init__(self, engine):
        self.engine = engine

    def assess(self, **kwargs) -> dict:
        # engine is the `compute_priority` callable from services.priority
        return self.engine(**kwargs)


class ActionPlanningAgent:
    """Selects constrained actions from the library per issue + priority."""

    def __init__(self, library: dict):
        self.library = library

    def plan(self, issue: str, level: str, score: int) -> list[str]:
        general = self.library.get(issue, {}).get("general", self.library["pothole"]["general"])
        if score >= 65 and level in ("HIGH", "CRITICAL"):
            return self.library.get(issue, {}).get("high", general)
        if score < 45:
            return self.library.get(issue, {}).get("low", general)
        return general


class RoutingAgent:
    """Deterministic issue -> department mapping."""

    def __init__(self, table: dict):
        self.table = table

    def route(self, issue: str) -> dict:
        department = self.table.get(issue, "ROAD_MAINTENANCE")
        return {
            "department": department,
            "department_label": DEPARTMENT_LABELS.get(department, department),
        }


class Supervisor:
    """Lightweight orchestrator coordinating pipeline stages."""

    def __init__(
        self,
        intake: IntakeAgent,
        evidence: EvidenceAgent,
        duplicate: DuplicateAgent,
        priority: PriorityAgent,
        actions: ActionPlanningAgent,
        routing: RoutingAgent,
    ):
        self.intake = intake
        self.evidence = evidence
        self.duplicate = duplicate
        self.priority = priority
        self.actions = actions
        self.routing = routing

    def run(self, raw_input: IntakeInput) -> dict:
        normalized = self.intake.normalize(raw_input)
        evidence = self.evidence.combine(
            has_text=bool(normalized.description),
            has_image=bool(normalized.image_path or normalized.image_bytes),
            has_voice=bool(normalized.voice_transcript),
            has_location=True,
        )
        return {
            "input": normalized,
            "evidence": evidence,
            "stage": "normalized",
        }