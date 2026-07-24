// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// HaveYouTried.jsx — the "Have you tried?" tab: three small real-life kindness
// prompts a day (one from your focus areas, one rotating, one self-kindness).
// Complete = tap (strike-through + soft chime). "Try another" swaps a prompt with
// no penalty — an unfinished list must never feel like failure.
//
// v2-preview note: state lives in localStorage (per-device). Firestore wiring
// (users/{uid}/haveYouTried) lands when Phase 1 ships for real, with a rules update.

import React, { useMemo, useState } from "react";
import { RefreshCw, Check } from "lucide-react";
import { HYT_AREAS, pickDaily, todayKey } from "./hytPrompts";
import { playCheckIn } from "./sounds";

const FOCUS_KEY = "seen_hyt_focus";
const stateKey = (day) => `seen_hyt_state_${day}`;

const loadJSON = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

// ── first-open focus picker ──────────────────────────────────────────────────
function FocusPicker({ onDone }) {
  const [chosen, setChosen] = useState([]);
  const toggle = (id) =>
    setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev));
  const areas = HYT_AREAS.filter((a) => a.id !== "self"); // self-kindness is always included daily

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h2 className="text-lg font-bold text-slate-800">Where would you like to practise kindness?</h2>
      <p className="mt-1 text-sm text-slate-500 leading-relaxed">
        Pick <strong>3–5 areas</strong> of your life. Each day you'll get three tiny, real-life
        suggestions — one from your areas, one surprise, and one just for you.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {areas.map((a) => {
          const on = chosen.includes(a.id);
          return (
            <button key={a.id} onClick={() => toggle(a.id)}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                on ? "border-teal-400 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600"
              }`}>
              <span className="text-base">{a.emoji}</span>
              <span className="min-w-0 truncate">{a.label}</span>
              {on && <Check size={14} className="ml-auto flex-shrink-0" />}
            </button>
          );
        })}
      </div>
      <button
        disabled={chosen.length < 3}
        onClick={() => onDone(chosen)}
        className="mt-5 w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-40">
        {chosen.length < 3 ? `Pick ${3 - chosen.length} more` : "Start my daily three ✨"}
      </button>
    </div>
  );
}

// ── a single daily prompt card ───────────────────────────────────────────────
function PromptCard({ item, done, onToggle, onSwap }) {
  return (
    <div className={`rounded-2xl border bg-white px-4 py-3.5 transition-all ${done ? "border-teal-200" : "border-slate-200"}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm">{item.emoji}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</span>
        {!done && (
          <button onClick={onSwap} title="Try another"
            className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors">
            <RefreshCw size={11} /> try another
          </button>
        )}
      </div>
      <button onClick={onToggle} className="flex w-full items-start gap-3 text-left group">
        <span className={`mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border-2 transition-all ${
          done ? "border-teal-500 bg-teal-500 text-white" : "border-slate-300 text-transparent group-hover:border-teal-400"
        }`}>
          <Check size={14} strokeWidth={3} />
        </span>
        <span className={`text-[15px] leading-snug transition-all ${
          done ? "text-slate-400 line-through decoration-teal-500/60" : "text-slate-800 font-medium"
        }`}>
          {item.text}
        </span>
      </button>
    </div>
  );
}

// ── the tab ──────────────────────────────────────────────────────────────────
export default function HaveYouTried({ currentUser }) {
  const uid = currentUser?.uid ?? "anon";
  const day = todayKey();
  const [focus, setFocus] = useState(() => loadJSON(FOCUS_KEY, null));
  const [state, setState] = useState(() => loadJSON(stateKey(day), { done: {}, swaps: {} }));

  const items = useMemo(
    () => pickDaily({ uid, focusIds: focus ?? [], swaps: state.swaps }),
    [uid, focus, state.swaps, day]
  );

  if (!focus) {
    return (
      <main className="flex-1 overflow-y-auto bg-slate-50/60">
        <FocusPicker onDone={(chosen) => { saveJSON(FOCUS_KEY, chosen); setFocus(chosen); }} />
      </main>
    );
  }

  const update = (next) => { setState(next); saveJSON(stateKey(day), next); };
  const toggle = (slot) => {
    const nowDone = !state.done[slot];
    if (nowDone) { try { playCheckIn(); } catch { /* ignore */ } }
    update({ ...state, done: { ...state.done, [slot]: nowDone } });
  };
  const swap = (slot) => update({ ...state, swaps: { ...state.swaps, [slot]: (state.swaps[slot] ?? 0) + 1 } });

  const doneCount = items.filter((i) => state.done[i.slot]).length;
  const allDone = doneCount === 3;

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4">
      <div className="mx-auto w-full max-w-md space-y-3">
        <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">🌱 Today's three</h2>
          <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">
            Tiny acts of real-life kindness. Do what feels right — swap or skip freely; there's no
            streak to break and no score to keep.
          </p>
        </div>

        {items.map((item) => (
          <PromptCard
            key={item.slot}
            item={item}
            done={Boolean(state.done[item.slot])}
            onToggle={() => toggle(item.slot)}
            onSwap={() => swap(item.slot)}
          />
        ))}

        {allDone ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-center">
            <p className="text-sm font-bold text-amber-700">You showed up for kindness today 🌅</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Fresh suggestions arrive tomorrow.</p>
          </div>
        ) : (
          <p className="text-center text-[11px] text-slate-400 pt-1">
            {doneCount === 0 ? "Whenever you're ready — one is plenty." : `${doneCount} of 3 — lovely.`}
          </p>
        )}

        <button
          onClick={() => { try { localStorage.removeItem(FOCUS_KEY); } catch { /* ignore */ } setFocus(null); }}
          className="mx-auto block pt-2 text-[11px] font-semibold text-slate-400 hover:text-teal-600 transition-colors">
          Change my focus areas
        </button>
      </div>
    </main>
  );
}
