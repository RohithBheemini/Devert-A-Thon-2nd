import { motion } from "framer-motion";
import gsap from "gsap";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Droplets,
  Image as ImageIcon,
  Lamp,
  Loader2,
  MapPin,
  MessageSquareText,
  Mic,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LocationPicker } from "../components/LocationPicker";
import { ConfidenceBadge } from "../components/Badges";
import { api } from "../lib/api";
import { HYDERABAD_DEFAULT } from "../lib/geo";
import type { ReportOut } from "../types";

const ISSUE_CATEGORIES = [
  {
    type: "pothole",
    title: "Road Defect / Pothole",
    desc: "Craters, asphalt breakup, open trenches",
    icon: TriangleAlert,
    color: "from-orange-500 to-amber-600",
    sample: "Deep hazardous pothole on the main road, damaging vehicles and causing traffic jams.",
  },
  {
    type: "garbage_overflow",
    title: "Garbage Overflow",
    desc: "Full dumpsters, litter piles, foul odor",
    icon: Trash2,
    color: "from-purple-500 to-indigo-600",
    sample: "Garbage overflowing from the community bin onto the pedestrian path, stinking badly.",
  },
  {
    type: "water_leakage",
    title: "Water / Drainage",
    desc: "Pipe bursts, street flooding, sewage leak",
    icon: Droplets,
    color: "from-sky-500 to-blue-600",
    sample: "Municipal water supply pipe ruptured, clean drinking water flooding the road continuously.",
  },
  {
    type: "broken_streetlight",
    title: "Broken Streetlight",
    desc: "Dark roads, non-working lamps, bare wires",
    icon: Lamp,
    color: "from-amber-500 to-yellow-600",
    sample: "Streetlights not functioning for the last four days, making the road pitch dark and unsafe.",
  },
];

export default function CitizenReport() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [position, setPosition] = useState({ lat: HYDERABAD_DEFAULT.lat, lng: HYDERABAD_DEFAULT.lng });
  const [locationLabel, setLocationLabel] = useState(HYDERABAD_DEFAULT.label);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [mobile, setMobile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReportOut | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resultRef.current || !result) return;
    const ctx = gsap.context(() => {
      gsap.from(resultRef.current!, { opacity: 0, y: 24, scale: 0.98, duration: 0.5, ease: "power3.out" });
      gsap.from([".decision-row"], {
        opacity: 0,
        x: -12,
        stagger: 0.08,
        duration: 0.4,
        ease: "power2.out",
        delay: 0.2,
      });
    }, resultRef);
    return () => ctx.revert();
  }, [result]);

  const selectCategory = (cat: typeof ISSUE_CATEGORIES[0]) => {
    setSelectedCategory(cat.type);
    if (!description.trim()) {
      setDescription(cat.sample);
    }
  };

  const pickImage = (file: File | null) => {
    setImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const submit = async () => {
    if (description.trim().length < 8) {
      setError("Please describe the issue in at least a few words.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("description", description.trim());
      form.append("latitude", String(position.lat));
      form.append("longitude", String(position.lng));
      form.append("accuracy_meters", "10");
      if (locationLabel.trim()) form.append("location_label", locationLabel.trim());
      if (voiceTranscript.trim()) form.append("voice_transcript", voiceTranscript.trim());
      if (mobile.trim()) form.append("mobile_number", mobile.trim());
      if (image) form.append("image", image);
      const res = await api.submitReport(form);
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? "Submission failed. Is the backend running?");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setSelectedCategory(null);
    setDescription("");
    setImage(null);
    setImagePreview(null);
    setVoiceTranscript("");
    setMobile("");
    setPosition({ lat: HYDERABAD_DEFAULT.lat, lng: HYDERABAD_DEFAULT.lng });
    setLocationLabel(HYDERABAD_DEFAULT.label);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
          <Sparkles className="h-3.5 w-3.5" /> AI Civic Intake & De-duplication Engine
        </span>
        <h1 className="font-display mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Report a Community Civic Issue
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
          Directly notify municipal authorities of road hazards, overflowing waste, leaks, or broken lights.
          Upload photo proof and pinpoint the exact spot on the map below.
        </p>
      </motion.div>

      {/* Form */}
      {!result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-8 space-y-5"
        >
          {/* Quick DVPS30 Category Selector Cards */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Select Civic Issue Category
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ISSUE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.type;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.type}
                    type="button"
                    onClick={() => selectCategory(cat)}
                    className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-brand-500 bg-brand-50/60 shadow-md ring-2 ring-brand-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr ${cat.color} text-white shadow-sm mb-2.5`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-bold text-slate-900">{cat.title}</span>
                    <span className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{cat.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Issue Description */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Issue Description & Details
              </label>
              <span className="text-xs text-slate-400">{description.length}/500</span>
            </div>

            <textarea
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what you observed, road condition, danger level, landmark..."
              className="mt-2.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Quick presets:</span>
              {[
                "Deep pothole near metro station, damaging cars",
                "Garbage overflowing onto street, foul odor",
                "Main water pipe ruptured, road flooded",
                "Streetlight out for days, pitch dark road",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDescription(s)}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Photo Proof + Voice / Mobile */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Photo Upload with Proof badge */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Camera className="h-4 w-4 text-brand-600" /> 3. Photo Proof (Mandatory for DVPS30)
                </label>
                {image && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-3 w-3" /> Attached
                  </span>
                )}
              </div>

              {imagePreview ? (
                <div className="mt-2.5 relative flex-1 overflow-hidden rounded-xl border border-slate-200 min-h-[160px]">
                  <img src={imagePreview} alt="preview" className="h-44 w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-2 text-[11px] text-white flex items-center justify-between">
                    <span className="font-semibold truncate">{image?.name}</span>
                    <button
                      type="button"
                      onClick={() => pickImage(null)}
                      className="rounded bg-red-600/90 px-2 py-0.5 text-[10px] font-bold hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="mt-2.5 flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-6 text-slate-400 transition hover:border-brand-400 hover:bg-brand-50/30 cursor-pointer min-h-[160px]">
                  <ImageIcon className="h-8 w-8 text-slate-400" />
                  <span className="mt-2 text-xs font-bold text-slate-700">Click or Drag Photo Proof</span>
                  <span className="text-[11px] text-slate-400">JPG, PNG up to 10MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>

            {/* Voice Transcript & SMS Mobile */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Mic className="h-4 w-4 text-brand-600" /> Voice / Telugu Note (Optional)
                </label>
                <textarea
                  value={voiceTranscript}
                  onChange={(e) => setVoiceTranscript(e.target.value)}
                  rows={2}
                  placeholder="e.g. పెద్ద రోడ్డు గుంత మెట్రో దగ్గర లేదా audio transcript…"
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 outline-none focus:border-brand-500 focus:bg-white"
                />
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Telugu example:</span>
                  <button
                    type="button"
                    onClick={() => setVoiceTranscript("పెద్ద రోడ్డు గుంత మెట్రో దగ్గర వాహనాలు ప్రమాదంలో పడుతున్నాయి")}
                    className="text-[10px] font-medium text-brand-600 hover:underline"
                  >
                    పెద్ద రోడ్డు గుంత మెట్రో దగ్గర…
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <MessageSquareText className="h-4 w-4 text-brand-600" /> Mobile for SMS Tracking Updates
                </label>
                <input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+91 98450 10001 (get SMS at each resolution step)"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Interactive GIS Location Pinning */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <MapPin className="h-4 w-4 text-brand-600" /> 4. Precise Location & Map Pin
              </label>
              <span className="text-xs font-mono font-medium text-slate-500">
                Coordinates: {position.lat.toFixed(5)}°N, {position.lng.toFixed(5)}°E
              </span>
            </div>

            <LocationPicker
              position={position}
              onChange={(lat, lng) => setPosition({ lat, lng })}
              onAddressResolved={(addr) => setLocationLabel(addr)}
            />

            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 shrink-0">Street/Landmark:</span>
              <input
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="Identified landmark (auto-updates when pin drops)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100 font-medium text-slate-800"
              />
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          {/* Submit CTA */}
          <motion.button
            whileTap={{ scale: 0.99 }}
            onClick={submit}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 via-brand-700 to-indigo-700 px-6 py-4 text-sm font-bold text-white shadow-xl shadow-brand-500/25 transition hover:shadow-brand-500/40 disabled:opacity-60 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Classifying, checking duplicates & routing…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Submit Report to Municipal Control
              </>
            )}
          </motion.button>
        </motion.div>
      )}

      {/* Submission Result Screen */}
      {result && (
        <div ref={resultRef} className="mt-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    Report Registered Successfully!
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Unique Report ID: <span className="font-mono font-bold text-slate-800">{result.id}</span>
                  </p>
                </div>
              </div>
              {result.needs_review && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Queued for Review
                </span>
              )}
            </div>

            <div className="mt-6 space-y-3">
              {/* Classification step */}
              <div className="decision-row flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      AI Category Detection
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {result.issue_type ? ISSUE_CLASS_LABEL[result.issue_type] ?? result.issue_type : "Unclear issue"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {result.classification_confidence != null && (
                    <ConfidenceBadge
                      confidence={result.classification_confidence}
                      label={confidenceLevel(result.classification_confidence)}
                    />
                  )}
                  <span className="text-[11px] text-slate-400">
                    via {result.classification_source ?? "text NLP"}
                  </span>
                </div>
              </div>

              {/* Fusion / Duplicate check step */}
              <div className="decision-row flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700">
                    <Workflow className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Spatio-Temporal De-duplication
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {result.incident_id ? (
                        <>
                          Consolidated into Incident{" "}
                          <span className="font-mono text-brand-600 font-bold">{result.incident_id}</span>
                        </>
                      ) : (
                        "Created as New Standalone Incident"
                      )}
                    </p>
                  </div>
                </div>
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>

              {/* Location */}
              <div className="decision-row flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Geocoded Incident Site
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {result.location_label ?? "Hyderabad"} · {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Report Another Issue
              </button>

              <div className="flex items-center gap-2">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Municipal Dashboard <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  to={`/track/${result.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-700"
                >
                  Live Citizen Tracker <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ISSUE_CLASS_LABEL: Record<string, string> = {
  pothole: "Road Hazard / Pothole",
  garbage_overflow: "Garbage Overflow",
  water_leakage: "Water Leakage / Pipe Burst",
  broken_streetlight: "Broken Streetlight",
};

function confidenceLevel(c: number): string {
  if (c >= 0.8) return "HIGH";
  if (c >= 0.6) return "MEDIUM";
  return "LOW";
}