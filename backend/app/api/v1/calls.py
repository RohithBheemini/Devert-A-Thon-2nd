"""Voice helpline (Exotel) intake API.

Webhook endpoints mirror Exotel's callbacks (IncomingCall, Gaffe transcript,
CallStatusCallback) plus list/detail for the dashboard and a demo simulator.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...db.database import get_db
from ...models.models import PhoneCall
from ...schemas.schemas import CallOut
from ...services import exotel

router = APIRouter(prefix="/calls", tags=["calls"])


class CallInboundBody(BaseModel):
    call_id: str = Field(..., min_length=3, max_length=64)
    from_number: str = Field(..., min_length=3)
    to_number: str | None = None


class CallTranscriptBody(BaseModel):
    call_id: str = Field(..., min_length=3, max_length=64)
    transcript: str = Field(..., min_length=1, max_length=4000)
    recording_url: str | None = None


class CallEndBody(BaseModel):
    call_id: str = Field(..., min_length=3, max_length=64)
    duration_seconds: int | None = Field(default=None, ge=0, le=86400)


class CallSimulateBody(BaseModel):
    from_number: str = Field(..., min_length=3)
    transcript: str | None = Field(default=None, max_length=4000)


@router.post("/inbound", status_code=201)
def calls_inbound(body: CallInboundBody, db: Session = Depends(get_db)):
    """Exotel IncomingCall webhook: a citizen just dialed the helpline."""
    if db.query(PhoneCall).filter(PhoneCall.id == body.call_id).first():
        raise HTTPException(status_code=409, detail="Call already registered")
    call = exotel.begin_inbound(db, body.call_id, body.from_number, body.to_number)
    return exotel.call_out(call)


@router.post("/transcript", status_code=201)
def calls_transcript(body: CallTranscriptBody, db: Session = Depends(get_db)):
    """Exotel Gaffe (STT) webhook: transcript for the call is now available."""
    try:
        call = exotel.store_transcript(db, body.call_id, body.transcript, body.recording_url)
    except LookupError:
        raise HTTPException(status_code=404, detail="Call not found")
    return exotel.call_out(call)


@router.post("/end", status_code=200)
def calls_end(body: CallEndBody, db: Session = Depends(get_db)):
    """Exotel CallStatusCallback: hangup -> finalize DB + follow-up SMS."""
    try:
        call = exotel.complete_call(db, body.call_id, body.duration_seconds)
    except LookupError:
        raise HTTPException(status_code=404, detail="Call not found")
    return exotel.call_out(call)


@router.post("/simulate", status_code=201)
def calls_simulate(body: CallSimulateBody, db: Session = Depends(get_db)):
    """Run the full lifecycle for one caller (demo): dial -> transcript -> hangup."""
    return exotel.simulate_call(db, body.from_number, body.transcript)


@router.get("", response_model=list[CallOut])
def list_calls(limit: int = 25, db: Session = Depends(get_db)):
    return (
        db.query(PhoneCall)
        .order_by(PhoneCall.started_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{call_id}", response_model=CallOut)
def call_detail(call_id: str, db: Session = Depends(get_db)):
    call = db.query(PhoneCall).filter(PhoneCall.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call