import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  Compass,
  ImageUp,
  Loader2,
  MapPin,
  MessageSquareWarning,
  Scale,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapContainer, Marker, TileLayer, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Spinner } from "../components/Badges";
import { createIncidentIcon } from "../components/gis/MapIcons";
import { api } from "../lib/api";
import { formatDateTime, priorityBg, priorityColor } from "../lib/format";
import type { PhotoProofResult, TrackerInfo } from "../types";

export default function Tracker() {
  const { reportId } = useParams<{ reportId: string }>();
  const [tracker, setTracker] = useState<TrackerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appealText, setAppealText] = useState("");
  const [appealing, setAppealing] = useState(false);
  const [appealDone, setAppealDone] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoResult, setPhotoResult] = useState<PhotoProofResult | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!reportId) return;
    let alive = true;
    api
      .tracker(reportId)
      .then((t) => alive && setTracker(t))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reportId]);

  const submitAppeal = async () => {
    if (!tracker?.incident_id || appealText.trim().length < 5 || appealing) return;
    setAppealing(true);
    try {
      await api.appeal(tracker.incident_id, appealText.trim());
      setAppealDone(true);
      const fresh = await api.tracker(reportId!);
      setTracker(fresh);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAppealing(false);
    }
  };

  const submitPhoto = async () => {
    if (!reportId || !photoFile) return;
    setError(null);
    setPhotoResult(null);
    try {
      const res = await api.uploadPhotoProof(reportId, photoFile);
      setPhotoResult(res);
      const fresh = await api.tracker(reportId!);
      setTracker(fresh);
    } catch (e: any) {
      setError(e.message ?? "Photo upload failed");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-24 text-slate-400">
        <Spinner className="h-8 w-8 text-brand-600" />
        <p className="text-sm font-medium">Looking up report #{reportId} in municipal index…</p>
      </div>
    );
  }

  if (error || !tracker) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="font-display text-2xl font-bold text-slate-900">Report Record Not Found</p>
        <p className="mt-2 text-sm text-slate-500">
          {error ?? "The requested reference ID does not exist or has been archived."}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> File a New Civic Report
        </Link>
      </div>
    );
  }

  if (!tracker.found) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="font-display text-2xl font-bold text-slate-900">Reference Registered</p>
        <p className="mt-2 text-sm text-slate-500">{tracker.message}</p>
        <p className="mt-2 font-mono text-sm font-semibold text-slate-700">{tracker.report_id}</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-600">
          <ArrowLeft className="h-4 w-4" /> Return to Reporting
        </Link>
      </div>
    );
  }

  const fc = tracker.forecast;
  const lat = tracker.latitude ?? 17.4948;
  const lng = tracker.longitude ?? 78.3996;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-600 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Reporting Portal
        </Link>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">
                <Sparkles className="h-3 w-3" /> Public Incident Tracking
              </span>
              <h1 className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {tracker.issue_label ?? "Civic Incident"}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-bold text-slate-700">{tracker.tracking_ref}</span>
                <span className="text-slate-300">·</span>
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                <span>{tracker.location_label ?? "Hyderabad"}</span>
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold ring-1 ${priorityBg(
                  tracker.priority_level ?? "LOW",
                )}`}
              >
                Priority {tracker.priority_score ?? "—"} · {tracker.priority_level}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {tracker.reports_merged_into_incident ?? 1} citizen report
                {(tracker.reports_merged_into_incident ?? 1) > 1 ? "s" : ""} fused
              </span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Status" value={(tracker.status ?? "OPEN").replace("_", " ")} />
            <Stat
              label="Resolution SLA"
              value={fc ? `${fc.predicted_hours}h` : "—"}
              sub={fc?.predicted_resolve_at ? `target ${formatDateTime(fc.predicted_resolve_at)}` : ""}
            />
            <Stat label="Assigned Department" value={tracker.department_label ?? "—"} />
            <Stat
              label="Consolidated Evidence"
              value={String(tracker.reports_merged_into_incident ?? 0)}
              sub="cross-verified"
            />
          </div>

          {/* SMS updates alert */}
          {tracker.sms_updates_enabled && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              <MessageSquareWarning className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>SMS notifications active — you will receive a text when the municipal crew arrives and finishes.</span>
            </div>
          )}

          {/* Interactive GIS Site Map */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Compass className="h-4 w-4 text-brand-600" />
                <span>Geocoded Resolution Site</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {lat.toFixed(5)}°N, {lng.toFixed(5)}°E
              </span>
            </div>

            <div className="h-56 w-full relative">
              <MapContainer
                center={[lat, lng]}
                zoom={15}
                scrollWheelZoom={false}
                className="h-full w-full"
                style={{ background: "#f8fafc" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  maxZoom={19}
                />
                <Circle
                  center={[lat, lng]}
                  radius={180}
                  pathOptions={{
                    color: priorityColor(tracker.priority_level ?? "LOW"),
                    fillColor: priorityColor(tracker.priority_level ?? "LOW"),
                    fillOpacity: 0.15,
                    weight: 1.5,
                  }}
                />
                <Marker
                  position={[lat, lng]}
                  icon={createIncidentIcon({
                    issueType: tracker.issue_type ?? "unknown",
                    priorityLevel: tracker.priority_level ?? "LOW",
                    reportCount: tracker.reports_merged_into_incident ?? 1,
                  })}
                />
              </MapContainer>
            </div>
          </div>

          {/* Action Plan */}
          {(tracker.action_plan?.length ?? 0) > 0 && (
            <div className="mt-6 rounded-2xl border border-slate-200 p-5 bg-slate-50/50">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Building2 className="h-4 w-4 text-brand-600" /> Department Operational Action Plan
              </p>
              <ul className="mt-3 space-y-2">
                {tracker.action_plan!.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resolution Timeline */}
          <div className="mt-6 rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-brand-600" /> Resolution Milestones
            </p>
            <div className="space-y-3">
              {tracker.status_history?.map((h, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                      i === 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-bold text-slate-800">{h.status.replace("_", " ")}</span>
                  <span className="text-slate-400">
                    · by {h.by ?? "municipal engine"} · {formatDateTime(h.at)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Photo Proof Upload */}
          <div className="mt-6 rounded-2xl border border-slate-200 p-5 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                <Camera className="h-4 w-4 text-brand-600" /> Upload Follow-up Photo Proof
              </p>
              <span className="text-[11px] text-slate-400">Vision model re-evaluates severity</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              If the condition worsened (e.g. hole widened, water flooded higher), upload a fresh photo to escalate priority.
            </p>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 cursor-pointer"
              >
                <ImageUp className="h-3.5 w-3.5" /> {photoFile ? photoFile.name : "Select Follow-up Photo"}
              </button>
              <button
                type="button"
                onClick={submitPhoto}
                disabled={!photoFile}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5" /> Upload & Re-rate Priority
              </button>
            </div>
            {photoResult && (
              <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 ring-1 ring-emerald-200">
                <p className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Follow-up photo analyzed!
                </p>
                <p className="mt-1 text-[11px]">
                  Priority updated: {photoResult.priority_before ?? "—"} →{" "}
                  <strong>{photoResult.priority_after ?? "—"}</strong> ({photoResult.priority_level})
                </p>
              </div>
            )}
          </div>

          {/* Public Citizen Appeal */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            {tracker.appeal_open ? (
              <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <Scale className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                <div>
                  <p className="text-xs font-bold text-violet-900">Appeal Registered for Human Review</p>
                  <p className="mt-0.5 text-xs text-violet-700">
                    Your objection is queued with municipal supervisors. An officer will re-verify the categorization.
                  </p>
                </div>
              </div>
            ) : (
              <details className="group rounded-2xl border border-slate-200 p-4">
                <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                  <MessageSquareWarning className="h-4 w-4 text-violet-600" />
                  Disagree with category or handling? File an Official Appeal
                  <span className="ml-auto text-[11px] font-semibold text-violet-600 group-open:hidden">
                    open form
                  </span>
                </summary>
                <div className="mt-3 space-y-2.5">
                  <textarea
                    value={appealText}
                    onChange={(e) => setAppealText(e.target.value)}
                    rows={3}
                    placeholder="Specify why you disagree (e.g. water leakage is from underground sewage, road is completely blocked)…"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-brand-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={submitAppeal}
                    disabled={appealing || appealText.trim().length < 5}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50 cursor-pointer"
                  >
                    {appealing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {appealDone ? "Appeal Registered" : "Submit Appeal"}
                  </button>
                  {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
                </div>
              </details>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}