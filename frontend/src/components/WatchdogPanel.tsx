import { motion } from "framer-motion";
import { AlertTriangle, Bot, Eye, TimerReset } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { EscalationBadge, Spinner } from "./Badges";
import type { WatchdogRunResult, WatchdogStatus } from "../types";

const ORDER = ["ON_TRACK", "DUE_SOON", "OVERDUE", "STALLED"];
const STATE_STYLE: Record<string, string> = {
  ON_TRACK: "bg-emerald-500",
  DUE_SOON: "bg-amber-500",
  OVERDUE: "bg-orange-500",
  STALLED: "bg-red-600",
};

export function WatchdogPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [asOf, setAsOf] = useState(0);
  const [status, setStatus] = useState<WatchdogStatus | null>(null);
  const [runResult, setRunResult] = useState<WatchdogRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .watchdogStatus(asOf)
      .then((s) => alive && setStatus(s))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [asOf]);

  const loadStatus = (hours: number) => setAsOf(hours);

  const run = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const real = await api.runWatchdog(false);
      setRunResult(real);
      await loadStatus(asOf);
    } finally {
      setRunning(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">Resolution watchdog</p>
            <p className="text-[11px] text-slate-400">Forecast vs reality · closed-loop escalation</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[
            { h: 0, l: "Now" },
            { h: 24, l: "+24h" },
            { h: 60, l: "+60h" },
          ].map((opt) => (
            <button
              key={opt.h}
              onClick={() => loadStatus(opt.h)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                asOf === opt.h ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {loading && !status ? (
        <div className="flex flex-1 items-center justify-center py-8 text-slate-300">
          <Spinner className="h-6 w-6" />
        </div>
      ) : status ? (
        <>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {ORDER.map((s) => (
              <div key={s} className="rounded-xl bg-slate-50 p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${STATE_STYLE[s]}`} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{s.replace("_", " ")}</span>
                </div>
                <p className="mt-1 font-display text-xl font-bold tabular-nums text-slate-900">{status.state_counts[s] ?? 0}</p>
              </div>
            ))}
          </div>

          {asOf > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Eye className="h-3 w-3" /> Preview: states as projected {asOf}h from now (no emails sent)
            </p>
          )}

          <div className="thin-scroll mt-3 flex-1 space-y-2 overflow-y-auto">
            {status.incidents
              .filter((i) => i.state !== "ON_TRACK")
              .concat(status.incidents.filter((i) => i.state === "ON_TRACK"))
              .map((i) => (
                <button
                  key={i.incident_id}
                  onClick={() => onOpen(i.incident_id)}
                  className="w-full rounded-xl border border-slate-100 p-2.5 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-700">{i.incident_id}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase text-slate-400">{i.priority_level}</span>
                      <EscalationBadge state={i.state} />
                    </div>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{i.issue_label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {i.predicted_resolve_at && <>expected {formatDateTime(i.predicted_resolve_at)}</>}
                  </p>
                </button>
              ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[11px] text-slate-400">
              {runResult ? (
                <>
                  Last sweep: <b>{runResult.scanned}</b> checked ·{" "}
                  <b>{runResult.emails_dispatched}</b> escalation email{runResult.emails_dispatched !== 1 ? "s" : ""}
                </>
              ) : (
                "Watchdog auto-sweeps stalled work"
              )}
            </span>
            <button
              onClick={run}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {running ? <Spinner className="h-3.5 w-3.5" /> : <TimerReset className="h-3.5 w-3.5" />}
              Run sweep
            </button>
          </div>

          {runResult && runResult.escalated.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-red-600">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              Escalated {runResult.escalated.map((e) => e.incident_id).join(", ")} to level {Math.max(...runResult.escalated.map((e) => e.level))}.
            </p>
          )}
        </>
      ) : null}
    </motion.section>
  );
}