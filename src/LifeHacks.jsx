// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// LifeHacks.jsx — Daily life hack cards with expand + sparkle flip reveal.

import React, { useEffect, useState } from "react";

// ── Area styles ───────────────────────────────────────────────────────────────

const AREA_STYLES = {
  Mind: {
    gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    shadow:   "0 8px 24px rgba(139,92,246,0.4)",
    badge:    "bg-violet-100 text-violet-700 border-violet-200",
    well:     "bg-violet-50 border-violet-100",
    title:    "text-violet-700",
    sparks:   ["#c4b5fd", "#fff", "#ffd700", "#a78bfa", "#f0abfc", "#fff"],
  },
  Body: {
    gradient: "linear-gradient(135deg, #14b8a6, #10b981)",
    shadow:   "0 8px 24px rgba(20,184,166,0.4)",
    badge:    "bg-teal-100 text-teal-700 border-teal-200",
    well:     "bg-teal-50 border-teal-100",
    title:    "text-teal-700",
    sparks:   ["#99f6e4", "#fff", "#ffd700", "#5eead4", "#6ee7b7", "#fff"],
  },
  Relationships: {
    gradient: "linear-gradient(135deg, #f43f5e, #ec4899)",
    shadow:   "0 8px 24px rgba(244,63,94,0.4)",
    badge:    "bg-rose-100 text-rose-700 border-rose-200",
    well:     "bg-rose-50 border-rose-100",
    title:    "text-rose-700",
    sparks:   ["#fda4af", "#fff", "#ffd700", "#f9a8d4", "#fb7185", "#fff"],
  },
  Work: {
    gradient: "linear-gradient(135deg, #3b82f6, #6366f1)",
    shadow:   "0 8px 24px rgba(59,130,246,0.4)",
    badge:    "bg-blue-100 text-blue-700 border-blue-200",
    well:     "bg-blue-50 border-blue-100",
    title:    "text-blue-700",
    sparks:   ["#93c5fd", "#fff", "#ffd700", "#a5b4fc", "#7dd3fc", "#fff"],
  },
  Finance: {
    gradient: "linear-gradient(135deg, #f59e0b, #f97316)",
    shadow:   "0 8px 24px rgba(245,158,11,0.4)",
    badge:    "bg-amber-100 text-amber-700 border-amber-200",
    well:     "bg-amber-50 border-amber-100",
    title:    "text-amber-700",
    sparks:   ["#fcd34d", "#fff", "#ffd700", "#fdba74", "#fbbf24", "#fff"],
  },
  Home: {
    gradient: "linear-gradient(135deg, #84cc16, #65a30d)",
    shadow:   "0 8px 24px rgba(132,204,22,0.4)",
    badge:    "bg-lime-100 text-lime-700 border-lime-200",
    well:     "bg-lime-50 border-lime-100",
    title:    "text-lime-700",
    sparks:   ["#bef264", "#fff", "#ffd700", "#a3e635", "#d9f99d", "#fff"],
  },
  Digital: {
    gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
    shadow:   "0 8px 24px rgba(6,182,212,0.4)",
    badge:    "bg-cyan-100 text-cyan-700 border-cyan-200",
    well:     "bg-cyan-50 border-cyan-100",
    title:    "text-cyan-700",
    sparks:   ["#a5f3fc", "#fff", "#ffd700", "#67e8f9", "#22d3ee", "#fff"],
  },
  "Weird & Wonderful": {
    gradient: "linear-gradient(135deg, #e879f9, #c026d3)",
    shadow:   "0 8px 24px rgba(192,38,211,0.4)",
    badge:    "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
    well:     "bg-fuchsia-50 border-fuchsia-100",
    title:    "text-fuchsia-700",
    sparks:   ["#f0abfc", "#fff", "#ffd700", "#e879f9", "#d946ef", "#fff"],
  },
};

const DEFAULT_STYLE = AREA_STYLES.Mind;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ms = midnight - now;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// ── Sparkle burst ─────────────────────────────────────────────────────────────

const SPARK_ANGLES = [0, 22, 45, 68, 90, 113, 135, 158, 180, 203, 225, 248, 270, 293, 315, 338];

function Sparkles({ sparks }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: "visible", zIndex: 20 }}
    >
      {SPARK_ANGLES.map((angle, i) => {
        const rad   = (angle * Math.PI) / 180;
        const dist  = 72 + (i % 5) * 18;
        const size  = 5 + (i % 3) * 3;
        const color = sparks[i % sparks.length];
        const dur   = (0.7 + (i % 3) * 0.1).toFixed(1);
        const delay = (i * 0.028).toFixed(3);
        return (
          <div
            key={i}
            style={{
              position:     "absolute",
              top:          "50%",
              left:         "50%",
              width:        size,
              height:       size,
              marginTop:    -(size / 2),
              marginLeft:   -(size / 2),
              background:   color,
              borderRadius: i % 3 === 1 ? "2px" : "50%",
              transform:    i % 3 === 1 ? "rotate(45deg)" : "none",
              boxShadow:    `0 0 ${size + 2}px ${color}, 0 0 ${size * 3}px ${color}55`,
              "--tx":       `${Math.round(Math.cos(rad) * dist)}px`,
              "--ty":       `${Math.round(Math.sin(rad) * dist)}px`,
              animation:    `hackSparkleOut ${dur}s ease-out ${delay}s forwards`,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard({ tall }) {
  return (
    <div
      className={`rounded-3xl bg-slate-200 animate-pulse ${tall ? "col-span-2 h-44" : "h-44"}`}
    />
  );
}

// ── Preview card (shown in the 2-col grid) ────────────────────────────────────

function PreviewCard({ hack, onTap }) {
  const s = AREA_STYLES[hack.area] || DEFAULT_STYLE;
  return (
    <button
      className="h-44 w-full rounded-3xl relative overflow-hidden flex flex-col items-center justify-center gap-2 select-none active:scale-95 transition-transform duration-150"
      style={{ background: s.gradient, boxShadow: s.shadow }}
      onClick={onTap}
      aria-label={`Open ${hack.area} life hack`}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{ backgroundImage: "radial-gradient(circle at 70% 20%, rgba(255,255,255,0.6) 0%, transparent 60%)" }}
      />
      <span className="text-5xl leading-none drop-shadow-sm">{hack.areaEmoji}</span>
      <p className="text-base font-extrabold text-white tracking-wide">{hack.area}</p>
      <p className="text-[10px] text-white/50 mt-0.5">tap to reveal</p>
    </button>
  );
}

// ── Expanded overlay card ─────────────────────────────────────────────────────

function ExpandedCard({ hack, onClose }) {
  const s = AREA_STYLES[hack.area] || DEFAULT_STYLE;
  const [flipped, setFlipped]         = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => { setFlipped(true); setShowSparkles(true); }, 280);
    const t2 = setTimeout(() => setShowSparkles(false), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 px-5"
      style={{
        background:           "rgba(0,0,0,0.68)",
        backdropFilter:       "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation:            "hackOverlayIn 0.2s ease both",
      }}
      onClick={onClose}
    >
      {/* Card wrapper — perspective context + entrance animation */}
      <div
        className="relative w-full max-w-sm"
        style={{
          height:      "min(490px, 80vh)",
          perspective: "1200px",
          animation:   "hackCardIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {showSparkles && <Sparkles sparks={s.sparks} />}

        {/* 3-D flip container */}
        <div
          className="absolute inset-0"
          style={{
            transformStyle: "preserve-3d",
            transition:     "transform 0.62s cubic-bezier(0.4, 0, 0.2, 1)",
            transform:      flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* ── Front face ── */}
          <div
            className="absolute inset-0 rounded-3xl flex flex-col items-center justify-center gap-3 overflow-hidden"
            style={{
              backfaceVisibility:       "hidden",
              WebkitBackfaceVisibility: "hidden",
              background:               s.gradient,
              boxShadow:                s.shadow,
            }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle at 65% 18%, rgba(255,255,255,0.7) 0%, transparent 55%)" }}
            />
            <span className="text-7xl leading-none drop-shadow-md">{hack.areaEmoji}</span>
            <p className="text-2xl font-extrabold text-white tracking-wide">{hack.area}</p>
            <div className="flex items-center gap-2 mt-1">
              {[0, 0.18, 0.36].map((d, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: `${d}s` }} />
              ))}
            </div>
          </div>

          {/* ── Back face ── */}
          <div
            className="absolute inset-0 rounded-3xl bg-white flex flex-col overflow-hidden"
            style={{
              backfaceVisibility:       "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform:                "rotateY(180deg)",
              boxShadow:                "0 20px 60px rgba(0,0,0,0.22)",
            }}
          >
            {/* Colour strip */}
            <div className="h-2 w-full flex-shrink-0" style={{ background: s.gradient }} />

            {/* Content area — flex-1 to fill remaining space, no scroll */}
            <div className="flex-1 px-5 pt-4 pb-2 flex flex-col gap-3 min-h-0">
              <span className={`self-start inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${s.badge}`}>
                {hack.subAreaEmoji} {hack.subArea}
              </span>

              <p className={`text-[15px] font-extrabold leading-snug ${s.title}`}>
                {hack.title}
              </p>

              <p className="text-sm text-slate-600 leading-relaxed flex-1">
                {hack.hack}
              </p>

              <div className={`rounded-2xl border p-3 flex-shrink-0 ${s.well}`}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  💡 Why it works
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">{hack.why}</p>
              </div>
            </div>

            <p className="text-center text-[10px] text-slate-300 py-2.5 flex-shrink-0">
              tap outside to close
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LifeHacks() {
  const [hacks, setHacks]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [activeHack, setActive]   = useState(null);
  const [countdown, setCountdown] = useState(timeUntilMidnight());

  useEffect(() => {
    const t = setInterval(() => setCountdown(timeUntilMidnight()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const todayKey = `lhacks4_${new Date().toISOString().split("T")[0]}`;

    // Serve from localStorage if we already fetched today's hacks
    try {
      const cached = localStorage.getItem(todayKey);
      if (cached) {
        setHacks(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch (_) {}

    fetch("/api/lifehacks")
      .then((r) => { if (!r.ok) throw new Error("Could not load Life Hacks"); return r.json(); })
      .then((data) => {
        setHacks(data.hacks);
        setLoading(false);
        // Only cache if the API confirmed today's date (guards against stale CDN responses)
        if (data.date === todayKey.replace("lhacks4_", "")) {
          try {
            // Remove previous days' entries
            Object.keys(localStorage)
              .filter((k) => k.startsWith("lhacks4_") && k !== todayKey)
              .forEach((k) => localStorage.removeItem(k));
            localStorage.setItem(todayKey, JSON.stringify(data.hacks));
          } catch (_) {}
        }
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-4 pt-3 pb-3 bg-white border-b border-slate-100 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-bold text-slate-800">Life Hacks</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{todayLabel()}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-slate-400">New hacks in</p>
            <p className="text-[12px] font-bold text-teal-600">{countdown}</p>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <span className="text-4xl mb-3">😔</span>
            <p className="text-sm font-semibold text-slate-600 mb-1">Couldn't load today's hacks</p>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {hacks?.map((hack) => (
              <PreviewCard key={hack.area} hack={hack} onTap={() => setActive(hack)} />
            ))}
          </div>
        )}

        {!loading && !error && (
          <p className="text-center text-[10px] text-slate-300 pt-4 pb-2">
            Fresh hacks every day at midnight
          </p>
        )}
      </div>

      {/* Expanded card overlay */}
      {activeHack && (
        <ExpandedCard hack={activeHack} onClose={() => setActive(null)} />
      )}
    </div>
  );
}
