// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// MicButton.jsx — the visible way to talk instead of type (3.23). Phones' keyboards have a
// dictation key, and almost nobody finds it; a big, plain "Say it instead of typing" in the place
// you are being asked to write is what changes what people do. See dictation.js.
//
//   variant "pill" — a full-width button under a writing box, with any error underneath.
//   variant "icon" — a round button for a chat input row; the caller shows `dictation.error`.
//
// Renders nothing where the device has no speech service.

import React from "react";
import { Mic, Square } from "lucide-react";

export default function MicButton({ dictation, variant = "pill", className = "" }) {
  if (!dictation?.supported) return null;
  const { listening, error, toggle } = dictation;

  if (variant === "icon") {
    return (
      <button type="button" onClick={toggle} aria-pressed={listening}
        aria-label={listening ? "Stop listening" : "Talk instead of typing"}
        className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full transition-colors ${listening ? "bg-red-500 text-white animate-pulse" : "text-slate-500 hover:bg-slate-100"} ${className}`}>
        {listening ? <Square size={11} fill="currentColor" /> : <Mic size={17} />}
      </button>
    );
  }

  return (
    <div className={className}>
      <button type="button" onClick={toggle} aria-pressed={listening}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[13.5px] font-semibold transition-colors ${listening
          ? "border-red-300 bg-red-50 text-red-600"
          : "border-teal-200 bg-white text-teal-700 hover:bg-teal-50"}`}>
        {listening
          ? <><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden /> Listening… tap when you're done</>
          : <><Mic size={16} aria-hidden /> Say it instead of typing</>}
      </button>
      {error && <p className="mt-1 text-center text-[11.5px] leading-snug text-slate-500" role="status">{error}</p>}
    </div>
  );
}
