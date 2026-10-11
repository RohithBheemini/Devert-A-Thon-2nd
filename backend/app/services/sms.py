"""Mock SMS/WhatsApp intake gateway (feature G).

Low-bandwidth/no-JavaScript citizens text a short message to a number;
the gateway parses location hints from the text (known ward/landmark names
or "near X, Y" coordinates) and pushes it through the same fusion pipeline,
so SMS reports are first-class citizens of duplicate detection & priority.

The default cell/ward gives a sensible demo location when the text has no
locatable anchor.
"""

from __future__ import annotations

import logging
import re
import uuid

from sqlalchemy.orm import Session

from ..core.timeutil import as_naive_utc, utcnow
from ..models.models import SmsMessage

logger = logging.getLogger(__name__)

# Hyderabad anchors from the hotspot engine, reused for SMS geocoding.
from ..services.hotspots import WARD_ANCHORS  # noqa: E402

DEFAULT_LAT, DEFAULT_LNG = 17.4849, 78.3897  # Kukatpally

MAINTENANCE_BUDGET = 10  # SMSes accepted per sweep; everything is mock anyway

_STOP_WORDS = (
    "pls", "please", "fix", "there", "is", "have", "has", "got", "very",
    "near", "at", "in", "on", "the", "a", "an", "and", "of", "to", "for",
)


def parse_sms(text: str) -> dict:
    """Extract {latitude, longitude, location_label, excerpt} from free text."""
    low = text.lower()

    # Explicit coordinate shorthand: "17.48, 78.38"
    coord_m = re.search(r"(-?\d+\.\d{2,})\s*,\s*(-?\d+\.\d{2,})", text)
    if coord_m:
        try:
            lat, lng = float(coord_m.group(1)), float(coord_m.group(2))
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return {
                    "latitude": round(lat, 5),
                    "longitude": round(lng, 5),
                    "location_label": f"SMS pin {lat:.4f}, {lng:.4f}",
                    "excerpt": _excerpt(text),
                }
        except ValueError:
            pass

    # Known ward/landmark anchor name in text
    best, best_pos = None, float("inf")
    for a_lat, a_lng, name in WARD_ANCHORS:
        idx = low.find(name.lower())
        if idx != -1 and idx < best_pos:
            best, best_pos = (a_lat, a_lng, name), idx
    if best:
        a_lat, a_lng, name = best
        return {
            "latitude": round(a_lat, 5),
            "longitude": round(a_lng, 5),
            "location_label": name,
            "excerpt": _excerpt(text),
        }

    # Sub-area tokens: the first neighborhood-ish word after a location word
    for needle in ("kukatpally", "miyapur", "ameerpet", "amberpet", "gachibowli",
                   "moosapet", "nizampet", "sr nagar", "erragadda", "sultan bazar"):
        idx = low.find(needle)
        if idx != -1:
            for a_lat, a_lng, name in WARD_ANCHORS:
                if name.lower() == needle:
                    return {
                        "latitude": round(a_lat, 5),
                        "longitude": round(a_lng, 5),
                        "location_label": name,
                        "excerpt": _excerpt(text),
                    }

    return {
        "latitude": DEFAULT_LAT,
        "longitude": DEFAULT_LNG,
        "location_label": "Kukatpally",
        "excerpt": _excerpt(text),
        "fallback_location": True,
    }


def _excerpt(text: str) -> str:
    return " ".join(text.split())[:120]


def process_sms(db: Session, from_number: str, text: str) -> SmsMessage:
    """Persist an inbound SMS, geocode it, and run it through fusion."""
    from ..services.fusion import classify_and_fuse_report, make_report_id

    location = parse_sms(text)
    report_id = make_report_id(db)
    report = classify_and_fuse_report(
        db,
        report_id=report_id,
        description=location["excerpt"],
        latitude=location["latitude"],
        longitude=location["longitude"],
        accuracy_meters=50.0,
        location_label=location.get("location_label", "Kukatpally"),
        timestamp=utcnow(),
        voice_transcript=None,
        mobile_number=from_number,
    )

    sms = SmsMessage(
        id=f"SMS-{uuid.uuid4().hex[:8].upper()}",
        from_number=from_number,
        raw_text=text,
        received_at=utcnow(),
        status="PROCESSED",
        report_id=report.id,
        parsed={**location, "incident_id": report.incident_id},
    )
    db.add(sms)
    db.commit()
    db.refresh(sms)
    return sms