"""Outbound SMS notifications (feature G, outbound leg).

Citizens who supplied a mobile number get short status texts exactly where
the department gets an email: intake acknowledgement, watchdog escalation,
resolution, and appeal confirmation.

The sender is a mock (mirrors EMAIL_MOCK): nothing leaves the machine, each
message is appended to `data/sms_sent.log` so the demo produces a real,
inspectable artifact. Swap the writer for a Twilio/ClickSend SDK behind the
same function signature for production.
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from ..core.paths import DEMO_SMS_LOG
from ..core.timeutil import utcnow

logger = logging.getLogger(__name__)

CHANNEL_NAME = "hylo"  # demo-friendly carrier label


def _tracking_ref(report_id: str, incident_id: str) -> str:
    return f"CRN-{report_id}/{incident_id}"


def send_sms(to: str, text: str, kind: str = "UPDATE") -> dict:
    """Send one SMS via the mock (or future real) carrier. No DB writes."""
    message_id = f"mock-sms-{uuid.uuid4().hex[:10]}"
    entry = (
        f"[{utcnow().isoformat()}] message_id={message_id} to={to} kind={kind}\n"
        f"Text: {text}\n"
        f"{'=' * 70}\n"
    )
    with DEMO_SMS_LOG.open("a", encoding="utf-8") as f:
        f.write(entry)
    logger.info("SMS %s -> %s (%s)", message_id, to, kind)
    return {
        "message_id": message_id,
        "to": to,
        "channel": CHANNEL_NAME,
        "kind": kind,
        "status": "SENT",
        "sent_at": utcnow().isoformat(),
    }


def _citizen_mobiles(incident) -> list[str]:
    """Distinct mobile numbers of citizens merged into the incident."""
    seen: dict[str, str] = {}
    for link in incident.report_links:
        if link.report.mobile_number:
            raw = (link.report.mobile_number or "").strip()
            if raw not in seen:
                seen[raw] = raw
    return sorted(seen)


def notify_citizens(db: Session, incident, text: str, kind: str = "UPDATE") -> int:
    """Fan the message out to every citizen whose report merged into the incident."""
    mobiles = _citizen_mobiles(incident)
    for m in mobiles:
        send_sms(m, text, kind=kind)
    return len(mobiles)


def build_ack_text(report, incident) -> str:
    ref = _tracking_ref(report.id, incident.id)
    return (
        f"CivicPulse: {incident.issue_label} noted near {incident.location_label or 'your area'} "
        f"({incident.id}, priority {incident.priority_score}). Track at civicpulse.local/track/{report.id} "
        f"(ref {ref}). Reply SMS anytime."
    )


def build_escalation_text(incident) -> str:
    level = {1: "due soon", 2: "overdue", 3: "stalled"}.get(incident.escalation_level or 1, "escalated")
    return (
        f"CivicPulse: your {incident.issue_label} ({incident.id}) is now flagged {level}. "
        f"Priority {incident.priority_score} — {incident.department_label} has been re-alerted. "
        f"Track updates at civicpulse.local/track"
    )


def build_resolution_text(incident) -> str:
    return (
        f"CivicPulse: Good news — {incident.issue_label} ({incident.id}) is marked RESOLVED. "
        f"Thank you for reporting in your area. Reply if the issue returns."
    )


def build_appeal_text(incident) -> str:
    return (
        f"CivicPulse: appeal registered for {incident.id} ({incident.issue_label}). "
        f"An operator will re-verify before final judgement — you'll get a message here."
    )