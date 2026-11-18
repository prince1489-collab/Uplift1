// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// SinceLastCard.jsx — "Since you were last here", first on the home screen (3.32). The lines
// come from sinceLast.js; each one opens what it is about.

import React from "react";
import { ChevronRight } from "lucide-react";

export default function SinceLastCard({ items = [], onAction }) {
  return (
    <section className="seen-since mb-3 rounded-2xl border border-slate-200 bg-white px-3.5 pb-2 pt-3 shadow-sm"
      style={{ animation: "seenFadeUp 320ms ease both" }} aria-label="Since you were last here">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Since you were last here</p>
      {items.length ? (
        <ul className="mt-1">
          {items.map((it) => (
            <li key={it.key}>
              <button onClick={() => onAction?.(it.action)}
                className="flex w-full items-start gap-2.5 rounded-xl py-2 text-left active:bg-slate-50">
                <span className="mt-[1px] text-[15px] leading-none" aria-hidden>{it.icon}</span>
                <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-slate-700">{it.text}</span>
                <ChevronRight size={15} className="mt-[1px] flex-shrink-0 text-slate-300" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-1 mt-1 text-[13px] leading-snug text-slate-500">Quiet since you were last here — nothing missed.</p>
      )}
    </section>
  );
}
