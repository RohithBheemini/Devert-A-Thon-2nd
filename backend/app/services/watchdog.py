"""Stalled-incident watchdog (feature A, closed loop).

The intake->email pipeline hands work to a department but never follows up.
The watchdog closes that loop: every non-resolved incident carries a
`predicted_resolve_at`; a sweep escalates anything that isn't done in time.

Escalation ladder (stored on the incident, fully idempotent):
    level 0  ON_TRACK / just created
    level 1  DUE_SOON          (<= 6h remaining)   — soft nudge, history entry
    level 2  OVERDUE           (predicted passed)  — escalation notice email
    level 3  STALLED           (> 48h late)        — STALLED escalation email

Each step is recorded in status_history for the audit trail and re-sends a
distinct watchdog email (escalation bypasses the idempotent original dispatch).
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from ..core.timeutil import as_naive_utc, utcnow
from ..models.models import Incident
from ..services.email import send_incident_email
from ..services.predictive import resolution_state

logger = logging.getLogger(__name__)

ESCALATION_LABELS = {0: "NONE", 1: "DUE_SOON", 2: "OVERDUE", 3: "STALLED"}


def _append_history(incident: Incident, status: str, by: str):
    history = list(incident.status_history or [])
    history.append({"status": status, "at": utcnow().isoformat(), "by": by})
    incident.status_history = history


def _escalate(db: Session, incident: Incident, new_level: int):
    """Raise escalation level, record it, and dispatch a watchdog email."""
    incident.escalation_level = new_level
    incident.escalated_at = utcnow()
    as_naive_utc(incident.escalated_at)
    _append_history(incident, f"ESCALATED_{new_level}", "watchdog")
    send_incident_email(db, incident, escalation=new_level, notification_type="ESCALATION")
    try:
        from ..services.sms_out import build_escalation_text, notify_citizens

        notify_citizens(db, incident, build_escalation_text(incident), kind="ESCALATION")
    except Exception:  # noqa: BLE001
        logger.exception("SMS escalation notification failed for %s", incident.id)
    incident.updated_at = utcnow()


def run_watchdog(db: Session, dry_run: bool = False) -> dict:
    """One sweep over all non-resolved incidents. Returns an action summary."""
    now = utcnow()
    incidents = db.query(Incident).filter(Incident.status != "RESOLVED").all()

    summary = {
        "scanned": len(incidents),
        "due_soon": 0,
        "overdue": 0,
        "stalled": 0,
        "escalated": [],
        "emails_dispatched": 0,
    }

    for incident in incidents:
        if incident.predicted_resolve_at is None:
            continue
        state = resolution_state(incident, now)
        target_level = {"DUE_SOON": 1, "OVERDUE": 2, "STALLED": 3}.get(state, 0)
        current = incident.escalation_level or 0

        if target_level > current:
            if not dry_run:
                _escalate(db, incident, target_level)
            summary["escalated"].append(
                {
                    "incident_id": incident.id,
                    "level": target_level,
                    "label": ESCALATION_LABELS[target_level],
                    "overdue_hours": max(
                        0.0, (now - as_naive_utc(incident.predicted_resolve_at)).total_seconds() / 3600.0
                    ),
                }
            )
            summary["emails_dispatched"] += 0 if dry_run else 1
        elif target_level == current:
            # Reclassify count only (already escalated to that level)
            pass

        if state == "DUE_SOON":
            summary["due_soon"] += 1
        elif state == "OVERDUE":
            summary["overdue"] += 1
        elif state == "STALLED":
            summary["stalled"] += 1

    if not dry_run:
        db.commit()
    summary["escalation_counts"] = {
        "DUE_SOON": summary["due_soon"],
        "OVERDUE": summary["overdue"],
        "STALLED": summary["stalled"],
    }
    return summary


def watchdog_status(db: Session, as_of_hours: int = 0) -> dict:
    """Per-incident escalation snapshot for the dashboard filter view.

    `as_of_hours > 0` PREVIEWS the state that far in the future without
    persisting it — used to show what the sweep will look like later.
    """
    now = utcnow()
    if as_of_hours > 0:
        from datetime import timedelta

        now = now + timedelta(hours=as_of_hours)
    incidents = db.query(Incident).filter(Incident.status != "RESOLVED").all()
    rows = []
    for inc in incidents:
        state = resolution_state(inc, now)
        projected_level = max(inc.escalation_level or 0, {"DUE_SOON": 1, "OVERDUE": 2, "STALLED": 3}.get(state, 0))
        rows.append(
            {
                "incident_id": inc.id,
                "issue_label": inc.issue_label,
                "priority_level": inc.priority_level,
                "escalation_level": projected_level if as_of_hours else (inc.escalation_level or 0),
                "escalation_label": ESCALATION_LABELS.get(
                    projected_level if as_of_hours else (inc.escalation_level or 0), "NONE"
                ),
                "state": state,
                "predicted_resolve_at": (
                    inc.predicted_resolve_at.isoformat() if inc.predicted_resolve_at else None
                ),
                "escalated_at": inc.escalated_at.isoformat() if inc.escalated_at else None,
                "appeal_open": inc.appeal_open,
            }
        )
    return {
        "as_of_hours": as_of_hours,
        "state_counts": {
            "ON_TRACK": sum(1 for r in rows if r["state"] == "ON_TRACK"),
            "DUE_SOON": sum(1 for r in rows if r["state"] == "DUE_SOON"),
            "OVERDUE": sum(1 for r in rows if r["state"] == "OVERDUE"),
            "STALLED": sum(1 for r in rows if r["state"] == "STALLED"),
        },
        "incidents": sorted(rows, key=lambda r: (r["escalation_level"], r["incident_id"]), reverse=True),
    }