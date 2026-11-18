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
//   Since you were last here (once you've done a kind act — before that it would only be empty)
//   Today's question
//   Your one thing today
// The "Seen · official" welcome card that sat above them is gone (3.36): it came back after every
// sign-in, and the cards already say what to do.

import React from "react";

export default function TodayTab({ since = null, question = null, oneThing = null }) {
  return (
    <main className="seen-today-tab flex-1 overflow-y-auto bg-slate-50/60 px-3.5 pt-3 pb-4">
      {since}
      {question}
      {oneThing}
      <p className="mt-5 mb-2 text-center text-[12.5px] font-semibold text-slate-400">That's today 🌱 — see you tomorrow.</p>
    </main>
  );
}
