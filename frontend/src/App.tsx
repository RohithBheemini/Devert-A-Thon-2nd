import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Landmark, MapPin, BellRing, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./lib/api";
import CitizenReport from "./pages/CitizenReport";
import Contact from "./pages/Contact";
import Dashboard from "./pages/Dashboard";
import Tracker from "./pages/Tracker";

function useBackendMode() {
  const [mode, setMode] = useState<string | null>(null);
  useEffect(() => {
    api
      .demoStatus()
      .then((s) => setMode(s.settings.demo_mode ? `DEMO · mock email` : "LIVE"))
      .catch(() => setMode("offline"));
  }, []);
  return mode;
}

function Navbar() {
  const mode = useBackendMode();
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
              <Landmark className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-700 tracking-tight text-slate-900">
              Civic<span className="text-brand-600">Pulse</span>
            </span>
          </NavLink>
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/" className={linkCls}>
              <MapPin className="h-4 w-4" /> Report an issue
            </NavLink>
            <NavLink to="/dashboard" className={linkCls}>
              <BellRing className="h-4 w-4" /> Municipal dashboard
            </NavLink>
            <NavLink to="/contact" className={linkCls}>
              <Phone className="h-4 w-4" /> Call helpline
            </NavLink>
          </nav>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:flex">
          <span className={`h-2 w-2 rounded-full ${mode === "offline" ? "bg-red-500" : "bg-emerald-500"}`} />
          {mode}
        </span>
      </div>
    </motion.header>
  );
}

export default function App() {
  const location = useLocation();
  return (
    <div className="min-h-full bg-slate-50">
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <Routes>
            <Route path="/" element={<CitizenReport />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/track/:reportId" element={<Tracker />} />
          </Routes>
        </motion.main>
      </AnimatePresence>
      <footer className="border-t border-slate-200 bg-white py-6">
        <p className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-400">
          CivicPulse · AI Civic Issue Intake & Resolution Assistant · Demo Dataset
        </p>
      </footer>
    </div>
  );
}