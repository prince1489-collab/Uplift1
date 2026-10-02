// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// TodayCard.jsx — the day's one kind thing, at the top of Connect.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────
// Seen opened on the multiplayer tab while the community was small: "2 kind messages across 2
// countries today", "1 online". The parts that work with nobody else around — a real-world act,
// a moment to notice how it felt — sat on tabs two and three, and nothing anywhere said "you've
// done today". So there was no finish line, and an app without one is browsed, not returned to.
//
// This card is the finish line. One act (the kindness slot of the same daily pick Practice
// shows) → Done it → one tap for how it felt → "✓ You've done today". That is the whole daily
// loop, it takes under a minute, and it counts as showing up exactly like sending a message
// does — activeDays, certificates and the streak all move.
//
// Everything else on Connect stays where it was, underneath. This only decides what comes first.
//
// ── SIZE ─────────────────────────────────────────────────────────────────────────────────────
// It sits above the feeds in a column that must still show them, so every state is bounded and
// the finished state is one line. The old daily-story card taught the lesson: anything here
// that grows without limit pushes the people off the first screen.
//
// ── ONE SOURCE OF TRUTH ──────────────────────────────────────────────────────────────────────
// State is the Practice tab's own per-day record (hytState.js), so ticking here shows ticked
// there and the reverse. Nothing about the act is duplicated.

import React, { useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Clock, ChevronDown, Send, MessageCircle } from "lucide-react";
import { pickDaily, todayKey, ageBandFor } from "./hytPrompts";
import { loadDayState, saveDayState, onDayState, completeSlot, ageFromDob, SLOTS } from "./hytState";
import { FEELINGS, feelingFor, recordFeeling, actPhrase } from "./feelings";
import { NUDGE_CHOICES, nudgeLabel, nudgeAsked, markNudgeAsked, setNudgeHour } from "./nudgeTime";
import { rhythmOf } from "./rhythm";

const PIN_KEY = (d) => `seen_reflect_pin_${d}`; // Journal.jsx's "hold this thought" key

function fmtHour(h) {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function NudgeChooser({ current, onPick, onSkip, title }) {
  return (
    <div style={{ animation: "seenFadeUp 220ms ease both" }}>
      <p className="text-[13px] font-semibold text-slate-700">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {NUDGE_CHOICES.map((c) => (
          <button key={c.hour} onClick={() => onPick(c.hour)}
            className={`rounded-xl border px-2 py-1.5 text-left text-[12px] font-semibold transition-colors active:scale-[0.98] ${
              current === c.hour ? "border-teal-400 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}>
            <span className="block">{c.emoji} {c.label}</span>
            <span className="block text-[11px] font-normal text-slate-400">{fmtHour(c.hour)}</span>
          </button>
        ))}
      </div>
      {onSkip && (
        <button onClick={onSkip} className="mt-1.5 w-full py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600">
          {current == null ? "Keep 9am" : "Close"}
        </button>
      )}
    </div>
  );
}

// ── What it did for the other person ─────────────────────────────────────────────────────────
// The ritual is about someone else, so the finished card says something about them — and only
// something true. A reaction that arrived today names its country; otherwise it says what kind
// of thing happened, never a number that might be zero.
function consequence(via, echo, sentTo) {
  if (via === "reply") return `Your words reached ${sentTo || "them"}. Telling someone how they landed is how people feel seen.`;
  if (echo?.country) return `Someone in ${echo.country} felt your kindness ${echo.emoji || "❤️"}`;
  if (via === "sent") return "Your words are on their way — you'll see here when someone feels them.";
  return "That happened off the screen. That counts.";
}

export default function TodayCard({ db, currentUser, dob, nudgeHour, activeDates, echo, replyCandidate, onReplyTo, onKindAct, onPlanChange, onSayMore, onSend }) {
  const uid = currentUser?.uid ?? "anon";
  const day = todayKey();
  const ageBand = useMemo(() => ageBandFor(ageFromDob(dob)), [dob]);
  const [state, setState] = useState(() => loadDayState(day));
  const [expanded, setExpanded] = useState(false);
  const [choosingTime, setChoosingTime] = useState(false);
  // Asked once, straight after the first act — the moment the loop has just worked — and only to
  // someone who has never chosen. Held in state so answering removes it in the same render.
  const [askTime, setAskTime] = useState(() => !nudgeAsked());

  const item = useMemo(
    () => pickDaily({ uid, swaps: state.swaps, ageBand, chosenArea: state.area ?? null, evening: state.evening !== false })
      .find((i) => i.slot === "kindness"),
    [uid, state.swaps, state.area, state.evening, ageBand]
  );

  const update = (next) => { setState(next); saveDayState(day, next); };

  // A send elsewhere on the screen (markSentToday) or a tick in Practice lands here live.
  useEffect(() => onDayState((d) => { if (d?.day === day && d.state) setState(d.state); }), [day]);

  // Either way of making someone feel seen completes the day.
  const actDone = Boolean(state.done?.kindness);
  const done = actDone || Boolean(state.sent);
  const via = actDone ? "act" : state.sentVia === "reply" ? "reply" : "sent";
  const planned = Boolean(state.planned?.kindness);
  const swapsUsed = SLOTS.reduce((n, s) => n + (state.swaps?.[s] ? 1 : 0), 0) + (state.area ? 1 : 0);
  const canSwap = swapsUsed < 1 && !done;
  const what = via === "reply" ? `a reply to ${state.sentTo || "someone"}` : via === "sent" ? "a kind message" : item.text;

  const doneIt = () => {
    // The celebration is the 🍃 flying to Grow (motion.js), driven by the award itself — so no
    // overlay here as well. One action, one celebration.
    update(completeSlot(state, "kindness", { onKindAct, onPlanChange }));
    try { navigator.vibrate?.([8]); } catch { /* ignore */ }
  };
  const later = () => {
    if (done || planned) return;
    update({ ...state, planned: { ...(state.planned ?? {}), kindness: true } });
    try { onPlanChange?.(item.text); } catch { /* ignore */ }
  };
  const swap = () => { if (canSwap) update({ ...state, swaps: { ...state.swaps, kindness: 1 } }); };

  const feel = (id) => {
    const already = Boolean(state.feeling);
    update({ ...state, feeling: id, feelingSkipped: false });
    // The day has already been counted by Done it (completeSlot → onKindAct); this only says how.
    recordFeeling(db, currentUser?.uid, { day, feeling: id, act: what, alreadyAwarded: already });
  };

  const sayMore = () => {
    const f = feelingFor(state.feeling);
    const did = via === "reply" ? `you told ${state.sentTo || "someone"} how their words landed`
      : via === "sent" ? "you sent someone a kind message" : actPhrase(item.text);
    const prompt = `Today you made someone feel seen: ${did}.${f ? ` You felt ${f.label.toLowerCase()}.` : ""} What happened?`;
    try { localStorage.setItem(PIN_KEY(day), prompt); } catch { /* ignore */ }
    onSayMore?.();
  };

  const pickTime = (h) => {
    setNudgeHour(db, currentUser?.uid, h);
    setAskTime(false);
    setChoosingTime(false);
  };
  const skipTime = () => { markNudgeAsked(); setAskTime(false); setChoosingTime(false); };

  const rhythm = rhythmOf(activeDates);
  const feelingChosen = feelingFor(state.feeling);
  const awaitingFeeling = done && !state.feeling && !state.feelingSkipped;
  // nudgeHour arrives with the profile, possibly after mount — so it is checked here, live,
  // rather than only in the initial state.
  const awaitingTime = done && !awaitingFeeling && askTime && !Number.isInteger(nudgeHour);

  // ── 3. Done ─────────────────────────────────────────────────────────────────────────────────
  if (done && !awaitingFeeling && !awaitingTime && !choosingTime) {
    return (
      <div className="flex-shrink-0 px-3.5 pt-2">
        <div className="rounded-2xl border border-teal-200 bg-teal-50/70">
          <button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-left">
            <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-teal-500 text-white">
              <Check size={12} strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-teal-700">
              You made someone feel seen{feelingChosen ? ` ${feelingChosen.emoji}` : ""}
            </span>
            {rhythm != null && (
              <span className="flex-shrink-0 text-[11px] font-semibold text-teal-600/80"
                aria-label={`${rhythm} of the last 30 days`}>{rhythm}/30</span>
            )}
            <ChevronDown size={14} className={`flex-shrink-0 text-teal-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          {expanded && (
            <div className="border-t border-teal-100 px-3.5 pb-2.5 pt-2" style={{ animation: "seenFadeUp 200ms ease both" }}>
              <p className="text-[12px] font-semibold leading-snug text-teal-700">{consequence(via, echo, state.sentTo)}</p>
              {via === "act" && <p className="mt-0.5 text-[12px] leading-snug text-slate-500 line-clamp-2">{item.text}</p>}
              <div className="mt-2 flex items-center gap-2">
                <button onClick={sayMore}
                  className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-teal-600 border border-teal-200 hover:bg-teal-50">
                  Want to say more?
                </button>
                <button onClick={() => setChoosingTime(true)}
                  className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600">
                  <Clock size={11} /> {nudgeLabel(nudgeHour) || "9am"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 px-3.5 pt-2">
      <div className="relative overflow-hidden rounded-2xl border border-teal-200 bg-white px-3.5 py-3 shadow-sm">

        {choosingTime || awaitingTime ? (
          // ── Choose your moment ─────────────────────────────────────────────────────────────
          <NudgeChooser
            title={awaitingTime ? "When should we remind you tomorrow?" : "Your daily reminder"}
            current={Number.isInteger(nudgeHour) ? nudgeHour : null}
            onPick={pickTime}
            onSkip={skipTime} />
        ) : awaitingFeeling ? (
          // ── 2. How did that feel? ──────────────────────────────────────────────────────────
          <div style={{ animation: "seenFadeUp 220ms ease both" }}>
            <p className="text-[13px] font-bold text-slate-700">How did that feel?</p>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {FEELINGS.map((f) => (
                <button key={f.id} onClick={() => feel(f.id)}
                  className="flex flex-col items-center rounded-xl border border-slate-200 bg-white py-1.5 hover:border-teal-300 hover:bg-teal-50 active:scale-95 transition-all">
                  <span className="text-lg leading-none">{f.emoji}</span>
                  <span className="mt-1 text-[10px] font-semibold text-slate-500">{f.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <button onClick={sayMore} className="py-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700">
                Want to say more?
              </button>
              <button onClick={() => update({ ...state, feelingSkipped: true })}
                className="py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600">
                Skip
              </button>
            </div>
          </div>
        ) : (
          // ── 1. Make someone feel seen — two ways, either one is the day ───────────────────
          <>
            <div className="flex items-center gap-1.5">
              <span className="flex-1 text-[10px] font-bold uppercase tracking-wide text-teal-600">Today: make someone feel seen</span>
              <button onClick={() => setChoosingTime(true)} aria-label="Change reminder time"
                className="-my-1 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-600">
                <Clock size={11} /> {Number.isInteger(nudgeHour) ? fmtHour(nudgeHour) : "9am"}
              </button>
            </div>
            {replyCandidate ? (
              // Someone you follow wrote something you hearted and have not answered. Telling
              // them how it landed is the most direct way to make a real person feel seen, so it
              // goes first; sending to the world stays one tap away underneath.
              <>
                <p className="mt-1.5 text-[12px] leading-snug text-slate-500 line-clamp-1">
                  <span className="font-semibold text-slate-600">{replyCandidate.name}</span> wrote: “{String(replyCandidate.message.text).replace(/^[“"]|[”"]$/g, "")}”
                </p>
                <button onClick={() => onReplyTo?.(replyCandidate.message)}
                  className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-[13px] font-bold text-white hover:bg-teal-700 active:scale-[0.98] transition-all">
                  <MessageCircle size={14} /> Tell {replyCandidate.name} how it landed
                </button>
                <button onClick={onSend} className="mt-1 w-full py-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700">
                  or send some kindness to the world
                </button>
              </>
            ) : (
              // Online: the send sheet that already exists. Twenty seconds, and someone somewhere
              // gets a kind word — the fastest way to finish the day.
              <button onClick={onSend}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-[13px] font-bold text-white hover:bg-teal-700 active:scale-[0.98] transition-all">
                <Send size={14} /> Send some kindness <span className="font-medium text-teal-100">· 20 sec</span>
              </button>
            )}
            {/* Or in the world: the kindness slot of Practice's daily pick, same record. */}
            <p className="mt-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">or, in real life</p>
            <div className="mt-1 flex items-start gap-2">
              <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-slate-700 line-clamp-2">{item.text}</p>
              {canSwap && (
                <button onClick={swap} aria-label="Swap for another"
                  className="-mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-slate-300 hover:text-teal-600 transition-colors">
                  <RefreshCw size={13} />
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <button onClick={doneIt}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 py-1.5 text-[12px] font-bold text-teal-700 hover:bg-teal-100 active:scale-[0.98] transition-all">
                <Check size={13} strokeWidth={3} /> Done it
              </button>
              {planned ? (
                <span className="flex-1 text-center text-[11px] font-semibold text-teal-600">Planned for today</span>
              ) : (
                <button onClick={later}
                  className="flex-1 rounded-xl border border-slate-200 py-1.5 text-[12px] font-semibold text-slate-500 hover:bg-slate-50 active:scale-[0.98] transition-all">
                  Later today
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
