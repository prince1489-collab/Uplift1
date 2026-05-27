// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// LifeHacks.jsx — Daily life hacks across 5 life areas, refreshed every midnight.

import React, { useEffect, useState } from "react";
import { ChevronDown, Share2 } from "lucide-react";

// ── Area colour tokens ────────────────────────────────────────────────────────

const AREA_STYLES = {
  Mind: {
    iconBg:  "bg-violet-100",
    badge:   "bg-violet-100 text-violet-700 border-violet-200",
    cardBorder: "border-violet-100",
    well:    "bg-violet-50 border-violet-100",
    title:   "text-violet-700",
    bar:     "bg-gradient-to-b from-violet-500 to-purple-600",
  },
  Body: {
    iconBg:  "bg-teal-100",
    badge:   "bg-teal-100 text-teal-700 border-teal-200",
    cardBorder: "border-teal-100",
    well:    "bg-teal-50 border-teal-100",
    title:   "text-teal-700",
    bar:     "bg-gradient-to-b from-teal-400 to-emerald-500",
  },
  Relationships: {
    iconBg:  "bg-rose-100",
    badge:   "bg-rose-100 text-rose-700 border-rose-200",
    cardBorder: "border-rose-100",
    well:    "bg-rose-50 border-rose-100",
    title:   "text-rose-700",
    bar:     "bg-gradient-to-b from-rose-400 to-pink-500",
  },
  Work: {
    iconBg:  "bg-blue-100",
    badge:   "bg-blue-100 text-blue-700 border-blue-200",
    cardBorder: "border-blue-100",
    well:    "bg-blue-50 border-blue-100",
    title:   "text-blue-700",
    bar:     "bg-gradient-to-b from-blue-400 to-indigo-500",
  },
  Finance: {
    iconBg:  "bg-amber-100",
    badge:   "bg-amber-100 text-amber-700 border-amber-200",
    cardBorder: "border-amber-100",
    well:    "bg-amber-50 border-amber-100",
    title:   "text-amber-700",
    bar:     "bg-gradient-to-b from-amber-400 to-orange-500",
  },
};

const DEFAULT_STYLE = AREA_STYLES.Mind;

// ── Countdown helper ──────────────────────────────────────────────────────────

function timeUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ms = midnight - now;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm animate-pulse">
      <div className="w-1 self-stretch rounded-full bg-slate-100 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-24 rounded-full bg-slate-100" />
        <div className="h-3 w-16 rounded-full bg-slate-100" />
        <div className="h-3 w-full rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

// ── Single hack card ──────────────────────────────────────────────────────────

function HackCard({ hack, isOpen, onToggle }) {
  const s = AREA_STYLES[hack.area] || DEFAULT_STYLE;
  const [copied, setCopied] = useState(false);

  const handleShare = async (e) => {
    e.stopPropagation();
    const text = `${hack.areaEmoji} ${hack.title}\n\n${hack.hack}\n\n💡 ${hack.why}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: hack.title, text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (_) {}
  };

  return (
    <div className={`rounded-2xl border ${s.cardBorder} bg-white shadow-sm overflow-hidden`}>
      {/* ── Collapsed header — always visible ── */}
      <button
        onClick={onToggle}
        className="w-full flex items-stretch gap-0 text-left active:bg-slate-50 transition-colors">

        {/* Coloured accent bar */}
        <div className={`w-1 flex-shrink-0 ${s.bar}`} />

        <div className="flex items-center gap-3 flex-1 px-4 py-3.5">
          {/* Area icon */}
          <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-2xl ${s.iconBg}`}>
            {hack.areaEmoji}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <p className="text-sm font-bold text-slate-800">{hack.area}</p>
              <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${s.badge}`}>
                {hack.subAreaEmoji} {hack.subArea}
              </span>
            </div>
            <p className={`text-[12px] font-semibold truncate ${isOpen ? s.title : "text-slate-500"}`}>
              {hack.title}
            </p>
          </div>

          {/* Chevron */}
          <ChevronDown
            size={16}
            className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* ── Expanded body ── */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? "600px" : "0px" }}>

        <div className="px-4 pb-4 pt-1 ml-1">
          {/* Divider */}
          <div className="h-px bg-slate-100 mb-4" />

          {/* Hack title */}
          <p className={`text-[15px] font-extrabold mb-2 ${s.title}`}>{hack.title}</p>

          {/* Hack body */}
          <p className="text-[13px] text-slate-700 leading-relaxed mb-4">{hack.hack}</p>

          {/* Why it works */}
          <div className={`rounded-xl border p-3 mb-4 ${s.well}`}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
              💡 Why it works
            </p>
            <p className="text-[12px] text-slate-600 leading-relaxed">{hack.why}</p>
          </div>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 active:scale-95 transition-all">
            <Share2 size={11} />
            {copied ? "Copied ✓" : "Share this hack"}
          </button>
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
  const [openCards, setOpenCards] = useState(new Set());
  const [countdown, setCountdown] = useState(timeUntilMidnight());

  // Refresh countdown every minute
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

  const toggle = (idx) => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Sub-header */}
      <div className="px-4 pt-3 pb-3 bg-white border-b border-slate-100 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-bold text-slate-800">Life Hacks</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{todayLabel()}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 leading-snug">New hacks in</p>
            <p className="text-[12px] font-bold text-teal-600">{countdown}</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
          Tap any card to reveal today's hack for that area.
        </p>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4 space-y-3">
        {loading ? (
          Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} />)
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <span className="text-4xl mb-3">😔</span>
            <p className="text-sm font-semibold text-slate-600 mb-1">Couldn't load today's hacks</p>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : (
          hacks?.map((hack, idx) => (
            <HackCard
              key={hack.area}
              hack={hack}
              isOpen={openCards.has(idx)}
              onToggle={() => toggle(idx)}
            />
          ))
        )}

        {!loading && !error && (
          <p className="text-center text-[10px] text-slate-300 pt-2 pb-4">
            Fresh hacks every day · Tap to expand · Share with friends
          </p>
        )}
      </div>
    </div>
  );
}
