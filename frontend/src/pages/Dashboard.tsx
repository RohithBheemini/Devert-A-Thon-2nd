import { motion } from "framer-motion";
import {
  Activity,
  AlertOctagon,
  Building2,
  Database,
  Eye,
  Filter,
  LayoutGrid,
  Mail,
  MapPin,
  Radio,
  RefreshCw,
  Scale,
  Search,
  Table as TableIcon,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatedNumber } from "../components/AnimatedNumber";
import {
  EscalationBadge,
  PriorityBadge,
  ReviewFlag,
  Spinner,
  StatusBadge,
} from "../components/Badges";
import { CallsPanel } from "../components/CallsPanel";
import { HotspotPanel } from "../components/HotspotPanel";
import { IncidentDetailDrawer } from "../components/IncidentDetailDrawer";
import { IncidentMap } from "../components/MapView";
import { SmsInboxPanel } from "../components/SmsInboxPanel";
import { ToastStack, type ToastState } from "../components/Toast";
import { WatchdogPanel } from "../components/WatchdogPanel";
import { api } from "../lib/api";
import { formatRelative } from "../lib/format";
import type { DashboardStats, HotspotPayload, IncidentDetail, IncidentSummary } from "../types";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [hotspots, setHotspots] = useState<HotspotPayload["hotspots"]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Filters & State
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"split" | "table" | "analytics">("split");

  // Selection & Inspector
  const [selected, setSelected] = useState<IncidentDetail | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((kind: ToastState["kind"], message: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, incs, hot] = await Promise.all([
        api.dashboardStats(),
        api.dashboardIncidents(),
        api.hotspots(),
      ]);
      setStats(s);
      setIncidents(incs);
      setHotspots(hot.hotspots);
    } catch (e: any) {
      notify("error", e.message ?? "Could not reach the backend");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const seedDemo = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/v1/demo/seed", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Seed failed");
      await load();
      setSelected(null);
      setFocusId(null);
      notify("success", "Demo dataset refreshed & reloaded");
    } catch (e: any) {
      notify("error", e.message ?? "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const openDetail = async (id: string) => {
    setFocusId(id);
    try {
      const detail = await api.getIncident(id);
      setSelected(detail);
    } catch (e: any) {
      notify("error", e.message ?? "Failed to load incident details");
    }
  };

  const handleFocusOnMap = (id: string) => {
    setFocusId(id);
  };

  const onUpdated = (detail: IncidentDetail) => {
    setSelected(detail);
    load();
  };

  const filtered = useMemo(() => {
    return incidents
      .filter((i) => (statusFilter === "ALL" ? true : i.status === statusFilter))
      .filter((i) => (priorityFilter === "ALL" ? true : i.priority_level === priorityFilter))
      .filter((i) => (categoryFilter === "ALL" ? true : i.issue_type === categoryFilter))
      .filter(
        (i) =>
          !query.trim() ||
          i.id.toLowerCase().includes(query.toLowerCase()) ||
          i.issue_label.toLowerCase().includes(query.toLowerCase()) ||
          i.department_label.toLowerCase().includes(query.toLowerCase()) ||
          (i.location_label ?? "").toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) => b.priority_score - a.priority_score);
  }, [incidents, query, statusFilter, priorityFilter, categoryFilter]);

  const statCards = useMemo(
    () => [
      {
        label: "Total incidents",
        value: stats?.total_incidents ?? 0,
        note: `${stats?.total_reports ?? 0} raw reports`,
        icon: Activity,
        tint: "text-brand-600 bg-brand-50",
      },
      {
        label: "Active incidents",
        value: stats?.active_incidents ?? 0,
        note: "open / in progress",
        icon: Users,
        tint: "text-sky-600 bg-sky-50",
      },
      {
        label: "Critical / High",
        value: stats?.high_priority ?? 0,
        note: "urgent attention",
        icon: AlertOctagon,
        tint: "text-red-600 bg-red-50",
      },
      {
        label: "Redundancy cut",
        value: stats?.redundancy_reduction ?? 0,
        suffix: "%",
        note: "reports consolidated",
        icon: Scale,
        tint: "text-emerald-600 bg-emerald-50",
      },
      {
        label: "Actionable rate",
        value: stats?.actionable_conversion_rate ?? 0,
        suffix: "%",
        note: "routed & planned",
        icon: TrendingUp,
        tint: "text-violet-600 bg-violet-50",
      },
      {
        label: "Dispatched alerts",
        value: stats?.emails_sent ?? 0,
        note: "department notices",
        icon: Mail,
        tint: "text-amber-600 bg-amber-50",
      },
    ],
    [stats],
  );

  return (
    <div className="mx-auto max-w-[1540px] px-4 py-6 sm:px-6">
      <ToastStack toasts={toasts} dismiss={(id: number) => setToasts((t) => t.filter((x) => x.id !== id))} />

      {/* Header with City Operational Pulse */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-800 text-white shadow-md shadow-brand-500/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Municipal Operations Hub
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Hyderabad Live Feed
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              AI Incident Intake, Spatial De-duplication, Multi-Source Fusion & Autonomous Routing
            </p>
          </div>
        </div>

        {/* Action Controls & View Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Switcher */}
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold text-slate-600">
            <button
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                viewMode === "split"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>GIS Workspace</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Data Grid</span>
            </button>
            <button
              onClick={() => setViewMode("analytics")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                viewMode === "analytics"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              <span>Oversight & Radar</span>
            </button>
          </div>

          <button
            onClick={seedDemo}
            disabled={seeding}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            title="Reload reproducible Hyderabad test dataset"
          >
            {seeding ? <Spinner className="h-3.5 w-3.5" /> : <Database className="h-3.5 w-3.5 text-brand-600" />}
            <span>Reset Demo Data</span>
          </button>

          <button
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-20 flex flex-col items-center gap-3 text-slate-400">
          <Spinner className="h-10 w-10 text-brand-600" />
          <p className="text-sm font-medium">Synchronizing city incidents & satellite map data…</p>
        </div>
      ) : (
        <>
          {/* Top KPI Ribbon */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {statCards.map((c, idx) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-grid h-8 w-8 place-items-center rounded-xl ${c.tint}`}>
                    <c.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">{c.note}</span>
                </div>
                <p className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-900">
                  <AnimatedNumber value={c.value} suffix={c.suffix ?? ""} />
                </p>
                <p className="text-xs font-semibold text-slate-600">{c.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Quick Category Filter Bar */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-1.5 overflow-x-auto thin-scroll">
              <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Domain:
              </span>
              {[
                { key: "ALL", label: "All Issues", count: incidents.length },
                {
                  key: "pothole",
                  label: "Road / Pothole",
                  count: incidents.filter((i) => i.issue_type === "pothole").length,
                },
                {
                  key: "garbage_overflow",
                  label: "Sanitation",
                  count: incidents.filter((i) => i.issue_type === "garbage_overflow").length,
                },
                {
                  key: "water_leakage",
                  label: "Water / Leakage",
                  count: incidents.filter((i) => i.issue_type === "water_leakage").length,
                },
                {
                  key: "broken_streetlight",
                  label: "Streetlights",
                  count: incidents.filter((i) => i.issue_type === "broken_streetlight").length,
                },
              ].map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(cat.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    categoryFilter === cat.key
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      categoryFilter === cat.key ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Status & Priority dropdowns */}
            <div className="flex items-center gap-2">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-brand-500"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-brand-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="EMAIL_SENT">Email Sent</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
              </select>

              <span className="text-xs text-slate-400 font-medium ml-1">
                Showing {filtered.length} incident{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* VIEW MODE 1: SPLIT GIS WORKSPACE */}
          {viewMode === "split" && (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
              {/* GIS Map Canvas (7 cols on lg, 8 on xl) */}
              <div className="lg:col-span-7 xl:col-span-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[680px]">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-brand-600 animate-ping" />
                    <span className="text-xs font-bold text-slate-800">
                      Hyderabad GIS Incident Canvas
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({filtered.length} active geocoded markers)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-600" /> Critical
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-orange-500" /> High
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-yellow-500" /> Medium
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Low
                    </span>
                  </div>
                </div>

                <div className="flex-1 relative">
                  <IncidentMap
                    incidents={filtered}
                    hotspots={hotspots}
                    focusId={focusId}
                    onSelect={(id) => openDetail(id)}
                    height="100%"
                  />
                </div>
              </div>

              {/* Synchronized Incident Queue (5 cols on lg, 4 on xl) */}
              <div className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col h-[680px]">
                {/* Queue Header & Search */}
                <div className="border-b border-slate-100 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-brand-600" />
                      <h2 className="text-sm font-bold text-slate-800">Prioritized Incident Queue</h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {filtered.length} items
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search ID, street, or department…"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                </div>

                {/* Scrollable Incident Cards */}
                <div className="flex-1 overflow-y-auto thin-scroll p-3 space-y-2.5">
                  {filtered.length === 0 ? (
                    <div className="flex h-48 flex-col items-center justify-center text-slate-400 text-xs">
                      <p>No incidents match the active filters.</p>
                      <button
                        onClick={() => {
                          setQuery("");
                          setStatusFilter("ALL");
                          setPriorityFilter("ALL");
                          setCategoryFilter("ALL");
                        }}
                        className="mt-2 font-semibold text-brand-600 hover:underline"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    filtered.map((inc) => {
                      const isFocused = focusId === inc.id;
                      return (
                        <div
                          key={inc.id}
                          onClick={() => {
                            handleFocusOnMap(inc.id);
                          }}
                          className={`group relative rounded-xl border p-3 cursor-pointer transition ${
                            isFocused
                              ? "border-brand-500 bg-brand-50/40 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-slate-900">
                                  {inc.id}
                                </span>
                                <ReviewFlag needsReview={inc.needs_review} />
                                <EscalationBadge state={inc.resolution_state} />
                              </div>
                              <h3 className="mt-1 text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-brand-700">
                                {inc.issue_label}
                              </h3>
                            </div>
                            <PriorityBadge score={inc.priority_score} level={inc.priority_level} />
                          </div>

                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                            <span className="truncate">{inc.location_label ?? "Hyderabad"}</span>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-700">
                                {inc.department_label}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                                <Users className="h-3 w-3 text-slate-400" />
                                {inc.report_count} {inc.report_count > 1 ? "reports" : "report"}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <StatusBadge status={inc.status} />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDetail(inc.id);
                                }}
                                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                                title="Open full incident inspector"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: TABULAR DATA GRID */}
          {viewMode === "table" && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search ID, issue, department, street…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-500"
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {filtered.length} total records
                </span>
              </div>

              <div className="thin-scroll overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 uppercase tracking-wider text-slate-400 text-[10px]">
                      <th className="px-4 py-3 font-semibold">Incident Ref</th>
                      <th className="px-4 py-3 font-semibold">Priority</th>
                      <th className="px-4 py-3 font-semibold">Department & Locality</th>
                      <th className="px-4 py-3 text-center font-semibold">Fused Reports</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">SLA Forecast</th>
                      <th className="px-4 py-3 font-semibold">Email Dispatch</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inc) => (
                      <tr
                        key={inc.id}
                        onClick={() => openDetail(inc.id)}
                        className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 ${
                          selected?.id === inc.id ? "bg-brand-50/50" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900">{inc.id}</span>
                            <ReviewFlag needsReview={inc.needs_review} />
                          </div>
                          <p className="mt-0.5 max-w-56 truncate text-slate-500">{inc.issue_label}</p>
                        </td>
                        <td className="px-4 py-3">
                          <PriorityBadge score={inc.priority_score} level={inc.priority_level} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-700">{inc.department_label}</p>
                          <p className="text-[11px] text-slate-400">{inc.location_label ?? "Hyderabad"}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3 text-slate-400" />
                            {inc.report_count}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={inc.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {inc.predicted_resolve_at ? formatRelative(inc.predicted_resolve_at) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-mono text-slate-500">
                            {inc.notification_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(inc.id);
                            }}
                            className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW MODE 3: RADAR, HOTSPOTS & TELEPHONY LOGS */}
          {viewMode === "analytics" && (
            <div className="mt-5 space-y-5">
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <WatchdogPanel onOpen={(id) => openDetail(id)} />
                </div>
                <HotspotPanel />
              </div>
              <div className="grid gap-5 lg:grid-cols-3">
                <CallsPanel />
                <div className="lg:col-span-2">
                  <SmsInboxPanel onOpenIncident={openDetail} />
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Secondary Oversight for Split Mode */}
          {viewMode === "split" && (
            <div className="mt-8 border-t border-slate-200/80 pt-6">
              <h2 className="font-display text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Radio className="h-4 w-4 text-brand-600" /> Autonomous Systems & Telephony Watchdog
              </h2>
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <WatchdogPanel onOpen={(id) => openDetail(id)} />
                </div>
                <HotspotPanel />
              </div>
              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                <CallsPanel />
                <div className="lg:col-span-2">
                  <SmsInboxPanel onOpenIncident={openDetail} />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Incident Detail Drawer */}
      <IncidentDetailDrawer
        incident={selected}
        busy={refreshing}
        onClose={() => setSelected(null)}
        onUpdate={onUpdated}
        notify={notify}
      />
    </div>
  );
}