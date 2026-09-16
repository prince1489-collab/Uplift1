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
// ── WHY IT IS COLLAPSED ──────────────────────────────────────────────────────
// Connect is the screen about people who wrote to you. A daily 200-word article sitting open
// above them would push the messages off the first screen every single day, which inverts what
// the tab is for. Headline and category only, until someone wants more.

import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

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
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left active:scale-[0.99] transition-transform"
          aria-expanded={open}>
          <span className="text-base leading-none mt-0.5" aria-hidden>{story.emoji || "✨"}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-700/70">
              {story.label || "Good news"} · today
            </span>
            <span className={`mt-0.5 block text-[13px] font-semibold leading-snug text-slate-800 ${open ? "" : "line-clamp-2"}`}>
              {story.title}
            </span>
          </span>
          <span className={`mt-1 text-[10px] text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>▾</span>
        </button>

        {open && (
          <div className="px-3.5 pb-3.5" style={{ animation: "seenFadeUp 200ms ease both" }}>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{story.summary}</p>
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
