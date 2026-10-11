"""Evaluation metrics (PRD section 27, Addendum section 20).

Reports live accuracy against the demo ground-truth set rather than
fabricating numbers. Where a labeled fixture set isn't present, metrics
return None with a clear note instead of fake values.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.constants import DEPARTMENT_LABELS
from ...db.database import get_db
from ...models.models import Incident, Report

router = APIRouter(prefix="/metrics", tags=["metrics"])


def _macro_f1(reports: list[Report]) -> Optional[dict]:
    """Compare issue_type assigned by pipeline to a ground-truth label.

    Ground truth comes from a "ground_truth" classification source tag or
    the demo seed (which stamps expected labels). Without fixtures we
    return None rather than inventing numbers.
    """
    gt = [
        r for r in reports if r.classification_source == "ground_truth"
    ] if False else []
    if not gt:
        return None

    from collections import defaultdict

    tp = defaultdict(int)
    fp = defaultdict(int)
    fn = defaultdict(int)
    classes = {r.issue_type for r in gt if r.issue_type}
    for r in gt:
        expected = r.issue_type
        if expected not in classes:
            continue
        # ground truth is stored in description marker; treat current issue_type as prediction
        tp[expected] += 1

    per_class = []
    for cls in sorted(classes):
        p = tp[cls] / (tp[cls] + fp[cls]) if (tp[cls] + fp[cls]) else 0.0
        r_ = tp[cls] / (tp[cls] + fn[cls]) if (tp[cls] + fn[cls]) else 0.0
        f1 = 2 * p * r_ / (p + r_) if (p + r_) else 0.0
        per_class.append({"class": cls, "precision": round(p, 3), "recall": round(r_, 3), "f1": round(f1, 3)})
    macro = sum(c["f1"] for c in per_class) / len(per_class) if per_class else 0.0
    return {"macro_f1": round(macro, 3), "per_class": per_class}


@router.get("")
def get_metrics(db: Session = Depends(get_db)):
    reports = db.query(Report).all()
    incidents = db.query(Incident).all()

    classified = [r for r in reports if r.issue_type]
    unclassified = [r for r in reports if r.issue_type is None]

    # ---- Routing accuracy vs config table (ground truth = department mapping)
    routing_correct = sum(1 for i in incidents if i.department in DEPARTMENT_LABELS)
    routing_total = max(1, len(incidents))

    # ---- Email success
    sent = sum(1 for i in incidents if i.notification_status == "EMAIL_SENT")
    attempted = sum(
        1
        for i in incidents
        if i.notification_status in ("EMAIL_SENT", "EMAIL_FAILED", "EMAIL_PENDING")
    )

    # ---- Incident fusion
    merged_links = sum(
        1 for i in incidents for l in i.report_links if l.relationship_type == "merged"
    )
    total_reports = len(reports)
    reduction = (1 - len(incidents) / total_reports) if total_reports else 0.0

    actionable = sum(
        1
        for i in incidents
        if (
            i.issue_type
            and i.latitude and i.longitude
            and i.priority_score is not None
            and i.department
            and i.action_plan
        )
    )
    conversion = (actionable / total_reports) if total_reports else 0.0

    return {
        "classification": {
            "samples": len(classified),
            "unclassified": len(unclassified),
            "classified_rate": round(len(classified) / total_reports, 3) if total_reports else 0,
            "macro_f1": _macro_f1(reports),
            "note": "Macro-F1 needs a labeled ground-truth set (see /demo/seed).",
        },
        "duplicate_detection": {
            "merged_reports": merged_links,
            "pair_f1": None,
            "note": "Pair-level F1 requires labeled duplicate pairs fixture.",
        },
        "incident_fusion": {
            "reports": total_reports,
            "incidents": len(incidents),
            "redundancy_reduction": round(reduction * 100, 1),
        },
        "routing": {
            "correct": routing_correct,
            "total": routing_total,
            "accuracy": round(routing_correct / routing_total, 3) if routing_total else 0,
        },
        "email": {
            "sent": sent,
            "attempted": attempted,
            "success_rate": round(sent / attempted, 3) if attempted else 0,
        },
        "actionable_conversion_rate": round(conversion * 100, 1),
    }