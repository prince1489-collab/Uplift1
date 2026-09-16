// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// StickerReactions.jsx — curated animated sticker reactions.
//
// THERE IS NO ❤️ STICKER, and that is the point. There used to be one — `sticker_love`, whose
// emoji was the identical glyph to the heart the bubble already carries — and it caused three
// separate problems at once:
//
//   1. Two documents in the same subcollection meant the same feeling could be recorded twice,
//      by two different components, in two different visual treatments, on two different parts
//      of the card. People saw a doubled heart because there genuinely were two.
//   2. Picking it also painted a PHANTOM: the picker called back with the emoji, App.jsx read
//      "❤️" and applied an optimistic +1 to the badge — but only a sticker_love document was
//      ever written, so the badge showed a count that did not exist and vanished on reload.
//   3. "Who felt this" iterated the collection unfiltered and printed the raw document id, so
//      the panel listed a reactor as the literal string "sticker_love".
//
// The heart is the app's primary gesture and it owns that glyph. A sticker says something the
// heart cannot — a hug, applause, hang in there — which is the only reason to have stickers.

import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { HEART, announceReaction, setMyReaction } from "./reactions";
import { X } from "lucide-react";

export const STICKERS = [
  { id: "sticker_hug",      emoji: "🤗",  label: "Big hug",        anim: "sticker-bounce", bg: "bg-amber-50  border-amber-100"  },
  { id: "sticker_clap",     emoji: "👏",  label: "Applause",       anim: "sticker-clap",   bg: "bg-teal-50   border-teal-100"   },
  { id: "sticker_star",     emoji: "🌟",  label: "You're a star",  anim: "sticker-spin",   bg: "bg-yellow-50 border-yellow-100" },
  { id: "sticker_party",    emoji: "🎉",  label: "Woohoo!",        anim: "sticker-wiggle", bg: "bg-purple-50 border-purple-100" },
  { id: "sticker_strength", emoji: "💪",  label: "You've got this",anim: "sticker-wiggle", bg: "bg-orange-50 border-orange-100" },
  { id: "sticker_blossom",  emoji: "🌸",  label: "Blooming",       anim: "sticker-float",  bg: "bg-pink-50   border-pink-100"   },
  { id: "sticker_rainbow",  emoji: "🌈",  label: "Hang in there",  anim: "sticker-float",  bg: "bg-indigo-50 border-indigo-100" },
  { id: "sticker_sun",      emoji: "☀️",  label: "Bright ahead",   anim: "sticker-spin",   bg: "bg-yellow-50 border-yellow-100" },
  { id: "sticker_peace",    emoji: "🕊️", label: "Peace",          anim: "sticker-float",  bg: "bg-sky-50    border-sky-100"    },
  { id: "sticker_growth",   emoji: "🌱",  label: "Keep growing",   anim: "sticker-bounce", bg: "bg-emerald-50 border-emerald-100"},
  { id: "sticker_sparkle",  emoji: "✨",  label: "Sparkling",      anim: "sticker-pulse",  bg: "bg-violet-50 border-violet-100" },
];

// ── StickerPicker ─────────────────────────────────────────────────────────────

export function StickerPicker({ db, currentUser, messageId, senderUid, reactorCountry = null, reactorName = "", myReactionId = null, onClose, onPick }) {
  // A ref rather than state, because this component closes itself the instant a sticker is
  // picked — a setState afterwards would be a write to a tree that is already gone. The latch
  // only exists to swallow a double-tap in the frame before the sheet unmounts.
  const sending = useRef(false);

  // ── ONE REACTION, PAINTED BEFORE IT IS WRITTEN ──────────────────────────────────────────────
  // Two things happen here that did not used to.
  //
  // It REPLACES. The write is setMyReaction in reactions.js, shared with the heart chip, and it
  // is told what I already have (`myReactionId`) so it can clear it in the same transaction.
  // Before, this wrote its own document and looked at nothing else, so hearting a message and
  // then sending a sticker left both on the card from one person — and two stickers stacked up
  // the same way.
  //
  // And it PAINTS FIRST. This used to `await runTransaction` before doing anything visible: the
  // sheet stayed open, no burst, no haptic, no chip, until Firestore answered. On mobile data
  // that is most of a second of nothing. The heart has never worked that way, so a sticker was
  // slower than a heart for no reason except which function you were in.
  const handlePick = (sticker) => {
    if (sending.current || !db || !currentUser || !messageId) return;
    // You cannot react to your own message. Every heart path has checked this since it was
    // written; the sticker path never did, so your own stickers appeared in your own
    // "Who felt this" and, once the code below existed, would have notified you of yourself.
    if (senderUid && senderUid === currentUser.uid) { onClose?.(); return; }
    sending.current = true;

    // Tapping the sticker you already sent takes it back. It is the only way to undo one — the
    // chip on the bubble opens "who felt this" rather than toggling — so the grid rings the one
    // that is yours, and the gesture is never a mis-tap you cannot explain.
    const isSame = myReactionId === sticker.id;
    const nextId = isSame ? null : sticker.id;
    const country = reactorCountry ?? null;

    // Everything the person can see happens here, before a byte leaves the phone.
    onPick?.(nextId, isSame ? null : sticker);
    onClose?.();

    setMyReaction({ db, uid: currentUser.uid, messageId, fromId: myReactionId, toId: nextId, country })
      .then(() => {
        // Tell the person. A sticker used to write its reaction document and stop there: no row
        // on their bell, no dot on their globe, no push. Someone sent warmth and the app quietly
        // absorbed it — in an app whose whole purpose is making a person feel noticed, that was
        // the worst thing on the card.
        //
        // Chained rather than fired beside the write: notify-like re-reads the reaction to prove
        // it happened, so in parallel it often finds nothing yet. Not awaiting the write is what
        // makes the sticker instant; it must not cost the thing that makes it arrive.
        announceReaction({
          db, currentUser, messageId, senderUid,
          reaction: nextId ? sticker : null,
          country, reactorName,
        });
      })
      .catch((err) => {
        console.error("Sticker react error:", err);
        // Nothing was written, so the optimistic chip is a lie. undefined rather than null: the
        // truth is now whatever the server already said, not "I have none" — this person may
        // have reacted from another device.
        onPick?.(undefined, null);
      });
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[160] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl max-h-[72dvh] flex flex-col">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2 flex-shrink-0">
          <div>
            {/* Not "React with a GIF", which is what this said. There are no GIFs here — these
                are emoji with CSS keyframes on them. Promising a GIF and delivering a bouncing
                emoji is a small lie told at the exact moment someone is deciding whether this
                app is worth their attention. */}
            <p className="text-sm font-bold text-slate-800">React with a sticker</p>
            {/* The subtitle changes once you have one, because the rule changes with it: a
                second pick replaces the first rather than adding to it, and tapping the one you
                sent takes it back. Both are worth saying before the tap rather than after. */}
            <p className="text-[11px] text-slate-400">
              {myReactionId && myReactionId !== HEART
                ? "Tap another to swap it — or tap yours to take it back"
                : "Tap one to send it as a reaction"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Sticker grid. The one that is currently yours carries a ring and a tick — without it,
            re-tapping to undo is a gesture with no visible target, which reads as the app losing
            your sticker rather than as you removing it. */}
        <div className="overflow-y-auto px-4 pt-1 pb-10 grid grid-cols-4 gap-2.5">
          {STICKERS.map(s => {
            const isMine = myReactionId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => handlePick(s)}
                aria-pressed={isMine}
                title={isMine ? `${s.label} — tap to take it back` : s.label}
                className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all active:scale-90 hover:scale-105 ${s.bg} ${
                  isMine ? "ring-2 ring-teal-400 ring-offset-1" : ""
                }`}
              >
                {isMine && (
                  <span aria-hidden
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[9px] font-bold text-white shadow-sm">
                    ✓
                  </span>
                )}
                <span className={`text-3xl leading-none select-none ${s.anim}`}>{s.emoji}</span>
                <span className="text-[9px] font-semibold text-slate-500 text-center leading-tight">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

// StickerDisplay used to live here, and it is gone on purpose.
//
// It rendered its own row of sticker pills, in normal flow, 6px below the bubble — while the
// heart badge hung 12px ABOVE the bubble's bottom edge, absolutely positioned. Two rows of
// reactions to the same message, in the same 18px band, on opposite sides of the card, with
// 2px of gap between messages. That is what "the stickers fall just below the message" was.
//
// ReactionSideBadges now renders hearts and stickers as one row, from one listener. It was
// already subscribed to this whole subcollection and reading every document — it simply threw
// the sticker ones away. Two components watching the same collection for the same message is
// also two Firestore listeners per bubble, on the app's hottest render path.
//
// useStickerReactions went with it; StickerDisplay was its only caller.
