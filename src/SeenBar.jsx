// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// SeenBar.jsx — "Make someone feel seen today", the one thing Seen asks.
//
// ── WHY A BAR ────────────────────────────────────────────────────────────────────────────────
// Seen had four tabs and a 200px card, which left people deciding what kind of session they were
// having before they had done anything. Now there is one question, at the top of Connect, in a
// single 44px line. Tap it and it opens into a short list of ways to answer it, every one of them
// achievable in under a minute:
//
//   💬 someone who wrote to you            (reply back)
//   💬 someone you follow                  (tell them how their words landed)
//   💌 a kind note to someone you follow
//   🌍 a stranger, anywhere                (the send sheet)
//   🤝 someone in real life                (today's act and the words to say — its own card,
//                                           first until done, with "when?" and a reminder; 3.25)
//   🌱 yesterday's "who's next"            (a name you gave yourself)
//
// Any one of them completes the day, and NOTHING is asked afterwards (3.28): one warm line says
// what it did, and that's all. The "Feel it" card and the question about the other person used to
// follow acts — every act, then weekly — and were skipped in recording after recording, called
// "tedious" by the person who designed them. How kindness felt is now something Seen, the AI
// conversation in Messages, asks about now and then, about a specific act, where an answer goes
// somewhere (it's part of what Seen understands about you).
//
// The panel OVERLAYS the feed rather than pushing it, so opening it never moves anything, and
// closing it puts everything back exactly where it was.
//
// State is the per-day record in hytState.js — the same one the old Practice tab used — so
// nothing about a day already in progress is lost in the move.

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { doc, updateDoc } from "firebase/firestore";
import { readPublicProfile } from "./publicProfile";
import { useVisibleViewport, sheetBox, sheetCap } from "./viewport";
import { Check, RefreshCw, Clock, ChevronDown, Send, MessageCircle, Heart, Globe, Footprints, Sprout } from "lucide-react";
import { pickDaily, todayKey, ageBandFor } from "./hytPrompts";
import { loadDayState, saveDayState, onDayState, completeSlot, ageFromDob } from "./hytState";
import { momentsLeft, momentById, planFor, actAsPhrase } from "./realLife";
import { whosNext } from "./reflectPrompts";
import { NUDGE_CHOICES, nudgeLabel, nudgeAsked, markNudgeAsked, setNudgeHour } from "./nudgeTime";
import { rhythmOf } from "./rhythm";
import { inCountry } from "./countryName";

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
      <button onClick={onSkip} className="mt-1.5 w-full py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600">
        {current == null ? "Keep 9am" : "Close"}
      </button>
    </div>
  );
}

// One way to make someone feel seen. Icon, a title that says who, a hint that says how.
function Option({ icon, title, hint, onClick, open, children }) {
  return (
    <div className={`rounded-xl border transition-colors ${open ? "border-teal-200 bg-teal-50/40" : "border-slate-100 bg-white"}`}>
      <button onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left active:scale-[0.99] transition-transform">
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-teal-50 text-teal-600">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-snug text-slate-800">{title}</span>
          {hint && <span className="block truncate text-[11px] leading-snug text-slate-500">{hint}</span>}
        </span>
      </button>
      {children}
    </div>
  );
}

// How many acts a day's state holds — days saved before the counter existed count as one.
const countOf = (x) => Math.max(Number(x?.seenCount || 0), x?.sent || x?.done?.kindness || x?.done?.who ? 1 : 0);

const kindnessFrom = (m) => {
  const first = String(m?.sender || "").trim().split(/\s+/)[0] || "Someone";
  return m?.country ? `${first} in ${inCountry(m.country)}` : first;
};

// ── What it did for the other person ─────────────────────────────────────────────────────────
// Only ever something true: a reaction that arrived today names its country; otherwise it says
// what kind of thing happened, never a number that might be zero.
// `delivery` (3.21) is where today's message to a stranger went: it now lands on one real person,
// and the country it reached is the truest thing the bar can say — about THIS message, not any.
// After "Done it" in real life (3.25), the one warm line — true of any act, a different one now
// and then so it never becomes wallpaper. It is all that follows: nothing to fill in.
const REAL_LIFE_DONE = [
  "That happened off the screen — and it counts.",
  "Someone's day just got a little lighter.",
  "Small, real and done. That's the kind people remember.",
];

function consequence(route, echo, name, delivery = null, n = 0) {
  if (route === "reply") return `Your words reached ${name || "them"}.`;
  if (route === "note") return `${name || "They"} will get your note — only them.`;
  if (route === "act") return REAL_LIFE_DONE[Math.abs(Number(n) || 0) % REAL_LIFE_DONE.length];
  if (route === "sent" && delivery?.delivered) {
    return delivery.country
      ? `Your words reached someone in ${inCountry(delivery.country)} 💛 You'll hear if they write back.`
      : "Your words reached someone 💛 You'll hear if they write back.";
  }
  if (echo?.country) return `Someone in ${echo.country} felt your kindness ${echo.emoji || "❤️"}`;
  if (route === "sent") return "Your words are on their way to someone — you'll hear if they write back.";
  return "That happened off the screen. That counts.";
}


// ── Today, in real life (3.25) ───────────────────────────────────────────────────────────────
// Its own card, first in the panel until it is done, because it was the option everybody read
// past: fourth of four, styled like the rest, and the only one you can't finish on the phone. It
// says the act, the words to say (realLife.js — "what do I even say" is what stops people in the
// moment), and "Done it". "Not now?" asks WHEN — this morning, at lunch, on the way home, this
// evening — and Seen sends the act and the words at that moment (api/send-reminder.js), so the
// reminder arrives when it can be acted on rather than hours later. Done is one tap and one warm
// line; nothing to fill in (3.28: nothing is asked after any act).
function RealLifeCard({ item, planMoment, canRemind, canSwap, onDone, onPlan, onSwap }) {
  const [changing, setChanging] = useState(false);
  const moment = momentById(planMoment);
  const left = momentsLeft(new Date());
  const choosing = !moment || changing;
  return (
    // bg-gradient-to-br + from-orange-50: the pair index.css already turns into the warm night tint.
    <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white px-3.5 pb-3 pt-2.5 shadow-sm"
      style={{ animation: "seenFadeUp 220ms ease both" }}>
      <div className="flex items-center gap-1.5">
        <Footprints size={13} className="text-orange-500" aria-hidden />
        <p className="flex-1 text-[10.5px] font-bold uppercase tracking-wide text-orange-600">Today, in real life</p>
        {canSwap && (
          <button onClick={onSwap} aria-label="Swap for another one (once a day)" title="Swap (once a day)"
            className="-mr-1 grid h-7 w-7 place-items-center rounded-lg text-orange-300 hover:text-orange-600">
            <RefreshCw size={13} />
          </button>
        )}
      </div>
      <p className="mt-1 text-[15px] font-extrabold leading-snug text-slate-800">{item.text}</p>
      {item.say && (
        <p className="mt-1.5 text-[13px] leading-snug text-slate-600">
          Try: <span className="font-semibold italic text-slate-800">“{item.say}”</span>
        </p>
      )}
      <button onClick={onDone}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-600 py-2.5 text-[14px] font-bold text-white shadow-sm active:scale-[0.99]">
        <Check size={15} strokeWidth={3} /> Done it
      </button>
      {moment && !changing && (
        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug text-slate-600">
          <Clock size={12} className="mt-[1px] flex-shrink-0 text-orange-500" aria-hidden />
          <span>
            Planned for {moment.for}{canRemind ? ` — Seen will remind you at ${fmtHour(moment.hour)}` : ""}.{" "}
            {left.length > 0 && <button onClick={() => setChanging(true)} className="font-semibold text-teal-700">Change</button>}
          </span>
        </p>
      )}
      {choosing && left.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[11.5px] font-semibold text-slate-500">Not now? When will you do it?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {left.map((m) => (
              <button key={m.id} onClick={() => { onPlan(m); setChanging(false); }} aria-pressed={m.id === planMoment}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold active:scale-95 ${m.id === planMoment
                  ? "border-orange-300 bg-orange-100 text-orange-700" : "border-orange-200 bg-white text-slate-700 hover:bg-orange-50"}`}>
                {m.label}
              </button>
            ))}
          </div>
          {canRemind && <p className="mt-1.5 text-[10.5px] text-slate-400">Seen will remind you then, with the words.</p>}
        </div>
      )}
      {!moment && left.length === 0 && (
        <p className="mt-2 text-center text-[11px] text-slate-500">Any time before bed counts.</p>
      )}
    </div>
  );
}

const clip = (t, n = 60) => {
  const s = String(t || "").replace(/^[“"]|[”"]$/g, "").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

export default function SeenBar({
  db, currentUser, dob, nudgeHour, activeDates, streak = null, echo,
  inboxReply, followMessage, follows = [], delivery = null, kindnessIn = null, onOpenKindness,
  openRequest = 0, coach = false, sendLimitReached = false, onOpened,
  onSend, onReplyTo, onOpenReply, onNote, onSeeAllFollows, onFindPeople,
  onKindAct, onPlanChange, onSayMore, canRemind = false,
}) {
  const uid = currentUser?.uid ?? "anon";
  const view = useVisibleViewport();
  const day = todayKey();
  const ageBand = useMemo(() => ageBandFor(ageFromDob(dob)), [dob]);
  const [state, setState] = useState(() => loadDayState(day));
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState(null); // "notes" | "time" — a sub-part of the panel
  const [askTime, setAskTime] = useState(() => !nudgeAsked());
  // Something was just done in this open panel — "Done it" is followed by one warm line, so the
  // one-time "when should we remind you?" waits for the next time the bar is opened.
  const [justActed, setJustActed] = useState(false);
  // "Right now…" lines people you follow chose to share (3.15), read when the notes list opens.
  // Fresh ones (two weeks) go first, with the line as the hint — understanding turned into an act.
  const [lines, setLines] = useState({});
  useEffect(() => {
    if (section !== "notes" || !db) return undefined;
    let alive = true;
    Promise.all(follows.slice(0, 12).map((f) => readPublicProfile(db, f.uid).then((p) => [f.uid, p]).catch(() => [f.uid, null])))
      .then((rows) => {
        if (!alive) return;
        const fresh = {};
        for (const [id, p] of rows) {
          if (p?.rightNow && Date.now() - Number(p.rightNowAt || 0) < 14 * 86400000) fresh[id] = String(p.rightNow);
        }
        setLines(fresh);
      });
    return () => { alive = false; };
  }, [section, db, follows]);
  const noteList = useMemo(() => [...follows.slice(0, 12)].sort((a, b) => Boolean(lines[b.uid]) - Boolean(lines[a.uid])), [follows, lines]);

  const update = (next) => { setState(next); saveDayState(day, next); };

  // One more person made to feel seen today → the "✓ N today" pill pops and the bar glows once.
  const count = countOf(state);

  // A send, reply or note elsewhere on the screen lands here live. It never opens the panel
  // (3.28): the act is confirmed by its own sheet or toast and the "✓ N today" pill, and the
  // person is left to get on with their day.
  useEffect(() => onDayState((d) => {
    if (d?.day !== day || !d.state) return;
    setState(d.state);
  }), [day]);
  const [shownCount, setShownCount] = useState(count);
  const [flash, setFlash] = useState(false);
  if (count !== shownCount) {
    setShownCount(count);
    if (count > shownCount) { setFlash(true); setTimeout(() => setFlash(false), 1200); }
  }

  // Somebody else asked for the bar to open (a notification, the Grow button).
  const [seenRequest, setSeenRequest] = useState(openRequest);
  if (openRequest !== seenRequest) { setSeenRequest(openRequest); setOpen(true); setJustActed(false); }

  const item = useMemo(
    () => pickDaily({ uid, swaps: state.swaps, ageBand, chosenArea: null, evening: state.evening !== false })
      .find((i) => i.slot === "kindness"),
    [uid, state.swaps, state.evening, ageBand]
  );

  const actDone = Boolean(state.done?.kindness);
  const whoDone = Boolean(state.done?.who);
  const done = actDone || whoDone || Boolean(state.sent);
  // The LATEST act decides the words and the question — a reply after a real-life act is a reply.
  // Days saved before 3.9 have no lastAct and fall back to the old reading.
  const route = state.lastAct?.route
    ?? (actDone || whoDone ? "act" : state.sentVia === "reply" ? "reply" : state.sentVia === "note" ? "note" : "sent");
  const toName = state.lastAct ? state.lastAct.name : whoDone ? state.whoName : state.sentTo;
  // When they said they'd do it (3.25): a moment id from realLife.MOMENTS. A day planned before
  // 3.25 ("Later today") has `planned` with no moment, and is simply asked when.
  const planMoment = state.planned?.kindness ? state.planMoment ?? null : null;
  // ONE replacement a day, no more — and not once it is planned, so the reminder never quotes an
  // act that is no longer on the card. The area picker went with the Practice tab.
  const canSwap = !state.swaps?.kindness && !actDone && !planMoment;
  const next = whosNext(day);


  // The one-time "when should we remind you?" — never straight after an act in this open panel.
  const awaitingTime = done && !justActed && askTime && !Number.isInteger(nudgeHour);

  const what = route === "reply" ? `told ${toName || "someone"} how their words landed`
    : route === "note" ? `sent ${toName || "someone"} a kind note`
    : route === "sent" ? "sent a kind message to someone in the world"
    : toName ? `made ${toName} feel seen` : `did something kind in real life (${actAsPhrase(item.text)})`;


  const sayMore = () => {
    const prompt = `Today you ${what}. What happened, and what did you notice?`;
    try { localStorage.setItem(PIN_KEY(day), prompt); } catch { /* ignore */ }
    setOpen(false);
    onSayMore?.();
  };

  // ── The real-life ways ─────────────────────────────────────────────────────────────────────
  // "Done it" is one tap and one warm line (the summary above the card); nothing to fill in. A
  // plan's reminder is cleared by completeSlot through onPlanChange(null).
  const doneIt = () => {
    const after = completeSlot(state, "kindness", { onKindAct, onPlanChange });
    update(after);
    setJustActed(true);
    try { navigator.vibrate?.([8]); } catch { /* ignore */ }
  };
  const doneWho = () => {
    // Done — so tomorrow's push shouldn't still be about them.
    if (db && currentUser?.uid) updateDoc(doc(db, "users", currentUser.uid), { whosNext: null }).catch(() => {});
    const after = { ...completeSlot(state, "who", { onKindAct }), whoName: next, lastAct: { route: "act", name: next } };
    update(after);
    setJustActed(true);
    try { navigator.vibrate?.([8]); } catch { /* ignore */ }
  };
  // "When will you do it?" — the moment, and the reminder at that moment (3.25).
  const planIt = (m) => {
    if (actDone || !m) return;
    update({ ...state, planned: { ...(state.planned ?? {}), kindness: true }, planMoment: m.id });
    try { onPlanChange?.(planFor(item, m, day)); } catch { /* ignore */ }
  };
  const swap = () => { if (canSwap) update({ ...state, swaps: { ...state.swaps, kindness: 1 } }); };

  const pickTime = (h) => { setNudgeHour(db, currentUser?.uid, h); setAskTime(false); setSection(null); };
  const skipTime = () => { markNudgeAsked(); setAskTime(false); setSection(null); };

  const close = () => setOpen(false);
  const go = (fn) => () => { setOpen(false); fn?.(); };
  // Today counts as soon as it is done, so the rhythm never reads blank on someone's first day
  // while their profile is still catching up.
  const rhythm = rhythmOf(done ? [...(activeDates || []), day] : activeDates, new Date(), streak);

  return (
    // Pinned at the bottom of Connect (3.7), where the thumb already is and where Seen's users
    // learned the orange button lives. The panel opens as a bottom sheet like every other sheet
    // in the app, so it can never be covered by the feed's sticky headers again.
    <div className="relative">
      {/* ── The bar ───────────────────────────────────────────────────────────────────────────
          The one thing to press on Connect, so it looks like it: the glossy orange the Send
          button used to have, which is the action it now replaces. It always says the same
          thing. Before today's first kind act it pulses; after, it goes calm and a pill counts
          the people you made feel seen today — an invitation to one more, never a nag. */}
      <button data-tour="send" onClick={() => { if (open) close(); else { setOpen(true); setJustActed(false); } setSection(null); onOpened?.(); }} aria-expanded={open}
        className={`relative flex w-full items-center gap-1.5 overflow-hidden rounded-2xl py-3 pl-3.5 pr-2.5 text-left text-white active:scale-[0.99] transition-transform${done ? "" : " send-kindness-pulse"}`}
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 55%), linear-gradient(180deg, #FFAD6E 0%, #FF9E57 55%, #E07C33 100%)",
          border: "1px solid rgba(224,124,51,0.55)",
          boxShadow: flash
            ? "inset 0 1px 0 rgba(255,255,255,0.55), 0 0 0 4px rgba(255,173,110,0.35), 0 6px 22px rgba(255,158,87,0.7)"
            : "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 6px rgba(184,95,29,0.45), 0 4px 16px rgba(255,158,87,0.45)",
          textShadow: "0 1px 1px rgba(184,95,29,0.4)",
          transition: "box-shadow 400ms ease",
        }}>
        <span aria-hidden="true" className="send-kindness-shine" />
        <span className="text-base leading-none" aria-hidden>✨</span>
        <span className={`min-w-0 flex-1 truncate font-extrabold ${done ? "text-[14px]" : "text-[15px]"}`}>Make Someone Feel Seen</span>
        {done && (
          <span key={count} className="flex-shrink-0 whitespace-nowrap rounded-full bg-white px-1.5 py-0.5 text-[10.5px] font-bold text-orange-600 shadow-sm"
            style={{ animation: "seenLeafPop 500ms ease both", textShadow: "none" }}
            aria-label={`${count} ${count === 1 ? "person" : "people"} today`}>
            ✓ {count} today
          </span>
        )}
        <ChevronDown size={17} className={`flex-shrink-0 transition-transform ${open ? "" : "rotate-180"}`} />
      </button>

      {/* First visit: point at the one thing to press. */}
      {coach && !open && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 -translate-x-1/2">
          <div className="send-coach-hop flex flex-col items-center">
            <div className="whitespace-nowrap rounded-full bg-slate-900/90 px-3.5 py-2 text-[12px] font-semibold text-white shadow-lg">
              👇 Start here — make someone feel seen
            </div>
            <div className="h-0 w-0" style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "7px solid rgba(15,23,42,0.9)" }} />
          </div>
        </div>
      )}

      {/* ── The panel, as a bottom sheet ───────────────────────────────────────────────────── */}
      {open && createPortal(
        <div data-portal className="fixed inset-0 z-[230] flex flex-col justify-end" style={sheetBox(view)}>
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={close} aria-hidden />
          <div className="relative sheet-slide-up flex flex-col rounded-t-3xl bg-white shadow-2xl" style={sheetCap(view)}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-shrink-0 items-center justify-between px-4 pt-3 pb-1">
              <span className="w-8" />
              <div className="h-1 w-10 rounded-full bg-slate-200" />
              <button onClick={close} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:text-slate-600">
                <ChevronDown size={18} />
              </button>
            </div>
            <p className="flex-shrink-0 px-5 pb-1 text-[16px] font-extrabold text-slate-800">✨ Make Someone Feel Seen</p>
            <div className="overflow-y-auto overscroll-contain px-4 pb-6 pt-1" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>

            {section === "time" || awaitingTime ? (
              <NudgeChooser
                title={awaitingTime ? "When should we remind you tomorrow?" : "Your daily reminder"}
                current={Number.isInteger(nudgeHour) ? nudgeHour : null}
                onPick={pickTime} onSkip={skipTime} />
            ) : (
              <div className="space-y-1.5">
                {done && (
                  // What it did, in one warm line.
                  <div className="mb-2 rounded-xl bg-orange-50/80 px-3 py-2.5">
                    <p className="text-[13px] font-bold leading-snug text-slate-800">{consequence(route, echo, toName, delivery, count)}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <button onClick={sayMore} className="text-[11px] font-semibold text-teal-700 hover:text-teal-800">Want to say more?</button>
                      {rhythm != null && <span className="text-[11px] font-semibold text-slate-500">{rhythm} of the last 30 days</span>}
                    </div>
                  </div>
                )}
                {/* Today, in real life — first until it is done (3.25). */}
                {!actDone && (
                  <div className="pb-1.5">
                    <RealLifeCard item={item} planMoment={planMoment} canRemind={canRemind} canSwap={canSwap}
                      onDone={doneIt} onPlan={planIt} onSwap={swap} />
                  </div>
                )}
                <p className="px-1 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {done ? "Make someone else feel seen" : "Or here, in a minute"}
                </p>

                {next && !whoDone && (
                  <Option icon={<Sprout size={15} />} title={`Make ${next} feel seen today`}
                    hint="You thought of them yesterday" onClick={() => setSection(section === "who" ? null : "who")} open={section === "who"}>
                    {section === "who" && (
                      <div className="flex gap-1.5 px-3 pb-2.5">
                        <button onClick={doneWho} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-teal-600 py-1.5 text-[12px] font-bold text-white"><Check size={13} /> Done it</button>
                        {follows.some((f) => f.name?.split(" ")[0]?.toLowerCase() === next.split(" ")[0].toLowerCase()) && (
                          <button onClick={go(() => onNote?.(follows.find((f) => f.name?.split(" ")[0]?.toLowerCase() === next.split(" ")[0].toLowerCase())))}
                            className="flex-1 rounded-lg border border-teal-200 py-1.5 text-[12px] font-semibold text-teal-700">Send a note</button>
                        )}
                      </div>
                    )}
                  </Option>
                )}

                {/* A stranger's words, delivered to you (3.21) — answering them is the most
                    direct way there is to make that person feel seen, so it comes first. */}
                {kindnessIn?.message && (
                  <Option icon={<Heart size={15} />} title={`${kindnessFrom(kindnessIn.message)} sent you kind words — tell them how it landed`}
                    hint={`“${clip(kindnessIn.message.text)}”`} onClick={go(() => onOpenKindness?.(kindnessIn))} />
                )}

                {inboxReply && (
                  <Option icon={<MessageCircle size={15} />} title={`${inboxReply.name} wrote to you — reply back`}
                    hint={clip(inboxReply.reply.text)} onClick={go(() => onOpenReply?.(inboxReply.reply))} />
                )}

                {followMessage && (
                  <Option icon={<Heart size={15} />} title={`Tell ${followMessage.name} how their words landed`}
                    hint={`“${clip(followMessage.message.text)}”`} onClick={go(() => onReplyTo?.(followMessage.message))} />
                )}

                <Option icon={<Send size={15} />} title="A kind note to someone you follow"
                  hint={follows.length ? "Private, just between you two" : "Follow someone first — it takes a tap"}
                  onClick={() => (follows.length ? setSection(section === "notes" ? null : "notes") : go(onFindPeople)())}
                  open={section === "notes"}>
                  {section === "notes" && (
                    <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
                      {noteList.filter((f) => lines[f.uid]).map((f) => (
                        <button key={f.uid} onClick={go(() => onNote?.(f))}
                          className="flex w-full items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50/60 px-3 py-1.5 text-left active:scale-[0.99]">
                          <span className="text-[12.5px] font-bold text-slate-800">{(f.name || "Someone").split(" ")[0]}</span>
                          <span className="min-w-0 flex-1 truncate text-[11.5px] text-orange-700">🌱 {lines[f.uid]}</span>
                        </button>
                      ))}
                      {noteList.filter((f) => !lines[f.uid]).slice(0, 6).map((f) => (
                        <button key={f.uid} onClick={go(() => onNote?.(f))}
                          className="rounded-full border border-teal-200 bg-white px-3 py-1 text-[12px] font-semibold text-teal-700 active:scale-95">
                          {(f.name || "Someone").split(" ")[0]}
                        </button>
                      ))}
                      {follows.length > 6 && (
                        <button onClick={go(onSeeAllFollows)} className="rounded-full px-2 py-1 text-[12px] font-semibold text-slate-500">See all</button>
                      )}
                    </div>
                  )}
                </Option>

                {sendLimitReached ? (
                  <Option icon={<Globe size={15} />} title="A stranger, anywhere in the world"
                    hint="You've sent your messages for today — back tomorrow 🌙" onClick={() => {}} />
                ) : (
                  <Option icon={<Globe size={15} />} title="A stranger, anywhere in the world"
                    hint="Send a kind message · 20 seconds" onClick={go(onSend)} />
                )}

                {/* Today's real-life one, once done: kept in the list, quietly, as what you did. */}
                {actDone && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-teal-200 bg-teal-50/40 px-3 py-2.5">
                    <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-teal-50 text-teal-600"><Footprints size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-snug text-slate-800">In real life <span className="text-teal-600">· ✓ Done today</span></p>
                      <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{item.text}</p>
                    </div>
                  </div>
                )}
                <button onClick={() => setSection("time")} className="flex items-center gap-1 px-1 pt-1 text-[10px] text-slate-500 hover:text-slate-600">
                  <Clock size={10} /> {nudgeLabel(nudgeHour) ? `Reminder: ${nudgeLabel(nudgeHour)}` : "Reminder: 9am"} · One is enough — anything more is a bonus.
                </button>
              </div>
            )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
