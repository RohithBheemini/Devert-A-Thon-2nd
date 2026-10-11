"""Dashboard operational stats (PRD G8, Addendum sections 20-21)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db.database import get_db
from ...models.models import Incident, Notification, Report
from ...schemas.schemas import DashboardStats, IncidentSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)):
    total_reports = db.query(Report).count()
    incidents = db.query(Incident).all()
    total_incidents = len(incidents)

    merged_links = 0
    high_priority = 0
    emails_sent = 0
    acknowledged = 0
    in_progress = 0
    resolved = 0
    for inc in incidents:
        merged_links += sum(
            1 for l in inc.report_links if l.relationship_type in ("merged", "seed")
        )
        if inc.priority_level in ("HIGH", "CRITICAL"):
            high_priority += 1
        if inc.notification_status == "EMAIL_SENT":
            emails_sent += 1
        if inc.status == "ACKNOWLEDGED":
            acknowledged += 1
        if inc.status == "IN_PROGRESS":
            in_progress += 1
        if inc.status == "RESOLVED":
            resolved += 1

    redundancy = 1.0 - (total_incidents / total_reports) if total_reports else 0.0

    # Actionable Incident Conversion Rate (Addendum 21)
    actionable = 0
    for inc in incidents:
        if (
            inc.issue_type
            and inc.latitude and inc.longitude
            and inc.priority_score is not None
            and inc.department
            and inc.action_plan
        ):
            actionable += 1
    conversion = actionable / total_reports if total_reports else 0.0

    return DashboardStats(
        total_reports=total_reports,
        total_incidents=total_incidents,
        reports_consolidated=merged_links,
        high_priority=high_priority,
        active_incidents=len([i for i in incidents if i.status not in ("RESOLVED",)]),
        emails_sent=emails_sent,
        acknowledged=acknowledged,
        in_progress=in_progress,
        resolved=resolved,
        redundancy_reduction=round(redundancy * 100, 1),
        actionable_conversion_rate=round(conversion * 100, 1),
    )


@router.get("/incidents", response_model=list[IncidentSummary])
def dashboard_incidents(db: Session = Depends(get_db)):
    incidents = db.query(Incident).order_by(Incident.created_at.desc()).all()
    out = []
    for inc in incidents:
        out.append(
            IncidentSummary(
                id=inc.id,
                issue_type=inc.issue_type,
                issue_label=inc.issue_label,
                latitude=inc.latitude,
                longitude=inc.longitude,
                location_label=inc.location_label,
                confidence=inc.confidence,
                confidence_label=inc.confidence_label,
                priority_score=inc.priority_score,
                priority_level=inc.priority_level,
                department=inc.department,
                department_label=inc.department_label,
                status=inc.status,
                notification_status=inc.notification_status,
                needs_review=inc.needs_review,
                report_count=inc.report_count,
                image_count=inc.image_count,
                created_at=inc.created_at,
                updated_at=inc.updated_at,
                summary=inc.summary,
            )
        )
    return out