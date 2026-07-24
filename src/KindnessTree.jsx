// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// KindnessTree.jsx — the personal-growth visual that replaces the sparks meter (v2).
// Kind actions "water" a tree that grows through stages; the stage IS the level.
// Balance is the existing spark balance 1:1 — pure re-theme, no data change.

import React from "react";
import { createPortal } from "react-dom";
import { X, Droplets } from "lucide-react";

export const TREE_STAGES = [
  { min: 0,      name: "Seed",       scene: "🌰", ground: "🟤", blurb: "Every forest starts exactly here." },
  { min: 50,     name: "Sprout",     scene: "🌱", ground: "🟫", blurb: "First green — your kindness is taking root." },
  { min: 150,    name: "Seedling",   scene: "🌿", ground: "🟫", blurb: "Small, steady, and quietly growing." },
  { min: 400,    name: "Sapling",    scene: "🪴", ground: "🟫", blurb: "Standing on its own now." },
  { min: 1000,   name: "Young tree", scene: "🌳", ground: "🟩", blurb: "Strong enough to give a little shade." },
  { min: 2500,   name: "Tree in leaf", scene: "🌳", ground: "🟩", blurb: "Full and green — people notice." },
  { min: 6000,   name: "Blossom",    scene: "🌸", ground: "🟩", blurb: "Your kindness is flowering." },
  { min: 15000,  name: "Full bloom", scene: "🌸", ground: "🌼", blurb: "A tree others rest beneath." },
];

export function treeStageFor(balance) {
  return TREE_STAGES.reduce((s, t) => (balance >= t.min ? t : s), TREE_STAGES[0]);
}

export default function KindnessTreePanel({ sparkBalance = 0, darkMode = false, onClose }) {
  const stage = treeStageFor(sparkBalance);
  const stageIdx = TREE_STAGES.indexOf(stage);
  const next = TREE_STAGES[stageIdx + 1] ?? null;
  const pct = next
    ? Math.max(0, Math.min(100, Math.round(((sparkBalance - stage.min) / (next.min - stage.min)) * 100)))
    : 100;
  // The tree grows visually with the stage
  const sceneSize = 44 + stageIdx * 10;

  return createPortal(
    <div data-portal {...(darkMode ? { "data-dark-shell": "" } : {})}
      className="fixed inset-0 z-[250] flex flex-col"
      style={{ background: darkMode ? "#0e1219" : "#fff" }}>
      <div className="seen-overlay-header flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0 bg-white">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-1">🌳 Your Kindness Tree</h2>
        <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* The tree scene */}
        <div className="rounded-3xl border border-teal-100 bg-teal-50 px-4 pt-8 pb-6 text-center overflow-hidden">
          <div className="seen-heartbeat inline-block" style={{ fontSize: `${sceneSize}px`, lineHeight: 1.1 }} aria-hidden="true">
            {stage.scene}
          </div>
          <p className="mt-3 text-lg font-bold text-slate-800">{stage.name}</p>
          <p className="text-[12px] text-slate-500 mt-0.5">{stage.blurb}</p>

          {/* progress to next stage */}
          <div className="mt-4 mx-auto max-w-xs">
            {next ? (
              <>
                <div className="h-2 rounded-full bg-white/70 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {sparkBalance.toLocaleString()} drops · {Math.max(0, next.min - sparkBalance).toLocaleString()} more until <strong>{next.name}</strong>
                </p>
              </>
            ) : (
              <p className="text-[11px] font-semibold text-teal-700">Fully grown — {sparkBalance.toLocaleString()} drops of kindness 🌸</p>
            )}
          </div>
        </div>

        {/* how it grows */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-start gap-3">
          <span className="mt-0.5 text-teal-500"><Droplets size={18} /></span>
          <p className="text-[12px] text-slate-600 leading-relaxed">
            Every kind action — sending a greeting, trying a daily kindness, writing a reflection,
            hearting someone — <strong className="text-slate-800">waters your tree</strong>. It only ever grows.
          </p>
        </div>

        {/* stage ladder */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Growth stages</p>
          <div className="space-y-1">
            {TREE_STAGES.map((t, i) => {
              const achieved = sparkBalance >= t.min;
              const current = t === stage;
              return (
                <div key={t.name}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${
                    current ? "border-teal-300 bg-teal-50" : achieved ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"
                  }`}>
                  <span className="text-lg w-7 text-center" style={{ opacity: achieved ? 1 : 0.35 }}>{t.scene}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${achieved ? "text-slate-800" : "text-slate-400"}`}>
                      {t.name}{current && <span className="ml-1.5 text-[10px] font-bold text-teal-700">· you are here</span>}
                    </p>
                    <p className="text-[10px] text-slate-400">{t.min.toLocaleString()}+ drops</p>
                  </div>
                  {achieved && !current && <span className="text-teal-500 text-xs">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
        <p className="pb-6 text-center text-[10px] text-slate-400">
          One day, a fully grown tree may plant a real one. 🌍
        </p>
      </div>
    </div>,
    document.body
  );
}
