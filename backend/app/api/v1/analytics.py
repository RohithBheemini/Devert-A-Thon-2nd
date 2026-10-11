"""Analytics API: hotspot detection (B) + watchdog sweeps (A)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...db.database import get_db
from ...services.hotspots import detect_hotspots, incident_counts
from ...services.predictive import resolution_state
from ...services.watchdog import run_watchdog, watchdog_status

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/hotspots")
def hotspots(
    window_hours: int = Query(default=72, ge=6, le=336),
    db: Session = Depends(get_db),
):
    """Feature B: emerging report clusters ahead of formal incident status."""
    payload = detect_hotspots(db, window_hours=window_hours)
    payload["incident_cells"] = incident_counts(db)
    return payload


@router.get("/watchdog/status")
def watchdog_view(as_of_hours: int = Query(default=0, ge=0, le=336), db: Session = Depends(get_db)):
    """Feature A: which incidents are overdue/stalled, per escalation level.

    `as_of_hours` previews the sweep that many hours in the future.
    """
    return watchdog_status(db, as_of_hours=as_of_hours)


@router.post("/watchdog/run")
def watchdog_run(dry_run: bool = False, db: Session = Depends(get_db)):
    """Feature A: execute (or preview) one escalation sweep."""
    result = run_watchdog(db, dry_run=dry_run)
    if dry_run:
        result["preview"] = True
    return result


@router.get("/resolution-overview")
def resolution_overview(
    as_of_hours: int = Query(default=0, ge=0, le=336),
    db: Session = Depends(get_db),
):
    """Aggregate view across forecast/prediction for the dashboard."""
    from ...core.timeutil import utcnow
    from datetime import timedelta
    from ...models.models import Incident

    now = utcnow() + timedelta(hours=as_of_hours)
    rows = []
    for inc in db.query(Incident).filter(Incident.status != "RESOLVED").all():
        rows.append(
            {
                "incident_id": inc.id,
                "issue_label": inc.issue_label,
                "priority_level": inc.priority_level,
                "state": resolution_state(inc, now),
                "escalation_level": inc.escalation_level or 0,
                "appeal_open": inc.appeal_open,
                "predicted_resolve_at": (
                    inc.predicted_resolve_at.isoformat() if inc.predicted_resolve_at else None
                ),
            }
        )
    return {
        "as_of_hours": as_of_hours,
        "counts": {
            state: sum(1 for r in rows if r["state"] == state) for state in
            ("ON_TRACK", "DUE_SOON", "OVERDUE", "STALLED", "UNSCHEDULED", "RESOLVED")
        },
        "incidents": sorted(rows, key=lambda r: r["escalation_level"], reverse=True),
    }