// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// KindnessForYou.jsx — a stranger's kind words, delivered to you (3.21).
//
// Until 3.21, opening Seen meant being asked to give: there was rarely anything waiting that was
// about you. Now a message sent to "a stranger, anywhere in the world" lands on one real person
// (api/_kindness.js), and this is what that person sees:
//
//   KindnessNote  — one line above the orange button while a delivered message is waiting:
//                   "Vidhi in India sent you a few kind words." Read, or put it away.
//   KindnessSheet — the message itself, who sent it and from where, and three one-tap answers
//                   ("This was just what I needed today 💛"). One tap tells the sender their words
//                   reached someone, which is the reason they will come back too. "Write back"
//                   opens the ordinary reply sheet for anyone with more to say.
//
// Report or block sits under every delivered message, because these arrive uninvited.

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useVisibleViewport, sheetBox, sheetCap } from "./viewport";
import { FLAG_MAP } from "./MicroAnimations";
import { ReportBlockBar } from "./UpliftRetentionFeatures";
import { inCountry } from "./countryName";
import { QUICK_ANSWERS, answerKindness, markKindness, firstNameOf } from "./kindnessInbox";

const flagFor = (c) => (c && FLAG_MAP[c] ? FLAG_MAP[c] : "🌍");

// "sent you a few kind words" — the sender as the feed shows them.
function fromLine(message) {
  const first = firstNameOf(message?.sender);
  return message?.country ? `${first} in ${inCountry(message.country)}` : first;
}

function when(ms) {
  const d = new Date(Number(ms) || 0);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "today";
  if (d.toDateString() === yesterday.toDateString()) return "yesterday";
  return `on ${d.toLocaleDateString([], { day: "numeric", month: "short" })}`;
}

export function KindnessNote({ item, onOpen, onDismiss }) {
  if (!item?.message) return null;
  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2" role="status"
      style={{ animation: "seenFadeUp 300ms ease both" }}>
      <span className="text-base leading-none" aria-hidden>💌</span>
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-slate-700">
        <span className="font-bold">{fromLine(item.message)}</span> sent you a few kind words.
      </p>
      <button onClick={onOpen} className="flex-shrink-0 rounded-full bg-teal-600 px-3 py-1 text-[12px] font-bold text-white">
        Read
      </button>
      <button onClick={onDismiss} aria-label="Not now" className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-slate-400 hover:text-slate-600">
        <X size={13} />
      </button>
    </div>
  );
}

export function KindnessSheet({ item, db, currentUser, me, onClose, onWriteBack, onAnswered }) {
  const view = useVisibleViewport();
  const [state, setState] = useState(item?.answered ? "answered-before" : "idle"); // idle | sending | sent | answered-before | error
  const message = item?.message;
  const first = firstNameOf(message?.sender);

  // Opening it is reading it.
  useEffect(() => {
    if (item && !item.seen && db && currentUser?.uid) markKindness(db, currentUser.uid, item.id, { seen: true }).catch(() => {});
  }, [item, db, currentUser?.uid]);

  if (!item || !message) return null;

  const answer = async (text) => {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    try {
      await answerKindness({ db, currentUser, me, item, text });
      setState("sent");
      onAnswered?.(item, text);
    } catch {
      setState("error");
    }
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[260] flex flex-col justify-end" style={sheetBox(view)}>
      <div className="absolute inset-0 bg-black/40" onClick={state === "sending" ? undefined : onClose} aria-hidden />
      <div className="relative flex flex-col rounded-t-3xl bg-white shadow-2xl sheet-slide-up" style={sheetCap(view)}
        role="dialog" aria-modal="true" aria-labelledby="kfy-title">
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <p id="kfy-title" className="text-[17px] font-extrabold text-slate-900">A few kind words for you</p>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 pt-1" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
          <p className="text-[13px] text-slate-600">
            <span className="mr-1" aria-hidden>{flagFor(message.country)}</span>
            <span className="font-bold text-slate-800">{fromLine(message)}</span> sent this to you {when(item.deliveredAt)}.
          </p>

          <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3.5">
            <p className="text-[16px] font-semibold leading-snug text-slate-900">
              {message.proverbOriginal ? `“${message.text}”` : message.text}
            </p>
            {message.proverbOriginal && (
              <p className="mt-1.5 text-[12px] leading-snug text-slate-600">
                <span className="font-semibold">{message.proverbLanguage}:</span> {message.proverbOriginal}
                {message.proverbMeaning ? <><br /><span className="italic">Meaning: {message.proverbMeaning}</span></> : null}
              </p>
            )}
          </div>

          {state === "sent" ? (
            <div className="py-6 text-center" role="status">
              <p className="text-[28px]" aria-hidden>💛</p>
              <p className="mt-1 text-[15px] font-bold text-slate-900">{first} will know their words reached you.</p>
              <button onClick={onClose} className="mt-4 w-full rounded-2xl bg-teal-600 py-3 text-[14.5px] font-bold text-white">Done</button>
            </div>
          ) : state === "answered-before" ? (
            <div className="py-5 text-center">
              <p className="text-[13.5px] text-slate-600">You've already told {first} how this landed.</p>
              <button onClick={onClose} className="mt-3 w-full rounded-2xl border border-slate-200 py-3 text-[14px] font-semibold text-slate-700">Close</button>
            </div>
          ) : (
            <>
              <p className="mt-4 text-[12.5px] font-bold uppercase tracking-wide text-slate-500">How did it land?</p>
              <div className="mt-2 space-y-2">
                {QUICK_ANSWERS.map((a) => (
                  <button key={a.id} onClick={() => answer(a.text)} disabled={state === "sending"}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-white py-3 text-[14.5px] font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-50">
                    {state === "sending" ? <Loader2 size={15} className="animate-spin" /> : null}{a.text}
                  </button>
                ))}
              </div>
              {state === "error" && (
                <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700" role="alert">
                  That didn't send — check your connection and try again.
                </p>
              )}
              <button onClick={() => onWriteBack?.(item)} disabled={state === "sending"}
                className="mt-3 w-full py-2.5 text-[13.5px] font-semibold text-teal-700">
                Write back in your own words →
              </button>
            </>
          )}

          <div className="mt-2 flex justify-center pb-1">
            <ReportBlockBar db={db} currentUser={currentUser} targetUid={message.uid} targetName={first}
              contentId={item.messageId} contentKind="message" />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
