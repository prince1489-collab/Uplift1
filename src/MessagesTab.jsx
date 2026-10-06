// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// MessagesTab.jsx — every private conversation, one per person.
//
// Private replies and kind notes used to vanish once sent: the app only ever listened for what
// arrived, so "I replied to Mateo this morning" could not be checked anywhere. This tab puts both
// sides together (conversations.js does the grouping). The list is one row per person; opening it
// shows each exchange as a small thread — the post it was about, then the bubbles in order — and,
// under the last bubble, whatever the rules still allow you to write (Reply back / Write back one
// last time). Writing still goes through PrivateReplySheet, so screening, limits and push are the
// same as everywhere else.

import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { ChevronLeft, MessageCircle, Send } from "lucide-react";
import { FLAG_MAP } from "./MicroAnimations";
import { nextStep } from "./conversations";
import SeenConversation, { SeenAvatar, AiTag } from "./SeenConversation";
import { SEEN_ID, seenUnread } from "./seenChat";

const flagFor = (c) => (c && FLAG_MAP[c] ? FLAG_MAP[c] : "🌍");
const first = (n) => String(n || "Someone").split(" ")[0];
const strip = (t) => String(t || "").replace(/^[“"]|[”"]$/g, "");

function when(ts) {
  const t = Number(ts) || 0;
  if (!t) return "";
  const d = new Date(t);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  if (d.toDateString() === y.toDateString()) return `Yesterday ${time}`;
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function Bubble({ m, name }) {
  return (
    <div className={`flex ${m.mine ? "justify-end" : "justify-start"}`} data-unread={!m.mine && m.read === false ? "1" : undefined}>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${m.mine ? "rounded-br-md bg-teal-600 text-white" : "rounded-bl-md bg-sky-50 border border-sky-100 text-slate-800"}`}>
        <p className="text-[14px] leading-snug whitespace-pre-wrap">{m.text}</p>
        <p className={`mt-0.5 text-[10px] ${m.mine ? "text-teal-100" : "text-slate-400"}`}>
          {m.mine ? "You" : first(name)} · {when(m.ts)}{m.final ? " · last word" : ""}
        </p>
      </div>
    </div>
  );
}

function Conversation({ person, myUid, canNote, onBack, onAction, onNote, onMarkRead }) {
  // Opening a conversation is reading it.
  const unreadIds = useMemo(
    () => person.threads.flatMap((t) => t.messages).filter((m) => !m.mine && m.read === false).map((m) => m.id),
    [person]
  );
  useEffect(() => { if (unreadIds.length) onMarkRead?.(unreadIds); }, [unreadIds, onMarkRead]);

  // Open where the news is (3.11): the first message you haven't read, or else the newest — not
  // the top of a history that can go back months. Once per person, before paint, so the list
  // never visibly jumps; marking things read afterwards doesn't move you again.
  const scrollRef = useRef(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const unread = el.querySelector("[data-unread]");
    if (unread) unread.scrollIntoView({ block: "center" });
    else el.scrollTop = el.scrollHeight;
  }, [person.uid]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-100 px-2 py-2">
        <button onClick={onBack} aria-label="Back to messages" className="grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100">
          <ChevronLeft size={20} />
        </button>
        <p className="text-[16px] font-bold text-slate-800">{person.name || "Someone"} {flagFor(person.country)}</p>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
        {person.threads.map((t) => {
          const step = nextStep(t, myUid);
          return (
            <div key={t.id} className="space-y-2">
              <div className="mx-auto max-w-[90%] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {t.isNote ? "Kind note" : t.postByMe ? "Your message" : `${first(person.name)}'s message`}
                </p>
                {!t.isNote && t.postText && <p className="mt-0.5 text-[12px] italic text-slate-500">“{strip(t.postText)}”</p>}
              </div>
              {t.messages.map((m) => <Bubble key={m.id} m={m} name={person.name} />)}
              {step ? (
                <div className={`flex ${step.mode === "final" ? "justify-end" : "justify-start"}`}>
                  <button onClick={() => onAction?.(step.doc)}
                    className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-[12px] font-semibold text-teal-700 active:scale-95">
                    {step.mode === "answer" ? "Reply back" : "Write back one last time"}
                  </button>
                </div>
              ) : t.complete ? (
                <p className="text-center text-[10px] text-slate-400">This exchange is complete</p>
              ) : null}
            </div>
          );
        })}
      </div>
      {canNote && (
        <div className="flex-shrink-0 border-t border-slate-100 px-4 pt-2" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <button onClick={() => onNote?.(person)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-[13px] font-bold text-white active:scale-[0.99]">
            <Send size={14} /> Send {first(person.name)} a kind note
          </button>
        </div>
      )}
    </div>
  );
}

// "Seen" — the AI conversation (3.15) — always pinned first. Its preview is the last thing Seen
// said, or an invitation before it's been switched on.
function SeenRow({ seen, onOpen }) {
  const lastSeen = [...(seen.chat || [])].reverse().find((m) => m.role === "seen");
  const unread = seenUnread(seen.chat);
  const preview = !seen.consent ? "A few questions about your life — just for you"
    : lastSeen?.kind === "reflection" ? "✨ Seen noticed something"
    : lastSeen?.text || "Every few days, a question about your life";
  return (
    <button onClick={onOpen} className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-orange-50 ${unread || !seen.consent ? "bg-orange-50/70" : "bg-white"}`}>
      <SeenAvatar />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`text-[14px] ${unread ? "font-extrabold text-slate-900" : "font-semibold text-slate-800"}`}>Seen</span>
          <AiTag />
          {lastSeen && <span className="ml-auto flex-shrink-0 text-[11px] text-slate-400">{when(lastSeen.createdAt)}</span>}
        </span>
        <span className={`block truncate text-[12px] ${unread ? "font-semibold text-slate-700" : "text-slate-500"}`}>{preview}</span>
      </span>
      {unread > 0 && (
        <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>
      )}
    </button>
  );
}

export default function MessagesTab({ conversations = [], myUid, followUids = new Set(), openUid, onOpen, onClose, onAction, onNote, onMarkRead, onStart,
  db, currentUser, seen = null, onWriteTo, onOpenSupport }) {
  if (openUid === SEEN_ID && seen && currentUser) {
    return (
      <SeenConversation db={db} currentUser={currentUser} chat={seen.chat} state={seen.state} consent={seen.consent}
        onBack={onClose} onWriteTo={onWriteTo} onOpenSupport={onOpenSupport} />
    );
  }
  const person = openUid ? conversations.find((c) => c.uid === openUid) : null;
  if (person) {
    return (
      <Conversation person={person} myUid={myUid} canNote={followUids.has(person.uid)}
        onBack={onClose} onAction={onAction} onNote={onNote} onMarkRead={onMarkRead} />
    );
  }
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60">
      {seen && <div className="border-b border-slate-100"><SeenRow seen={seen} onOpen={() => onOpen?.(SEEN_ID)} /></div>}
      {conversations.length === 0 ? (
        <div className="mx-4 mt-8 rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center">
          <MessageCircle size={28} className="mx-auto text-teal-500" />
          <p className="mt-2 text-[15px] font-bold text-slate-800">Your private conversations</p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
            Reply to someone's message or send a kind note, and the conversation appears here — both sides of it.
          </p>
          <button onClick={onStart} className="mt-4 rounded-xl bg-teal-600 px-4 py-2 text-[13px] font-bold text-white">Make someone feel seen</button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 bg-white">
          {conversations.map((c) => (
            <li key={c.uid}>
              <button onClick={() => onOpen?.(c.uid)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-emerald-400 text-[16px] font-bold text-white">
                  {first(c.name)[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={`truncate text-[14px] ${c.unread ? "font-extrabold text-slate-900" : "font-semibold text-slate-800"}`}>{c.name || "Someone"}</span>
                    <span className="text-[12px]">{flagFor(c.country)}</span>
                    <span className="ml-auto flex-shrink-0 text-[11px] text-slate-400">{when(c.lastTs)}</span>
                  </span>
                  <span className={`block truncate text-[12px] ${c.unread ? "font-semibold text-slate-700" : "text-slate-500"}`}>
                    {c.last?.mine ? "You: " : ""}{c.last?.text}
                  </span>
                </span>
                {c.unread > 0 && (
                  <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{c.unread}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
