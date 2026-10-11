export interface ReportOut {
  id: string;
  description: string;
  issue_type: string | null;
  classification_confidence: number | null;
  classification_source: string | null;
  needs_review: boolean;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  location_label: string | null;
  timestamp: string;
  image_filename: string | null;
  voice_transcript: string | null;
  vision_confidence: number | null;
  vision_detections: Array<{ label: string; confidence?: number }> | null;
  vision_failed: boolean;
  vision_severity: number | null;
  incident_id: string | null;
}

export interface IncidentSummary {
  id: string;
  issue_type: string;
  issue_label: string;
  latitude: number;
  longitude: number;
  location_label: string | null;
  confidence: number;
  confidence_label: string;
  priority_score: number;
  priority_level: string;
  department: string;
  department_label: string;
  status: string;
  notification_status: string;
  needs_review: boolean;
  report_count: number;
  image_count: number;
  created_at: string;
  updated_at: string;
  summary: string;
  predicted_resolve_at: string | null;
  escalation_level: number;
  escalated_at: string | null;
  appeal_open: boolean;
  resolution_state: string | null;
}

export interface IncidentReportOut {
  report: ReportOut;
  relatedness_score: number;
  relationship_type: string;
  band: string;
}

export interface NotificationOut {
  id: string;
  incident_id: string;
  notification_type: string;
  recipient: string;
  status: string;
  sent_at: string | null;
  message_id: string | null;
  error: string | null;
}

export interface IncidentDetail extends IncidentSummary {
  description: string;
  priority_breakdown: Record<string, number> | null;
  action_plan: string[];
  evidence_summary: string[] | null;
  response_to: { question: string; answer: string }[];
  status_history: { status: string; at: string; by?: string }[];
  reports: IncidentReportOut[];
  notifications: NotificationOut[];
}

export interface DashboardStats {
  total_reports: number;
  total_incidents: number;
  reports_consolidated: number;
  high_priority: number;
  active_incidents: number;
  emails_sent: number;
  acknowledged: number;
  in_progress: number;
  resolved: number;
  redundancy_reduction: number;
  actionable_conversion_rate: number;
}

export interface EmailResult {
  incident_id: string;
  notification_status: string;
  sent: boolean;
  message: string;
  recipient: string | null;
  already_sent: boolean;
}

export interface ForecastInfo {
  issue_label: string;
  base_hours: number;
  priority_multiplier: number;
  workload_penalty: number;
  predicted_hours: number;
  predicted_resolve_at: string | null;
  state: string;
  overdue_hours: number;
}

export interface WatchdogIncident {
  incident_id: string;
  issue_label: string;
  priority_level: string;
  escalation_level: number;
  escalation_label: string;
  state: string;
  predicted_resolve_at: string | null;
  escalated_at: string | null;
  appeal_open: boolean;
}

export interface WatchdogStatus {
  as_of_hours: number;
  state_counts: Record<string, number>;
  incidents: WatchdogIncident[];
}

export interface WatchdogRunResult {
  scanned: number;
  due_soon: number;
  overdue: number;
  stalled: number;
  escalated: Array<{ incident_id: string; level: number; label: string; overdue_hours: number }>;
  emails_dispatched: number;
  escalation_counts: Record<string, number>;
  preview?: boolean;
}

export interface Hotspot {
  cell: string;
  area: string;
  latitude: number;
  longitude: number;
  reports_window: number;
  reports_recent: number;
  baseline_daily: number;
  spike_ratio: number;
  intensity: number;
  issue_mix: Record<string, number>;
  report_ids: string[];
}

export interface HotspotPayload {
  generated_at: string;
  window_hours: number;
  recent_hours: number;
  hotspots: Hotspot[];
  hotspot_count: number;
  series_24h: Array<{ hour: string; reports: number }>;
  incident_cells?: Array<{ incident_id: string; issue_label: string; cells: string[] }>;
}

export interface SmsMessage {
  id: string;
  from_number: string;
  raw_text: string;
  received_at: string;
  status: string;
  report_id: string | null;
  parsed: {
    latitude?: number;
    longitude?: number;
    location_label?: string;
    excerpt?: string;
    incident_id?: string | null;
    fallback_location?: boolean;
  } | null;
}

export interface PhoneCall {
  call_id: string;
  from_number: string;
  to_number: string;
  status: string;
  started_at: string;
  answered_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  recording_url?: string | null;
  transcript?: string | null;
  transcript_status: string;
  report_id?: string | null;
  incident_id?: string | null;
  area?: string | null;
  photo_proof_requested?: boolean;
  sms_followup_id?: string | null;
}

export interface CallSimulateResult extends PhoneCall {
  sms_followup_text?: string;
  issue_label?: string | null;
  priority_score?: number | null;
  priority_level?: string | null;
  tracking_ref?: string | null;
  tracking_path?: string | null;
}

export interface PhotoProofResult {
  report_id: string;
  image_filename: string;
  vision_available: boolean;
  severity_hint?: number | null;
  incident_id?: string | null;
  priority_before?: number | null;
  priority_after?: number | null;
  priority_level?: string | null;
}

export interface TrackerInfo {
  report_id: string;
  found: boolean;
  message?: string;
  incident_id?: string;
  issue_label?: string;
  issue_type?: string;
  status?: string;
  priority_level?: string;
  priority_score?: number;
  department_label?: string;
  reports_merged_into_incident?: number;
  evidence_summary?: string[];
  action_plan?: string[];
  location_label?: string | null;
  latitude?: number;
  longitude?: number;
  forecast?: ForecastInfo;
  appeal_open?: boolean;
  needs_review?: boolean;
  sms_updates_enabled?: boolean;
  status_history?: { status: string; at: string; by?: string }[];
  tracking_ref?: string;
}

export interface DemoStatus {
  reports: number;
  incidents: IncidentSummary[];
  settings: {
    vision_model_enabled: boolean;
    embeddings_enabled: boolean;
    email_mock: boolean;
    demo_mode: boolean;
    contact_number?: string;
  };
}

export const ISSUE_LABELS: Record<string, string> = {
  pothole: "Pothole / Road Defect",
  garbage_overflow: "Garbage Overflow",
  water_leakage: "Water Leakage / Sewage",
  broken_streetlight: "Broken Streetlight",
};