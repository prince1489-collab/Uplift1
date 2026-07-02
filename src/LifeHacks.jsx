// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// LifeHacks.jsx — Daily life hack cards with expand + sparkle flip reveal.

import React, { useEffect, useState } from "react";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { HACK_LIBRARY } from "./LifeHackLibrary.js";
import { FINANCE_LOCAL, COUNTRY_REGION } from "./FinanceLocalTips.js";

// Return a localised Finance tip array for the user's region:
// - UK users see all tips (including region:"UK" ones)
// - other regions: strip UK-only tips, append their local supplement + the global fallback set
function localiseFinanceTips(tips, userRegion) {
  if (userRegion === "UK") return tips;
  const base = tips.filter((t) => !t.region || t.region === userRegion);
  const local = FINANCE_LOCAL[userRegion] ?? [];
  const global = FINANCE_LOCAL.GLOBAL ?? [];
  return [...base, ...local, ...global];
}

// Approximate GBP → local currency conversion for tip body text.
// Handles single amounts (£10), ranges (£30–60), and thousands (£1,000).
const CURRENCY_CONVERT = {
  US: { symbol: "$",    rate: 1.27 },
  AU: { symbol: "AU$",  rate: 1.95 },
  CA: { symbol: "CA$",  rate: 1.73 },
  IN: { symbol: "₹",   rate: 106  },
  EU: { symbol: "€",   rate: 1.18 },
  CH: { symbol: "CHF ", rate: 1.13 },
  NZ: { symbol: "NZ$",  rate: 2.15 },
  SG: { symbol: "S$",   rate: 1.71 },
  HK: { symbol: "HK$",  rate: 9.9  },
  JP: { symbol: "¥",   rate: 190  },
  KR: { symbol: "₩",   rate: 1700 },
  TW: { symbol: "NT$",  rate: 41   },
  IL: { symbol: "₪",   rate: 4.7  },
};

function localiseHackText(text, userRegion) {
  if (!text || userRegion === "UK" || !CURRENCY_CONVERT[userRegion]) return text;
  const { symbol, rate } = CURRENCY_CONVERT[userRegion];
  const cvt = (pounds) => {
    const v = Math.round(parseFloat(pounds.replace(/,/g, "")) * rate);
    if (v >= 10000) return symbol + Math.round(v / 1000) + "k";
    if (v >= 1000)  return symbol + (v / 1000).toFixed(1) + "k";
    return symbol + v;
  };
  // Ranges first: £30–60 → ₹3,180–₹6,360
  let out = text.replace(/£([\d,]+(?:\.\d+)?)([–—-])([\d,]+(?:\.\d+)?)/g,
    (_, a, sep, b) => `${cvt(a)}${sep}${cvt(b)}`);
  // Single amounts
  out = out.replace(/£([\d,]+(?:\.\d+)?)/g, (_, n) => cvt(n));
  return out;
}

// Area metadata (emoji + styles) — keyed by area name
const AREA_META = {
  Mind:               { emoji: "🧠" },
  Body:               { emoji: "💪" },
  Relationships:      { emoji: "❤️" },
  Work:               { emoji: "💼" },
  Finance:            { emoji: "💰" },
  Home:               { emoji: "🏡" },
  Digital:            { emoji: "📱" },
  "Weird & Wonderful":{ emoji: "🪄" },
};

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

// Returns the local calendar day number (increments at LOCAL midnight, not UTC).
function localDayNumber() {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

// Deterministic per-user offset so different users see different rotations.
function seedFromUid(uid) {
  if (!uid) return 0;
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return h % 10000;
}

// Local YYYY-MM-DD (matches localDayNumber's day boundary).
function localDateString() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
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

function SkeletonCard() {
  return <div className="rounded-2xl bg-slate-200 animate-pulse h-28" />;
}

// ── Compact hack card (single-column list — the hack itself is visible, no tap-to-reveal) ──

function CompactHackCard({ hack, onTap, userRegion }) {
  const s = AREA_STYLES[hack.area] || DEFAULT_STYLE;
  const localTitle = localiseHackText(hack.title, userRegion);
  const localHack  = localiseHackText(hack.hack,  userRegion);
  return (
    <button
      className="w-full text-left rounded-2xl bg-white border border-slate-100 shadow-sm px-3.5 py-3 select-none active:scale-[0.99] transition-transform duration-150"
      onClick={onTap}
      aria-label={`Open ${hack.area} life hack`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl text-[15px]"
          style={{ background: s.gradient }}>
          {hack.areaEmoji}
        </span>
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{hack.area}</span>
        <span className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold truncate max-w-[45%] ${s.badge}`}>
          {hack.subAreaEmoji} {hack.subArea}
        </span>
      </div>
      <p className={`text-[13px] font-extrabold leading-snug ${s.title}`}>{localTitle}</p>
      <p className="text-[12px] text-slate-600 leading-snug mt-0.5">{localHack}</p>
      <p className="text-[9px] text-slate-300 mt-1.5">Tap for why it works · vote · share</p>
    </button>
  );
}

// ── Expanded overlay card ─────────────────────────────────────────────────────

function ExpandedCard({ hack, onClose, db, currentUser, userRegion }) {
  const s = AREA_STYLES[hack.area] || DEFAULT_STYLE;
  const localTitle = localiseHackText(hack.title, userRegion);
  const localHack  = localiseHackText(hack.hack,  userRegion);
  const localWhy   = localiseHackText(hack.why,   userRegion);
  const [flipped, setFlipped]         = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const [votes, setVotes] = useState(null); // { up, down, voters: { uid: "up"|"down" } }
  const [shareCopied, setShareCopied] = useState(false);
  // Persist vote locally so highlight survives Firestore latency / rule issues
  const [localVote, setLocalVote] = useState(() => {
    if (!currentUser?.uid || !hack?.id) return null;
    try { return localStorage.getItem(`lhv_${hack.id}_${currentUser.uid}`) || null; } catch { return null; }
  });

  useEffect(() => {
    const t1 = setTimeout(() => { setFlipped(true); setShowSparkles(true); }, 280);
    const t2 = setTimeout(() => setShowSparkles(false), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Live usefulness votes — shared across all users
  useEffect(() => {
    if (!db || !hack?.id) return;
    return onSnapshot(doc(db, "hackVotes", String(hack.id)), (snap) => {
      setVotes(snap.exists() ? snap.data() : { up: 0, down: 0, voters: {} });
    }, () => {});
  }, [db, hack?.id]);

  // Prefer Firestore data; fall back to localStorage so button highlights immediately
  const myVote = votes?.voters?.[currentUser?.uid] ?? localVote;
  const totalVotes = (votes?.up ?? 0) + (votes?.down ?? 0);
  const upPct = totalVotes > 0 ? Math.round(((votes?.up ?? 0) / totalVotes) * 100) : null;

  const castVote = (vote) => {
    if (!currentUser || !hack?.id || myVote === vote) return;
    // Optimistic local highlight — shows immediately even before Firestore responds
    setLocalVote(vote);
    try { localStorage.setItem(`lhv_${hack.id}_${currentUser.uid}`, vote); } catch {}
    if (!db) return;
    const ref = doc(db, "hackVotes", String(hack.id));
    runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : { up: 0, down: 0, voters: {} };
      const voters = { ...(data.voters ?? {}) };
      const prev = voters[currentUser.uid];
      let up = data.up ?? 0, down = data.down ?? 0;
      if (prev === "up") up = Math.max(0, up - 1);
      if (prev === "down") down = Math.max(0, down - 1);
      if (vote === "up") up++; else down++;
      voters[currentUser.uid] = vote;
      tx.set(ref, { up, down, voters });
    }).catch(() => {});
  };

  const handleShare = async () => {
    const text = `💡 ${localTitle}\n\n${localHack}\n\nWhy it works: ${localWhy}\n\n— from Seen, daily kindness & life hacks → https://seenapp.app`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Life Hack: ${localTitle}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch (_) {} // user cancelled the share sheet — not an error
  };

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
                {localTitle}
              </p>

              <p className="text-sm text-slate-600 leading-relaxed flex-1">
                {localHack}
              </p>

              <div className={`rounded-2xl border p-3 flex-shrink-0 ${s.well}`}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  💡 Why it works
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">{localWhy}</p>
              </div>

              {/* Useful? vote + share row */}
              <div className="flex items-center justify-between gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">Useful?</span>
                  <button
                    onClick={() => castVote("up")}
                    aria-label="Thumbs up"
                    className={`rounded-full border px-2.5 py-1 text-sm transition-all active:scale-90 ${
                      myVote === "up"
                        ? "border-emerald-300 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white opacity-60 hover:opacity-100"
                    }`}>
                    👍
                  </button>
                  <button
                    onClick={() => castVote("down")}
                    aria-label="Thumbs down"
                    className={`rounded-full border px-2.5 py-1 text-sm transition-all active:scale-90 ${
                      myVote === "down"
                        ? "border-rose-300 bg-rose-50 shadow-sm"
                        : "border-slate-200 bg-white opacity-60 hover:opacity-100"
                    }`}>
                    👎
                  </button>
                  {upPct !== null && (
                    <span className="ml-1 text-[11px] font-bold text-emerald-600">
                      {upPct}% 👍
                    </span>
                  )}
                </div>
                <button
                  onClick={handleShare}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 transition-all active:scale-95 hover:border-teal-300 hover:text-teal-600">
                  {shareCopied ? "Copied! ✓" : "Share ↗"}
                </button>
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

export default function LifeHacks({ db, currentUser, profile }) {
  const userRegion = COUNTRY_REGION[profile?.country] ?? "GLOBAL";
  const [hacks, setHacks]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [activeHack, setActive]   = useState(null);
  const [countdown, setCountdown] = useState(timeUntilMidnight());

  useEffect(() => {
    const t = setInterval(() => setCountdown(timeUntilMidnight()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const today = localDateString();
    const build = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
    const todayKey = `lhacks5_${build}_${today}_${userRegion}`;

    // Fast path: serve today's cached selection if it exists.
    // The cache is optional — correctness never depends on it surviving.
    try {
      const cached = localStorage.getItem(todayKey);
      if (cached) {
        setHacks(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch (_) {}

    // Deterministic selection: index = (localDayNumber + userOffset) % categoryLength.
    // This advances exactly once per local calendar day and never resets even if
    // localStorage is evicted, cleared, or unavailable (iOS/Safari/private mode).
    const day = localDayNumber();
    const offset = seedFromUid(currentUser?.uid);
    const selected = Object.entries(HACK_LIBRARY).map(([area, tips]) => {
      // Finance tips are localised per user region; all other categories are global.
      const pool = area === "Finance" ? localiseFinanceTips(tips, userRegion) : tips;
      const idx = (((day + offset) % pool.length) + pool.length) % pool.length;
      return { ...pool[idx], area, areaEmoji: AREA_META[area]?.emoji ?? "✨" };
    });

    setHacks(selected);
    setLoading(false);

    // Cache today's selection for instant repaint on same-day reopens; prune stale keys.
    try {
      localStorage.setItem(todayKey, JSON.stringify(selected));
      Object.keys(localStorage)
        .filter((k) => k.startsWith("lhacks5_") && k !== todayKey)
        .forEach((k) => localStorage.removeItem(k));
      Object.keys(localStorage)
        .filter((k) => k.startsWith("lhacks4_") || k === "lhacks_history_v1")
        .forEach((k) => localStorage.removeItem(k));
    } catch (_) {}
  }, [currentUser?.uid, profile?.country]);

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

      {/* All of today's hacks in one scrollable column — content visible, no tap-to-reveal */}
      <div className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4">
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="space-y-2.5">
            {hacks?.map((hack) => (
              <CompactHackCard key={hack.area} hack={hack} onTap={() => setActive(hack)} userRegion={userRegion} />
            ))}
          </div>
        )}

        {!loading && (
          <p className="text-center text-[10px] text-slate-300 pt-4 pb-2">
            Fresh hacks every day at midnight
          </p>
        )}
      </div>

      {/* Expanded card overlay */}
      {activeHack && (
        <ExpandedCard hack={activeHack} onClose={() => setActive(null)} db={db} currentUser={currentUser} userRegion={userRegion} />
      )}
    </div>
  );
}
