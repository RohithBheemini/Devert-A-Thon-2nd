import { motion } from "framer-motion";
import { ArrowRight, Camera, Phone, PhoneIncoming, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatDateTime, formatRelative } from "../lib/format";
import { Spinner } from "./Badges";
import type { PhoneCall } from "../types";

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  IN_PROGRESS: "bg-sky-100 text-sky-700 ring-sky-200",
  RINGING: "bg-amber-100 text-amber-700 ring-amber-200",
  FAILED: "bg-red-100 text-red-700 ring-red-200",
};

export function CallsPanel() {
  const [calls, setCalls] = useState<PhoneCall[] | null>(null);

  useEffect(() => {
    api
      .calls()
      .then(setCalls)
      .catch(() => setCalls([]));
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-600">
            <PhoneIncoming className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">Recent call cases</p>
            <p className="text-[11px] text-slate-400">Exotel helpline · keyed by call ID</p>
          </div>
        </div>
        {calls && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-600 ring-1 ring-violet-200">
            {calls.length} calls
          </span>
        )}
      </div>

      {!calls ? (
        <div className="flex flex-1 items-center justify-center py-8 text-slate-300">
          <Spinner className="h-6 w-6" />
        </div>
      ) : calls.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-center text-xs text-slate-400">
          No calls yet — dial the helpline (see the Contact page) and a case appears here by its call ID.
        </div>
      ) : (
        <div className="thin-scroll mt-3 flex-1 space-y-2 overflow-y-auto">
          {calls.map((c) => (
            <div key={c.call_id} className="rounded-xl border border-slate-100 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-slate-800">#{c.call_id}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${STATUS_STYLE[c.status] ?? STATUS_STYLE.IN_PROGRESS}`}>
                  {c.status}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {c.from_number}
                </span>
                <span className="flex items-center gap-1">
                  <Radio className="h-3 w-3" /> {c.area ?? "—"}
                </span>
                <span>{c.duration_seconds ? `${c.duration_seconds}s` : "—"}</span>
                <span title={formatDateTime(c.started_at)}>{formatRelative(c.started_at)}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-600">
                {c.transcript ?? "Transcript pending at the carrier…"}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                {c.report_id && (
                  <Link
                    to={`/track/${c.report_id}`}
                    className="inline-flex items-center gap-1 rounded bg-brand-100 px-1.5 py-0.5 font-semibold text-brand-700 transition hover:bg-brand-200"
                  >
                    case → {c.report_id} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
                {c.incident_id && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-500">{c.incident_id}</span>
                )}
                {c.photo_proof_requested && (
                  <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-700">
                    <Camera className="h-3 w-3" /> photo proof requested
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.section>
  );
}