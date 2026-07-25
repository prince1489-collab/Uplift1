// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// HaveYouTried.jsx — the "Practice" tab: two small real-life prompts a day. One from
// the 14 areas of kindness (a different area each day), one self-care matched to your
// age band. Complete = tap (strike-through + soft chime). "Try another" swaps one
// prompt, once a day — an unfinished list must never feel like failure.
//
// v2-preview note: state lives in localStorage (per-device). Firestore wiring
// (users/{uid}/haveYouTried) lands when Phase 1 ships for real, with a rules update.

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Check, Info, X } from "lucide-react";
import { HYT_AREAS, pickDaily, todayKey, ageBandFor } from "./hytPrompts";
import { playCheckIn } from "./sounds";
import { awardPoints } from "./points";

// Turn a stored dob string ("January 5, 1990") into an age; null if unknown.
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
function ageFromDob(dob) {
  if (!dob) return null;
  const [m = "", d = "", y = ""] = String(dob).replace(",", "").split(" ");
  const mi = MONTHS.indexOf(m);
  const year = Number(y);
  if (mi < 0 || !year) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  const bd = new Date(now.getFullYear(), mi, Number(d) || 1);
  if (now < bd) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

const stateKey = (day) => `seen_hyt_state_${day}`;
const SLOTS = ["kindness", "self"];

const loadJSON = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

// ── "how does this work?" sheet ──────────────────────────────────────────────
function HowItWorksSheet({ onClose }) {
  const Line = ({ emoji, title, body }) => (
    <div className="flex gap-3">
      <span className="text-lg flex-shrink-0 leading-none mt-0.5">{emoji}</span>
      <p className="text-[13px] text-slate-600 leading-relaxed">
        <strong className="text-slate-800">{title}</strong> {body}
      </p>
    </div>
  );
  return createPortal(
    <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">🌱 How Practice works</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-8 pt-1 space-y-3.5">
          <Line emoji="✌️" title="Two ideas a day."
            body="Small, real-life things you can actually do today — not big gestures." />
          <Line emoji="🤝" title="The first is an act of kindness."
            body={`It comes from a different one of the ${HYT_AREAS.length} areas of life each day — work, home, friends, neighbours, nature and more — so you're never stuck in the same corner.`} />
          <Line emoji="🌤️" title="The second is for you."
            body="A bit of self-care, matched to your stage of life. Being kind to yourself counts too." />
          <Line emoji="🔄" title="Not feeling one? Try another."
            body="You can swap a suggestion once a day. After that, today's two stay put — fresh ones arrive tomorrow." />
          <Line emoji="✅" title="Tap to mark it done."
            body="That's it. Each one waters your Kindness Tree in My Journey." />
          <Line emoji="🕊️" title="Nothing to break."
            body="No streaks, no scores, no guilt. Doing one is plenty. Doing none is fine too." />
          <button onClick={onClose}
            className="mt-2 w-full rounded-2xl bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 transition-colors">
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── a single daily prompt card ───────────────────────────────────────────────
function PromptCard({ item, done, swapped, canSwap, onToggle, onSwap }) {
  return (
    <div className={`rounded-2xl border bg-white px-4 py-3.5 transition-all ${done ? "border-teal-200" : "border-slate-200"}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm">{item.emoji}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</span>
        {!done && canSwap && (
          <button onClick={onSwap} title="Try another"
            className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors">
            <RefreshCw size={11} /> try another
          </button>
        )}
        {!done && !canSwap && swapped && (
          <span className="ml-auto text-[10px] font-semibold text-slate-300">swapped — back tomorrow</span>
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
export default function HaveYouTried({ currentUser, dob }) {
  const uid = currentUser?.uid ?? "anon";
  const day = todayKey();
  const ageBand = useMemo(() => ageBandFor(ageFromDob(dob)), [dob]);
  const [state, setState] = useState(() => loadJSON(stateKey(day), { done: {}, swaps: {} }));
  const [showHow, setShowHow] = useState(false);

  const items = useMemo(
    () => pickDaily({ uid, swaps: state.swaps, ageBand }),
    [uid, state.swaps, day, ageBand]
  );

  const update = (next) => { setState(next); saveJSON(stateKey(day), next); };

  const toggle = (slot) => {
    const nowDone = !state.done[slot];
    const nextDone = { ...state.done, [slot]: nowDone };
    if (nowDone) {
      try { playCheckIn(); } catch { /* ignore */ }
      awardPoints("practice");
      // Bonus once when both of today's prompts are complete.
      if (SLOTS.every((s) => nextDone[s]) && !state.bonus) {
        awardPoints("practiceAll");
        update({ ...state, done: nextDone, bonus: true });
        return;
      }
    }
    update({ ...state, done: nextDone });
  };

  // One "try another" per DAY, across both cards — not one per card.
  const swapsUsed = SLOTS.reduce((n, s) => n + (state.swaps?.[s] ? 1 : 0), 0);
  const canSwap = swapsUsed < 1;
  const swap = (slot) => {
    if (!canSwap) return;
    update({ ...state, swaps: { ...state.swaps, [slot]: 1 } });
  };

  const doneCount = items.filter((i) => state.done[i.slot]).length;
  const allDone = doneCount === SLOTS.length;

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4">
      <div className="mx-auto w-full max-w-md space-y-3">
        <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-sm font-bold text-slate-800">🌱 Today's two</h2>
            <button onClick={() => setShowHow(true)} aria-label="How Practice works"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-teal-200 bg-white text-teal-600 hover:bg-teal-100 active:scale-90 transition-all">
              <Info size={14} />
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">
            One act of kindness, one bit of self-care. Small and real — do what feels right.
          </p>
        </div>

        {items.map((item) => (
          <PromptCard
            key={item.slot}
            item={item}
            done={Boolean(state.done[item.slot])}
            swapped={Boolean(state.swaps?.[item.slot])}
            canSwap={canSwap}
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
            {doneCount === 0 ? "Whenever you're ready — one is plenty." : "One done — lovely."}
          </p>
        )}
      </div>

      {showHow && <HowItWorksSheet onClose={() => setShowHow(false)} />}
    </main>
  );
}
