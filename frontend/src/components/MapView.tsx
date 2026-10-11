import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Maximize2, Minimize2, Navigation, Layers, Compass } from "lucide-react";
import { priorityColor } from "../lib/format";
import type { Hotspot, IncidentSummary } from "../types";
import { createIncidentIcon } from "./gis/MapIcons";

// Fix Leaflet container resizing bugs (grey tiles, offset pins)
function MapAutoResizer() {
  const map = useMap();

  useEffect(() => {
    // Initial size invalidations to ensure clean tile rendering after layout paint
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 350);

    const container = map.getContainer();
    if (!container) return () => { clearTimeout(t1); clearTimeout(t2); };

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

// Dynamically fits bounds to all visible incidents or focuses on selected incident
function DynamicMapController({
  incidents,
  focusId,
}: {
  incidents: IncidentSummary[];
  focusId?: string | null;
}) {
  const map = useMap();
  const prevFocusRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusId && focusId !== prevFocusRef.current) {
      prevFocusRef.current = focusId;
      const target = incidents.find((i) => i.id === focusId);
      if (target) {
        map.flyTo([target.latitude, target.longitude], 15.5, {
          duration: 0.8,
          easeLinearity: 0.25,
        });
        return;
      }
    }

    if (!focusId && incidents.length > 0 && prevFocusRef.current !== null) {
      prevFocusRef.current = null;
      // Auto-fit to all visible markers
      const validPoints = incidents
        .filter((i) => Number.isFinite(i.latitude) && Number.isFinite(i.longitude))
        .map((i) => [i.latitude, i.longitude] as [number, number]);

      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints);
        map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 14, duration: 0.6 });
      }
    }
  }, [focusId, incidents, map]);

  return null;
}

function HotspotLayer({ hotspots, visible }: { hotspots: Hotspot[]; visible: boolean }) {
  if (!visible) return null;

  return (
    <>
      {hotspots.map((h) => (
        <Circle
          key={`hot-${h.cell}`}
          center={[h.latitude, h.longitude]}
          radius={1200 + h.intensity * 2500}
          pathOptions={{
            color: "#dc2626",
            fillColor: "#ef4444",
            fillOpacity: 0.12 + h.intensity * 0.2,
            weight: 1.5,
            dashArray: "5 5",
          }}
        >
          <Popup>
            <div className="min-w-48 font-sans text-xs">
              <div className="flex items-center gap-1.5 font-bold text-red-700">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                <span>Cluster Hotspot · {h.area}</span>
              </div>
              <p className="mt-1 text-slate-600">
                <strong className="text-slate-900">{h.reports_recent} reports</strong> in last 24h ({h.spike_ratio}× baseline)
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(h.issue_mix).map(([issue, n]) => (
                  <span
                    key={issue}
                    className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-200"
                  >
                    {n}× {issue.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
          </Popup>
        </Circle>
      ))}
    </>
  );
}

export function IncidentMap({
  incidents,
  hotspots = [],
  center,
  focusId,
  onSelect,
  height = "100%",
  className = "",
}: {
  incidents: IncidentSummary[];
  hotspots?: Hotspot[];
  center?: [number, number];
  focusId?: string | null;
  onSelect?: (id: string) => void;
  height?: string;
  className?: string;
}) {
  const [showHotspots, setShowHotspots] = useState(true);
  const [tileStyle, setTileStyle] = useState<"standard" | "carto">("carto");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Compute natural center of current incidents or Hyderabad default
  const defaultCenter = useMemo(() => {
    if (center) return center;
    const valid = incidents.filter((i) => Number.isFinite(i.latitude) && Number.isFinite(i.longitude));
    if (valid.length === 0) return [17.4485, 78.3908] as [number, number]; // Hyderabad central corridor
    const lat = valid.reduce((s, i) => s + i.latitude, 0) / valid.length;
    const lng = valid.reduce((s, i) => s + i.longitude, 0) / valid.length;
    return [lat, lng] as [number, number];
  }, [center, incidents]);

  const toggleFullscreen = () => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full overflow-hidden ${className} ${
        isFullscreen ? "h-screen w-screen rounded-none z-50 bg-slate-900" : ""
      }`}
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: "#f1f5f9" }}
      >
        <MapAutoResizer />
        <DynamicMapController incidents={incidents} focusId={focusId} />

        {tileStyle === "carto" ? (
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxZoom={19}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        )}

        <HotspotLayer hotspots={hotspots} visible={showHotspots} />

        {incidents.map((inc) => {
          const isSelected = focusId === inc.id;
          const icon = createIncidentIcon({
            issueType: inc.issue_type,
            priorityLevel: inc.priority_level,
            reportCount: inc.report_count,
            isSelected,
          });

          return (
            <Marker
              key={inc.id}
              position={[inc.latitude, inc.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onSelect?.(inc.id),
              }}
            >
              <Popup>
                <div className="min-w-56 font-sans text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="font-mono text-xs font-bold text-slate-900">{inc.id}</span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white uppercase"
                      style={{ background: priorityColor(inc.priority_level) }}
                    >
                      {inc.priority_level} ({inc.priority_score})
                    </span>
                  </div>

                  <p className="mt-1.5 font-bold text-slate-800 text-sm leading-tight">
                    {inc.issue_label}
                  </p>
                  <p className="mt-0.5 text-slate-500 flex items-center gap-1">
                    <Compass className="h-3 w-3 text-slate-400" />
                    {inc.location_label ?? `${inc.latitude.toFixed(4)}, ${inc.longitude.toFixed(4)}`}
                  </p>

                  <div className="mt-2 rounded-lg bg-slate-50 p-2 text-slate-600">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Department:</span>
                      <strong className="text-slate-800">{inc.department_label}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-0.5">
                      <span>Fused reports:</span>
                      <strong className="text-slate-800">{inc.report_count} citizen submission{inc.report_count > 1 ? "s" : ""}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-0.5">
                      <span>Status:</span>
                      <strong className="text-brand-600">{inc.status.replace("_", " ")}</strong>
                    </div>
                  </div>

                  {inc.summary && (
                    <p className="mt-2 line-clamp-2 text-[11px] italic text-slate-500">
                      "{inc.summary}"
                    </p>
                  )}

                  {onSelect && (
                    <button
                      onClick={() => onSelect(inc.id)}
                      className="mt-2.5 w-full rounded-lg bg-brand-600 py-1.5 text-center font-semibold text-white shadow-sm transition hover:bg-brand-700"
                    >
                      Inspect incident →
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Map Controls overlay */}
      <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white/95 p-1.5 shadow-md backdrop-blur">
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
          className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        <button
          onClick={() => setShowHotspots((prev) => !prev)}
          title={showHotspots ? "Hide Hotspots" : "Show Hotspots"}
          className={`rounded-lg p-1.5 transition ${
            showHotspots ? "bg-red-50 text-red-600" : "text-slate-400 hover:bg-slate-100"
          }`}
        >
          <Layers className="h-4 w-4" />
        </button>

        <button
          onClick={() => setTileStyle((s) => (s === "carto" ? "standard" : "carto"))}
          title="Toggle Tile Style"
          className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <Navigation className="h-4 w-4" />
        </button>
      </div>

      {/* Quick Map Legend pill */}
      <div className="absolute bottom-3 left-3 z-[1000] hidden sm:flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-orange-600" /> Road
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-purple-600" /> Garbage
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-600" /> Water
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-600" /> Light
        </span>
        {hotspots.length > 0 && showHotspots && (
          <span className="flex items-center gap-1 border-l border-slate-200 pl-2 text-red-600">
            <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" /> {hotspots.length} Hotspots
          </span>
        )}
      </div>
    </div>
  );
}