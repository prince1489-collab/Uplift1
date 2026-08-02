// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// HaveYouTried.jsx — the "Practice" tab: two small real-life prompts a day. One from
// the 14 areas of kindness (a different area each day), one self-care matched to your
// age band. Complete = tap (strike-through + soft chime). "Try another" swaps one
// prompt, once a day — an unfinished list must never feel like failure.
//
// State lives in localStorage, so it is per-device: your two prompts, what you've ticked and
// whether you've used today's swap do not follow you to another phone. Firestore wiring
// (users/{uid}/haveYouTried) lands when Phase 1 ships for real, with a rules update.

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Check, Info, X } from "lucide-react";
import { pickDaily, todayKey, ageBandFor, areasForBand } from "./hytPrompts";
import { playCheckIn } from "./sounds";
import { awardPoints, POINTS } from "./points";

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
// Line sits outside the sheet rather than inside it: a component defined during render is a
// new component type every pass, so React remounts the whole list on each render instead of
// updating it.
const Line = ({ emoji, title, body }) => (
  <div className="flex gap-3">
    <span className="text-lg flex-shrink-0 leading-none mt-0.5">{emoji}</span>
    <p className="text-[13px] text-slate-600 leading-relaxed">
      <strong className="text-slate-800">{title}</strong> {body}
    </p>
  </div>
);

function HowItWorksSheet({ ageBand, onClose }) {
  // Counts and names only the areas this band can actually reach — telling a 15-year-old about
  // 14 sets "starting with work" describes an app they are not being shown.
  const areas = areasForBand(ageBand);
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
            body="Something anyone can do, wherever they are — no special place, no money, no particular person needed." />
          <Line emoji="🌤️" title="The second is for you."
            body="A bit of self-care, matched to your stage of life. Being kind to yourself counts too." />
          <Line emoji="🔄" title="Not feeling one? Try another."
            body="One swap a day — either a different suggestion, or a different area entirely. After that today's two stay put, and fresh ones arrive tomorrow." />
          <Line emoji="🎯" title="Want something more specific?"
            body={`"Pick an area" opens ${areas.length} themed sets — ${areas.slice(0, 4).map((a) => a.label.toLowerCase()).join(", ")} and more — for when you know what kind of kindness you're in the mood for.`} />
          <Line emoji="✅" title="Tap to mark it done."
            body="That's it. Each one waters your Kindness Tree in Grow." />
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
function PromptCard({ item, done, swapped, canSwap, celebrate, drops, onToggle, onSwap, children }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-white px-4 py-3.5 transition-all ${done ? "border-teal-200" : "border-slate-200"}`}>
      {/* A real-world act deserves more than a strike-through. Brief, then it gets out
          of the way — the acknowledgement matters, lingering on it doesn't. */}
      {celebrate && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-teal-500/95 text-center"
          style={{ animation: "seenPracticeDone 2200ms ease both" }}>
          <p className="text-lg font-extrabold text-white">✨ +{drops} drops</p>
          <p className="mt-0.5 px-6 text-[12px] font-medium leading-snug text-teal-50">
            That happened off the screen. That counts.
          </p>
        </div>
      )}
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
      <button onClick={onToggle} aria-pressed={done}
        aria-label={`${done ? "Done" : "Mark done"}: ${item.text}`}
        className="flex w-full items-start gap-3 text-left group">
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
      {children}
    </div>
  );
}

// ── steer to a different area when today's doesn't fit ───────────────────────
// Deliberately not capped like "try another": this steers, it doesn't reroll. The prompt
// inside a chosen area is still fixed by the day, so there's nothing to shop for.
function AreaPicker({ current, canPick, ageBand, onPick, onClear }) {
  const [open, setOpen] = useState(false);
  // Under-18s don't see Work life, Romantic life, Money life or Legacy life — see areasForBand.
  // This hides the control; pickDaily independently refuses a stored area outside the band, so
  // an existing selection can't survive the button disappearing.
  const areas = areasForBand(ageBand);
  // Nothing to offer once the day's swap is spent and no area is active — say so rather than
  // showing a control that would do nothing.
  if (!canPick && !current) {
    return (
      <p className="mt-2.5 text-center text-[10px] text-slate-300">
        Today's swap is used — a fresh suggestion arrives tomorrow.
      </p>
    );
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="mt-2.5 w-full rounded-xl border border-dashed border-slate-200 py-1.5 text-[11px] font-semibold text-slate-400 hover:border-teal-300 hover:text-teal-600 transition-colors">
        {current ? "Change area, or go back to everyday" : "Doesn't fit today? Pick an area"}
      </button>
    );
  }
  return (
    <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50 p-2" style={{ animation: "seenFadeUp 200ms ease both" }}>
      <div className="flex items-center gap-2 px-1 pb-1.5">
        <p className="flex-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Choose an area</p>
        <button onClick={() => setOpen(false)} className="text-[10px] font-semibold text-slate-400 hover:text-slate-600">Close</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {areas.map((a) => {
          const active = current === a.id;
          // Once the swap is spent you can still see where you are and step back to
          // everyday, but you cannot hop between areas.
          const disabled = !canPick && !active;
          return (
            <button key={a.id} disabled={disabled}
              onClick={() => { onPick(a.id); setOpen(false); }}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                active
                  ? "border-teal-400 bg-teal-50 text-teal-700"
                  : disabled
                  ? "border-slate-100 bg-white text-slate-300"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}>
              {a.emoji} {a.label}
            </button>
          );
        })}
      </div>
      {current && (
        <button onClick={() => { onClear(); setOpen(false); }}
          className="mt-2 w-full rounded-lg py-1 text-[10px] font-semibold text-slate-400 hover:text-teal-600">
          Back to everyday kindness
        </button>
      )}
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
    () => pickDaily({ uid, swaps: state.swaps, ageBand, chosenArea: state.area ?? null }),
    [uid, state.swaps, state.area, day, ageBand]
  );
  const [celebrating, setCelebrating] = useState(null); // slot showing its completion moment

  const update = (next) => { setState(next); saveJSON(stateKey(day), next); };

  const toggle = (slot) => {
    const nowDone = !state.done[slot];
    const nextDone = { ...state.done, [slot]: nowDone };
    if (nowDone) {
      try { playCheckIn(); } catch { /* ignore */ }
      awardPoints("practice");
      setCelebrating(slot);
      setTimeout(() => setCelebrating((c) => (c === slot ? null : c)), 2200);
      // Bonus once when both of today's prompts are complete.
      if (SLOTS.every((s) => nextDone[s]) && !state.bonus) {
        awardPoints("practiceAll");
        update({ ...state, done: nextDone, bonus: true });
        return;
      }
    }
    update({ ...state, done: nextDone });
  };

  // ONE swap per day, full stop — and picking an area counts as that swap.
  //
  // The review put it as "either swap the category, or swap a different suggestion in the
  // same category… only one swap a day". Previously "try another" was capped at one but the
  // area picker was uncapped, so the cap could be walked around by steering instead. Both
  // now draw on the same single allowance.
  const swapsUsed = SLOTS.reduce((n, s) => n + (state.swaps?.[s] ? 1 : 0), 0)
    + (state.area ? 1 : 0);
  const canSwap = swapsUsed < 1;
  const swap = (slot) => {
    if (!canSwap) return;
    update({ ...state, swaps: { ...state.swaps, [slot]: 1 } });
  };
  // Steering to an area spends the day's swap. Clearing it back to Everyday refunds it —
  // that's a correction, not a second bite, and leaving someone stuck in an area they picked
  // by accident would be the opposite of the point.
  const pickArea = (id) => { if (canSwap) update({ ...state, area: id }); };
  const clearArea = () => update({ ...state, area: null });

  const doneCount = items.filter((i) => state.done[i.slot]).length;
  const allDone = doneCount === SLOTS.length;

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4">
      <div className="mx-auto w-full max-w-md space-y-3">
        {/* Free-floating rather than a card. Below this sit the two prompt cards — the things
            you actually tap — and a tinted card here made three panels of similar weight where
            only two do anything. The rule this follows across the app: plain text is context,
            a card means you can act on it.

            The ⓘ keeps a card-like circle and its 44px tap target: it IS actionable, so it
            should still look it, and shrinking a control below 44px fails the accessible
            minimum regardless of how tidy it looks. */}
        <div className="px-1 pt-1">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-[15px] font-bold text-slate-800">🌱 Today's two</h2>
            <button onClick={() => setShowHow(true)} aria-label="How Practice works"
              className="-m-2 flex h-11 w-11 flex-shrink-0 items-center justify-center text-teal-600 active:scale-90 transition-all">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-teal-200 bg-white">
                <Info size={14} />
              </span>
            </button>
          </div>
          <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">
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
            celebrate={celebrating === item.slot}
            drops={POINTS.practice}
            onToggle={() => toggle(item.slot)}
            onSwap={() => swap(item.slot)}
          >
            {/* Only the kindness slot has areas to choose between; self-care has one bank. */}
            {item.slot === "kindness" && !state.done[item.slot] && (
              <AreaPicker
                current={state.area ?? null}
                canPick={canSwap}
                ageBand={ageBand}
                onPick={pickArea}
                onClear={clearArea}
              />
            )}
          </PromptCard>
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

      {showHow && <HowItWorksSheet ageBand={ageBand} onClose={() => setShowHow(false)} />}
    </main>
  );
}
