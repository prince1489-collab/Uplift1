// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// OneThingCard.jsx — "Your one thing today" (3.34). The day's ask is one kind act, and once it's
// done the home screen says so — "that's enough" — instead of asking for more.

import React from "react";

export default function OneThingCard({ done = false, onOpen }) {
  if (done) {
    return (
      <p className="seen-one-thing mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] font-semibold text-emerald-800"
        style={{ animation: "seenFadeUp 320ms ease both" }}>
        ✓ You made someone feel seen today — that's enough 🌱
      </p>
    );
  }
  return (
    <button onClick={onOpen}
      className="seen-one-thing mb-3 flex w-full items-center gap-2.5 rounded-2xl border border-orange-200 bg-white px-3.5 py-2.5 text-left shadow-sm active:scale-[0.99] transition-transform"
      style={{ animation: "seenFadeUp 320ms ease both" }}>
      <span className="text-[16px]" aria-hidden>✨</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-bold uppercase tracking-wide text-orange-600">Your one thing today</span>
        <span className="block text-[13.5px] font-semibold text-slate-800">Make someone feel seen — it takes a minute</span>
      </span>
      <span className="text-[13px] font-bold text-teal-700" aria-hidden>→</span>
    </button>
  );
}
