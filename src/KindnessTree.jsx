// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// KindnessTree.jsx — the personal-growth centrepiece (v2). Kind actions "water" a tree
// that grows through many stages (up to 10M points). Balance = real spark balance + local
// preview points. The growth is an animated inline SVG: soil → seed → stem → leaves →
// blossom, with a watering animation when points are earned.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Droplets } from "lucide-react";
import { getPoints } from "./points";

export const TREE_STAGES = [
  { min: 0,          name: "Seed",          blurb: "Every forest starts exactly here." },
  { min: 200,        name: "Sprouting",     blurb: "Something is stirring beneath the soil." },
  { min: 600,        name: "Sprout",        blurb: "First green — your kindness broke the surface." },
  { min: 1500,       name: "Seedling",      blurb: "Small, steady, and quietly growing." },
  { min: 3500,       name: "Sapling",       blurb: "Standing a little taller each day." },
  { min: 7000,       name: "Rooted",        blurb: "Roots deep enough to hold firm." },
  { min: 15000,      name: "Young tree",    blurb: "Strong enough to give a little shade." },
  { min: 30000,      name: "Leafing",       blurb: "Leaves unfurling, one by one." },
  { min: 60000,      name: "In leaf",       blurb: "Full and green — people notice." },
  { min: 120000,     name: "Budding",       blurb: "The first buds are forming." },
  { min: 250000,     name: "First blossom", blurb: "Your kindness is beginning to flower." },
  { min: 500000,     name: "Blooming",      blurb: "In full, glorious bloom." },
  { min: 1000000,    name: "Full bloom",    blurb: "A million drops of kindness." },
  { min: 2000000,    name: "Flourishing",   blurb: "Thriving, and giving back to the world." },
  { min: 3500000,    name: "Grand tree",    blurb: "A landmark of kindness." },
  { min: 6000000,    name: "Ancient tree",  blurb: "Weathered, wise, and wonderful." },
  { min: 10000000,   name: "Tree of Life",  blurb: "A tree others rest beneath. 🌍" },
];

export function treeStageFor(balance) {
  return TREE_STAGES.reduce((s, t) => (balance >= t.min ? t : s), TREE_STAGES[0]);
}

// ── the animated SVG growth scene ─────────────────────────────────────────────
export function TreeScene({ stageIdx = 0, watering = false, size = 200 }) {
  const t = Math.max(0, Math.min(1, stageIdx / (TREE_STAGES.length - 1))); // 0..1 growth
  const stemH = 8 + t * 96;            // stem/trunk height
  const stemTopY = 178 - stemH;        // top of trunk
  const canopyR = t < 0.28 ? 0 : 8 + (t - 0.28) * 78;
  const showLeaves = stageIdx >= 2 && stageIdx < 7;
  const showCanopy = stageIdx >= 6;
  const showBlossom = stageIdx >= 10;
  const trunkW = 3 + t * 9;

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={watering ? "" : "seen-tree-sway"} aria-hidden="true">
      {/* soil mound */}
      <ellipse cx="100" cy="182" rx="52" ry="12" fill="#8b5e34" />
      <ellipse cx="100" cy="180" rx="52" ry="9" fill="#a06a3c" />

      {/* seed (early) */}
      {stageIdx <= 1 && <ellipse cx="100" cy="176" rx="7" ry="9" fill="#6b4423" style={{ transformOrigin: "100px 176px", animation: stageIdx === 1 ? "seenSeedCrack 1.6s ease-in-out infinite" : "none" }} />}

      {/* trunk / stem */}
      {stageIdx >= 1 && (
        <rect x={100 - trunkW / 2} y={stemTopY} width={trunkW} height={stemH} rx={trunkW / 2}
          fill={stageIdx >= 6 ? "#7a5230" : "#3f9d4f"} style={{ transition: "all 900ms cubic-bezier(0.34,1.2,0.64,1)" }} />
      )}

      {/* young leaves along the stem */}
      {showLeaves && [0.4, 0.68].map((f, i) => (
        <g key={i} style={{ transformOrigin: `100px ${stemTopY + stemH * f}px`, animation: "seenLeafPop 700ms ease both", animationDelay: `${i * 120}ms` }}>
          <ellipse cx={100 - 10} cy={stemTopY + stemH * f} rx="11" ry="6" fill="#4caf50" transform={`rotate(-28 ${100 - 10} ${stemTopY + stemH * f})`} />
          <ellipse cx={100 + 10} cy={stemTopY + stemH * f - 6} rx="11" ry="6" fill="#43a047" transform={`rotate(28 ${100 + 10} ${stemTopY + stemH * f - 6})`} />
        </g>
      ))}

      {/* canopy for trees */}
      {showCanopy && (
        <g style={{ transformOrigin: `100px ${stemTopY}px`, transition: "all 900ms cubic-bezier(0.34,1.2,0.64,1)" }}>
          <circle cx="100" cy={stemTopY} r={canopyR} fill="#3f9d4f" />
          <circle cx={100 - canopyR * 0.55} cy={stemTopY + canopyR * 0.15} r={canopyR * 0.7} fill="#4caf50" />
          <circle cx={100 + canopyR * 0.55} cy={stemTopY + canopyR * 0.1} r={canopyR * 0.72} fill="#43a047" />
          <circle cx="100" cy={stemTopY - canopyR * 0.4} r={canopyR * 0.7} fill="#4caf50" />
        </g>
      )}

      {/* blossoms */}
      {showBlossom && Array.from({ length: 7 }).map((_, i) => {
        const ang = (i / 7) * Math.PI * 2;
        const bx = 100 + Math.cos(ang) * canopyR * 0.7;
        const by = stemTopY + Math.sin(ang) * canopyR * 0.7;
        return <circle key={i} cx={bx} cy={by} r={3.4} fill={i % 2 ? "#f9a8d4" : "#fbcfe8"}
          style={{ animation: "seenLeafPop 600ms ease both", animationDelay: `${i * 80}ms` }} />;
      })}

      {/* watering — droplets + a pouring stream */}
      {watering && (
        <g>
          <text x="150" y="34" fontSize="26" style={{ transformOrigin: "150px 34px", animation: "seenWaterTilt 2s ease-in-out infinite" }}>💧</text>
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={92 + i * 6} cy="40" r="2.5" fill="#38bdf8"
              style={{ animation: `seenWaterDrop 1.1s ease-in ${i * 0.22}s infinite` }} />
          ))}
        </g>
      )}
    </svg>
  );
}

export default function KindnessTreePanel({ sparkBalance = 0, darkMode = false, onClose, autoWater = false }) {
  const [localPts, setLocalPts] = useState(() => getPoints());
  const [watering, setWatering] = useState(autoWater);
  useEffect(() => {
    const onPts = () => { setLocalPts(getPoints()); setWatering(true); setTimeout(() => setWatering(false), 2600); };
    window.addEventListener("seen-points", onPts);
    return () => window.removeEventListener("seen-points", onPts);
  }, []);
  useEffect(() => {
    if (!autoWater) return;
    const t = setTimeout(() => setWatering(false), 4200);
    return () => clearTimeout(t);
  }, [autoWater]);

  const balance = sparkBalance + localPts;
  const stage = treeStageFor(balance);
  const stageIdx = TREE_STAGES.indexOf(stage);
  const next = TREE_STAGES[stageIdx + 1] ?? null;
  const pct = next ? Math.max(0, Math.min(100, Math.round(((balance - stage.min) / (next.min - stage.min)) * 100))) : 100;

  return createPortal(
    <div data-portal {...(darkMode ? { "data-dark-shell": "" } : {})}
      className="fixed inset-0 z-[250] flex flex-col" style={{ background: darkMode ? "#0e1219" : "#fff" }}>
      <div className="seen-overlay-header flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0 bg-white">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-1">🌳 Your Kindness Tree</h2>
        <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="rounded-3xl border border-teal-100 bg-gradient-to-b from-sky-50 to-teal-50 px-4 pt-4 pb-5 text-center overflow-hidden">
          <div className="mx-auto" style={{ width: 200, height: 200 }}><TreeScene stageIdx={stageIdx} watering={watering} /></div>
          <p className="mt-1 text-lg font-bold text-slate-800">{stage.name}</p>
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
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-start gap-3">
          <span className="mt-0.5 text-teal-500"><Droplets size={18} /></span>
          <p className="text-[12px] text-slate-600 leading-relaxed">
            Every kind action — a message, a real-life kindness, a reflection, a heart —
            <strong className="text-slate-800"> waters your tree</strong>. Watch it grow.
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Growth stages</p>
          <div className="space-y-1">
            {TREE_STAGES.map((s) => {
              const achieved = balance >= s.min;
              const current = s === stage;
              return (
                <div key={s.name}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${current ? "border-teal-300 bg-teal-50" : achieved ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"}`}>
                  <span className="text-xs w-6 text-center" style={{ opacity: achieved ? 1 : 0.4 }}>{achieved ? "🌿" : "•"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${achieved ? "text-slate-800" : "text-slate-400"}`}>
                      {s.name}{current && <span className="ml-1.5 text-[10px] font-bold text-teal-700">· you are here</span>}
                    </p>
                    <p className="text-[10px] text-slate-400">{s.min.toLocaleString()}+ drops</p>
                  </div>
                  {achieved && !current && <span className="text-teal-500 text-xs">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
        <p className="pb-6 text-center text-[10px] text-slate-400">One day, a fully grown tree may plant a real one. 🌍</p>
      </div>
    </div>,
    document.body
  );
}
