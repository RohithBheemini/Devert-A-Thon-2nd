"""SQLAlchemy models for the normalized data store.

Entities per Addendum section 16:
    reports, incidents, incident_reports, notifications

Normalized + auditable: raw reports are never overwritten, every report
retains its own evidence, and incidents keep a full audit trail.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.timeutil import utcnow
from ..db.database import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    description: Mapped[str] = mapped_column(Text)
    issue_type: Mapped[str | None] = mapped_column(String, nullable=True)
    classification_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    classification_source: Mapped[str | None] = mapped_column(String, nullable=True)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    accuracy_meters: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_label: Mapped[str | None] = mapped_column(String, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    image_path: Mapped[str | None] = mapped_column(String, nullable=True)
    image_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    voice_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    vision_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    vision_detections: Mapped[list | None] = mapped_column(JSON, nullable=True)
    vision_failed: Mapped[bool] = mapped_column(Boolean, default=False)
    vision_severity: Mapped[float | None] = mapped_column(Float, nullable=True)
    mobile_number: Mapped[str | None] = mapped_column(String, nullable=True)

    incident_links: Mapped[list["IncidentReport"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )

    @property
    def incident_id(self) -> str | None:
        latest = max(
            self.incident_links,
            key=lambda l: l.incident.created_at,
            default=None,
        )
        return latest.incident_id if latest else None


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    issue_type: Mapped[str] = mapped_column(String)
    issue_label: Mapped[str] = mapped_column(String)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    location_label: Mapped[str | None] = mapped_column(String, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    confidence_label: Mapped[str] = mapped_column(String, default="LOW")
    priority_score: Mapped[int] = mapped_column(Integer)
    priority_level: Mapped[str] = mapped_column(String)
    priority_breakdown: Mapped[list | None] = mapped_column(JSON, nullable=True)
    department: Mapped[str] = mapped_column(String)
    department_label: Mapped[str] = mapped_column(String)
    action_plan: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String, default="OPEN")
    notification_status: Mapped[str] = mapped_column(String, default="NOT_SENT")
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    review_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text)
    evidence_summary: Mapped[list | None] = mapped_column(JSON, nullable=True)
    response_to: Mapped[list] = mapped_column(JSON, default=list)
    related_incidents: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow
    )

    report_links: Mapped[list["IncidentReport"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    status_history: Mapped[list] = mapped_column(JSON, default=list)
    predicted_resolve_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    escalation_level: Mapped[int] = mapped_column(Integer, default=0)
    escalated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    appeal_open: Mapped[bool] = mapped_column(Boolean, default=False)
    appeal_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    @property
    def report_count(self) -> int:
        return len(self.report_links)

    @property
    def image_count(self) -> int:
        return sum(1 for r in self.report_links if r.report.image_path)


class IncidentReport(Base):
    __tablename__ = "incident_reports"

    incident_id: Mapped[str] = mapped_column(
        String, ForeignKey("incidents.id"), primary_key=True
    )
    report_id: Mapped[str] = mapped_column(
        String, ForeignKey("reports.id"), primary_key=True
    )
    relatedness_score: Mapped[float] = mapped_column(Float)
    relationship_type: Mapped[str] = mapped_column(String)
    band: Mapped[str] = mapped_column(String)

    incident: Mapped[Incident] = relationship(back_populates="report_links")
    report: Mapped[Report] = relationship(back_populates="incident_links")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    incident_id: Mapped[str] = mapped_column(
        String, ForeignKey("incidents.id"), nullable=False
    )
    notification_type: Mapped[str] = mapped_column(String, default="EMAIL")
    recipient: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="PENDING")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    message_id: Mapped[str | None] = mapped_column(String, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    incident: Mapped[Incident] = relationship(back_populates="notifications")


class SmsMessage(Base):
    """Mock SMS/WhatsApp intake gateway (no-JavaScript citizens)."""

    __tablename__ = "sms_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    from_number: Mapped[str] = mapped_column(String)
    raw_text: Mapped[str] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    status: Mapped[str] = mapped_column(String, default="RECEIVED")
    report_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("reports.id"), nullable=True
    )
    parsed: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class PhoneCall(Base):
    """Voice helpline session bridged through Exotel (feature: call intake).

    `id` is the Exotel call id (e.g. CX-..) and is the unique case reference
    shown on the dashboard. A transcript becomes a normal fused report, so a
    voice call is a first-class citizen of duplicate detection & priority.
    """

    __tablename__ = "phone_calls"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    from_number: Mapped[str] = mapped_column(String)
    to_number: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="IN_PROGRESS")  # RINGING/IN_PROGRESS/COMPLETED/FAILED
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recording_url: Mapped[str | None] = mapped_column(String, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_status: Mapped[str] = mapped_column(String, default="PENDING")  # PENDING/READY/FAILED
    report_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("reports.id"), nullable=True
    )
    incident_id: Mapped[str | None] = mapped_column(String, nullable=True)
    area: Mapped[str | None] = mapped_column(String, nullable=True)
    photo_proof_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    sms_followup_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    @property
    def call_id(self) -> str:
        return self.id