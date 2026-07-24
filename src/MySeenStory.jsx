// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// MySeenStory.jsx — the "My Journey" tab (v2). The centrepiece is the animated
// Kindness Tree; the whole page has gentle motion (staggered fade-in, idle tree sway,
// count-up metrics). Only four metrics are shown: Countries reached, Ripple effect,
// Tried in real life, Reflections. Tree balance = real sparkBalance + device-local
// preview points, so demo actions visibly grow the hero tree.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { treeStageFor, TREE_STAGES, TreeScene } from "./KindnessTree";
import { getPoints } from "./points";
import { useReactionData, useRippleData, useOnwardReach } from "./MyImpact";

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
          className="block w-full rounded-3xl border border-teal-100 bg-gradient-to-b from-sky-50 to-teal-50 px-4 pt-5 pb-6 text-center overflow-hidden active:scale-[0.99] transition-transform"
          style={{ animation: "seenFadeUp 600ms ease both", animationDelay: "80ms" }}>
          <div className="mx-auto" style={{ width: 210, height: 210 }}>
            <TreeScene stageIdx={stageIdx} watering={watering} size={210} />
          </div>
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
    </main>
  );
}
