import { motion } from "framer-motion";
import { priorityBg } from "../lib/format";

export function PriorityBadge({ score, level }: { score: number; level: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${priorityBg(level)}`}
    >
      <span className="tabular-nums">{score}</span>
      <span className="uppercase tracking-wide">{level}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { dot: string; cls: string }> = {
    RESOLVED: { dot: "bg-emerald-500", cls: "text-emerald-700 bg-emerald-50 ring-emerald-200" },
    IN_PROGRESS: { dot: "bg-blue-500", cls: "text-blue-700 bg-blue-50 ring-blue-200" },
    ACKNOWLEDGED: { dot: "bg-violet-500", cls: "text-violet-700 bg-violet-50 ring-violet-200" },
    EMAIL_SENT: { dot: "bg-purple-500", cls: "text-purple-700 bg-purple-50 ring-purple-200" },
    PRIORITIZED: { dot: "bg-amber-500", cls: "text-amber-700 bg-amber-50 ring-amber-200" },
    ROUTED: { dot: "bg-sky-500", cls: "text-sky-700 bg-sky-50 ring-sky-200" },
  };
  const style = map[status] ?? { dot: "bg-slate-400", cls: "text-slate-600 bg-slate-50 ring-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {status.replace("_", " ")}
    </span>
  );
}

export function ConfidenceBadge({ confidence, label }: { confidence: number; label: string }) {
  const cls =
    label === "HIGH"
      ? "text-emerald-700 bg-emerald-50 ring-emerald-200"
      : label === "MEDIUM"
        ? "text-amber-700 bg-amber-50 ring-amber-200"
        : "text-red-700 bg-red-50 ring-red-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>
      {label} · {(confidence * 100).toFixed(0)}%
    </span>
  );
}

export function NotificationBadge({ status }: { status: string }) {
  if (status === "EMAIL_SENT")
    return (
      <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 ring-1 ring-purple-200">
        ✉ Sent
      </span>
    );
  if (status === "EMAIL_FAILED")
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
        Failed
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
      Not sent
    </span>
  );
}

export function ReviewFlag({ needsReview }: { needsReview: boolean }) {
  if (!needsReview) return null;
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white"
    >
      ⚠ Review
    </motion.span>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const ESCALATION_META: Record<string, { label: string; cls: string; pulse?: boolean }> = {
  DUE_SOON: { label: "Due soon", cls: "bg-amber-50 text-amber-700 ring-amber-300" },
  OVERDUE: { label: "Overdue", cls: "bg-orange-100 text-orange-800 ring-orange-300", pulse: true },
  STALLED: { label: "Stalled", cls: "bg-red-600 text-white ring-red-600", pulse: true },
};

export function EscalationBadge({ state }: { state: string | null }) {
  if (!state) return null;
  const meta = ESCALATION_META[state];
  if (!meta) return <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">On track</span>;
  return (
    <motion.span
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${meta.cls}`}
    >
      {meta.pulse && <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" /></span>}
      {meta.label}
    </motion.span>
  );
}

export function AppealFlag({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <motion.span
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-violet-600"
    >
      ⚖ Appeal
    </motion.span>
  );
}