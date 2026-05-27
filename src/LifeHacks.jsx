// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// LifeHacks.jsx — Daily flip-card life hacks across 5 life areas.

import React, { useEffect, useRef, useState } from "react";

// ── Area styles ───────────────────────────────────────────────────────────────

const AREA_STYLES = {
  Mind: {
    gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    shadow:   "0 8px 24px rgba(139,92,246,0.4)",
    badge:    "bg-violet-100 text-violet-700 border-violet-200",
    well:     "bg-violet-50 border-violet-100",
    title:    "text-violet-700",
  },
  Body: {
    gradient: "linear-gradient(135deg, #14b8a6, #10b981)",
    shadow:   "0 8px 24px rgba(20,184,166,0.4)",
    badge:    "bg-teal-100 text-teal-700 border-teal-200",
    well:     "bg-teal-50 border-teal-100",
    title:    "text-teal-700",
  },
  Relationships: {
    gradient: "linear-gradient(135deg, #f43f5e, #ec4899)",
    shadow:   "0 8px 24px rgba(244,63,94,0.4)",
    badge:    "bg-rose-100 text-rose-700 border-rose-200",
    well:     "bg-rose-50 border-rose-100",
    title:    "text-rose-700",
  },
  Work: {
    gradient: "linear-gradient(135deg, #3b82f6, #6366f1)",
    shadow:   "0 8px 24px rgba(59,130,246,0.4)",
    badge:    "bg-blue-100 text-blue-700 border-blue-200",
    well:     "bg-blue-50 border-blue-100",
    title:    "text-blue-700",
  },
  Finance: {
    gradient: "linear-gradient(135deg, #f59e0b, #f97316)",
    shadow:   "0 8px 24px rgba(245,158,11,0.4)",
    badge:    "bg-amber-100 text-amber-700 border-amber-200",
    well:     "bg-amber-50 border-amber-100",
    title:    "text-amber-700",
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

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard({ tall }) {
  return (
    <div
      className={`rounded-3xl bg-slate-200 animate-pulse ${tall ? "col-span-2 h-44" : "h-44"}`}
    />
  );
}

// ── Flip card ─────────────────────────────────────────────────────────────────

function FlipCard({ hack, isFlipped, onFlip }) {
  const s = AREA_STYLES[hack.area] || DEFAULT_STYLE;
  const backRef = useRef(null);

  // Prevent accidental flip-back when user is scrolling the back content
  const touchStartY = useRef(0);
  const didScroll = useRef(false);

  const handleBackTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    didScroll.current = false;
  };
  const handleBackTouchMove = (e) => {
    if (Math.abs(e.touches[0].clientY - touchStartY.current) > 8) {
      didScroll.current = true;
    }
  };
  const handleBackClick = (e) => {
    e.stopPropagation();
    if (!didScroll.current) onFlip();
  };

  return (
    <div
      className="h-44 cursor-pointer select-none"
      style={{ perspective: "1200px" }}
      onClick={onFlip}>

      <div
        className="relative w-full h-full"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}>

        {/* ── Front ── */}
        <div
          className="absolute inset-0 rounded-3xl flex flex-col items-center justify-center gap-2 overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            background: s.gradient,
            boxShadow: s.shadow,
          }}>

          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 70% 20%, rgba(255,255,255,0.6) 0%, transparent 60%)" }} />

          <span className="text-5xl leading-none drop-shadow-sm">{hack.areaEmoji}</span>
          <p className="text-base font-extrabold text-white tracking-wide">{hack.area}</p>
          <p className="text-[10px] text-white/50 mt-0.5">tap to reveal</p>
        </div>

        {/* ── Back ── */}
        <div
          ref={backRef}
          className="absolute inset-0 rounded-3xl bg-white overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
          onClick={handleBackClick}
          onTouchStart={handleBackTouchStart}
          onTouchMove={handleBackTouchMove}>

          {/* Coloured top strip */}
          <div className="h-1 w-full flex-shrink-0" style={{ background: s.gradient }} />

          {/* Scrollable content */}
          <div
            className="h-full overflow-y-auto p-3"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "28px" }}>

            {/* Sub-area chip */}
            <span className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[9px] font-bold mb-2 ${s.badge}`}>
              {hack.subAreaEmoji} {hack.subArea}
            </span>

            {/* Hack title */}
            <p className={`text-[12px] font-extrabold leading-snug mb-1.5 ${s.title}`}>
              {hack.title}
            </p>

            {/* Hack body */}
            <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
              {hack.hack}
            </p>

            {/* Why it works */}
            <div className={`rounded-xl border p-2 ${s.well}`}>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
                💡 Why it works
              </p>
              <p className="text-[10px] text-slate-500 leading-relaxed">{hack.why}</p>
            </div>
          </div>

          {/* Flip-back hint — fixed at bottom */}
          <div className="absolute bottom-0 inset-x-0 flex justify-center pb-1.5 pointer-events-none">
            <span className="text-[9px] text-slate-300 font-medium">tap to flip back</span>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LifeHacks() {
  const [hacks, setHacks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flipped, setFlipped] = useState(new Set());
  const [countdown, setCountdown] = useState(timeUntilMidnight());

  useEffect(() => {
    const t = setInterval(() => setCountdown(timeUntilMidnight()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/api/lifehacks")
      .then((r) => { if (!r.ok) throw new Error("Could not load Life Hacks"); return r.json(); })
      .then((data) => { setHacks(data.hacks); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const toggle = (area) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      next.has(area) ? next.delete(area) : next.add(area);
      return next;
    });
  };

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
            {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
            <SkeletonCard tall />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <span className="text-4xl mb-3">😔</span>
            <p className="text-sm font-semibold text-slate-600 mb-1">Couldn't load today's hacks</p>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {hacks?.map((hack, idx) =>
              idx === 4 ? (
                // 5th card centred across both columns
                <div key={hack.area} className="col-span-2 flex justify-center">
                  <div className="w-[calc(50%-6px)]">
                    <FlipCard
                      hack={hack}
                      isFlipped={flipped.has(hack.area)}
                      onFlip={() => toggle(hack.area)}
                    />
                  </div>
                </div>
              ) : (
                <FlipCard
                  key={hack.area}
                  hack={hack}
                  isFlipped={flipped.has(hack.area)}
                  onFlip={() => toggle(hack.area)}
                />
              )
            )}
          </div>
        )}

        {!loading && !error && (
          <p className="text-center text-[10px] text-slate-300 pt-4 pb-2">
            Fresh hacks every day at midnight
          </p>
        )}
      </div>
    </div>
  );
}
