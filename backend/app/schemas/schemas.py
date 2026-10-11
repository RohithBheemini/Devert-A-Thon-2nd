from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict


# ---------- Report ----------
class ReportCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=2000)
    latitude: float
    longitude: float
    accuracy_meters: float | None = None
    location_label: str | None = None
    voice_transcript: str | None = None


class ReportEvidence(BaseModel):
    text: dict
    image: dict | None = None
    voice: dict
    location: dict


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    description: str
    issue_type: str | None
    classification_confidence: float | None
    classification_source: str | None
    needs_review: bool
    latitude: float
    longitude: float
    accuracy_meters: float | None
    location_label: str | None
    timestamp: datetime
    image_filename: str | None
    voice_transcript: str | None
    vision_confidence: float | None
    vision_detections: list | None
    vision_failed: bool
    vision_severity: float | None
    mobile_number: str | None = None
    incident_id: str | None = None


# ---------- Incident ----------
class IncidentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    issue_type: str
    issue_label: str
    latitude: float
    longitude: float
    location_label: str | None
    confidence: float
    confidence_label: str
    priority_score: int
    priority_level: str
    department: str
    department_label: str
    status: str
    notification_status: str
    needs_review: bool
    report_count: int = 0
    image_count: int = 0
    created_at: datetime
    updated_at: datetime
    summary: str
    predicted_resolve_at: datetime | None = None
    escalation_level: int = 0
    escalated_at: datetime | None = None
    appeal_open: bool = False
    resolution_state: str | None = None


class IncidentDetail(IncidentSummary):
    description: str
    priority_breakdown: dict | None
    action_plan: list
    evidence_summary: list | None
    response_to: list
    status_history: list


class IncidentReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report: ReportOut
    relatedness_score: float
    relationship_type: str
    band: str


class IncidentDetailFull(IncidentDetail):
    reports: list[IncidentReportOut]
    notifications: list["NotificationOut"]


# ---------- Notification ----------
class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incident_id: str
    notification_type: str
    recipient: str
    status: str
    sent_at: datetime | None
    message_id: str | None
    error: str | None


# ---------- Dashboard ----------
class DashboardStats(BaseModel):
    total_reports: int
    total_incidents: int
    reports_consolidated: int
    high_priority: int
    active_incidents: int
    emails_sent: int
    acknowledged: int
    in_progress: int
    resolved: int
    redundancy_reduction: float
    actionable_conversion_rate: float


# ---------- Action ----------
class StatusUpdate(BaseModel):
    status: str


class EmailResult(BaseModel):
    incident_id: str
    notification_status: str
    sent: bool
    message: str
    recipient: str | None = None
    already_sent: bool = False


# ---------- Feature A/E ----------
class AppealBody(BaseModel):
    reason: str = Field(..., min_length=5, max_length=1000)
    citizen_name: str | None = None
    contact: str | None = None
    from_number: str | None = None


# ---------- Feature G ----------
class SmsInbound(BaseModel):
    from_number: str = Field(..., min_length=3)
    text: str = Field(..., min_length=1, max_length=1600)


class SmsMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    from_number: str
    raw_text: str
    received_at: datetime
    status: str
    report_id: str | None
    parsed: dict | None


# ---------- Voice helpline (Exotel) ----------
class CallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    call_id: str
    from_number: str
    to_number: str
    status: str = "IN_PROGRESS"
    started_at: datetime
    answered_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: int | None = None
    recording_url: str | None = None
    transcript: str | None = None
    transcript_status: str = "PENDING"
    report_id: str | None = None
    incident_id: str | None = None
    area: str | None = None
    photo_proof_requested: bool = False
    sms_followup_id: str | None = None


IncidentDetailFull.model_rebuild()