// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// SeenConversation.jsx — the "Seen" conversation, pinned first in Messages (3.15).
//
// Seen asks a question about your life every few days; you answer in the one box; Seen replies
// once, specifically. Every few days, when something is genuinely supported, a "Seen noticed"
// message reflects a pattern back — with the evidence one tap away, and "That's me / Not quite /
// Forget this" so you stay the authority on yourself. When you've named someone you'd like to
// make feel seen, Seen points you back to them. It is labelled an AI everywhere, it is private,
// and "Forget everything" is always in the ⋯ menu. See seenChat.js and api/understand.js.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, MoreHorizontal, Send, X, Loader2 } from "lucide-react";
import { enableSeen, sendToSeen, markSeenRead, giveFeedback, swapQuestion, shareRightNow, forgetEverything } from "./seenChat";
import { readPublicProfile } from "./publicProfile";

export function SeenAvatar({ size = 44 }) {
  return (
    <span className="grid flex-shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, fontSize: size * 0.45, background: "radial-gradient(circle at 30% 30%, #FFE7B8, #FFAD6E 55%, #E07C33)", boxShadow: "0 0 0 3px #FFF1E6" }}
      aria-hidden>✨</span>
  );
}
export const AiTag = () => (
  <span className="rounded-full bg-orange-100 px-1.5 py-px text-[9.5px] font-extrabold tracking-wide text-orange-700">AI</span>
);

const dayLabel = (ts) => {
  const d = new Date(Number(ts)), t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
};
const timeOf = (ts) => new Date(Number(ts)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function Reflection({ m, uid, db }) {
  const [why, setWhy] = useState(false);
  const fb = m.feedback;
  return (
    <div className="max-w-[90%] self-start rounded-[18px] rounded-bl-md border-[1.5px] border-amber-300 bg-white px-3.5 py-2.5 shadow-[0_3px_12px_rgba(245,180,40,0.15)]">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-orange-700">✨ Seen noticed</p>
      <p className="mt-1 text-[14px] leading-snug text-slate-800">{m.text}</p>
      <button onClick={() => setWhy((v) => !v)} className="mt-1.5 text-[11.5px] font-semibold text-orange-700">
        {why ? "Hide why" : "Why I think this ›"}
      </button>
      {why && (
        <ul className="mt-1.5 space-y-0.5 rounded-xl bg-orange-50/80 px-2.5 py-2 text-[11.5px] leading-snug text-slate-600">
          {(m.evidence || []).map((e, i) => <li key={i}>• {e.label}</li>)}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[["yes", "💛 That's me"], ["no", "Not quite"], ["forget", "Forget this"]].map(([v, label]) => (
          <button key={v} onClick={() => giveFeedback(db, uid, m.id, fb === v ? null : v)}
            className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-all active:scale-95 ${
              fb === v ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-500"}`}>
            {label}
          </button>
        ))}
      </div>
      {fb === "no" && <p className="mt-1.5 text-[11px] text-slate-400">Thanks — Seen will take that into account.</p>}
      {fb === "forget" && <p className="mt-1.5 text-[11px] text-slate-400">Forgotten. Seen won't build on this.</p>}
    </div>
  );
}

// What Seen knows: the living themes, your shared line, and Forget everything.
function KnowsPanel({ db, currentUser, state, onClose }) {
  const [line, setLine] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let alive = true;
    readPublicProfile(db, currentUser.uid).then((p) => { if (alive) { setLine(p?.rightNow || ""); setDraft(p?.rightNow || ""); } });
    return () => { alive = false; };
  }, [db, currentUser.uid]);
  const themes = state?.themes || [];
  const save = async (text) => {
    setBusy(true); setMsg("");
    try { await shareRightNow(db, currentUser, text); setLine(text.trim()); setMsg(text.trim() ? "Shared ✓" : "Removed from your profile."); }
    catch (e) { setMsg(e.message || "Couldn't save that just now."); }
    setBusy(false);
  };
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white" style={{ animation: "seenFadeUp 200ms ease both" }}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        <p className="flex-1 text-[15px] font-bold text-slate-800">What Seen knows about you</p>
        <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-slate-400"><X size={18} /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">What seems to matter to you right now</p>
          {themes.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {themes.map((t) => <span key={t.name} className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[12.5px] font-semibold text-orange-800">{t.name}</span>)}
            </div>
          ) : <p className="mt-1.5 text-[13px] text-slate-500">Nothing yet. Answer a couple of Seen's questions and this will start to fill in — and change as your life does.</p>}
          <p className="mt-1.5 text-[11px] text-slate-400">Themes fade after a month if they stop coming up. "Not quite" and "Forget this" on a reflection change them too.</p>
        </section>
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Share a line on your profile</p>
          <p className="mt-1 text-[12.5px] text-slate-500">Optional. People who tap your name will see it, so they can understand you — and send a kindness that fits.</p>
          <div className="mt-2 flex gap-1.5">
            <input value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 80))} placeholder="Right now: training for my first 10k"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13.5px] focus:border-teal-400 focus:outline-none" />
            <button disabled={busy || draft.trim() === (line || "")} onClick={() => save(draft)}
              className="rounded-xl bg-teal-600 px-3 text-[12.5px] font-bold text-white disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin" /> : "Share"}</button>
          </div>
          {msg && <p className="mt-1 text-[12px] font-semibold text-teal-700">{msg}</p>}
          {line ? (
            <div className="mt-2 rounded-2xl border border-orange-200 bg-orange-50/60 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-orange-600">🌱 Right now…</p>
              <p className="text-[13.5px] text-slate-700">{line}</p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Where people see it</p>
              <ul className="mt-1 space-y-0.5 text-[12px] leading-snug text-slate-600">
                <li>• Next to your name in the feed, for people who follow you</li>
                <li>• On your glimpse, when someone taps your name</li>
                <li>• When someone writes you a kind note — so it can be about this</li>
              </ul>
              <p className="mt-1.5 text-[11px] text-slate-400">Tap "You" above your messages to see it as others do. It fades after 30 days.</p>
              <button onClick={() => { setDraft(""); save(""); }} className="mt-2 text-[12px] font-semibold text-slate-400">Remove it from my profile</button>
            </div>
          ) : null}
        </section>
        <section className="rounded-2xl bg-slate-50 px-3.5 py-3 text-[12px] leading-relaxed text-slate-500">
          Seen is an AI. Your conversation is private to you. To reply and notice patterns, what you write here and how you use Seen are processed by Anthropic's AI on our behalf; it isn't used to train their models. Nothing here is ever shown to anyone else unless you share a line above.
        </section>
        <section>
          {!confirm ? (
            <button onClick={() => setConfirm(true)} className="w-full rounded-xl border border-red-200 py-2.5 text-[13px] font-bold text-red-600">Forget everything</button>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-700">
              This deletes your whole conversation with Seen, everything it has noticed, and your shared line, and turns Seen off. It can't be undone.
              <div className="mt-2 flex gap-2">
                <button onClick={async () => { setBusy(true); await forgetEverything(db, currentUser.uid); setBusy(false); onClose(true); }}
                  className="flex-1 rounded-lg bg-red-600 py-2 font-bold text-white">{busy ? "Forgetting…" : "Yes, forget everything"}</button>
                <button onClick={() => setConfirm(false)} className="flex-1 rounded-lg border border-red-200 bg-white py-2 font-semibold">Keep it</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Consent({ onStart, onBack, busy }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center" style={{ animation: "seenFadeUp 250ms ease both" }}>
      <SeenAvatar size={68} />
      <p className="mt-4 text-[20px] font-extrabold text-slate-800">Meet Seen <AiTag /></p>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-600">Every few days, Seen asks you a question about your life — what's keeping you busy, what's on your mind, what you're working towards.</p>
      <ul className="mt-4 space-y-2 text-left text-[13px] leading-snug text-slate-600">
        <li>💬 It listens, and replies to what you share.</li>
        <li>✨ Over time it reflects back what seems to matter to you — always showing why.</li>
        <li>🔒 Private to you. Processed by Anthropic's AI for us, not used to train it.</li>
        <li>🧹 You can forget everything, any time.</li>
      </ul>
      <button onClick={onStart} disabled={busy} className="mt-6 w-full rounded-2xl bg-teal-600 py-3 text-[14px] font-bold text-white disabled:opacity-60">
        {busy ? "Starting…" : "Start"}
      </button>
      <button onClick={onBack} className="mt-2 py-2 text-[13px] font-semibold text-slate-400">Not now</button>
    </div>
  );
}

export default function SeenConversation({ db, currentUser, chat, state, consent, onBack, onWriteTo, onOpenSupport }) {
  const uid = currentUser.uid;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [knows, setKnows] = useState(false);
  const [swapped, setSwapped] = useState(() => new Set());
  const scrollRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => { if (consent && chat) markSeenRead(db, uid, chat); }, [consent, chat, db, uid]);
  useLayoutEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [chat?.length, sending]);
  // The box grows with what you write — up to about five lines, then it scrolls — so a real
  // answer is never squeezed into one line where you can't see it (3.18).
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  const last = chat?.[chat.length - 1];
  const waiting = sending || last?.role === "me"; // Seen hasn't answered yet
  const lastQ = [...(chat || [])].reverse().find((m) => m.role === "seen" && m.kind === "question");
  const lastQOpen = lastQ && !(chat || []).some((m) => m.role === "me" && Number(m.createdAt) > Number(lastQ.createdAt));

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setText(""); setSending(true);
    try { await sendToSeen(db, currentUser, chat, t); } finally { setSending(false); }
  };

  let prevDay = null;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-100 px-2 py-2">
        <button onClick={onBack} aria-label="Back to messages" className="grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><ChevronLeft size={20} /></button>
        <SeenAvatar size={34} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[15px] font-bold text-slate-800">Seen <AiTag /></p>
          <p className="truncate text-[10.5px] text-slate-400">Private to you · learns what matters to you</p>
        </div>
        {consent && <button onClick={() => setKnows(true)} aria-label="What Seen knows" className="grid h-10 w-10 place-items-center rounded-full text-slate-400"><MoreHorizontal size={20} /></button>}
      </div>

      {!consent ? (
        <Consent busy={starting} onBack={onBack} onStart={async () => { setStarting(true); try { await enableSeen(db, uid); } finally { setStarting(false); } }} />
      ) : (
        <>
          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain bg-[#fffdfa] px-3.5 py-3">
            {!chat && <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-300" /></div>}
            {(chat || []).map((m) => {
              const d = dayLabel(m.createdAt);
              const sep = d !== prevDay ? <p key={`d-${m.id}`} className="py-1 text-center text-[10.5px] font-semibold text-slate-400">{d}</p> : null;
              prevDay = d;
              let body;
              if (m.role === "me") {
                body = (
                  <div className="max-w-[80%] self-end rounded-[18px] rounded-br-md bg-teal-600 px-3 py-2 text-[14px] leading-snug text-white">
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    <p className="mt-0.5 text-[9.5px] text-teal-100">{timeOf(m.createdAt)}</p>
                  </div>
                );
              } else if (m.kind === "reflection") {
                body = <Reflection m={m} uid={uid} db={db} />;
              } else if (m.kind === "nudge") {
                body = (
                  <div className="max-w-[88%] self-start rounded-[18px] rounded-bl-md border border-orange-200 bg-orange-50 px-3 py-2 text-[13.5px] leading-snug text-slate-700">
                    {m.text}
                    <button onClick={() => onWriteTo?.(m.name)} className="mt-2 block rounded-full px-3 py-1 text-[12px] font-extrabold text-white"
                      style={{ background: "#D9692A" }}>Write to {m.name} ✨</button>
                  </div>
                );
              } else if (m.kind === "support") {
                body = (
                  <div className="max-w-[90%] self-start rounded-[18px] rounded-bl-md border border-sky-200 bg-sky-50 px-3 py-2 text-[13.5px] leading-snug text-slate-700">
                    {m.text}
                    <button onClick={onOpenSupport} className="mt-2 block rounded-full bg-sky-600 px-3 py-1 text-[12px] font-bold text-white">Open Support</button>
                  </div>
                );
              } else {
                const isOpenQ = m.kind === "question" && m.id === lastQ?.id && lastQOpen;
                body = (
                  <div className="max-w-[84%] self-start">
                    <div className="rounded-[18px] rounded-bl-md border border-orange-200 bg-orange-50 px-3 py-2 text-[14px] leading-snug text-slate-700">
                      <p className={m.kind === "question" ? "font-bold text-slate-800" : ""}>{m.text}</p>
                    </div>
                    {isOpenQ && !swapped.has(m.id) && m.qid !== "followup" && (
                      <button onClick={async () => { setSwapped((s) => new Set(s).add(m.id)); await swapQuestion(db, uid, chat, m); }}
                        className="mt-1 px-1 text-[11px] font-semibold text-slate-400">Ask me something else</button>
                    )}
                  </div>
                );
              }
              return <React.Fragment key={m.id}>{sep}{body}</React.Fragment>;
            })}
            {waiting && chat?.length > 0 && (
              <div className="self-start rounded-[18px] rounded-bl-md border border-orange-100 bg-orange-50 px-3 py-2 text-[13px] text-slate-400">
                <span className="inline-flex gap-1"><span className="animate-pulse">●</span><span className="animate-pulse [animation-delay:150ms]">●</span><span className="animate-pulse [animation-delay:300ms]">●</span></span>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 border-t border-slate-100 bg-white px-3 pt-2" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
            <div className="flex items-end gap-2 rounded-[20px] border border-slate-200 bg-slate-50 py-1.5 pl-3.5 pr-1.5">
              <textarea ref={boxRef} value={text} rows={1} onChange={(e) => setText(e.target.value.slice(0, 600))}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={lastQOpen ? "Your answer…" : "Reply to Seen, or ask it something…"}
                className="min-h-[24px] flex-1 resize-none overflow-y-auto bg-transparent py-1 text-[14px] leading-snug text-slate-800 placeholder:text-slate-400 focus:outline-none" />
              <button onClick={send} disabled={!text.trim() || sending} aria-label="Send"
                className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-teal-600 text-white disabled:opacity-40"><Send size={14} /></button>
            </div>
            <p className="mt-1 text-center text-[10px] text-slate-400">
              Seen is an AI. Only you can see this · <button onClick={() => setKnows(true)} className="underline">What Seen knows</button>
            </p>
          </div>
        </>
      )}
      {knows && <KnowsPanel db={db} currentUser={currentUser} state={state} onClose={(forgot) => { setKnows(false); if (forgot === true) onBack?.(); }} />}
    </div>
  );
}
