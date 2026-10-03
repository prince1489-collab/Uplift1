// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// UpdateNote.jsx — "A new version of Seen is ready". See appVersion.js for when it shows.

import React from "react";
import { X } from "lucide-react";

export default function UpdateNote({ update, onDismiss }) {
  if (!update) return null;
  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2" role="status">
      <span className="text-base leading-none" aria-hidden>✨</span>
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-slate-700">
        {update.required ? "Please update Seen to keep everything working." : `A new version of Seen (${update.latest}) is ready.`}
      </p>
      <a href={update.url} target="_blank" rel="noopener noreferrer"
        className="flex-shrink-0 rounded-full bg-teal-600 px-3 py-1 text-[12px] font-bold text-white">Update</a>
      {!update.required && (
        <button onClick={onDismiss} aria-label="Not now" className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-slate-400 hover:text-slate-600">
          <X size={13} />
        </button>
      )}
    </div>
  );
}
