// glimpseExamples.js — inspiration for the two onboarding "glimpse" fields.
// Tappable idea chips make the boxes easy to fill; tapping one PREFILLS the field (still editable),
// so answers stay personal. Kept short (≤80 chars) and light — no personal details.

import React, { useState } from "react";

export const MOST_DAYS_EXAMPLES = [
  "a tired but hopeful nurse",
  "a mum running on coffee and love",
  "a quiet dreamer with a loud playlist",
  "a student figuring it all out",
  "a maker of small, good things",
  "someone who shows up, even on hard days",
  "a plant parent and part-time optimist",
  "a night-shift worker chasing sunrises",
  "a gentle soul in a busy city",
  "a work-in-progress, and that's okay",
];

export const ANOTHER_LIFE_EXAMPLES = [
  "a jazz pianist in Lisbon",
  "a lighthouse keeper with a good book",
  "a baker who knows everyone's name",
  "a wildlife photographer in the Serengeti",
  "a bookshop owner by the sea",
  "an astronaut, or at least a stargazer",
  "a street artist painting kindness",
  "a mountain guide with endless stories",
  "a ceramicist with clay-stained hands",
  "a travelling chef cooking for strangers",
];

// A small "tap for ideas" row: 3 rotating example chips + a shuffle. onPick(example) fills the field.
export function GlimpseChips({ examples, onPick, accent = "amber" }) {
  const [start, setStart] = useState(0);
  const shown = [0, 1, 2].map((i) => examples[(start + i) % examples.length]);
  const tint = accent === "violet"
    ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
    : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold text-slate-400">💡 ideas:</span>
      {shown.map((ex) => (
        <button key={ex} type="button" onClick={() => onPick(ex)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors active:scale-95 ${tint}`}>
          {ex}
        </button>
      ))}
      <button type="button" aria-label="More ideas" title="More ideas"
        onClick={() => setStart((s) => (s + 3) % examples.length)}
        className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
        🔀
      </button>
    </div>
  );
}
