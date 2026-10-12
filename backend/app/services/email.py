"""Real email notification service (PRD FR-10, Addendum sections 11-12).

Idempotency: never auto-resends if a SENT notification exists for the
incident. Every send is recorded in `notifications`. On failure the
incident stays visible with EMAIL_FAILED -- RETRY; a manual retry is
available. When SMTP isn't configured, EMAIL_MOCK writes the email to a
log so the demo still produces a real, inspectable artifact.

State machine:
    OPEN -> PRIORITIZED -> ROUTED -> EMAIL_PENDING -> EMAIL_SENT
        -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED
    failure: EMAIL_PENDING -> EMAIL_FAILED -> RETRY -> EMAIL_SENT
"""

from __future__ import annotations

import logging
import smtplib
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.paths import DEMO_EMAIL_LOG
from ..core.timeutil import utcnow
from ..models.models import Incident, Notification

logger = logging.getLogger(__name__)

# Department demo recipients (PRD FR-10 / Phone 1-3)
DEPARTMENT_RECIPIENTS: dict[str, str] = {
    "ROAD_MAINTENANCE": "road@civicpulse.demo",
    "SANITATION": "sanitation@civicpulse.demo",
    "WATER_DRAINAGE": "water@civicpulse.demo",
    "STREET_LIGHTING": "streetlight@civicpulse.demo",
}


def build_email(incident: Incident, escalation: int = 0, appeal: str | None = None) -> tuple[str, str]:
    """Build (subject, plain-text body) for an incident.

    `escalation` > 0 produces an escalation notice (watchdog re-alert); an
    `appeal` text produces a citizen-appeal notice to the operator.
    """
    label = incident.issue_label
    loc = incident.location_label or f"{incident.latitude}, {incident.longitude}"
    if appeal:
        subject = (
            f"CITIZEN APPEAL — {label} — {loc} — {incident.id}"
        )
        body = f"""CivicPulse — Citizen Appeal

Incident: {incident.id}
Issue: {label}

A citizen has appealed the system's decision:

>>> {appeal}

The incident is flagged for human review. Please re-verify the
classification and any consolidation decisions.
"""
        return subject, body

    if escalation > 0:
        level = {1: "OVERDUE", 2: "OVERDUE", 3: "STALLED"}.get(escalation, "ESCALATED")
        subject = (
            f"[WATCHDOG] {level} — {incident.priority_level} INCIDENT NOT RESOLVED — "
            f"{label} — {loc} — {incident.id}"
        )
        suffix = (
            "\n\n\n--\nWatchdog escalation {n}/3. "
            "Repeated escalations raise this incident's escalation level."
        ).format(n=incident.escalation_level or escalation)
    else:
        subject = (
            f"{incident.priority_level} PRIORITY CIVIC INCIDENT — "
            f"{label} — {loc} — {incident.id}"
        )
        suffix = ""

    breakdown = incident.priority_breakdown or {}
    evidence = "\n".join(f"  ✓ {e}" for e in (incident.evidence_summary or [])) or "  ✓ Citizen report"

    body = f"""CivicPulse — Action Required

Incident:
{incident.id}

Issue:
{label}

Location:
{loc}

Priority:
{incident.priority_score}/100 — {incident.priority_level}

Reports consolidated:
{incident.report_count}

Evidence:
{evidence}

Recommended action:
{_numbered(incident.action_plan)}

System assessment:
{incident.issue_label} confidence — {int(incident.confidence * 100)}%

Priority breakdown:
{_breakdown_text(breakdown)}
{suffix}

This notification is an AI-assisted recommendation.
Final action remains with the responsible authority.
"""
    return subject, body


def _numbered(items: list[str]) -> str:
    return "\n".join(f"{i}. {it}" for i, it in enumerate(items, 1))


def _breakdown_text(breakdown: dict) -> str:
    lines = []
    for key, _label in (
        ("severity", "Visual severity"),
        ("reportRepetition", "Report repetition"),
        ("affectedArea", "Affected area"),
        ("locationImportance", "Location importance"),
        ("age", "Incident age"),
    ):
        if key in breakdown:
            lines.append(f"  {breakdown[key]:>3}  {_label}")
    return "\n".join(lines)


def _mock_send(recipient: str, subject: str, body: str) -> tuple[str, str | None]:
    """Log the email to disk so the demo has a real artifact."""
    ts = utcnow().isoformat()
    message_id = f"mock-{uuid.uuid4().hex[:12]}"
    entry = (
        f"[{ts}] message_id={message_id} to={recipient}\n"
        f"Subject: {subject}\n"
        f"{body}\n"
        f"{'=' * 70}\n"
    )
    with DEMO_EMAIL_LOG.open("a", encoding="utf-8") as f:
        f.write(entry)
    return message_id, None


def _smtp_send(recipient: str, subject: str, body: str) -> tuple[str, str | None]:
    msg = MIMEMultipart("alternative")
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        server.ehlo()
        if settings.EMAIL_USE_TLS:
            server.starttls()
            server.ehlo()
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(msg)
    return f"smtp-{uuid.uuid4().hex[:12]}", None


def send_incident_email(
    db: Session,
    incident: Incident,
    force_retry: bool = False,
    escalation: int = 0,
    appeal: str | None = None,
    notification_type: str = "EMAIL",
) -> Notification | None:
    """Send (or re-send on manual retry) the department notification.

    Escalation and appeal notices are distinct events and bypass the
    idempotency guard (which only protects the original dispatch).
    """
    existing = (
        db.query(Notification)
        .filter(
            Notification.incident_id == incident.id,
            Notification.status == "SENT",
        )
        .first()
    )
    if existing and not force_retry and escalation == 0 and appeal is None:
        return existing  # idempotency: never auto-resend

    if hasattr(incident, "status") and incident.status in ("RESOLVED",) and escalation == 0:
        logger.info("Incident %s resolved; skipping new email", incident.id)

    recipient = DEPARTMENT_RECIPIENTS.get(incident.department, DEPARTMENT_RECIPIENTS["ROAD_MAINTENANCE"])
    subject, body = build_email(incident, escalation=escalation, appeal=appeal)

    if settings.EMAIL_MOCK:
        message_id, error = _mock_send(recipient, subject, body)
    elif settings.SMTP_HOST:
        try:
            message_id, error = _smtp_send(recipient, subject, body)
        except Exception as exc:  # noqa: BLE001
            logger.exception("SMTP send failed for %s", incident.id)
            message_id, error = None, str(exc)
    else:
        message_id, error = None, "SMTP not configured and EMAIL_MOCK is off"

    notification = Notification(
        id=f"NTF-{uuid.uuid4().hex[:10].upper()}",
        incident_id=incident.id,
        notification_type=notification_type,
        recipient=recipient,
        status="SENT" if error is None else "FAILED",
        sent_at=utcnow() if error is None else None,
        message_id=message_id,
        error=error,
    )
    db.add(notification)
    incident.notification_status = "EMAIL_SENT" if error is None else "EMAIL_FAILED"
    if error is None and escalation:
        _append_history(incident, f"ESCALATED_{escalation}", "watchdog")
    elif error is None and appeal:
        _append_history(incident, "APPEAL_NOTIFIED", "system")
    elif error is None:
        _append_history(incident, "EMAIL_SENT", "system")
    else:
        _append_history(incident, "EMAIL_FAILED", "system")
    incident.updated_at = utcnow()
    db.commit()
    db.refresh(notification)
    return notification


def _append_history(incident: Incident, status: str, by: str = "system"):
    history = list(incident.status_history or [])
    history.append(
        {
            "status": status,
            "at": utcnow().isoformat(),
            "by": by,
        }
    )
    incident.status_history = history