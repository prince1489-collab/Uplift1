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
import { Heart } from "lucide-react";
import { watchStoryLikes, toggleStoryLike } from "./storyLikes";

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

export default function GoodNewsCard({ db, currentUser }) {
  const [story, setStory] = useState(null);
  const [open, setOpen] = useState(false);
  const [likes, setLikes] = useState({ count: 0, mine: false });

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

  // Everybody looking at today's story is looking at the same number. One document, one
  // listener; see the note in storyLikes.js about why that is the point rather than an economy.
  const uid = currentUser?.uid;
  const link = story?.link;
  useEffect(() => {
    if (!db || !link) return;
    return watchStoryLikes(db, link, uid, setLikes);
  }, [db, link, uid]);

  const like = async () => {
    if (!db || !uid || !story?.link) return;
    // Painted before the write lands, and corrected by the listener either way. A heart that
    // waits for a round trip feels broken on a train.
    setLikes((prev) => ({ count: Math.max(0, prev.count + (prev.mine ? -1 : 1)), mine: !prev.mine }));
    try { await toggleStoryLike(db, uid, story); }
    catch (err) { console.error("[goodnews] like failed:", err?.message); }
  };

  if (!story) return null;

  return (
    // ── WHY THIS IS A FLEX COLUMN WITH min-h-0 ON EVERY RUNG ─────────────────────────────────
    // An expanded story used to stop mid-sentence with no way to reach the rest, and the reason
    // was not in this file's text handling — nothing here truncates. It was the layout.
    //
    // This card is mounted (App.jsx) as a SIBLING ABOVE the feed scroller, inside a shell that is
    // h-[100dvh] flex-col overflow-hidden. The feed below is `flex-1`, whose basis is 0%, so it
    // cannot give any height back. Every other sibling — the header, the tab bar, the Worldwide
    // board — carries flex-shrink-0. This one does not. So the entire overflow of an expanded
    // story landed here, flex squashed the card to whatever space was left, and the
    // overflow-hidden below (which is only there to clip the corners to the radius) cut the
    // paragraphs off. The only scroller in the tab was a sibling, so nothing could scroll to them.
    //
    // The fix is to keep being shrinkable and make the shrink SCROLL instead of CLIP. Adding
    // flex-shrink-0 would look like the obvious answer and is the wrong one: it just moves the
    // overflow up to the shell, which clips it too, with less to show for it.
    //
    // min-h-0 on every rung is the part that actually does the work. A flex child defaults to
    // min-height:auto, which refuses to shrink below its content — that default is precisely what
    // turns "scrollable" back into "clipped", and it has to be cancelled all the way down.
    <div className="flex min-h-0 flex-col px-3 pb-2">
      {/* The cap is about what sits BELOW this card. With the feed unable to shrink, an expanded
          story took the whole area under the tabs and pushed the send bar off the bottom of the
          screen entirely.

          Measured against the real proportions rather than guessed: on a normal phone the chrome
          above is about a third of the display, so the card is squash-limited and 58dvh barely
          binds — what it buys there is the composer staying on screen. The feed below is a sliver
          while a story is open, and that is the honest trade: somebody who opened a story is
          reading it. The cap earns its keep on a tall screen, where an expanded story would
          otherwise take four fifths of the display.

          Either way the body scrolls inside whatever height it ends up with, so cap or squash,
          the reading works the same. */}
      <div className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-amber-100 bg-amber-50/50 ${open ? "max-h-[58dvh]" : ""}`}>
        {/* One row, one tap. The whole row is the control — not the chevron — and it says so,
            because a chevron alone is a target you have to already know about.
            flex-shrink-0 so "Close" and the chevron never scroll away from under the thumb. */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="seen-news-row flex w-full flex-shrink-0 items-center gap-2.5 px-3.5 py-2.5 text-left active:scale-[0.99] transition-transform"
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
          <>
            {/* The scrolling part: the headline and the story, and nothing else.

                ── THE SOFT BOTTOM EDGE ───────────────────────────────────────────────────────
                A hard cut is what made a scrollable story read as a broken one, so the last few
                pixels of text fade out rather than stopping dead against the strip below.

                It is a MASK, not a gradient laid over the top. A gradient has to be painted in
                the card's own colour, and this card's background is bg-amber-50/50 in light and
                rgba(245,158,11,0.12) in dark (index.css) over different surfaces again — so any
                fixed colour would be a visible band in one theme or the other. A mask fades the
                CONTENT to transparent and has no colour to get wrong.

                pb-5 pairs with it: the mask sits on the element's box, not the scrolled content,
                so without that padding the final line of a fully-scrolled story would sit in the
                faded zone and read as ghosted. With it, the fade has nothing but padding to work
                on once you reach the end — and on a story too short to scroll, nothing at all. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 pb-5"
              style={{
                animation: "seenFadeUp 200ms ease both",
                WebkitMaskImage: "linear-gradient(to bottom, #000 calc(100% - 18px), transparent)",
                maskImage: "linear-gradient(to bottom, #000 calc(100% - 18px), transparent)",
              }}>
              {/* The headline lives here now, unclamped. Collapsed it cost three lines of the
                  first screen every day; expanded, it is the first thing you want to read. */}
              <p className="mb-1.5 text-[14px] font-bold leading-snug text-slate-800">{story.title}</p>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{asPlainText(story.summary)}</p>
            </div>

            {/* Lifted OUT of the scroller and pinned. These two were at the bottom of the block
                that was being clipped, which meant that on any story long enough to matter the
                attribution and the link to the original were the first things to become
                unreachable — the worst possible half to lose. */}
            <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-amber-100 px-3.5 pb-3 pt-2">
              {/* Named, because a reader deciding what to make of a story is entitled to know
                  where it came from — and because the sources here are not all the same kind of
                  publication. */}
              {/* The heart sits with the source and the link because this strip is the one part
                  of the card that stays put while the prose scrolls — so it is reachable whether
                  you read three lines or all of it. */}
              <button
                onClick={like}
                disabled={!uid}
                aria-pressed={likes.mine}
                aria-label={likes.mine ? "Remove your heart from this story" : "Heart this story"}
                className={`flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-40 ${
                  likes.mine
                    ? "border-rose-200 bg-rose-50 text-rose-600"
                    : "border-slate-200 bg-white text-slate-400 hover:text-rose-500"
                }`}>
                <Heart size={11} fill={likes.mine ? "currentColor" : "none"} />
                {likes.count > 0 && <span className="tabular-nums">{likes.count}</span>}
              </button>
              <span className="min-w-0 flex-1 truncate text-[10px] text-slate-400">{story.source || "source unknown"}</span>
              {story.link && (
                <a href={story.link} target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-50 transition-colors">
                  Read the full story ↗
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
