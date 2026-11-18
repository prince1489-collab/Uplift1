// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// TodayTab.jsx — the "Today" tab, the one Seen opens on (3.35).
//
// 3.34 put the daily cards at the top of Connect, and the founder found it busy: one scroll was
// doing two jobs — "what's for me today?" (short, personal, done in a minute) and "what are people
// saying?" (open-ended reading). So they are two tabs. Today answers the first and then ends;
// Connect is where you go to read people.
//
// Three cards, no more — anything new should replace one rather than join them:
//   Since you were last here (after a first kind act — before that it would only be empty)
//   Today's question
//   Your one thing today
// with the welcome card above them for a brand-new account.

import React from "react";
import { Sparkles, X } from "lucide-react";

export default function TodayTab({ showWelcome = false, onDismissWelcome, since = null, question = null, oneThing = null }) {
  return (
    <main className="seen-today-tab flex-1 overflow-y-auto bg-slate-50/60 px-3.5 pt-3 pb-4">
      {showWelcome && (
        <div className="seen-welcome-card relative mb-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5 pr-9"
          style={{ animation: "seenFadeUp 400ms ease both" }}>
          <button onClick={onDismissWelcome} aria-label="Dismiss welcome"
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-white/60 hover:text-slate-600">
            <X size={13} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-400 text-white shadow-sm">
              <Sparkles size={16} />
            </div>
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Seen · official</span>
          </div>
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-700">
            Welcome to Seen 💛 — a little corner of the internet whose only job is kindness. Tap “Make Someone Feel Seen” below, and someone, somewhere, will feel it.
          </p>
        </div>
      )}
      {since}
      {question}
      {oneThing}
      <p className="mt-5 mb-2 text-center text-[12.5px] font-semibold text-slate-400">That's today 🌱 — see you tomorrow.</p>
    </main>
  );
}
