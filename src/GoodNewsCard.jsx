// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// GoodNewsCard.jsx — one uplifting story a day, at the top of Connect.
//
// ── READS FIRESTORE, NEVER THE API ───────────────────────────────────────────
// A cron calls /api/goodnews once a day and stores the chosen story at meta/goodNewsToday; this
// reads that single document. Clients never touch the endpoint.
//
// That is a requirement rather than a nicety. GNews's free tier is 100 requests a DAY, so
// fetching on open would exhaust it before lunch at a few dozen users — and then the feature
// breaks for everyone in a way that looks like a bug rather than a quota. Reading one document
// also means the card is instant, works from cache, and shows EVERYONE THE SAME STORY, which is
// the point: a thing two people can both have read is worth more here than a personalised list
// nobody else saw.
//
// ── WHY IT IS COLLAPSED, AND WHY IT IS NOW ONE LINE ─────────────────────────
// Connect is the screen about people who wrote to you. A daily 200-word article sitting open
// above them would push the messages off the first screen every single day, which inverts what
// the tab is for.
//
// It used to show the headline too, which ran to three lines — so "collapsed" still cost a
// third of the first screen, and the control that opened it was a 10px grey chevron in the
// corner beside all that text. One line now: the category, a sweep through it, and words that
// say what the tap does. The headline is part of the story and belongs with it.

import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

// ── The summary arrives as prose, usually ────────────────────────────────────
// Haiku is asked for plain prose and mostly obliges, but one day it returned a markdown heading
// and the card — which renders the text verbatim — put `# A Foster Care Village Opens Its Doors`
// on the owner's home screen.
//
// The prompt is now explicit about it (api/goodnews.js), but this card reads FIRESTORE, not the
// API: a story already stored would keep its hash until the next cron. So the strip happens on
// read as well. Two cheap guards on opposite sides of a daily job are better than one.
//
// Deliberately not a markdown renderer. The summary is meant to be prose; anything that turned
// up here formatted is a mistake being cleaned up, not a feature being supported.
function asPlainText(s) {
  return String(s || "")
    .split("\n")
    .map((line) => line
      .replace(/^\s{0,3}#{1,6}\s+/, "")       // # heading
      .replace(/^\s{0,3}>\s?/, "")            // > blockquote
      .replace(/^\s{0,3}[-*+]\s+/, "• ")      // - bullet, kept as a bullet
    )
    .join("\n")
    .replace(/\*\*(.+?)\*\*/g, "$1")          // **bold**
    .replace(/(^|\s)_(.+?)_(?=\s|$)/g, "$1$2") // _italic_, only when it wraps a word
    .trim();
}

// Older than this and the card hides itself. The cron fails closed — a day with nothing suitable
// leaves the previous story in place rather than publishing the least-bad remaining one — so
// without an expiry a quiet stretch would leave a stale "today's" story sitting there for a week.
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

export default function GoodNewsCard({ db }) {
  const [story, setStory] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!db) return;
    // A listener rather than a one-shot read: the document changes once a day, and the owner may
    // delete it from the console if a story lands badly. That deletion should take the card off
    // everyone's screen without waiting for them to reopen the app.
    return onSnapshot(
      doc(db, "meta", "goodNewsToday"),
      (snap) => {
        const d = snap.exists() ? snap.data() : null;
        if (!d?.title || !d?.summary) { setStory(null); return; }
        if (Date.now() - Number(d.publishedAt || 0) > MAX_AGE_MS) { setStory(null); return; }
        setStory(d);
      },
      () => setStory(null),
    );
  }, [db]);

  if (!story) return null;

  return (
    <div className="px-3 pb-2">
      <div className="overflow-hidden rounded-2xl border border-amber-100 bg-amber-50/50">
        {/* One row, one tap. The whole row is the control — not the chevron — and it says so,
            because a chevron alone is a target you have to already know about. */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="seen-news-row flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left active:scale-[0.99] transition-transform"
          aria-expanded={open}
          aria-label={open ? "Close today's story" : `Read today's story: ${story.title}`}>
          <span className="text-base leading-none" aria-hidden>{story.emoji || "✨"}</span>
          <span className="seen-attract min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide">
            {story.label || "Good news"} · today
          </span>
          <span className="flex-shrink-0 text-[10px] font-semibold text-amber-700/70">
            {open ? "Close" : "Tap to read"}
          </span>
          {/* A filled disc rather than a bare glyph — the same shape as the chevron on the
              Worldwide heading above, so both say "press me" in the same voice. */}
          <span aria-hidden
            className={`seen-news-chev flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] leading-none text-white transition-transform ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>

        {open && (
          <div className="px-3.5 pb-3.5" style={{ animation: "seenFadeUp 200ms ease both" }}>
            {/* The headline lives here now, unclamped. Collapsed it cost three lines of the
                first screen every day; expanded, it is the first thing you want to read. */}
            <p className="mb-1.5 text-[14px] font-bold leading-snug text-slate-800">{story.title}</p>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{asPlainText(story.summary)}</p>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              {/* Named, because a reader deciding what to make of a story is entitled to know
                  where it came from — and because the sources here are not all the same kind of
                  publication. */}
              <span className="text-[10px] text-slate-400 truncate">{story.source || "source unknown"}</span>
              {story.link && (
                <a href={story.link} target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-50 transition-colors">
                  Read the full story ↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
