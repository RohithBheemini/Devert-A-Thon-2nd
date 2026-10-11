"""Voice helpline intake bridged through Exotel (mock).

Exotel is the Indian CPaaS carrying the civic helpline number citizens dial.
Real flow:
    1. citizen dials EXOTEL_CONTACT_NUMBER
    2. Exotel applet hits `POST /api/v1/calls/inbound` (IncomingCall) with
       CallSid + caller number
    3. Exotel studio records the call; Gaffe (STT) posts the transcript to
       `POST /api/v1/calls/transcript`
    4. after hangup Exotel's CallStatusCallback hits `POST /calls/{id}/end`

With EXOTEL_MOCK=True every step is simulated locally but the DB rows,
follow-up SMS, and dashboard call cases are exactly what the real carrier
would produce. Exotel credentials (sid/key/token/app) are configured via env.
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.timeutil import as_naive_utc, utcnow
from ..models.models import Incident, PhoneCall, Report
from ..services.sms import parse_sms

logger = logging.getLogger(__name__)

CONTACT_NUMBER = settings.EXOTEL_CONTACT_NUMBER

# Fallback transcript when a demo call carries no text yet.
DEFAULT_TRANSCRIPT = (
    "There is a big pothole near SR Nagar crossing, water leak on the road too, "
    "cars are braking suddenly. Location is 17.4439, 78.3929."
)


def make_call_id() -> str:
    return f"CX-{uuid.uuid4().hex[:8].upper()}"


def call_out(call: PhoneCall) -> dict:
    """Shape a PhoneCall row for API/UI responses."""
    return {
        "call_id": call.id,
        "from_number": call.from_number,
        "to_number": call.to_number,
        "status": call.status,
        "started_at": as_naive_utc(call.started_at).isoformat(),
        "answered_at": as_naive_utc(call.answered_at).isoformat() if call.answered_at else None,
        "ended_at": as_naive_utc(call.ended_at).isoformat() if call.ended_at else None,
        "duration_seconds": call.duration_seconds,
        "transcript": call.transcript,
        "transcript_status": call.transcript_status,
        "recording_url": call.recording_url,
        "area": call.area,
        "report_id": call.report_id,
        "incident_id": call.incident_id,
        "photo_proof_requested": call.photo_proof_requested,
        "sms_followup_id": call.sms_followup_id,
    }


def begin_inbound(db: Session, call_id: str, from_number: str, to_number: str | None = None) -> PhoneCall:
    """Exotel IncomingCall webhook: register the session before the call starts."""
    call = PhoneCall(
        id=call_id,
        from_number=from_number,
        to_number=to_number or CONTACT_NUMBER,
        status="IN_PROGRESS",
        started_at=utcnow(),
        answered_at=utcnow(),
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    return call


def store_transcript(
    db: Session,
    call_id: str,
    transcript: str,
    recording_url: str | None = None,
) -> PhoneCall:
    """Save the Gaffe transcript, geocode it, and fuse it into an incident."""
    call = db.query(PhoneCall).filter(PhoneCall.id == call_id).first()
    if not call:
        raise LookupError(f"Unknown call {call_id}")
    if call.transcript is None:
        call.transcript = transcript
        call.transcript_status = "READY"
        call.recording_url = recording_url

        location = parse_sms(transcript)
        report_id = f"REP-{db.query(Report).count() + 1:05d}"
        from ..services.fusion import classify_and_fuse_report

        report = classify_and_fuse_report(
            db,
            report_id=report_id,
            description=" ".join(transcript.split())[:180],
            latitude=location["latitude"],
            longitude=location["longitude"],
            accuracy_meters=50.0,
            location_label=location.get("location_label", "Hyderabad"),
            timestamp=utcnow(),
            voice_transcript=transcript,
        )
        call.report_id = report.id
        call.incident_id = report.incident_id
        call.area = location.get("location_label", "Hyderabad")
        call.updated_at = utcnow()
        db.commit()
        db.refresh(call)
    return call


def complete_call(db: Session, call_id: str, duration_seconds: int | None = None) -> PhoneCall:
    """Exotel CallStatusCallback (hangup): finalize the session + follow-up SMS.

    The follow-up message summarizes the transcript, the caller details, and
    asks for website photo proof so the case is treated with higher priority.
    """
    call = db.query(PhoneCall).filter(PhoneCall.id == call_id).first()
    if not call:
        raise LookupError(f"Unknown call {call_id}")

    if call.ended_at is None:
        call.status = "COMPLETED"
        call.ended_at = utcnow()
        call.duration_seconds = duration_seconds if duration_seconds is not None else 0
        call.photo_proof_requested = True
        call.updated_at = utcnow()
        db.commit()
        db.refresh(call)

    if call.sms_followup_id is None and call.from_number:
        from ..services.sms_out import send_sms

        text = build_followup_sms(call)
        receipt = send_sms(call.from_number, text, kind="CALL_FOLLOWUP")
        call.sms_followup_id = receipt["message_id"]
        call.updated_at = utcnow()
        db.commit()
        db.refresh(call)
    return call


def simulate_call(db: Session, from_number: str, transcript: str | None = None) -> dict:
    """Demo helper: run the whole Exotel lifecycle for one caller."""
    call_id = make_call_id()
    begin_inbound(db, call_id, from_number)
    call = store_transcript(db, call_id, transcript or DEFAULT_TRANSCRIPT)
    call = complete_call(db, call_id, duration_seconds=74)

    incident = None
    if call.incident_id:
        incident = db.query(Incident).filter(Incident.id == call.incident_id).first()
    report = db.query(Report).filter(Report.id == call.report_id).first() if call.report_id else None

    return {
        **call_out(call),
        "transcript": call.transcript,
        "sms_followup_text": build_followup_sms(call),
        "issue_label": incident.issue_label if incident else None,
        "priority_score": incident.priority_score if incident else None,
        "priority_level": incident.priority_level if incident else None,
        "tracking_ref": f"CRN-{report.id}/{incident.id}" if (report and incident) else None,
        "tracking_path": f"/track/{report.id}" if report else None,
    }


def build_followup_sms(call: PhoneCall) -> str:
    """Post-hangup message: transcript summary + caller details + photo proof."""
    started = as_naive_utc(call.started_at).strftime("%d %b %H:%M")
    transcript = (call.transcript or "transcript pending at the carrier").strip()[:600]
    report = f" {call.report_id}" if call.report_id else ""
    track = f"civicpulse.local/track/{call.report_id}" if call.report_id else "civicpulse.local/track"
    return (
        f"CivicPulse call notes ({call.id}) - from {call.from_number} on {started} "
        f"({call.duration_seconds or 0}s)\n"
        f"Transcript: {transcript}\n"
        f"Your report{report} is registered. To have it treated as a "
        f"HIGHER-PRIORITY case, submit photo proof now at {track}"
    )