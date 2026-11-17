// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// PushAskNote.jsx — "Want to know when your words land?", shown just after a kind act (3.28).
// See pushAsk.js for when, and nativePush.registerNativePush({ ask: true }) for what Yes does.

import React from "react";
import { Bell } from "lucide-react";

export default function PushAskNote({ onYes, onLater }) {
  return (
    <div className="mb-2 rounded-2xl border border-orange-200 bg-orange-50 px-3.5 py-3" role="dialog" aria-label="Notifications"
      style={{ animation: "seenFadeUp 260ms ease both" }}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-white text-orange-500"><Bell size={14} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold leading-snug text-slate-800">Want to know when your words land?</p>
          <p className="mt-0.5 text-[12px] leading-snug text-slate-600">
            Seen will tell you when someone feels your words or writes back, and remind you at the time you choose. Nothing else.
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex gap-2 pl-[38px]">
        <button onClick={onYes} className="flex-1 rounded-xl bg-teal-600 py-2 text-[13px] font-bold text-white active:scale-[0.99]">Yes, tell me</button>
        <button onClick={onLater} className="rounded-xl px-3 py-2 text-[12.5px] font-semibold text-slate-500">Not now</button>
      </div>
    </div>
  );
}
