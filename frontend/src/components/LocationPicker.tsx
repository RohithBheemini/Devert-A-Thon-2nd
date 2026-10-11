import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import {
  getCurrentPosition,
  HYDERABAD_PRESETS,
  reverseGeocode,
  searchLocations,
  type GeoLocation,
} from "../lib/geo";
import { createPickerPinIcon } from "./gis/MapIcons";

// Synchronizes map camera when external position state updates
function CameraSync({ position }: { position: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 15), {
      duration: 0.6,
    });
  }, [position.lat, position.lng, map]);

  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);

  return null;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPicker({
  position,
  onChange,
  onAddressResolved,
}: {
  position: { lat: number; lng: number };
  onChange: (lat: number, lng: number) => void;
  onAddressResolved?: (address: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeoLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [accuracyRadius, setAccuracyRadius] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pinIcon = useMemo(() => createPickerPinIcon(), []);

  // Handle user click on map
  const handlePick = useCallback(
    async (lat: number, lng: number) => {
      onChange(lat, lng);
      if (onAddressResolved) {
        const addr = await reverseGeocode(lat, lng);
        if (addr) onAddressResolved(addr);
      }
    },
    [onChange, onAddressResolved],
  );

  // Address search query with debounce
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const res = await searchLocations(searchQuery);
      setSearchResults(res);
      setShowDropdown(res.length > 0);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // GPS Locate Me
  const handleLocateMe = async () => {
    setIsLocating(true);
    try {
      const pos = await getCurrentPosition();
      onChange(pos.lat, pos.lng);
      setAccuracyRadius(pos.accuracy);
      if (onAddressResolved) {
        const addr = await reverseGeocode(pos.lat, pos.lng);
        if (addr) onAddressResolved(addr);
      }
    } catch {
      // fallback if user denies or offline
      alert("Could not retrieve precise GPS location. You can still pick a spot on the map or select a landmark.");
    } finally {
      setIsLocating(false);
    }
  };

  const selectSearchResult = (item: GeoLocation) => {
    onChange(item.lat, item.lng);
    if (onAddressResolved) onAddressResolved(item.label);
    setSearchQuery(item.label);
    setShowDropdown(false);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Top Search & Actions Bar */}
      <div className="relative z-[1001] border-b border-slate-100 p-3 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-2" ref={dropdownRef}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              placeholder="Search landmark (e.g. Kukatpally, Gachibowli, Ameerpet)…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
            )}

            {/* Dropdown Results */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 top-full mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-xl z-[1002] max-h-56 overflow-y-auto thin-scroll">
                {searchResults.map((item, idx) => (
                  <button
                    key={`${item.lat}-${item.lng}-${idx}`}
                    type="button"
                    onClick={() => selectSearchResult(item)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
            title="Use current GPS location"
          >
            {isLocating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
            ) : (
              <Crosshair className="h-3.5 w-3.5 text-brand-600" />
            )}
            <span className="hidden sm:inline">Locate Me</span>
          </button>
        </div>

        {/* Quick Landmark Chips */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto thin-scroll pb-1">
          <span className="text-[11px] font-medium text-slate-400 shrink-0">Popular:</span>
          {HYDERABAD_PRESETS.slice(0, 5).map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => selectSearchResult(p)}
              className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map View */}
      <div className="h-72 w-full relative">
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={15}
          scrollWheelZoom
          className="h-full w-full"
          style={{ background: "#f8fafc" }}
        >
          <CameraSync position={position} />
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxZoom={19}
          />
          <ClickHandler onPick={handlePick} />

          {accuracyRadius && (
            <Circle
              center={[position.lat, position.lng]}
              radius={accuracyRadius}
              pathOptions={{
                color: "#3b82f6",
                fillColor: "#60a5fa",
                fillOpacity: 0.15,
                weight: 1,
              }}
            />
          )}

          <Marker position={[position.lat, position.lng]} icon={pinIcon} />
        </MapContainer>

        <div className="pointer-events-none absolute bottom-2 left-3 z-[1000] rounded-lg bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-white shadow backdrop-blur">
          Click map or drag to fine-tune exact pin
        </div>
      </div>
    </div>
  );
}