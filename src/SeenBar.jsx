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
// Any one of them completes the day. Then comes a ten-second reflection — a different question
// each day (reflectPrompts.js), always about the other person — and the bar folds back to one
// line that says what happened.
//
// The panel OVERLAYS the feed rather than pushing it, so opening it never moves anything, and
// closing it puts everything back exactly where it was.
//
// State is the per-day record in hytState.js — the same one the old Practice tab used — so
// nothing about a day already in progress is lost in the move.

import React, { useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Clock, ChevronDown, Send, MessageCircle, Heart, Globe, Footprints, Sprout } from "lucide-react";
import { pickDaily, todayKey, ageBandFor } from "./hytPrompts";
import { loadDayState, saveDayState, onDayState, completeSlot, ageFromDob } from "./hytState";
import { recordReflection, actPhrase } from "./feelings";
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
  const day = todayKey();
  const ageBand = useMemo(() => ageBandFor(ageFromDob(dob)), [dob]);
  const [state, setState] = useState(() => loadDayState(day));
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState(null); // "notes" | "time" — a sub-part of the panel
  const [answer, setAnswer] = useState("");
  const [askTime, setAskTime] = useState(() => !nudgeAsked());

  const update = (next) => { setState(next); saveDayState(day, next); };

  // A send, reply or note elsewhere on the screen lands here live — and opens the panel on the
  // reflection, because the moment just after is the one worth ten seconds of thought.
  useEffect(() => onDayState((d) => {
    if (d?.day !== day || !d.state) return;
    setState((prev) => {
      const wasDone = Boolean(prev.sent || prev.done?.kindness || prev.done?.who);
      const nowDone = Boolean(d.state.sent || d.state.done?.kindness || d.state.done?.who);
      if (!wasDone && nowDone) { setOpen(true); setSection(null); }
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
  const route = actDone || whoDone ? "act" : state.sentVia === "reply" ? "reply" : state.sentVia === "note" ? "note" : "sent";
  const toName = whoDone ? state.whoName : state.sentTo;
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
  const question = useMemo(
    () => pickReflect({ uid, day, route, weekCount, isSunday: new Date().getDay() === 0 }),
    [uid, day, route, weekCount]
  );
  const qText = fillName(question.q, toName);
  const awaitingReflection = done && !state.reflected && !state.reflectSkipped;
  const awaitingTime = done && !awaitingReflection && askTime && !Number.isInteger(nudgeHour);

  const what = route === "reply" ? `told ${toName || "someone"} how their words landed`
    : route === "note" ? `sent ${toName || "someone"} a kind note`
    : route === "sent" ? "sent a kind message to someone in the world"
    : whoDone ? `made ${toName || "someone"} feel seen` : actPhrase(item.text);

  const reflect = (value) => {
    const a = String(value || "").trim();
    if (!a) return;
    const already = Boolean(state.reflected);
    update({ ...state, reflected: { id: question.id, q: qText, answer: a.slice(0, 140) } });
    rememberPick(day, question.id);
    recordReflection(db, currentUser?.uid, {
      day, route, act: what, questionId: question.id, question: qText, answer: a, alreadyAwarded: already,
    });
    if (question.kind === "next") setWhosNext(day, a);
    setAnswer("");
  };
  const skipReflection = () => { rememberPick(day, question.id); update({ ...state, reflectSkipped: true }); };

  const sayMore = () => {
    const r = state.reflected;
    const prompt = `Today you ${what}.${r ? ` ${r.q || qText} — ${r.answer}.` : ""} What happened, and what did you notice?`;
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
    update({ ...completeSlot(state, "who", { onKindAct }), whoName: next });
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
    // z-[45]: above the sticky feed headers (z 32), which used to cut the open panel in half,
    // and below every sheet and portal (z 240+).
    <div className="relative z-[45] flex-shrink-0 px-3.5 pt-2">
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
        <ChevronDown size={17} className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* First visit: point at the one thing to press. */}
      {coach && !open && (
        <div className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 -translate-x-1/2" style={{ animation: "seenFadeUp 300ms ease both" }}>
          <div className="mx-auto h-0 w-0" style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "7px solid rgba(15,23,42,0.9)" }} />
          <div className="send-coach-hop whitespace-nowrap rounded-full bg-slate-900/90 px-3.5 py-2 text-[12px] font-semibold text-white shadow-lg">
            👆 Start here — make someone feel seen
          </div>
        </div>
      )}

      {/* ── The panel, over the feed ───────────────────────────────────────────────────────── */}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-3.5 right-3.5 top-full z-40 mt-1.5 max-h-[calc(100dvh-170px)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
            style={{ animation: "seenDropIn 180ms ease-out both" }}>

            {section === "time" || awaitingTime ? (
              <NudgeChooser
                title={awaitingTime ? "When should we remind you tomorrow?" : "Your daily reminder"}
                current={Number.isInteger(nudgeHour) ? nudgeHour : null}
                onPick={pickTime} onSkip={skipTime} />
            ) : awaitingReflection ? (
              // ── A different small question each day, about the other person ───────────────
              <div style={{ animation: "seenFadeUp 220ms ease both" }}>
                <p className="text-[11px] font-semibold text-teal-600">{consequence(route, echo, toName)}</p>
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
                      {follows.slice(0, 6).map((f) => (
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
        </>
      )}
    </div>
  );
}
