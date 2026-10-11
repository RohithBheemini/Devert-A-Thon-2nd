import { motion } from "framer-motion";
import { Flame, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Spinner } from "./Badges";
import type { HotspotPayload } from "../types";

export function HotspotPanel() {
  const [data, setData] = useState<HotspotPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .hotspots()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600">
            <Flame className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">Live hotspots</p>
            <p className="text-[11px] text-slate-400">24h report spikes vs cell baseline</p>
          </div>
        </div>
        {data && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600 ring-1 ring-red-200">{data.hotspot_count} active</span>}
      </div>

      {loading && !data ? (
        <div className="flex flex-1 items-center justify-center py-8 text-slate-300">
          <Spinner className="h-6 w-6" />
        </div>
      ) : data && data.hotspots.length > 0 ? (
        <>
          <div className="thin-scroll mt-3 flex-1 space-y-2 overflow-y-auto">
            {data.hotspots.map((h) => (
              <motion.div
                key={h.cell}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-xl border border-red-100 bg-red-50/40 p-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Radio className="h-3 w-3 text-red-500" />
                    {h.area}
                  </span>
                  <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {h.spike_ratio}× baseline
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                  <span>{h.reports_recent} in 24h</span>
                  <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-200">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${h.intensity * 100}%` }}
                      className="h-full rounded-full bg-red-500"
                    />
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Object.entries(h.issue_mix).map(([issue, n]) => (
                    <span key={issue} className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      {n}× {issue}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-red-400" /> Red rings on the map = emerging clusters, before an
            incident is even filed
          </p>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center py-8 text-xs text-slate-400">
          No sustained report spikes in the window.
        </div>
      )}
    </motion.section>
  );
}