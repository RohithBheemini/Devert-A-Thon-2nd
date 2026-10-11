"""Demo dataset seeding (Addendum section 18).

Loads a deterministic 12-20 report set covering:
    4-6 pothole / 3-5 garbage / 3-5 water / 2-4 streetlight
    3 duplicate/related groups, 2 look-alike independents, 1 ambiguous,
    1 high + 1 low priority incident.

The primary demo scenario (PRD section 31) is exactly reproducible:
    4 pothole reports near Kukatpally Metro -> 1 incident HYD-RD-XXXX
    -> HIGH priority -> Road Maintenance -> email to Phone 1.
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.config import settings
from ...core.timeutil import utcnow
from ...db.database import Base, get_db
from ...models.models import Incident, Report
from ...services.fusion import classify_and_fuse_report, make_report_id
from ...services.sms import process_sms
from ...services.vision import severity_from_area

router = APIRouter(prefix="/demo", tags=["demo"])

# Kukatpally Metro, Hyderabad
KUKATPALLY_LAT, KUKATPALLY_LON = 17.494811, 78.399592

# Helper coordinates for independent demo incidents
GACHIBOWLI = (17.4402, 78.3424)
AMBERPET = (17.3724, 78.5368)
HYDERGUDA = (17.3929, 78.4624)
MIYAPUR = (17.4974, 78.3931)
SULTANBAZAR = (17.3850, 78.4720)


def _demo_reports() -> list[dict]:
    now = utcnow()
    h = lambda n: now - timedelta(hours=n)  # noqa: E731

    return [
        # ---- Primary demo scenario: 4 pothole reports -> 1 incident (RD)
        {
            "description": "There is a huge pothole near Kukatpally Metro. Vehicles are swerving dangerously.",
            "latitude": KUKATPALLY_LAT,
            "longitude": KUKATPALLY_LON,
            "accuracy_meters": 8,
            "location_label": "Kukatpally Metro",
            "timestamp": h(5),
            "image_filename": "demo_pothole_1.jpg",
            "detections": [{"type": "pothole", "confidence": 0.90, "area_fraction": 0.22}],
            "mobile_number": "+91-98450-10001",
        },
        {
            "description": "Large road hole beside the metro station. Getting bigger every day.",
            "latitude": KUKATPALLY_LAT + 0.0006,
            "longitude": KUKATPALLY_LON + 0.0004,
            "accuracy_meters": 12,
            "location_label": "Kukatpally Metro",
            "timestamp": h(8),
            "image_filename": None,
            "detections": None,
        },
        {
            "description": "Large road hole near Kukatpally metro",
            "latitude": KUKATPALLY_LAT - 0.0005,
            "longitude": KUKATPALLY_LON + 0.0006,
            "accuracy_meters": 15,
            "location_label": "Kukatpally Metro",
            "timestamp": h(11),
            "image_filename": None,
            "detections": None,
            "voice_transcript": "పెద్ద రోడ్డు గుంత మెట్రో దగ్గర",
        },
        {
            "description": "Road damage with a deep pothole at Kukatpally near the metro footbridge. Photo attached.",
            "latitude": KUKATPALLY_LAT + 0.0009,
            "longitude": KUKATPALLY_LON - 0.0003,
            "accuracy_meters": 10,
            "location_label": "Kukatpally Metro",
            "timestamp": h(13),
            "image_filename": "demo_pothole_2.jpg",
            "detections": [{"type": "pothole", "confidence": 0.88, "area_fraction": 0.18}],
        },
        # ---- Independent similar-wording pothole ~3 km away (look-alike)
        {
            "description": "There is a huge pothole near Miyapur metro on the service road.",
            "latitude": MIYAPUR[0],
            "longitude": MIYAPUR[1],
            "accuracy_meters": 14,
            "location_label": "Miyapur Metro",
            "timestamp": h(20),
            "image_filename": "demo_pothole_3.jpg",
            "detections": [{"type": "pothole", "confidence": 0.78, "area_fraction": 0.1}],
        },
        # ---- Garbage group (3 reports -> 1 incident)
        {
            "description": "Garbage overflowing from the bin near Moosapet junction, stinking badly.",
            "latitude": 17.4780,
            "longitude": 78.3980,
            "accuracy_meters": 10,
            "location_label": "Moosapet Junction",
            "timestamp": h(3),
            "image_filename": "demo_garbage_1.jpg",
            "detections": [{"type": "garbage", "confidence": 0.85, "area_fraction": 0.3}],
            "mobile_number": "+91-98450-10002",
        },
        {
            "description": "Overflowing trash pile at Moosapet junction needs pickup.",
            "latitude": 17.4782,
            "longitude": 78.3981,
            "accuracy_meters": 12,
            "location_label": "Moosapet Junction",
            "timestamp": h(6),
            "image_filename": None,
            "detections": None,
        },
        {
            "description": "Waste accumulating near Moosapet junction for two days.",
            "latitude": 17.4781,
            "longitude": 78.3982,
            "accuracy_meters": 15,
            "location_label": "Moosapet Junction",
            "timestamp": h(9),
            "image_filename": None,
            "detections": None,
        },
        # ---- Water group (3 reports -> 1 incident)
        {
            "description": "Water leaking from a pipe near Ameerpet metro, the road is flooded.",
            "latitude": 17.4373,
            "longitude": 78.4488,
            "accuracy_meters": 9,
            "location_label": "Ameerpet",
            "timestamp": h(4),
            "image_filename": "demo_water_1.jpg",
            "detections": [{"type": "water leak", "confidence": 0.82, "area_fraction": 0.25}],
        },
        {
            "description": "Continuous water leakage on the main road at Ameerpet crossing.",
            "latitude": 17.4375,
            "longitude": 78.4489,
            "accuracy_meters": 14,
            "location_label": "Ameerpet",
            "timestamp": h(7),
            "image_filename": None,
            "detections": None,
        },
        {
            "description": "Pipe burst near Ameerpet, water flow worsening.",
            "latitude": 17.4370,
            "longitude": 78.4486,
            "accuracy_meters": 11,
            "location_label": "Ameerpet",
            "timestamp": h(10),
            "image_filename": None,
            "detections": None,
        },
        # ---- Streetlight (2 reports -> related pair)
        {
            "description": "Broken streetlight outside Gachibowli stadium, road is dark at night.",
            "latitude": GACHIBOWLI[0],
            "longitude": GACHIBOWLI[1],
            "accuracy_meters": 12,
            "location_label": "Gachibowli",
            "timestamp": h(2),
            "image_filename": "demo_light_1.jpg",
            "detections": [{"type": "streetlight", "confidence": 0.8, "area_fraction": 0.05}],
        },
        {
            "description": "Street lamp not working near Gachibowli stadium for a week.",
            "latitude": GACHIBOWLI[0] + 0.0005,
            "longitude": GACHIBOWLI[1] + 0.0003,
            "accuracy_meters": 15,
            "location_label": "Gachibowli",
            "timestamp": h(12),
            "image_filename": None,
            "detections": None,
        },
        # ---- Ambiguous report (low confidence, flagged review)
        {
            "description": "Something wrong on the road near Sultan Bazar, not sure what it is.",
            "latitude": SULTANBAZAR[0],
            "longitude": SULTANBAZAR[1],
            "accuracy_meters": 20,
            "location_label": "Sultan Bazar",
            "timestamp": h(1),
            "image_filename": "demo_ambiguous.jpg",
            "detections": None,
        },
        # ---- Independent garbage (look-alike wording, different area)
        {
            "description": "Garbage overflowing near Amberpet bus stand.",
            "latitude": AMBERPET[0],
            "longitude": AMBERPET[1],
            "accuracy_meters": 13,
            "location_label": "Amberpet",
            "timestamp": h(15),
            "image_filename": None,
            "detections": None,
        },
    ]


@router.post("/seed")
def seed_demo(db: Session = Depends(get_db)):
    """Clear and reload the deterministic demo dataset."""
    if db.query(Report).first():
        # Full drop avoids stale junction rows (incident_reports, notifications)
        # that bulk deletes leave behind on the SQLite file.
        Base.metadata.drop_all(bind=db.get_bind())
        Base.metadata.create_all(bind=db.get_bind())
        db.commit()

    created = {"reports": 0, "incidents": []}
    for item in _demo_reports():
        vision_result = None
        if item.get("detections"):
            vision_result = {
                "available": True,
                "detections": item["detections"],
                "area_fraction": item["detections"][0].get("area_fraction", 0.1),
                "severity_hint": severity_from_area(
                    item["detections"][0].get("area_fraction", 0.1)
                ),
            }
        report_id = make_report_id(db)
        report = classify_and_fuse_report(
            db,
            report_id=report_id,
            description=item["description"],
            latitude=item["latitude"],
            longitude=item["longitude"],
            accuracy_meters=item.get("accuracy_meters"),
            location_label=item.get("location_label"),
            timestamp=item["timestamp"],
            voice_transcript=item.get("voice_transcript"),
            image_path=None,
            image_filename=item.get("image_filename"),
            vision_result=vision_result,
            mobile_number=item.get("mobile_number"),
        )
        created["reports"] += 1

    # Feature G: seed an SMS conversation so the mock gateway has an inbox.
    sms_burst = [
        ("+91-98450123-01", "17.4780, 78.3980 garbage overflowing from the bin near Moosapet junction, stinking badly"),
        ("+91-98450123-02", "17.4373, 78.4488 water leaking from a pipe near Ameerpet metro, the road is flooded"),
        ("+91-98450123-03", "17.4402, 78.3424 broken streetlight outside Gachibowli stadium, road is dark at night"),
        ("+91-98450123-04", "17.4948, 78.3996 there is a huge pothole near Kukatpally metro, vehicles are swerving"),
    ]
    sms_seeded = 0
    for number, text in sms_burst:
        try:
            process_sms(db, number, text)
            sms_seeded += 1
        except Exception:  # noqa: BLE001
            pass
    created["sms_messages"] = sms_seeded

    # Voice helpline: two recent calls with transcripts -> fused cases.
    from ...services import exotel

    created["calls"] = 0
    demo_calls = [
        (
            "+91-98450-30001",
            "Stagnant water and a leaking pipe near SR Nagar, 17.4439 78.3929, the road is flooded since morning.",
        ),
        (
            "+91-98450-30002",
            "There is a huge pothole near Kukatpally metro, vehicles are swerving dangerously, 17.4948 78.3996.",
        ),
    ]
    for number, transcript in demo_calls:
        try:
            exotel.simulate_call(db, number, transcript)
            created["calls"] += 1
        except Exception:  # noqa: BLE001
            pass

    for inc in db.query(Incident).order_by(Incident.created_at).all():
        created["incidents"].append(
            {
                "id": inc.id,
                "issue": inc.issue_label,
                "reports": inc.report_count,
                "priority": f"{inc.priority_score}/{inc.priority_level}",
                "department": inc.department_label,
            }
        )

    return {"loaded": True, "mode": "demo", **created}


@router.get("/status")
def demo_status(db: Session = Depends(get_db)):
    incidents = db.query(Incident).all()
    reports = db.query(Report).all()
    return {
        "reports": len(reports),
        "incidents": len(incidents),
        "settings": {
            "vision_model_enabled": settings.VISION_MODEL_ENABLED,
            "embeddings_enabled": settings.EMBEDDINGS_ENABLED,
            "email_mock": settings.EMAIL_MOCK,
            "demo_mode": settings.DEMO_MODE,
            "contact_number": settings.EXOTEL_CONTACT_NUMBER,
        },
        "incidents": [
            {
                "id": i.id,
                "issue": i.issue_label,
                "priority": i.priority_score,
                "level": i.priority_level,
                "department": i.department_label,
                "status": i.status,
                "notification": i.notification_status,
                "reports": i.report_count,
            }
            for i in incidents
        ],
    }