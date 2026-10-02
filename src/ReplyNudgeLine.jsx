// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// ReplyNudgeLine.jsx — the line that slides out under a message you just hearted. See replyNudge.js
// for when it appears; this is only how it looks. Small, under the bubble, gone by itself.

import React from "react";
import { MessageCircle, X } from "lucide-react";

export default function ReplyNudge({ name, onReply, onDismiss, align = "left" }) {
  return (
    <div className={`mt-1 flex ${align === "right" ? "justify-end" : "justify-start"}`}
      style={{ animation: "seenFadeUp 260ms ease both" }}>
      <div className="flex items-center gap-1 rounded-full border border-teal-200 bg-white pl-1 pr-1 shadow-sm">
        <button onClick={(e) => { e.stopPropagation(); onReply?.(); }}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-teal-700 hover:bg-teal-50 active:scale-95 transition-all">
          <MessageCircle size={13} /> Tell {name || "them"} what it meant to you →
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDismiss?.(); }} aria-label="Not now"
          className="grid h-6 w-6 place-items-center rounded-full text-slate-300 hover:text-slate-500">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
