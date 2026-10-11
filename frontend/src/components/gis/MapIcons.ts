import L from "leaflet";

export interface MarkerConfig {
  issueType: string;
  priorityLevel: string;
  reportCount: number;
  isSelected?: boolean;
}

const ISSUE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pothole: { bg: "#ea580c", border: "#c2410c", text: "#ffffff" },
  garbage_overflow: { bg: "#7c3aed", border: "#6d28d9", text: "#ffffff" },
  water_leakage: { bg: "#0284c7", border: "#0369a1", text: "#ffffff" },
  broken_streetlight: { bg: "#d97706", border: "#b45309", text: "#ffffff" },
  unknown: { bg: "#64748b", border: "#475569", text: "#ffffff" },
};

const PRIORITY_RING: Record<string, string> = {
  CRITICAL: "rgba(220, 38, 38, 0.8)",
  HIGH: "rgba(249, 115, 22, 0.6)",
  MEDIUM: "rgba(234, 179, 8, 0.5)",
  LOW: "rgba(16, 185, 129, 0.4)",
};

// Clean inline SVGs for civic categories
const ISSUE_SVGS: Record<string, string> = {
  pothole: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  garbage_overflow: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  water_leakage: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  broken_streetlight: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
  unknown: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
};

/**
 * Creates an interactive civic incident pin with category icon,
 * cluster count badge, and animated pulse for critical issues.
 */
export function createIncidentIcon({
  issueType,
  priorityLevel,
  reportCount,
  isSelected = false,
}: MarkerConfig): L.DivIcon {
  const colors = ISSUE_COLORS[issueType] || ISSUE_COLORS.unknown;
  const ringColor = PRIORITY_RING[priorityLevel] || PRIORITY_RING.LOW;
  const svg = ISSUE_SVGS[issueType] || ISSUE_SVGS.unknown;
  const isCritical = priorityLevel === "CRITICAL";

  const size = isSelected ? 42 : isCritical ? 38 : 34;
  const badgeHtml =
    reportCount > 1
      ? `<span style="
          position:absolute;
          top:-4px;
          right:-4px;
          background:#0f172a;
          color:#ffffff;
          font-size:10px;
          font-weight:700;
          padding:1px 5px;
          border-radius:9999px;
          border:1.5px solid #ffffff;
          box-shadow:0 1px 3px rgba(0,0,0,0.3);
        ">${reportCount}</span>`
      : "";

  const pingHtml = isCritical
    ? `<span style="
        position:absolute;
        inset:-6px;
        border-radius:50%;
        background:${ringColor};
        opacity:0.6;
        animation:pulse-ring 1.8s cubic-bezier(0.24,0,0.38,1) infinite;
        pointer-events:none;
      "></span>`
    : "";

  const html = `
    <div style="
      position:relative;
      width:${size}px;
      height:${size}px;
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      ${pingHtml}
      <div style="
        width:${size}px;
        height:${size}px;
        background:${colors.bg};
        border:2.5px solid ${isSelected ? "#0f172a" : "#ffffff"};
        border-radius:50%;
        color:${colors.text};
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:${isSelected ? "0 0 0 3px #3b82f6, 0 6px 16px rgba(0,0,0,0.35)" : "0 3px 8px rgba(0,0,0,0.25)"};
        transition:transform 0.15s ease;
      ">
        ${svg}
      </div>
      ${badgeHtml}
    </div>
  `;

  return L.divIcon({
    className: "civic-incident-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
  });
}

/**
 * High-precision teardrop Pin icon for citizen location picker.
 */
export function createPickerPinIcon(): L.DivIcon {
  const html = `
    <div style="position:relative;width:32px;height:38px;pointer-events:none;">
      <svg width="32" height="38" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
        <path d="M16 0C7.16344 0 0 7.16344 0 16C0 25.5 13.5 36.5 15.1 37.7C15.6 38.1 16.4 38.1 16.9 37.7C18.5 36.5 32 25.5 32 16C32 7.16344 24.8366 0 16 0Z" fill="#254eeb"/>
        <circle cx="16" cy="15" r="7" fill="white"/>
        <circle cx="16" cy="15" r="3.5" fill="#254eeb"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: "civic-picker-pin",
    html,
    iconSize: [32, 38],
    iconAnchor: [16, 38],
    popupAnchor: [0, -36],
  });
}
