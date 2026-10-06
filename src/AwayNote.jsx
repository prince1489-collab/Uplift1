// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// AwayNote.jsx — "While you were away…", once, on the first open after two days or more (3.11).
//
// Someone coming back after a gap is the person most likely to drift off for good, and the first
// thing they used to meet was the same bar as everyone else. This tells them what happened while
// they were gone — the hearts their words got, who wrote to them — because being reminded you
// were felt is the best reason to come back, and it is always true. With no news it just says
// the door is open. Never a count of days missed: that would be guilt, and guilt is not a mechanic.

import React from "react";
import { X } from "lucide-react";

export default function AwayNote({ note, hearts = 0, unread = null, onRead, onStart, onDismiss }) {
  if (!note) return null;
  const parts = [];
  if (hearts > 0) parts.push(`${hearts} ${hearts === 1 ? "heart" : "hearts"} on your words`);
  if (unread?.count > 0) parts.push(unread.count === 1 && unread.name ? `${unread.name} wrote to you` : `${unread.count} messages waiting`);
  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2" role="status"
      style={{ animation: "seenFadeUp 300ms ease both" }}>
      <span className="text-base leading-none" aria-hidden>{parts.length ? "❤️" : "🌱"}</span>
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-slate-700">
        {parts.length
          ? <><span className="font-bold">While you were away:</span> {parts.join(" · ")}</>
          : <><span className="font-bold">Welcome back.</span> One kind word is still enough.</>}
      </p>
      <button onClick={unread?.count > 0 ? onRead : onStart}
        className="flex-shrink-0 rounded-full bg-teal-600 px-3 py-1 text-[12px] font-bold text-white">
        {unread?.count > 0 ? "Read" : "Start"}
      </button>
      <button onClick={onDismiss} aria-label="Dismiss" className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-slate-400 hover:text-slate-600">
        <X size={13} />
      </button>
    </div>
  );
}
