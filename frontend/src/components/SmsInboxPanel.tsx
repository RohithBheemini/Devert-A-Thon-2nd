import { motion } from "framer-motion";
import { MessageSquareText, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { Spinner } from "./Badges";
import type { SmsMessage } from "../types";

export function SmsInboxPanel({ onOpenIncident }: { onOpenIncident: (id: string) => void }) {
  const [messages, setMessages] = useState<SmsMessage[] | null>(null);

  useEffect(() => {
    api
      .smsInbox()
      .then(setMessages)
      .catch(() => setMessages([]));
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-sky-600">
            <MessageSquareText className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">SMS / WhatsApp gateway</p>
            <p className="text-[11px] text-slate-400">No-app citizens · same pipeline</p>
          </div>
        </div>
        {messages && (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-600 ring-1 ring-sky-200">
            {messages.length} messages
          </span>
        )}
      </div>

      {!messages ? (
        <div className="flex flex-1 items-center justify-center py-8 text-slate-300">
          <Spinner className="h-6 w-6" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-xs text-slate-400">
          No inbound messages yet — send one to the mock gateway.
        </div>
      ) : (
        <div className="thin-scroll mt-3 flex-1 space-y-2 overflow-y-auto">
          {messages.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-100 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                  <Phone className="h-3 w-3 text-slate-400" />
                  {m.from_number}
                </span>
                <span className="text-[10px] text-slate-400">{formatDateTime(m.received_at)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-700">{m.raw_text}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                {m.parsed?.location_label && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-500">
                    📍 {m.parsed.location_label}
                  </span>
                )}
                {m.parsed?.incident_id ? (
                  <button
                    onClick={() => onOpenIncident(m.parsed!.incident_id!)}
                    className="rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-700 transition hover:bg-sky-200"
                  >
                    → {m.parsed.incident_id}
                  </button>
                ) : m.report_id ? (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-500">{m.report_id}</span>
                ) : null}
                {m.parsed?.fallback_location && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700">assumed area</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.section>
  );
}