"""Report classifier (Addendum section 5).

Confidence rules:
    >= 0.80      automatic classification
    0.60 - 0.79  classification + "needs review"
    <  0.60      "issue unclear" / request more evidence

Signal fusion: vision detections first, then voice transcript, then text.
The deterministic keyword classifier is the always-available fallback so an
AI/model failure never blocks a report.
"""

from __future__ import annotations

from typing import Optional

from ..core.constants import ISSUE_ALIASES
from ..services.duplicates import text_classify

HIGH_CONF = 0.80
MED_CONF = 0.60

POTHOLE_VISION_MAP = {
    "pothole": "pothole",
    "road defect": "pothole",
    "road crack": "pothole",
    "hole": "pothole",
}

VISION_CLASS_TO_ISSUE: dict[str, Optional[str]] = {
    "pothole": "pothole",
    "road crack": "pothole",
    "road defect": "pothole",
    "garbage": "garbage_overflow",
    "trash": "garbage_overflow",
    "waste": "garbage_overflow",
    "water leak": "water_leakage",
    "leak": "water_leakage",
    "streetlight": "broken_streetlight",
    "street light": "broken_streetlight",
}


def classify(
    *,
    description: str,
    voice_transcript: Optional[str] = None,
    vision_detections: Optional[list] = None,
) -> dict:
    """Return {issue_type, confidence, source, needs_review}."""
    confidence = 0.0
    source = ""
    issue_type: Optional[str] = None

    # 1. Vision is the strongest signal when available
    if vision_detections:
        best = None
        for det in vision_detections:
            mapped = VISION_CLASS_TO_ISSUE.get(det.get("type", "").lower())
            if mapped and (best is None or det.get("confidence", 0) > best[0]):
                best = (det.get("confidence", 0.0), mapped)
        if best:
            issue_type, confidence, source = best[1], best[0], "vision"
            if issue_type not in ISSUE_ALIASES:
                issue_type = None
                confidence = 0.0
                source = ""

    # 2. Voice transcript
    if issue_type is None and voice_transcript:
        detected = text_classify("", voice_transcript)
        if detected:
            issue_type = detected
            confidence = 0.72
            source = "voice"

    # 3. Text
    if issue_type is None:
        detected = text_classify(description)
        if detected:
            issue_type = detected
            # Keyword hits; confidence based on how strongly text matches
            confidence = _text_confidence(description, detected)
            source = "text"

    needs_review = False
    if issue_type is None:
        # Low confidence: issue unclear, request more evidence
        return {
            "issue_type": None,
            "confidence": 0.0,
            "source": "none",
            "needs_review": True,
        }

    # Apply confidence bands
    if confidence < MED_CONF:
        issue_type = None
        source = "low_confidence"
        needs_review = True
    elif MED_CONF <= confidence < HIGH_CONF:
        needs_review = True

    return {
        "issue_type": issue_type,
        "confidence": round(confidence, 4),
        "source": source,
        "needs_review": needs_review,
    }


def _text_confidence(description: str, issue: str) -> float:
    from ..core.constants import CLASSIFY_KEYWORDS

    lowered = description.lower()
    keywords = CLASSIFY_KEYWORDS.get(issue, [])
    hits = [kw for kw in keywords if kw in lowered]
    # Multiple keyword mentions inflate confidence, capped at 0.95
    conf = min(0.95, 0.72 + 0.1 * (len(hits) - 1)) if hits else 0.65
    return conf