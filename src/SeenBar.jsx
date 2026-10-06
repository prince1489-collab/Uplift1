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
//   🤝 someone in real life                (today's idea, with one swap)
//   🌱 yesterday's "who's next"            (a name you gave yourself)
//
// Any one of them completes the day. After EVERY act comes "Feel it" (3.9): tap a word or two for
// how it felt, tap an ending for why, and the app writes the sentence — "I feel proud because I
// nearly didn't do it." (feelingWords.js says why words come first.) After the day's first act
// it is followed by one optional question about the other person, a different one each day
// (reflectPrompts.js). Then the bar folds back to one line that says what happened.
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
import { loadDayState, saveDayState, onDayState, completeSlot, ageFromDob, feltFor, feltSkippedFor } from "./hytState";
import { recordReflection, recordFeelingEntry, actPhrase } from "./feelings";
import { endingsFor, feelPhrase, sentenceFor, playBack, pickFeelCard, readCardHistory, rememberCard, PULSE, BODY_SPOTS, MAX_WORDS } from "./feelingWords";
import { pickReflect, rememberPick, fillName, setWhosNext, whosNext } from "./reflectPrompts";
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

// ── What it did for the other person ─────────────────────────────────────────────────────────
// Only ever something true: a reaction that arrived today names its country; otherwise it says
// what kind of thing happened, never a number that might be zero.
function consequence(route, echo, name) {
  if (route === "reply") return `Your words reached ${name || "them"}.`;
  if (route === "note") return `${name || "They"} will get your note — only them.`;
  if (echo?.country) return `Someone in ${echo.country} felt your kindness ${echo.emoji || "❤️"}`;
  if (route === "sent") return "Your words are on their way — you'll see here when someone feels them.";
  return "That happened off the screen. That counts.";
}

// ── Feel it ──────────────────────────────────────────────────────────────────────────────────
// The card pickFeelCard() chose for this act (feelingWords.js): its heading, its words and its
// SHAPE — the full card, a quick row of four, a one-tap pulse, a phrase of their words (replies)
// or where you felt it (real life). Two taps at most before Save; typing is always optional.
// Keyed by the act's number, so each act starts clean.
const chip = (on) => `rounded-xl border transition-all active:scale-95 ${on
  ? "border-teal-400 bg-teal-50 text-teal-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`;

function WordGrid({ words, picked, onToggle, cols = 4 }) {
  return (
    <div className={`mt-2 grid gap-1.5 ${cols === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
      {words.map((w) => (
        <button key={w} onClick={() => onToggle(w)} aria-pressed={picked.includes(w)}
          className={`truncate px-0.5 py-2 text-[12px] font-semibold tracking-tight ${chip(picked.includes(w))}`}>
          {w}
        </button>
      ))}
    </div>
  );
}

function FeelCard({ card, lead, onSave, onSkip }) {
  const [words, setWords] = useState([]);
  const [other, setOther] = useState(null); // null = closed; string = typing your own word
  const [because, setBecause] = useState("");
  const [why, setWhy] = useState(false);    // the quick card's "Add why"
  const [body, setBody] = useState("");
  const [quote, setQuote] = useState("");
  const { shape, route } = card;
  const toggle = (w) => setWords((cur) => cur.includes(w) ? cur.filter((x) => x !== w)
    : [...cur, w].slice(shape === "words" ? -MAX_WORDS : -1)); // a further tap replaces — never a dead end
  const addOther = () => {
    const w = String(other || "").trim().toLowerCase().slice(0, 20);
    if (w) toggle(w);
    setOther(null);
  };
  const endings = endingsFor(route, words, card.key, card.endingsAvoid);
  const custom = words.filter((w) => !card.words.includes(w));
  const save = (extra = {}) => onSave({ words, because, body, quote, endings, ...extra });

  const head = (
    <>
      <p className="text-[11px] font-semibold text-teal-600">{lead}</p>
      <p className="mt-1.5 text-[15px] font-extrabold leading-snug text-slate-800">{card.stem}</p>
    </>
  );
  const because_ = (
    <div className="mt-3 rounded-xl bg-orange-50/80 px-3 py-2.5" style={{ animation: "seenFadeUp 200ms ease both" }}>
      <p className="text-[14px] font-bold leading-snug text-slate-800">
        {feelPhrase(words)} because<span className="font-semibold text-slate-500">{because ? ` ${because}` : "…"}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {endings.map((b) => (
          <button key={b} onClick={() => setBecause(because === b ? "" : b)}
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${because === b ? chip(true) : "border border-orange-200 bg-white text-slate-600 active:scale-95"}`}>
            …{b}
          </button>
        ))}
      </div>
      <input value={endings.includes(because) ? "" : because} onChange={(e) => setBecause(e.target.value.slice(0, 140))}
        placeholder="…or in your own words"
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none" />
    </div>
  );
  const actions = (ready) => (
    <div className="mt-2.5 flex items-center gap-2">
      <button onClick={() => save()} disabled={!ready}
        className="flex-1 rounded-xl bg-teal-600 py-2 text-[13px] font-bold text-white transition-opacity disabled:opacity-40 active:scale-[0.99]">
        Save
      </button>
      <button onClick={onSkip} className="px-2 py-2 text-[11px] font-semibold text-slate-400 hover:text-slate-600">Skip</button>
    </div>
  );

  // ── Pulse: one tap and done ──
  if (shape === "pulse") {
    return (
      <div style={{ animation: "seenFadeUp 220ms ease both" }}>
        {head}
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {PULSE.map((p) => (
            <button key={p.word} onClick={() => save({ pulse: p })}
              className={`flex flex-col items-center gap-0.5 py-2 ${chip(false)}`}>
              <span className="text-[22px] leading-none">{p.emoji}</span>
              <span className="text-[10.5px] font-semibold text-slate-500">{p.word}</span>
            </button>
          ))}
        </div>
        <button onClick={onSkip} className="mt-2 w-full py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600">Skip</button>
      </div>
    );
  }

  // ── A phrase of THEIR words (replies) ──
  if (shape === "quote") {
    return (
      <div style={{ animation: "seenFadeUp 220ms ease both" }}>
        {head}
        <div className="mt-2 space-y-1.5">
          {card.phrases.map((ph) => (
            <button key={ph} onClick={() => setQuote(quote === ph ? "" : ph)}
              className={`block w-full px-3 py-2 text-left text-[13px] italic ${chip(quote === ph)}`}>
              “{ph}”
            </button>
          ))}
        </div>
        {quote && (
          <div style={{ animation: "seenFadeUp 200ms ease both" }}>
            <p className="mt-3 text-[13px] font-bold text-slate-700">…and it made you feel</p>
            <WordGrid words={card.words} picked={words} onToggle={toggle} />
          </div>
        )}
        {actions(Boolean(quote && words.length))}
      </div>
    );
  }

  // ── Where you felt it (real life) ──
  if (shape === "body") {
    return (
      <div style={{ animation: "seenFadeUp 220ms ease both" }}>
        {head}
        <p className="text-[11px] text-slate-400">Kindness often shows up in the body first.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BODY_SPOTS.map((b) => (
            <button key={b} onClick={() => setBody(body === b ? "" : b)}
              className={`px-3 py-1.5 text-[12.5px] font-semibold ${chip(body === b)}`}>{b}</button>
          ))}
        </div>
        {body && (
          <div style={{ animation: "seenFadeUp 200ms ease both" }}>
            <p className="mt-3 text-[13px] font-bold text-slate-700">…and the feeling was</p>
            <WordGrid words={card.words} picked={words} onToggle={toggle} />
          </div>
        )}
        {actions(Boolean(body && words.length))}
      </div>
    );
  }

  // ── Quick: four words, "why" if you want it ──
  if (shape === "quick") {
    return (
      <div style={{ animation: "seenFadeUp 220ms ease both" }}>
        {head}
        <WordGrid words={card.words} picked={words} onToggle={toggle} />
        {words.length > 0 && !why && (
          <button onClick={() => setWhy(true)} className="mt-1.5 py-0.5 text-[11px] font-semibold text-teal-600">+ Add why</button>
        )}
        {words.length > 0 && why && because_}
        {actions(words.length > 0)}
      </div>
    );
  }

  // ── The full card: words, then the sentence ──
  return (
    <div style={{ animation: "seenFadeUp 220ms ease both" }}>
      {head}
      <p className="text-[11px] text-slate-400">Pick one or two. There's no right answer.</p>
      <WordGrid words={[...card.words, ...custom]} picked={words} onToggle={toggle} />
      {other === null ? (
        <button onClick={() => setOther("")} className="mt-1.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:text-slate-600">Something else…</button>
      ) : (
        <form className="mt-1.5 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); addOther(); }}>
          <input value={other} onChange={(e) => setOther(e.target.value.slice(0, 20))} placeholder="Your own word" autoFocus
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] focus:border-teal-400 focus:outline-none" />
          <button type="submit" className="rounded-lg border border-teal-200 px-3 text-[12px] font-semibold text-teal-700">Add</button>
        </form>
      )}
      {words.length > 0 && because_}
      {actions(words.length > 0)}
    </div>
  );
}

const clip = (t, n = 60) => {
  const s = String(t || "").replace(/^[“"]|[”"]$/g, "").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

export default function SeenBar({
  db, currentUser, dob, nudgeHour, activeDates, streak = null, echo,
  inboxReply, followMessage, follows = [],
  openRequest = 0, coach = false, sendLimitReached = false, onOpened,
  onSend, onReplyTo, onOpenReply, onNote, onSeeAllFollows, onFindPeople,
  onKindAct, onPlanChange, onSayMore,
}) {
  const uid = currentUser?.uid ?? "anon";
  const view = useVisibleViewport();
  const day = todayKey();
  const ageBand = useMemo(() => ageBandFor(ageFromDob(dob)), [dob]);
  const [state, setState] = useState(() => loadDayState(day));
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState(null); // "notes" | "time" — a sub-part of the panel
  const [answer, setAnswer] = useState("");
  const [askTime, setAskTime] = useState(() => !nudgeAsked());
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

  // A send, reply or note elsewhere on the screen lands here live — and opens the panel on the
  // reflection, because the moment just after is the one worth ten seconds of thought.
  useEffect(() => onDayState((d) => {
    if (d?.day !== day || !d.state) return;
    setState((prev) => {
      // Every new act, not just the first — each one gets its own "Feel it".
      const countOf = (x) => Math.max(Number(x.seenCount || 0), x.sent || x.done?.kindness || x.done?.who ? 1 : 0);
      if (countOf(d.state) > countOf(prev)) { setOpen(true); setSection(null); }
      return d.state;
    });
  }), [day]);

  // One more person made to feel seen today → the "✓ N today" pill pops and the bar glows once.
  const count = Math.max(Number(state.seenCount || 0), state.sent || state.done?.kindness || state.done?.who ? 1 : 0);
  const [shownCount, setShownCount] = useState(count);
  const [flash, setFlash] = useState(false);
  if (count !== shownCount) {
    setShownCount(count);
    if (count > shownCount) { setFlash(true); setTimeout(() => setFlash(false), 1200); }
  }

  // Somebody else asked for the bar to open (a notification, the Grow button).
  const [seenRequest, setSeenRequest] = useState(openRequest);
  if (openRequest !== seenRequest) { setSeenRequest(openRequest); setOpen(true); }

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
  const planned = Boolean(state.planned?.kindness);
  // ONE replacement a day, no more. The area picker that used to count as a second route to a
  // different idea is gone with the Practice tab.
  const canSwap = !state.swaps?.kindness && !actDone;
  const next = whosNext(day);

  // ── Today's reflection ─────────────────────────────────────────────────────────────────────
  const weekCount = useMemo(() => {
    const from = new Date(); from.setDate(from.getDate() - 6);
    const lo = todayKey(from);
    return new Set((activeDates || []).filter((d) => typeof d === "string" && d >= lo && d <= day)).size;
  }, [activeDates, day]);
  // The week's most-felt word, from this device's day records — for the Sunday look-back.
  const topWord = useMemo(() => {
    const counts = new Map();
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      for (const e of Object.values(loadDayState(todayKey(d)).felt || {})) {
        for (const w of e?.feelings || []) counts.set(w, (counts.get(w) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [state.felt]); // eslint-disable-line react-hooks/exhaustive-deps -- recount when today's words change
  const question = useMemo(
    () => pickReflect({ uid, day, route, weekCount, isSunday: new Date().getDay() === 0, topWord }),
    [uid, day, route, weekCount, topWord]
  );
  const qText = fillName(question.q, toName);
  const awaitingFeel = done && !feltFor(state, count) && !feltSkippedFor(state, count);
  // The question about the other person: once a day, after the first "Feel it" is dealt with.
  const awaitingReflection = done && !awaitingFeel && !state.reflected && !state.reflectSkipped;
  const awaitingTime = done && !awaitingFeel && !awaitingReflection && askTime && !Number.isInteger(nudgeHour);

  const what = route === "reply" ? `told ${toName || "someone"} how their words landed`
    : route === "note" ? `sent ${toName || "someone"} a kind note`
    : route === "sent" ? "sent a kind message to someone in the world"
    : toName ? `made ${toName} feel seen` : actPhrase(item.text);

  const reflect = (value) => {
    const a = String(value || "").trim();
    if (!a) return;
    update({ ...state, reflected: { id: question.id, q: qText, answer: a.slice(0, 140) } });
    rememberPick(day, question.id);
    recordReflection(db, currentUser?.uid, {
      day, n: count, route, act: what, questionId: question.id, question: qText, answer: a,
    });
    if (question.kind === "next") {
      // Also on their own (owner-only) user record, so tomorrow's reminder can say "You thought
      // of Sam yesterday" — a named person is the strongest cue there is (3.11).
      const name = setWhosNext(day, a);
      if (name && db && currentUser?.uid) updateDoc(doc(db, "users", currentUser.uid), { whosNext: { name, day } }).catch(() => {});
    }
    setAnswer("");
  };
  const skipReflection = () => { rememberPick(day, question.id); update({ ...state, reflectSkipped: true }); };

  // ── Feel it ──
  // This act's card — chosen once per act from what it was and what came before (feelingWords.js).
  const card = useMemo(
    () => pickFeelCard({
      uid, day, n: count, route, count, routeCount: state.routeCounts?.[route] || 1,
      name: toName, theirText: state.lastAct?.theirText, history: readCardHistory(),
    }),
    [uid, day, count, route, state.routeCounts, toName, state.lastAct]
  );
  const saveFeel = ({ words, because, body, quote, pulse, endings }) => {
    const feelings = pulse ? [pulse.word] : words;
    const b = card.shape === "words" || card.shape === "quick" ? String(because || "").trim() : "";
    const sentence = sentenceFor(card.shape, { words: feelings, because: b, body, quote, pulse });
    const entry = { route, shape: card.shape, feelings, because: b, sentence, body: body || null, quote: quote || null, pulse: pulse?.emoji || null };
    rememberCard(card, endings);
    update({ ...state, felt: { ...(state.felt || {}), [count]: entry } });
    recordFeelingEntry(db, currentUser?.uid, { day, n: count, route, act: what, toName, ...entry });
    try { navigator.vibrate?.([6]); } catch { /* ignore */ }
  };
  const skipFeel = () => {
    rememberCard(card);
    update({ ...state, feltSkipped: { ...(state.feltSkipped || {}), [count]: true } });
  };
  // The most recent act that has words — what the done card plays back.
  const lastFelt = Object.entries(state.felt || {}).sort((a, b) => Number(b[0]) - Number(a[0])).map(([, v]) => v).find((v) => v?.feelings?.length);

  const sayMore = () => {
    const r = state.reflected;
    const felt = lastFelt?.sentence ? ` ${lastFelt.sentence}` : "";
    const prompt = `Today you ${what}.${felt}${r ? ` ${r.q || qText} — ${r.answer}.` : ""} What happened, and what did you notice?`;
    try { localStorage.setItem(PIN_KEY(day), prompt); } catch { /* ignore */ }
    setOpen(false);
    onSayMore?.();
  };

  // ── The real-life ways ─────────────────────────────────────────────────────────────────────
  const doneIt = () => {
    update(completeSlot(state, "kindness", { onKindAct, onPlanChange }));
    try { navigator.vibrate?.([8]); } catch { /* ignore */ }
  };
  const doneWho = () => {
    // Done — so tomorrow's push shouldn't still be about them.
    if (db && currentUser?.uid) updateDoc(doc(db, "users", currentUser.uid), { whosNext: null }).catch(() => {});
    update({ ...completeSlot(state, "who", { onKindAct }), whoName: next, lastAct: { route: "act", name: next } });
    try { navigator.vibrate?.([8]); } catch { /* ignore */ }
  };
  const later = () => {
    if (actDone || planned) return;
    update({ ...state, planned: { ...(state.planned ?? {}), kindness: true } });
    try { onPlanChange?.(item.text); } catch { /* ignore */ }
  };
  const swap = () => { if (canSwap) update({ ...state, swaps: { ...state.swaps, kindness: 1 } }); };

  const pickTime = (h) => { setNudgeHour(db, currentUser?.uid, h); setAskTime(false); setSection(null); };
  const skipTime = () => { markNudgeAsked(); setAskTime(false); setSection(null); };

  const go = (fn) => () => { setOpen(false); fn?.(); };
  // Today counts as soon as it is done, so the rhythm never reads blank on someone's first day
  // while their profile is still catching up.
  const rhythm = rhythmOf(done ? [...(activeDates || []), day] : activeDates, new Date(), streak);
  const answered = state.reflected?.answer;

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
      <button data-tour="send" onClick={() => { setOpen((v) => !v); setSection(null); onOpened?.(); }} aria-expanded={open}
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
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative sheet-slide-up flex flex-col rounded-t-3xl bg-white shadow-2xl" style={sheetCap(view)}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-shrink-0 items-center justify-between px-4 pt-3 pb-1">
              <span className="w-8" />
              <div className="h-1 w-10 rounded-full bg-slate-200" />
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:text-slate-600">
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
            ) : awaitingFeel ? (
              <FeelCard key={card.key} card={card} onSave={saveFeel} onSkip={skipFeel}
                lead={route === "sent" && echo?.country ? consequence(route, echo, toName) : card.consequence} />
            ) : awaitingReflection ? (
              // ── A different small question each day, about the other person ───────────────
              <div style={{ animation: "seenFadeUp 220ms ease both" }}>
                <p className="text-[11px] font-semibold text-teal-600">One more, if you like</p>
                <p className="mt-1.5 text-[14px] font-bold leading-snug text-slate-800">{qText}</p>
                {question.kind === "chips" ? (
                  <div className={`mt-2 grid gap-1.5 ${question.options.length === 4 ? "grid-cols-2" : `grid-cols-${question.options.length}`}`}>
                    {question.options.map((o) => (
                      <button key={o} onClick={() => reflect(o)}
                        className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-[13px] font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50 active:scale-95 transition-all">
                        {o}
                      </button>
                    ))}
                  </div>
                ) : (
                  <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); reflect(answer); }}>
                    <input value={answer} onChange={(e) => setAnswer(e.target.value.slice(0, 140))}
                      placeholder={question.placeholder} autoFocus
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none" />
                    <button type="submit" disabled={!answer.trim()}
                      className="rounded-xl bg-teal-600 px-3 text-[12px] font-bold text-white disabled:opacity-40">
                      {question.kind === "next" ? "Tomorrow" : "Save"}
                    </button>
                  </form>
                )}
                {question.kind === "next" && (
                  <p className="mt-1 text-[10px] text-slate-400">We'll suggest them tomorrow.</p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <button onClick={sayMore} className="py-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700">Want to say more?</button>
                  <button onClick={skipReflection} className="py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600">Skip</button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {done && (
                  // Three clear lines: what it did, the question, your answer — never run together.
                  <div className="mb-2 rounded-xl bg-orange-50/80 px-3 py-2.5">
                    <p className="text-[13px] font-bold leading-snug text-slate-800">{consequence(route, echo, toName)}</p>
                    {lastFelt && (
                      <p className="mt-1 text-[13px] font-semibold leading-snug text-teal-700">{playBack(lastFelt)}</p>
                    )}
                    {answered && (
                      <>
                        <p className="mt-1.5 truncate text-[11px] text-slate-500">{String(state.reflected.q || qText).replace(/^Finish it:\s*/, "")}</p>
                        <p className="mt-0.5 text-[13px] font-semibold leading-snug text-slate-700 line-clamp-2">“{answered}”</p>
                      </>
                    )}
                    <div className="mt-1.5 flex items-center justify-between">
                      <button onClick={sayMore} className="text-[11px] font-semibold text-teal-600 hover:text-teal-700">Want to say more?</button>
                      {rhythm != null && <span className="text-[11px] font-semibold text-slate-400">{rhythm} of the last 30 days</span>}
                    </div>
                  </div>
                )}
                <p className="px-1 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {done ? "Make someone else feel seen" : "Who will it be?"}
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

                {/* Someone in real life — today's idea, with one swap and no more. */}
                <div className={`rounded-xl border px-3 py-2.5 ${actDone ? "border-teal-200 bg-teal-50/40" : "border-slate-100 bg-white"}`}>
                  <div className="flex items-start gap-2.5">
                    <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-teal-50 text-teal-600"><Footprints size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-snug text-slate-800">Someone in real life</p>
                      <p className="mt-0.5 text-[12px] leading-snug text-slate-600">{item.text}</p>
                    </div>
                    {canSwap && (
                      <button onClick={swap} aria-label="Swap for another idea (once a day)" title="Swap (once a day)"
                        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-slate-300 hover:text-teal-600">
                        <RefreshCw size={13} />
                      </button>
                    )}
                  </div>
                  {actDone ? (
                    <p className="mt-1.5 pl-[42px] text-[11px] font-semibold text-teal-600">✓ Done today</p>
                  ) : (
                    <div className="mt-2 flex gap-1.5 pl-[42px]">
                      <button onClick={doneIt}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-teal-200 bg-teal-50 py-1.5 text-[12px] font-bold text-teal-700 active:scale-[0.98]">
                        <Check size={13} strokeWidth={3} /> Done it
                      </button>
                      {planned ? (
                        <span className="flex-1 self-center text-center text-[11px] font-semibold text-teal-600">Planned for today</span>
                      ) : (
                        <button onClick={later} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-[12px] font-semibold text-slate-500 active:scale-[0.98]">
                          Later today
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {!canSwap && !actDone && state.swaps?.kindness && (
                  <p className="px-1 text-[10px] text-slate-400">Today's swap is used — a fresh idea arrives tomorrow.</p>
                )}
                <button onClick={() => setSection("time")} className="flex items-center gap-1 px-1 pt-1 text-[10px] text-slate-400 hover:text-slate-600">
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
