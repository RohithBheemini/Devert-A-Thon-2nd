import { motion } from "framer-motion";
import {
  Mail,
  CheckCircle2,
  Copy,
  Flag,
  ListChecks,
  MapPin,
  MessageSquareText,
  Scale,
  X,
  Users,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import type { IncidentDetail } from "../types";
import { formatDateTime, formatRelative, resolutionLabel, VALID_STATUSES } from "../lib/format";
import { AppealFlag, ConfidenceBadge, EscalationBadge, NotificationBadge, PriorityBadge, ReviewFlag, Spinner, StatusBadge } from "./Badges";

const BREAKDOWN_MAX: Record<string, number> = {
  severity: 35,
  reportRepetition: 25,
  affectedArea: 20,
  locationImportance: 10,
  age: 10,
};

const BREAKDOWN_LABEL: Record<string, string> = {
  severity: "Severity",
  reportRepetition: "Report repetition",
  affectedArea: "Affected area",
  locationImportance: "Location importance",
  age: "Age / urgency",
};

export function IncidentDetailDrawer({
  incident,
  busy,
  onClose,
  onUpdate,
  notify,
}: {
  incident: IncidentDetail | null;
  busy: boolean;
  onClose: () => void;
  onUpdate: (inc: IncidentDetail) => void;
  notify: (kind: "success" | "error" | "info", msg: string) => void;
}) {
  const [settingStatus, setSettingStatus] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const changeStatus = async (status: string) => {
    if (!incident) return;
    setSettingStatus(status);
    try {
      const res = await fetch(`/api/v1/incidents/${incident.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Update failed");
      onUpdate(await res.json());
      notify("success", `Status changed to ${status.replace("_", " ")}`);
    } catch (e: any) {
      notify("error", e.message ?? "Failed to update status");
    } finally {
      setSettingStatus(null);
    }
  };

  const sendEmail = async () => {
    if (!incident) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/v1/incidents/${incident.id}/email`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Email failed");
      const body = await res.json();
      const detail = incident ? await (await fetch(`/api/v1/incidents/${incident.id}`)).json() : null;
      if (detail) onUpdate(detail);
      notify(body.sent ? "success" : "error", body.message);
    } catch (e: any) {
      notify("error", e.message ?? "Email failed");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <AnimatedDrawer open={!!incident}>
      {incident && (
        <div className="flex h-full flex-col bg-white">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">{incident.id}</h2>
                <StatusBadge status={incident.status} />
                <ReviewFlag needsReview={incident.needs_review} />
                <EscalationBadge state={incident.resolution_state} />
                <AppealFlag open={incident.appeal_open} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {incident.issue_label} · {incident.location_label ?? `${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="thin-scroll flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {/* Priority */}
            <section className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Priority</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="font-display text-3xl font-bold tracking-tight text-slate-900">
                      {incident.priority_score}
                    </span>
                    <span className="text-lg font-semibold text-slate-500">/ 100</span>
                    <PriorityBadge score={incident.priority_score} level={incident.priority_level} />
                  </div>
                </div>
                <ConfidenceBadge confidence={incident.confidence} label={incident.confidence_label} />
              </div>
              {incident.priority_breakdown && (
                <div className="mt-4 space-y-2">
                  {Object.entries(incident.priority_breakdown).map(([key, value]) => {
                    const max = BREAKDOWN_MAX[key] ?? 20;
                    const pct = Math.min(100, Math.round((value / max) * 100));
                    return (
                      <div key={key} className="flex items-center gap-3 text-xs">
                        <span className="w-32 shrink-0 text-slate-500">{BREAKDOWN_LABEL[key] ?? key}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="h-full rounded-full bg-brand-500"
                          />
                        </div>
                        <span className="w-8 text-right tabular-nums text-slate-500">{value}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Forecast & escalation */}
            <section className={`rounded-xl border p-4 ${incident.resolution_state === "STALLED" ? "border-red-200 bg-red-50/40" : incident.resolution_state === "OVERDUE" ? "border-orange-200 bg-orange-50/30" : "border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resolution forecast</p>
                <EscalationBadge state={incident.resolution_state} />
              </div>
              {incident.predicted_resolve_at ? (
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-600">
                      Predicted resolution by{" "}
                      <span className="font-bold text-slate-800">{formatDateTime(incident.predicted_resolve_at)}</span>
                      <span className="text-slate-400"> · {formatRelative(incident.predicted_resolve_at)}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {resolutionLabel(incident.resolution_state)} · escalation level {incident.escalation_level}/3
                      {incident.escalated_at && <> · watchdog alerted {formatRelative(incident.escalated_at)}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((lvl) => (
                      <span
                        key={lvl}
                        className={`h-1.5 w-6 rounded-full ${incident.escalation_level >= lvl ? "bg-red-500" : "bg-slate-200"}`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">No prediction assigned yet.</p>
              )}
              {incident.appeal_open && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-violet-50 px-2.5 py-2 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200">
                  <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  A citizen appealed — flagged for human review (waiting on operator triage).
                </p>
              )}
            </section>

            {/* Summary */}
            <section className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">AI Summary</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{incident.summary}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Wrench className="h-4 w-4 text-slate-400" />
                  {incident.department_label}
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Users className="h-4 w-4 text-slate-400" />
                  {incident.report_count} linked report{incident.report_count > 1 ? "s" : ""} · {incident.image_count} image
                  {incident.image_count !== 1 ? "s" : ""}
                </div>
              </div>
            </section>

            {/* Action plan */}
            <section className="rounded-xl border border-slate-200 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <ListChecks className="h-3.5 w-3.5" /> Recommended action plan
              </p>
              <ul className="mt-2 space-y-1.5">
                {incident.action_plan.map((step) => (
                  <li key={step} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {step}
                  </li>
                ))}
              </ul>
            </section>

            {/* Response to */}
            <section className="rounded-xl border border-slate-200 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <MessageSquareText className="h-3.5 w-3.5" /> Why we believe this
              </p>
              <div className="mt-2 space-y-2.5">
                {incident.response_to.map((qa) => (
                  <div key={qa.question}>
                    <p className="text-xs font-semibold text-slate-500">{qa.question}</p>
                    <p className="text-sm text-slate-700">{qa.answer}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Linked reports */}
            <section className="rounded-xl border border-slate-200 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Users className="h-3.5 w-3.5" /> Consolidated reports
              </p>
              <ul className="mt-2 space-y-2">
                {incident.reports.map((link) => (
                  <li key={link.report.id} className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700">{link.report.id}</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {link.band} · {(link.relatedness_score * 100).toFixed(0)}% related
                        <span className="rounded bg-slate-200 px-1.5 text-[10px] font-semibold text-slate-600">
                          {link.report.classification_source ?? "text"}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{link.report.description}</p>
                    {link.report.image_filename && (
                      <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
                        <img
                          src={`/uploads/${link.report.image_filename}`}
                          alt="Citizen photo proof"
                          className="h-32 w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* History */}
            {incident.status_history.length > 0 && (
              <section className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">History</p>
                <ul className="mt-2 space-y-1.5">
                  {incident.status_history.map((h, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-500">
                      <Flag className="h-3.5 w-3.5 text-slate-300" />
                      <span className="font-semibold text-slate-700">{h.status.replace("_", " ")}</span>
                      <span>
                        · {h.by ?? "system"} · {formatDateTime(h.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Set status:</span>
              <div className="flex flex-wrap gap-1.5">
                {VALID_STATUSES.slice(0, 5).map((s) => (
                  <button
                    key={s}
                    disabled={busy || settingStatus === s}
                    onClick={() => changeStatus(s)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition disabled:opacity-50 ${
                      incident.status === s
                        ? "bg-brand-600 text-white ring-brand-600"
                        : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {settingStatus === s ? <Spinner className="h-3 w-3" /> : s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Mail className="h-4 w-4 text-slate-400" />
                <NotificationBadge status={incident.notification_status} />
              </div>
              <button
                onClick={sendEmail}
                disabled={busy || sendingEmail}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                {sendingEmail ? <Spinner className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                Send email now
              </button>
            </div>
            <TrackingLink incident={incident} notify={notify} />
          </div>
        </div>
      )}
    </AnimatedDrawer>
  );
}

function TrackingLink({
  incident,
  notify,
}: {
  incident: IncidentDetail;
  notify: (kind: "success" | "error" | "info", msg: string) => void;
}) {
  const reportId = incident.reports?.[0]?.report.id;
  if (!reportId) return null;
  const href = `${window.location.origin}/track/${reportId}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Citizen tracking link</p>
        <p className="truncate text-[11px] font-mono text-slate-600">{href}</p>
      </div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(href).then(
            () => notify("success", "Tracking link copied"),
            () => notify("error", "Copy failed"),
          );
        }}
        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200"
      >
        <Copy className="h-3 w-3" /> Copy
      </button>
    </div>
  );
}

function AnimatedDrawer({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <>
      <motion.div
        initial={false}
        animate={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm ${open ? "" : "hidden"}`}
      />
      <motion.aside
        initial={false}
        animate={{ x: open ? 0 : "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-hidden bg-white shadow-2xl ${open ? "" : "pointer-events-none"}`}
      >
        {children}
      </motion.aside>
    </>
  );
}