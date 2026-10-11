"""Report intake API (FR-1). Accepts text + optional image + location.

On image upload the vision service analyzes it; failures degrade gracefully
(IMAGE ANALYSIS UNAVAILABLE marker) instead of blocking submission.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ...core.paths import UPLOADS_DIR
from ...core.timeutil import utcnow
from ...db.database import get_db
from ...models.models import IncidentReport, Report
from ...schemas.schemas import ReportOut
from ...services.fusion import classify_and_fuse_report, make_report_id
from ...services.vision import vision_service

router = APIRouter(prefix="/reports", tags=["reports"])


def _save_image(upload: UploadFile) -> tuple[str, str]:
    ext = Path(upload.filename or "image.jpg").suffix or ".jpg"
    filename = f"rep_{utcnow().strftime('%Y%m%d%H%M%S%f')}{ext}"
    dest = UPLOADS_DIR / filename
    with dest.open("wb") as out:
        shutil.copyfileobj(upload.file, out)
    return str(dest), filename


@router.post("", response_model=ReportOut, status_code=201)
async def submit_report(
    description: str = Form(..., min_length=1, max_length=2000),
    latitude: float = Form(...),
    longitude: float = Form(...),
    accuracy_meters: float | None = Form(default=None),
    location_label: str | None = Form(default=None),
    voice_transcript: str | None = Form(default=None),
    mobile_number: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> ReportOut:
    image_path = None
    image_filename = None
    vision_result = None

    if image is not None:
        image_path, image_filename = _save_image(image)
        image_bytes = Path(image_path).read_bytes()
        vision_result = vision_service.analyze(image_bytes)
        if not vision_result.get("available"):
            vision_result["available"] = False  # keep marker, continue

    report_id = make_report_id(db)
    report = classify_and_fuse_report(
        db,
        report_id=report_id,
        description=description,
        latitude=latitude,
        longitude=longitude,
        accuracy_meters=accuracy_meters,
        location_label=location_label,
        timestamp=utcnow(),
        voice_transcript=voice_transcript,
        image_path=image_path,
        image_filename=image_filename,
        vision_result=vision_result,
        mobile_number=mobile_number,
    )
    return ReportOut.model_validate(report)


@router.get("", response_model=list[ReportOut])
def list_reports(db: Session = Depends(get_db)):
    return db.query(Report).order_by(Report.timestamp.desc()).all()


@router.get("/tracker/{report_id}")
def get_tracker(report_id: str, db: Session = Depends(get_db)):
    """Feature E: public 'where's my issue' view for a citizen's report."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not report.incident_id:
        return {
            "report_id": report.id,
            "found": False,
            "message": "Report received but not yet linked to an incident.",
        }

    from ...models.models import Incident, IncidentReport

    incident = (
        db.query(Incident)
        .join(IncidentReport, IncidentReport.incident_id == Incident.id)
        .filter(IncidentReport.report_id == report.id, IncidentReport.relationship_type == "merged")
        .first()
    )
    if not incident:
        incident = db.query(Incident).filter(Incident.id == report.incident_id).first()

    from ...services.predictive import forecast_summary

    merged = len(
        incident.report_links
    )
    return {
        "report_id": report.id,
        "found": True,
        "incident_id": incident.id,
        "issue_label": incident.issue_label,
        "issue_type": incident.issue_type,
        "status": incident.status,
        "priority_level": incident.priority_level,
        "priority_score": incident.priority_score,
        "department_label": incident.department_label,
        "reports_merged_into_incident": merged,
        "evidence_summary": incident.evidence_summary,
        "action_plan": incident.action_plan,
        "location_label": incident.location_label,
        "latitude": incident.latitude,
        "longitude": incident.longitude,
        "forecast": forecast_summary(incident),
        "appeal_open": incident.appeal_open,
        "needs_review": incident.needs_review,
        "sms_updates_enabled": any(l.report.mobile_number for l in incident.report_links),
        "status_history": incident.status_history,
        "tracking_ref": f"CRN-{report.id}/{incident.id}",
    }


@router.post("/{report_id}/photo", status_code=200)
async def upload_photo_proof(
    report_id: str,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Follow-up photo proof (helpline flow): add a photo to an existing report.

    Vision re-analysis feeds severity hints into the priority recomputation,
    so a citizen who proves the issue with a photo gets it treated faster.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    prior_score = None
    incident = None
    from ...models.models import Incident

    inc = (
        db.query(Incident)
        .join(Incident.report_links)
        .filter(IncidentReport.report_id == report.id)
        .filter(IncidentReport.relationship_type == "merged")
        .first()
    )
    if inc:
        incident = inc
        prior_score = inc.priority_score

    image_path, image_filename = _save_image(image)
    image_bytes = Path(image_path).read_bytes()
    vision_result = vision_service.analyze(image_bytes)

    report.image_path = image_path
    report.image_filename = image_filename
    if vision_result.get("available"):
        detections = vision_result.get("detections", [])
        report.vision_confidence = max((d["confidence"] for d in detections), default=None)
        report.vision_detections = detections
        report.vision_failed = False
        hint = vision_result.get("severity_hint")
        from ...services.vision import severity_from_area

        report.vision_severity = hint or severity_from_area(vision_result.get("area_fraction", 0.1))
    else:
        report.vision_failed = True
        report.vision_confidence = None
        report.vision_severity = None
    report.needs_review = False
    db.commit()
    db.refresh(report)

    if incident:
        from ...services.fusion import _recompute_incident

        _recompute_incident(db, incident)
        db.refresh(incident)

    return {
        "report_id": report.id,
        "image_filename": image_filename,
        "vision_available": bool(vision_result.get("available")),
        "severity_hint": report.vision_severity,
        "incident_id": incident.id if incident else None,
        "priority_before": prior_score,
        "priority_after": incident.priority_score if incident else None,
        "priority_level": incident.priority_level if incident else None,
    }


@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportOut.model_validate(report)