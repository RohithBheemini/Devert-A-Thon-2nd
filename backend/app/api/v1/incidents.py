"""Incidents API: list/detail/status/email + human-review controls."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.timeutil import utcnow
from ...db.database import get_db
from ...models.models import Incident, Notification, Report
from ...schemas.schemas import (
    AppealBody,
    EmailResult,
    IncidentDetailFull,
    IncidentSummary,
    StatusUpdate,
)
from ...services.email import send_incident_email
from ...services.fusion import _create_incident, _recompute_incident
from ...services.predictive import (
    forecast_summary,
    overdue_hours,
    resolution_state,
)

router = APIRouter(prefix="/incidents", tags=["incidents"])


def _load_incident(db: Session, incident_id: str) -> Incident:
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


def _incident_detail(incident: Incident) -> IncidentDetailFull:
    from ...schemas.schemas import IncidentReportOut

    report_list = []
    for link in sorted(incident.report_links, key=lambda l: l.report.timestamp):
        report_list.append(
            IncidentReportOut(
                report=link.report,
                relatedness_score=link.relatedness_score,
                relationship_type=link.relationship_type,
                band=link.band,
            )
        )

    notifications = [n for n in incident.notifications]

    return IncidentDetailFull(
        id=incident.id,
        issue_type=incident.issue_type,
        issue_label=incident.issue_label,
        latitude=incident.latitude,
        longitude=incident.longitude,
        location_label=incident.location_label,
        confidence=incident.confidence,
        confidence_label=incident.confidence_label,
        priority_score=incident.priority_score,
        priority_level=incident.priority_level,
        priority_breakdown=incident.priority_breakdown,
        department=incident.department,
        department_label=incident.department_label,
        status=incident.status,
        notification_status=incident.notification_status,
        needs_review=incident.needs_review,
        report_count=incident.report_count,
        image_count=incident.image_count,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        summary=incident.summary,
        description=incident.description,
        action_plan=incident.action_plan,
        evidence_summary=incident.evidence_summary,
        response_to=incident.response_to,
        status_history=incident.status_history,
        predicted_resolve_at=incident.predicted_resolve_at,
        escalation_level=incident.escalation_level or 0,
        escalated_at=incident.escalated_at,
        appeal_open=incident.appeal_open,
        resolution_state=resolution_state(incident),
        reports=report_list,
        notifications=notifications,
    )


@router.get("", response_model=list[IncidentSummary])
def list_incidents(db: Session = Depends(get_db)):
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
                predicted_resolve_at=inc.predicted_resolve_at,
                escalation_level=inc.escalation_level or 0,
                escalated_at=inc.escalated_at,
                appeal_open=inc.appeal_open,
                resolution_state=resolution_state(inc),
            )
        )
    return out


@router.get("/{incident_id}", response_model=IncidentDetailFull)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    return _incident_detail(_load_incident(db, incident_id))


@router.post("/{incident_id}/status", response_model=IncidentDetailFull)
def update_status(incident_id: str, body: StatusUpdate, db: Session = Depends(get_db)):
    incident = _load_incident(db, incident_id)
    allowed = {
        "OPEN",
        "PRIORITIZED",
        "ROUTED",
        "EMAIL_PENDING",
        "EMAIL_SENT",
        "ACKNOWLEDGED",
        "IN_PROGRESS",
        "RESOLVED",
        "EMAIL_FAILED",
    }
    if body.status not in allowed:
        raise HTTPException(status_code=422, detail=f"Invalid status. Allowed: {sorted(allowed)}")

    history = list(incident.status_history or [])
    history.append(
        {
            "status": body.status,
            "at": utcnow().isoformat(),
            "by": "operator",
        }
    )
    incident.status_history = history
    incident.status = body.status
    incident.updated_at = utcnow()
    db.commit()
    db.refresh(incident)
    if body.status == "RESOLVED":
        _notify_resolution_sms(incident)
    return _incident_detail(incident)


def _notify_resolution_sms(incident):
    """Feature G: tell merged citizens their issue is fixed."""
    try:
        from ...services.sms_out import build_resolution_text, notify_citizens

        notify_citizens(None, incident, build_resolution_text(incident), kind="RESOLVED")
    except Exception:  # noqa: BLE001
        pass


@router.post("/{incident_id}/email", response_model=EmailResult)
def send_email(incident_id: str, force_retry: bool = False, db: Session = Depends(get_db)):
    incident = _load_incident(db, incident_id)
    existing = (
        db.query(Notification)
        .filter(Notification.incident_id == incident.id, Notification.status == "SENT")
        .first()
    )
    if existing and not force_retry:
        return EmailResult(
            incident_id=incident.id,
            notification_status=incident.notification_status,
            sent=True,
            message="Notification already sent (idempotency preserved).",
            recipient=existing.recipient,
            already_sent=True,
        )

    notification = send_incident_email(db, incident, force_retry=force_retry)
    if notification and notification.status == "SENT":
        return EmailResult(
            incident_id=incident.id,
            notification_status=incident.notification_status,
            sent=True,
            message=(f"Email dispatched{(' (retry)' if force_retry else '')} to {notification.recipient}."),
            recipient=notification.recipient,
            already_sent=False,
        )
    return EmailResult(
        incident_id=incident.id,
        notification_status=incident.notification_status,
        sent=False,
        message=f"Email failed: {notification.error if notification else 'unknown'} — EMAIL FAILED, RETRY available.",
        already_sent=False,
    )


@router.post("/{incident_id}/merge-report", response_model=IncidentDetailFull)
def merge_report_into_incident(incident_id: str, body: dict, db: Session = Depends(get_db)):
    """Human-review control (Addendum 13): force-merge an uncertain report."""
    incident = _load_incident(db, incident_id)
    report_id = body.get("report_id")
    if not report_id:
        raise HTTPException(status_code=422, detail="report_id required")
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if incident.id in [r.incident_id for r in report.incident_links]:
        raise HTTPException(status_code=409, detail="Report already linked")
    from ...services.fusion import _attach_report
    from ...services.duplicates import compute_relatedness

    rel = compute_relatedness(
        issue_a=report.issue_type or incident.issue_type,
        issue_b=incident.issue_type,
        text_a=report.description,
        text_b=incident.description,
        dt_a=report.timestamp,
        dt_b=incident.created_at,
        lat_a=report.latitude,
        lon_a=report.longitude,
        lat_b=incident.latitude,
        lon_b=incident.longitude,
    )
    from ...models.models import IncidentReport

    report.incident_links.append(
        IncidentReport(
            incident_id=incident.id,
            report_id=report.id,
            relatedness_score=rel["relatedness"],
            relationship_type="merged",
            band="manual",
        )
    )
    db.commit()
    _recompute_incident(db, incident)
    return _incident_detail(incident)


@router.post("", response_model=IncidentDetailFull, status_code=201)
def create_incident_from_report(body: dict, db: Session = Depends(get_db)):
    """Human-review control: create a new standalone incident for a report."""
    report_id = body.get("report_id")
    report = db.query(Report).filter(Report.id == report_id).first() if report_id else None
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    incident = _create_incident(db, report)
    return _incident_detail(incident)


@router.post("/{incident_id}/appeal", response_model=IncidentDetailFull)
def appeal_incident(incident_id: str, body: AppealBody, db: Session = Depends(get_db)):
    """Feature E: citizen appeals the system's decision; flag for review."""
    incident = _load_incident(db, incident_id)
    if incident.status == "RESOLVED":
        raise HTTPException(status_code=409, detail="Resolved incidents cannot be appealed")

    history = list(incident.status_history or [])
    history.append(
        {
            "status": "APPEAL_OPEN",
            "at": utcnow().isoformat(),
            "by": "citizen",
            "note": body.reason[:300],
        }
    )
    incident.status_history = history
    incident.appeal_open = True
    incident.appeal_reason = body.reason
    incident.needs_review = True
    incident.review_reason = (
        f"Citizen appeal: {body.reason[:200]}"
    )
    incident.updated_at = utcnow()
    db.commit()

    try:
        send_incident_email(
            db,
            incident,
            appeal=body.reason,
            notification_type="APPEAL",
        )
    except Exception:  # noqa: BLE001
        pass

    if body.from_number:
        try:
            from ...services.sms_out import build_appeal_text, send_sms

            send_sms(body.from_number, build_appeal_text(incident), kind="APPEAL")
        except Exception:  # noqa: BLE001
            pass

    db.refresh(incident)
    return _incident_detail(incident)


@router.get("/{incident_id}/forecast")
def get_forecast(incident_id: str, db: Session = Depends(get_db)):
    """Feature A: explainable resolution forecast for an incident."""
    incident = _load_incident(db, incident_id)
    return {
        "incident_id": incident.id,
        **forecast_summary(incident),
        "overdue_hours": overdue_hours(incident),
        "escalation_level": incident.escalation_level or 0,
        "escalation_label": {0: "NONE", 1: "DUE_SOON", 2: "OVERDUE", 3: "STALLED"}.get(
            incident.escalation_level or 0, "NONE"
        ),
    }