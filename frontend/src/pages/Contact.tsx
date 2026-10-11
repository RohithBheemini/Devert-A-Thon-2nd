import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Headphones,
  Loader2,
  MessageSquareText,
  Phone,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PriorityBadge } from "../components/Badges";
import { api } from "../lib/api";
import type { CallSimulateResult } from "../types";

export default function Contact() {
  const [helpline, setHelpline] = useState<string | null>(null);
  const [fromNumber, setFromNumber] = useState("+91-98450-30003");
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<CallSimulateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .demoStatus()
      .then((s) => setHelpline(s.settings.contact_number ?? "+9190000 00000"))
      .catch(() => setHelpline("+9190000 00000"));
  }, []);

  const simulate = async () => {
    setSimulating(true);
    setError(null);
    try {
      setResult(await api.simulateCall(fromNumber.trim()));
    } catch (e: any) {
      setError(e.message ?? "Call simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">No app? No problem.</p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Call the civic helpline
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
          Old-school, dead-simple: dial the number, tell us what's wrong, hang up. We transcribe the call, register your
          case, and text you a tracking link — upload a photo there to jump the priority queue.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-8 grid gap-4 md:grid-cols-3"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Phone className="h-4 w-4" />
          </span>
          <p className="mt-3 text-sm font-bold text-slate-800">1 · Call the number</p>
          <p className="mt-1 text-xs text-slate-500">An agent (human or AI) listens in. Powered by the Exotel carrier.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600">
            <Headphones className="h-4 w-4" />
          </span>
          <p className="mt-3 text-sm font-bold text-slate-800">2 · We transcribe it</p>
          <p className="mt-1 text-xs text-slate-500">
            The conversation becomes a structured report — merged, prioritized, routed like any other.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <Camera className="h-4 w-4" />
          </span>
          <p className="mt-3 text-sm font-bold text-slate-800">3 · Photo proof = priority</p>
          <p className="mt-1 text-xs text-slate-500">
            We text you the transcript + link. Prove it with a photo and the case is treated as higher priority.
          </p>
        </div>
      </motion.div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {/* Helpline card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Municipal helpline · Exotel</p>
          <button
            onClick={() => helpline && navigator.clipboard?.writeText(helpline)}
            className="font-display mt-3 flex items-center justify-center gap-3 rounded-2xl border border-brand-300 bg-white px-6 py-5 text-2xl font-bold tracking-tight text-slate-900 shadow-sm transition hover:border-brand-400 sm:text-3xl"
            title="Copy number"
          >
            <PhoneCall className="h-6 w-6 text-brand-600" />
            {helpline ?? "+9190000 00000"}
          </button>
          <p className="mt-3 text-center text-xs text-slate-500">Tap the number to copy · Mon–Sat, 7am–9pm (demo)</p>
          <div className="mt-4 space-y-1.5">
            {[
              "Spoken report is transcribed into the system",
              "You get an SMS with the call notes & a tracking link",
              "Skip tech — this works on any phone",
            ].map((t) => (
              <p key={t} className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> {t}
              </p>
            ))}
          </div>
        </motion.div>

        {/* Simulator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <p className="text-sm font-bold text-slate-800">Simulate a call (Exotel sandbox)</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">Runs the real inbound → transcript → hangup → SMS flow against this demo.</p>
          <input
            value={fromNumber}
            onChange={(e) => setFromNumber(e.target.value)}
            placeholder="Your number, e.g. +91-98450-30003"
            className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
          <button
            onClick={simulate}
            disabled={simulating}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {simulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
            {simulating ? "Calling…" : "Simulate the call"}
          </button>
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

          {result && (
            <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-brand-700">{result.call_id}</span>
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> {result.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                From {result.from_number} · {result.duration_seconds}s · {result.area ?? "—"} →{" "}
                {result.issue_label ?? "—"} ({result.priority_score}/{result.priority_level})
              </p>
              <div className="flex items-center gap-1.5">
                <PriorityBadge score={result.priority_score ?? 0} level={result.priority_level ?? "LOW"} />
                {result.report_id && (
                  <Link
                    to={result.tracking_path ?? `/track/${result.report_id}`}
                    className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-brand-700"
                  >
                    Open case <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              <details className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                <summary className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                  <MessageSquareText className="h-3.5 w-3.5" /> Transcript & follow-up SMS
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">{result.transcript}</p>
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">SMS sent to caller</p>
                  <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">{result.sms_followup_text}</p>
                </div>
              </details>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}