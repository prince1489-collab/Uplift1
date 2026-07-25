// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// MySeenStory.jsx — the "My Journey" tab (v2). The centrepiece is the animated
// Kindness Tree; the whole page has gentle motion (staggered fade-in, idle tree sway,
// count-up metrics). Only four metrics are shown: Countries reached, Ripple effect,
// Tried in real life, Reflections. Tree balance = real sparkBalance + device-local
// preview points, so demo actions visibly grow the hero tree.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { collection, getDocs } from "firebase/firestore";
import { Info, X } from "lucide-react";
import { treeStageFor, TREE_STAGES, TreeScene } from "./KindnessTree";
import { getPoints } from "./points";
import { playLevelUp } from "./sounds";
import { useReactionData, useRippleData, useOnwardReach } from "./MyImpact";

const STAGE_SEEN_KEY = "seen_v2_tree_stage_seen"; // highest stage already celebrated
const prefersReducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

const PERIODS = [
  { id: "week",  label: "This week" },
  { id: "month", label: "This month" },
  { id: "all",   label: "All time" },
];

// Count completed "Have you tried?" items across this device (localStorage).
function hytCompletedCount() {
  let n = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("seen_hyt_state_")) {
        const done = JSON.parse(localStorage.getItem(k) || "{}")?.done || {};
        n += Object.values(done).filter(Boolean).length;
      }
    }
  } catch { /* ignore */ }
  return n;
}

// Small count-up hook — rolls a number from 0 → target on mount / change.
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const to = Math.max(0, Math.round(Number(target) || 0));
    if (to === 0) { setVal(0); return; }
    let start = 0;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(Math.round(to * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

// ── what's actually behind each number ───────────────────────────────────────
const METRIC_INFO = [
  { emoji: "🌍", label: "Countries reached",
    what: "How many different countries the people who hearted your messages were in.",
    how: "Counted from the reactions on messages you sent, one per distinct country. It follows the period you've picked above." },
  { emoji: "💫", label: "Ripple effect",
    what: "Kindness that travelled beyond you.",
    how: "Two things added together: people who reacted to one of your messages and then went on to send their own, plus the hearts those onward messages received. All-time, not per period." },
  { emoji: "🤝", label: "Tried in real life",
    what: "Practice suggestions you've ticked off.",
    how: "Every prompt you've marked done in the Practice tab. Stored on this device, so it starts fresh on a new phone. All-time." },
  { emoji: "🪞", label: "Reflections",
    what: "Entries in your private journal.",
    how: "The total number of reflections you've written in the Reflect tab. Only you can ever read them. All-time." },
];

function MetricsInfoSheet({ onClose }) {
  return createPortal(
    <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Where these numbers come from</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-8 pt-1 space-y-3">
          {METRIC_INFO.map((m) => (
            <div key={m.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-sm font-bold text-slate-800">{m.emoji} {m.label}</p>
              <p className="mt-0.5 text-[13px] text-slate-600 leading-relaxed">{m.what}</p>
              <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">{m.how}</p>
            </div>
          ))}
          <p className="text-center text-[11px] text-slate-400 leading-relaxed pt-1">
            These are a mirror, never a score. Nobody else sees them, and there's nothing to keep up.
          </p>
          <button onClick={onClose}
            className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 transition-colors">
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── milestone celebration — petals + the new stage name drawing in ───────────
function MilestoneOverlay({ stage, onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 4200);
    return () => clearTimeout(t);
  }, [onDone]);
  const petals = ["🌸", "🌼", "🍃", "🌺", "🍂", "🌸", "🍃", "🌼"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl" aria-hidden="true">
      {/* warm glow pulses twice around the whole card */}
      <div className="absolute inset-0 rounded-3xl" style={{ animation: "seenMilestoneGlow 2.4s ease-in-out 2" }} />
      {petals.map((p, i) => (
        <span key={i} style={{
          position: "absolute", top: -14, left: `${6 + i * 12}%`, fontSize: 15 + (i % 3) * 4,
          "--spin": `${(i % 2 ? 1 : -1) * (240 + i * 40)}deg`,
          animation: `seenPetalFall ${2.6 + (i % 4) * 0.5}s cubic-bezier(0.35,0.6,0.5,1) ${i * 0.16}s both`,
        }}>{p}</span>
      ))}
      <div className="absolute inset-x-0 bottom-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600"
          style={{ animation: "seenFadeUp 600ms ease 500ms both" }}>New stage reached</p>
        <p className="mt-1 text-xl font-extrabold text-slate-800"
          style={{ animation: "seenStageReveal 1100ms cubic-bezier(0.2,0.9,0.3,1) 700ms both" }}>
          {stage.name}
        </p>
      </div>
    </div>
  );
}

function MetricTile({ emoji, value, label, delay = 0 }) {
  const shown = useCountUp(value);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4 text-center"
      style={{ animation: "seenFadeUp 500ms ease both", animationDelay: `${delay}ms` }}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-2xl font-extrabold text-slate-800 tabular-nums leading-none">{shown.toLocaleString()}</div>
      <div className="text-[11px] text-slate-500 mt-1.5 leading-tight">{label}</div>
    </div>
  );
}

export default function MySeenStory({ db, currentUser, liveStats, profile, sparkBalance = 0, darkMode = false, onOpenTree }) {
  const [period, setPeriod] = useState("week");
  const [journalCount, setJournalCount] = useState(null);
  const [localPts, setLocalPts] = useState(() => getPoints());
  const [watering, setWatering] = useState(false);
  const [showMetricInfo, setShowMetricInfo] = useState(false);
  const hytTried = useMemo(() => hytCompletedCount(), []);

  // Live points → grow + water the hero tree.
  useEffect(() => {
    const onPts = () => { setLocalPts(getPoints()); setWatering(true); setTimeout(() => setWatering(false), 2600); };
    window.addEventListener("seen-points", onPts);
    return () => window.removeEventListener("seen-points", onPts);
  }, []);

  useEffect(() => {
    if (!db || !currentUser?.uid) return;
    let alive = true;
    getDocs(collection(db, "users", currentUser.uid, "journal"))
      .then((snap) => { if (alive) setJournalCount(snap.size); })
      .catch(() => { if (alive) setJournalCount(0); });
    return () => { alive = false; };
  }, [db, currentUser?.uid]);

  // Real impact hooks (same as MyImpact): countries reached + ripple effect.
  const reactPeriod = period === "week" ? "7d" : "30d";
  const { data: reactData } = useReactionData(db, currentUser, reactPeriod);
  const { rippleCount, ripples } = useRippleData(db, currentUser);
  const onwardReach = useOnwardReach(db, currentUser, ripples);

  // Countries reached — prefer live reaction countries, fall back to liveStats.
  const reactCountries = reactData ? Object.keys(reactData.reactionByCountry || {}).length : 0;
  const statCountries = period === "week" ? Number(liveStats?.countries7d ?? 0) : Number(liveStats?.countries30d ?? 0);
  const countries = Math.max(reactCountries, statCountries);
  const ripple = rippleCount + onwardReach;

  const balance = sparkBalance + localPts;
  const stage = treeStageFor(balance);
  const stageIdx = TREE_STAGES.indexOf(stage);
  const next = TREE_STAGES[stageIdx + 1] ?? null;
  const pct = next ? Math.max(0, Math.min(100, Math.round(((balance - stage.min) / (next.min - stage.min)) * 100))) : 100;
  const first = (profile?.fullName || "").trim().split(" ")[0] || "you";

  // ── Grow-from-seed replay ──────────────────────────────────────────────────
  // On open, walk the tree from bare soil up to where it actually is, so the whole
  // journey is something you watch rather than a state you arrive at. `replay` is a
  // continuous 0..1 growth value; null hands control back to the stage-driven view.
  const [replay, setReplay] = useState(() => (prefersReducedMotion() ? null : 0));
  const replayRaf = useRef(0);
  const targetGrowth = stageIdx / (TREE_STAGES.length - 1);
  const replayDoneRef = useRef(false);
  useEffect(() => {
    if (replayDoneRef.current || prefersReducedMotion()) { setReplay(null); return; }
    replayDoneRef.current = true;
    const DURATION = 3000;
    let start = 0;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / DURATION);
      // easeOutCubic, with a beat of stillness on the seed before it breaks
      const eased = p < 0.12 ? 0 : 1 - Math.pow(1 - (p - 0.12) / 0.88, 3);
      setReplay(eased * targetGrowth);
      if (p < 1) replayRaf.current = requestAnimationFrame(step);
      else setReplay(null); // hand back to the live stage view
    };
    replayRaf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(replayRaf.current);
  }, [targetGrowth]);

  // ── Milestone moment ───────────────────────────────────────────────────────
  // Fires once per stage, the first time you reach it — never on every visit.
  const [milestone, setMilestone] = useState(null);
  useEffect(() => {
    let seen = -1;
    try { seen = Number(localStorage.getItem(STAGE_SEEN_KEY) ?? -1); } catch { /* ignore */ }
    if (stageIdx <= seen) return;
    try { localStorage.setItem(STAGE_SEEN_KEY, String(stageIdx)); } catch { /* ignore */ }
    if (seen < 0) return; // first ever visit — record where they are, don't celebrate
    // Let the growth replay finish before celebrating on top of it.
    const t = setTimeout(() => {
      setMilestone(TREE_STAGES[stageIdx]);
      try { playLevelUp(); } catch { /* ignore */ }
    }, prefersReducedMotion() ? 200 : 3100);
    return () => clearTimeout(t);
  }, [stageIdx]);

  return (
    <main {...(darkMode ? { "data-dark-shell": "" } : {})} className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4"
      style={{ background: darkMode ? "#0e1219" : undefined }}>
      <div className="mx-auto w-full max-w-md space-y-4">
        {/* Period segments */}
        <div className="flex gap-1 rounded-full bg-slate-100 p-1" style={{ animation: "seenFadeUp 400ms ease both" }}>
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`flex-1 rounded-full py-1.5 text-[12px] font-semibold transition-colors ${
                period === p.id ? "bg-white text-teal-600 shadow-sm" : "text-slate-500"
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Hero — the animated Kindness Tree (centrepiece) */}
        <button onClick={onOpenTree}
          className="relative block w-full rounded-3xl border border-teal-100 bg-gradient-to-b from-sky-50 to-teal-50 px-4 pt-5 pb-6 text-center overflow-hidden active:scale-[0.99] transition-transform"
          style={{ animation: "seenFadeUp 600ms ease both", animationDelay: "80ms" }}>
          <div className="mx-auto" style={{ width: 210, height: 210 }}>
            <TreeScene stageIdx={stageIdx} growth={replay} watering={watering} size={210} ambient />
          </div>
          {milestone && <MilestoneOverlay stage={milestone} onDone={() => setMilestone(null)} />}
          <p className="mt-1 text-xl font-extrabold text-slate-800">{stage.name}</p>
          <p className="text-[12px] text-slate-500 mt-0.5">{stage.blurb}</p>
          <div className="mt-4 mx-auto max-w-xs">
            {next ? (
              <>
                <div className="h-2 rounded-full bg-white/70 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {balance.toLocaleString()} drops · {Math.max(0, next.min - balance).toLocaleString()} more until <strong>{next.name}</strong>
                </p>
              </>
            ) : (
              <p className="text-[11px] font-semibold text-teal-700">Fully grown — {balance.toLocaleString()} drops of kindness 🌸</p>
            )}
          </div>
          <span className="mt-3 inline-block text-[11px] font-semibold text-teal-600">Tap to tend your tree →</span>
        </button>

        {/* Reflective one-liner */}
        <p className="text-center text-[13px] text-slate-500 leading-relaxed px-2"
          style={{ animation: "seenFadeUp 500ms ease both", animationDelay: "160ms" }}>
          Every kind act you make waters this tree, {first}. Here's the reach of your kindness.
        </p>

        {/* The four metrics */}
        <div className="flex items-center gap-2 px-1" style={{ animation: "seenFadeUp 500ms ease both", animationDelay: "180ms" }}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex-1">The reach of your kindness</p>
          <button onClick={() => setShowMetricInfo(true)} aria-label="Where these numbers come from"
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-teal-600 hover:border-teal-200 active:scale-90 transition-all">
            <Info size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <MetricTile emoji="🌍" value={countries} label="Countries reached" delay={200} />
          <MetricTile emoji="💫" value={ripple} label="Ripple effect" delay={280} />
          <MetricTile emoji="🤝" value={hytTried} label="Tried in real life" delay={360} />
          <MetricTile emoji="🪞" value={journalCount ?? 0} label="Reflections" delay={440} />
        </div>

        <p className="text-center text-[10px] text-slate-400 leading-relaxed pb-4"
          style={{ animation: "seenFadeUp 500ms ease both", animationDelay: "520ms" }}>
          A gentle mirror of your journey — never a score.
        </p>
      </div>

      {showMetricInfo && <MetricsInfoSheet onClose={() => setShowMetricInfo(false)} />}
    </main>
  );
}
