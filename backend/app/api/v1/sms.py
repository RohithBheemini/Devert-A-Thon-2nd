"""SMS/WhatsApp inbound gateway (feature G) + inbox view."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db.database import get_db
from ...models.models import SmsMessage
from ...schemas.schemas import SmsInbound, SmsMessageOut
from ...services.sms import process_sms

router = APIRouter(prefix="/sms", tags=["sms"])


@router.post("/inbound", response_model=SmsMessageOut, status_code=201)
def sms_inbound(body: SmsInbound, db: Session = Depends(get_db)):
    """Receive a citizen SMS/WhatsApp message and fuse it into the pipeline."""
    return process_sms(db, body.from_number, body.text)


@router.get("/inbox", response_model=list[SmsMessageOut])
def sms_inbox(limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(SmsMessage)
        .order_by(SmsMessage.received_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/inbox/{message_id}", response_model=SmsMessageOut)
def sms_message(message_id: str, db: Session = Depends(get_db)):
    msg = db.query(SmsMessage).filter(SmsMessage.id == message_id).first()
    if not msg:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="SMS message not found")
    return msg


@router.post("/simulate", status_code=201)
def simulate_burst(batch: list[SmsInbound], db: Session = Depends(get_db)):
    """Ingest a batch of messages (demo/eval convenience)."""
    results = []
    for body in batch:
        msg = process_sms(db, body.from_number, body.text)
        results.append(
            {
                "sms_id": msg.id,
                "report_id": msg.report_id,
                "incident_id": (msg.parsed or {}).get("incident_id"),
            }
        )
    return {"processed": len(results), "items": results}