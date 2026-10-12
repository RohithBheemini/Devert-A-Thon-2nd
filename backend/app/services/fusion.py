"""Incident fusion (PRD FR-6, Addendum sections 6-8).

Turns a classified report into (or into part of) an Incident:

    Report
      -> candidate filtering (issue, time, distance)
      -> pair relatedness
      -> MERGE            -> attach to best-matching incident and recompute
      -> MARK_RELATED     -> create new incident, cross-link as related
      -> CREATE_NEW       -> create new standalone incident

For each incident the service recomputes the aggregate evidence, priority
(explainable breakdown), department, and constrained action plan.
"""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy.orm import Session

from ..core.constants import (
    ACTION_LIBRARY,
    DEPARTMENT_LABELS,
    ISSUE_LABELS,
)
from ..core.timeutil import as_naive_utc, utcnow
from ..models.models import Incident, IncidentReport, Report
from ..services.duplicates import (
    compute_relatedness,
    haversine_meters,
)
from ..services.embeddings import embedding_service
from ..services.predictive import apply_prediction
from ..services.priority import compute_priority

logger = logging.getLogger(__name__)


def make_report_id(db: Session) -> str:
    count = db.query(Report).count() + 1
    return f"REP-{count:05d}"


def make_incident_id(issue_type: str, db: Session) -> str:
    prefix = {
        "pothole": "HYD-RD",
        "garbage_overflow": "HYD-GB",
        "water_leakage": "HYD-WT",
        "broken_streetlight": "HYD-SL",
    }.get(issue_type, "HYD-IC")
    count = db.query(Incident).count() + 1
    return f"{prefix}-{count:04d}"


def incident_union_summary(reports: list[Report]) -> str:
    """Short natural-language summary from the underlying reports."""
    merged = " ".join((r.description for r in reports if r.description))
    words = merged.split()
    if len(words) <= 40:
        return " ".join(words)
    return " ".join(words[:40]) + " ..."


def _semantic_vectors(texts: list[str]):
    return embedding_service.encode(texts)


def classify_and_fuse_report(
    db: Session,
    *,
    report_id: str,
    description: str,
    latitude: float,
    longitude: float,
    accuracy_meters: float | None,
    location_label: str | None,
    timestamp: datetime,
    voice_transcript: str | None = None,
    image_path: str | None = None,
    image_filename: str | None = None,
    vision_result: dict | None = None,
    mobile_number: str | None = None,
) -> Report:
    """Persist the report, classify it, then fuse into an incident."""
    from ..services.classifier import classify

    detections = None
    vision_conf = None
    vision_failed = False
    vision_severity = None
    if vision_result is not None:
        if vision_result.get("available"):
            detections = vision_result.get("detections", [])
            if detections:
                vision_conf = max(d["confidence"] for d in detections)
            vision_severity = vision_result.get("severity_hint")
        else:
            vision_failed = True

    cls = classify(
        description=description,
        voice_transcript=voice_transcript,
        vision_detections=detections,
    )

    report = Report(
        id=report_id,
        description=description,
        issue_type=cls["issue_type"],
        classification_confidence=cls["confidence"],
        classification_source=cls["source"],
        needs_review=cls["needs_review"],
        latitude=latitude,
        longitude=longitude,
        accuracy_meters=accuracy_meters,
        location_label=location_label,
        timestamp=timestamp,
        image_path=image_path,
        image_filename=image_filename,
        voice_transcript=voice_transcript,
        vision_confidence=vision_conf,
        vision_detections=detections,
        vision_failed=vision_failed,
        vision_severity=vision_severity,
        mobile_number=mobile_number,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    try:
        _fuse(db, report)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Fusion failed for %s; creating standalone incident", report_id)
        # Addendum 24: duplicate engine failure -> create a new incident.
        # Roll back any partial merge side effects, then seed a clean incident.
        db.rollback()
        db.refresh(report)
        report.needs_review = True
        db.commit()
        _create_incident(db, report)

    _acknowledge_by_sms(db, report)

    return report


def _acknowledge_by_sms(db: Session, report: Report):
    """Feature G: text the reporter an acknowledgement when they gave a mobile."""
    if not report.mobile_number:
        return
    incident = _incident_of_report(db, report.id)
    if incident is None:
        return
    try:
        from ..services.sms_out import build_ack_text, send_sms

        send_sms(report.mobile_number, build_ack_text(report, incident), kind="ACK")
    except Exception:  # noqa: BLE001
        logger.exception("Outbound SMS acknowledgement failed for %s", report.id)


def _fuse(db: Session, report: Report):
    """Match a new report against existing incidents and apply merge policy."""
    if report.issue_type is None:
        # Issue unclear: create a pending standalone incident flagged for review
        _create_incident(db, report, force_review=True)
        return

    candidates = _candidate_reports(db, report)
    if not candidates:
        _create_incident(db, report)
        return

    # Group candidates by their owning incident (every report lives in one).
    groups: dict[str, list[Report]] = {}
    for cand in candidates:
        incident = _incident_of_report(db, cand.id)
        key = incident.id if incident else f"orphan::{cand.id}"
        groups.setdefault(key, []).append(cand)

    incident_matches: list[tuple[Report, dict, Incident | None]] = []
    for incident_id, members in groups.items():
        incident = (
            db.query(Incident).get(incident_id)
            if not incident_id.startswith("orphan")
            else None
        )
        texts = [m.description for m in members] + [report.description]
        vecs = _semantic_vectors(texts)
        for idx, cand in enumerate(members):
            sim = None
            if vecs is not None:
                sim = embedding_service.cosine(vecs, idx, len(texts) - 1)
            rel = compute_relatedness(
                issue_a=cand.issue_type or report.issue_type,
                issue_b=report.issue_type,
                text_a=cand.description,
                text_b=report.description,
                dt_a=cand.timestamp,
                dt_b=report.timestamp,
                lat_a=cand.latitude,
                lon_a=cand.longitude,
                lat_b=report.latitude,
                lon_b=report.longitude,
                location_label_a=cand.location_label,
                location_label_b=report.location_label,
                embedding_similarity=sim,
            )
            incident_matches.append((cand, rel, incident))

    if not incident_matches:
        _create_incident(db, report)
        return

    best = max(incident_matches, key=lambda m: m[1]["relatedness"])
    best_cand, rel, incident = best

    if rel["decision"] == "MERGE" and incident is not None:
        _attach_report(db, incident, report, rel)
        return

    if rel["decision"] == "MARK_RELATED" and incident is not None:
        new_incident = _create_incident(db, report)
        _mark_related_pair(db, new_incident, incident, rel)
        _maybe_flag_review(db, new_incident, report)
        return

    _create_incident(db, report)


def _candidate_reports(db: Session, report: Report) -> list[Report]:
    """Candidate filtering: same issue, time diff <= 48h, distance <= 500m."""
    from ..services.duplicates import CANDIDATE_TIME_WINDOW_HOURS, CANDIDATE_DISTANCE_METERS, is_candidate

    window = CANDIDATE_TIME_WINDOW_HOURS * 3600.0
    report_ts = as_naive_utc(report.timestamp)
    earliest = int(report_ts.timestamp()) - int(window)
    latest = int(report_ts.timestamp()) + int(window)

    reports = (
        db.query(Report)
        .filter(Report.timestamp >= datetime.fromtimestamp(earliest).replace(tzinfo=None))
        .filter(Report.timestamp <= datetime.fromtimestamp(latest).replace(tzinfo=None))
    ).all()

    out = []
    for c in reports:
        if c.id == report.id:
            continue
        try:
            if is_candidate(
                c.issue_type or report.issue_type,
                report.issue_type or c.issue_type,
                c.timestamp,
                report.timestamp,
                c.latitude,
                c.longitude,
                report.latitude,
                report.longitude,
            ):
                out.append(c)
        except Exception:  # noqa: BLE001
            distance = haversine_meters(
                c.latitude, c.longitude, report.latitude, report.longitude
            )
            if c.issue_type == report.issue_type and distance <= CANDIDATE_DISTANCE_METERS:
                out.append(c)
    return out


def _incident_of_report(db: Session, report_id: str) -> Incident | None:
    link = (
        db.query(IncidentReport)
        .filter(IncidentReport.report_id == report_id)
        .filter(IncidentReport.relationship_type == "merged")
        .first()
    )
    return link.incident if link else None


def _attach_report(db: Session, incident: Incident, report: Report, rel: dict):
    db.add(
        IncidentReport(
            incident_id=incident.id,
            report_id=report.id,
            relatedness_score=rel["relatedness"],
            relationship_type="merged",
            band=rel["band"],
        )
    )
    _recompute_incident(db, incident)


def _mark_related_pair(db: Session, inc_a: Incident, inc_b: Incident, rel: dict):
    """Cross-link two keep-separate incidents as related (auditable).

    Records the pair on both incidents so the dashboard can show
    'possibly related to HYD-...'.
    """
    entry_a = {
        "incidentId": inc_b.id,
        "relatedness": rel["relatedness"],
        "band": rel["band"],
    }
    entry_b = {
        "incidentId": inc_a.id,
        "relatedness": rel["relatedness"],
        "band": rel["band"],
    }
    existing_a = list(inc_a.related_incidents or [])
    existing_b = list(inc_b.related_incidents or [])
    if inc_b.id not in [e.get("incidentId") for e in existing_a]:
        existing_a.append(entry_a)
    if inc_a.id not in [e.get("incidentId") for e in existing_b]:
        existing_b.append(entry_b)
    inc_a.related_incidents = existing_a
    inc_b.related_incidents = existing_b
    try:
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


def _create_incident(db: Session, report: Report, force_review: bool = False) -> Incident:
    issue = report.issue_type or "unknown"
    label = ISSUE_LABELS.get(issue, "Unclear Issue")
    department = _route_department(issue)
    department_label = DEPARTMENT_LABELS.get(department, department)

    vision_confidences = [c for c in [report.vision_confidence] if c is not None]
    severity_hints = [v for v in [report.vision_severity] if v is not None]
    detection_masks = (
        [{"area_fraction": report.vision_detections[0].get("area_fraction", 0.1), }]
        if report.vision_detections
        else None
    )

    priority = compute_priority(
        issue_type=issue,
        report_count=1,
        image_count=1 if report.image_path else 0,
        has_voice=bool(report.voice_transcript),
        vision_confidences=vision_confidences,
        location_label=report.location_label,
        created_at=report.timestamp,
        detection_masks=detection_masks,
        severity_hints=severity_hints,
    )

    confidence, confidence_label = _incident_confidence(report)

    action_plan = _select_actions(issue, priority["level"], priority["score"])

    incident = Incident(
        id=make_incident_id(issue, db),
        issue_type=issue,
        issue_label=label,
        latitude=report.latitude,
        longitude=report.longitude,
        location_label=report.location_label,
        confidence=confidence,
        confidence_label=confidence_label,
        priority_score=priority["score"],
        priority_level=priority["level"],
        priority_breakdown=priority["breakdown"],
        department=department,
        department_label=department_label,
        action_plan=action_plan,
        status="OPEN",
        notification_status="NOT_SENT",
        needs_review=force_review or report.needs_review,
        review_reason=(
            "Classification low confidence; additional evidence requested"
            if (force_review or report.needs_review)
            else None
        ),
        description=report.description,
        summary=incident_union_summary([report]),
        evidence_summary=_evidence_summary([report]),
        response_to=[
            {
                "question": "What happened?",
                "answer": f"{label} detected at the reported location.",
            },
            {
                "question": "Why do we believe it?",
                "answer": "Citizen report with supporting evidence.",
            },
            {
                "question": "Why is it this priority?",
                "answer": (
                    f"Priority = {priority['score']}/100 ({priority['level']}). "
                    f"See breakdown for details."
                ),
            },
            {
                "question": "What happens next?",
                "answer": f"{department_label} will inspect and act on this incident.",
            },
        ],
        status_history=[
            {"status": "OPEN", "at": utcnow().isoformat(), "by": "system"}
        ],
    )
    db.add(incident)
    db.flush()
    apply_prediction(incident)
    db.add(
        IncidentReport(
            incident_id=incident.id,
            report_id=report.id,
            relatedness_score=1.0,
            relationship_type="merged",
            band="seed",
        )
    )
    db.commit()
    db.refresh(incident)
    return incident


def _recompute_incident(db: Session, incident: Incident):
    """Recompute evidence, confidence, priority, actions after a merge."""
    reports = [link.report for link in incident.report_links if link.relationship_type == "merged"]

    issue = _highest_confidence_issue(reports)
    if issue["issue_type"] is None:
        return

    incident.issue_type = issue["issue_type"]
    incident.issue_label = ISSUE_LABELS.get(issue["issue_type"], issue["issue_type"])
    lat, lon = _representative_location(reports)
    incident.latitude, incident.longitude = lat, lon
    incident.location_label = _representative_label(reports, incident.location_label)

    confidence, confidence_label = _incident_confidence(reports)
    incident.confidence = confidence
    incident.confidence_label = confidence_label

    image_count = sum(1 for r in reports if r.image_path)
    vision_confidences = [r.vision_confidence for r in reports if r.vision_confidence is not None]
    severity_hints = [r.vision_severity for r in reports if r.vision_severity is not None]
    masks = None
    for r in reports:
        if r.vision_detections:
            masks = [{"area_fraction": d.get("area_fraction", 0.1)} for d in r.vision_detections]
            break

    priority = compute_priority(
        issue_type=issue["issue_type"],
        report_count=len(reports),
        image_count=image_count,
        has_voice=any(r.voice_transcript for r in reports),
        vision_confidences=vision_confidences,
        location_label=incident.location_label,
        created_at=incident.created_at,
        detection_masks=masks,
        severity_hints=severity_hints,
    )
    incident.priority_score = priority["score"]
    incident.priority_level = priority["level"]
    incident.priority_breakdown = priority["breakdown"]
    incident.department = _route_department(issue["issue_type"])
    incident.department_label = DEPARTMENT_LABELS.get(incident.department, incident.department)
    incident.action_plan = _select_actions(issue["issue_type"], priority["level"], priority["score"])
    incident.description = reports[-1].description if reports else incident.description
    incident.summary = incident_union_summary(reports)
    incident.evidence_summary = _evidence_summary(reports)
    incident.response_to = [
        {
            "question": "What happened?",
            "answer": f"{incident.issue_label} detected near {incident.location_label or 'the reported location'}.",
        },
        {
            "question": "Why do we believe it?",
            "answer": (
                f"{len(reports)} citizen report(s) + "
                f"{image_count} image(s) + location agreement."
            ),
        },
        {
            "question": "Why is it this priority?",
            "answer": (
                f"Priority = {priority['score']}/100 ({priority['level']}). "
                f"See breakdown for details."
            ),
        },
        {
            "question": "What happens next?",
            "answer": f"{incident.department_label} will inspect and act.",
        },
    ]
    _maybe_flag_review(db, incident, reports)
    apply_prediction(incident)
    incident.updated_at = utcnow()
    db.commit()
    db.refresh(incident)


def _maybe_flag_review(db: Session, incident: Incident, reports: list[Report] | Report):
    """Flag incident for human review when evidence is ambiguous."""
    if isinstance(reports, Report):
        reports = [reports]
    reasons = []
    low_conf = [r for r in reports if r.classification_confidence is not None and r.classification_confidence < 0.80]
    if low_conf:
        reasons.append("Classification confidence below 0.80")
    if incident.confidence < 0.60:
        reasons.append("Incident confidence low")
    needs = bool(reasons)
    incident.needs_review = needs
    incident.review_reason = "; ".join(reasons) if needs else None
    db.commit()


def _incident_confidence(reports: list[Report] | Report) -> tuple[float, str]:
    """Aggregate confidence without averaging model confidences (Addendum 7).

    Bounded and explainable: starts from the best single classification
    confidence and rises with corroborating independent reports.
    """
    if isinstance(reports, Report):
        reports = [reports]
    confs = [
        r.vision_confidence if r.vision_confidence is not None else r.classification_confidence
        for r in reports
        if (r.vision_confidence is not None or r.classification_confidence is not None)
    ]
    if not confs:
        return 0.5, "MEDIUM"
    base = max(confs)
    # +2% per additional independent report, cap at 0.98
    confidence = min(0.98, base + 0.02 * (len(confs) - 1))
    if confidence >= 0.8:
        label = "HIGH"
    elif confidence >= 0.6:
        label = "MEDIUM"
    else:
        label = "LOW"
    return round(confidence, 3), label


def _highest_confidence_issue(reports: list[Report]) -> dict:
    issue_type = None
    best = 0.0
    for r in reports:
        if r.issue_type is None:
            continue
        from ..core.constants import ISSUE_ALIASES

        resolved = ISSUE_ALIASES.get(r.issue_type, r.issue_type)
        conf = r.vision_confidence or r.classification_confidence or 0.0
        if conf > best:
            best = conf
            issue_type = resolved
    if issue_type is not None:
        return {"issue_type": issue_type, "confidence": best if best else 0.7}
    # Fall back to majority vote
    from collections import Counter

    votes = Counter(r.issue_type for r in reports if r.issue_type)
    if votes:
        return {"issue_type": votes.most_common(1)[0][0], "confidence": 0.6}
    return {"issue_type": None, "confidence": 0.0}


def _representative_location(reports: list[Report]) -> tuple[float, float]:
    """Weighted centroid preferring high-accuracy reports (Addendum 7)."""
    weights, lat_sum, lon_sum = 0.0, 0.0, 0.0
    for r in reports:
        acc = r.accuracy_meters if r.accuracy_meters and r.accuracy_meters > 0 else 20.0
        w = 1.0 / acc
        weights += w
        lat_sum += r.latitude * w
        lon_sum += r.longitude * w
    if weights == 0:
        r = reports[0]
        return r.latitude, r.longitude
    return round(lat_sum / weights, 6), round(lon_sum / weights, 6)


def _representative_label(reports: list[Report], fallback: str | None) -> str | None:
    for r in reports:
        if r.location_label:
            return r.location_label
    return fallback


def _evidence_summary(reports: list[Report]) -> list:
    image_count = sum(1 for r in reports if r.image_path)
    voice_count = sum(1 for r in reports if r.voice_transcript)
    return [
        "{} citizen report(s)".format(len(reports)),
        "{} image(s)".format(image_count),
        "{} voice report(s)".format(voice_count),
    ]


def _route_department(issue: str) -> str:
    from ..core.constants import DAILY_ROUTING_TEMPLATE

    return DAILY_ROUTING_TEMPLATE.get(issue, "ROAD_MAINTENANCE")


def _select_actions(issue: str, level: str, score: int) -> list[str]:
    """Constrained action library (Addendum section 9). Never invent steps."""
    lib = ACTION_LIBRARY.get(issue, {}).get("general", ACTION_LIBRARY["pothole"]["general"])
    if score >= 65 and level in ("HIGH", "CRITICAL"):
        lib = ACTION_LIBRARY.get(issue, {}).get("high", lib)
    elif score < 45:
        lib = ACTION_LIBRARY.get(issue, {}).get("low", lib)
    return lib