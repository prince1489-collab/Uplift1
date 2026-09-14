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

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { deleteDoc, doc, runTransaction, setDoc } from "firebase/firestore";
import { authedPost } from "./apiBase";
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

// Same job as shouldNotifyLike in UpliftRetentionFeatures.jsx, kept local rather than shared:
// a heart and a sticker are two different notifications, so throttling them together would mean
// sending a hug silently swallowed because you had hearted the same message a moment earlier.
const STICKER_NOTIFY_COOLDOWN_MS = 60 * 1000;
const lastStickerNotify = new Map();
function shouldNotifySticker(messageId) {
  const now = Date.now();
  const prev = lastStickerNotify.get(messageId) ?? 0;
  if (now - prev < STICKER_NOTIFY_COOLDOWN_MS) return false;
  lastStickerNotify.set(messageId, now);
  return true;
}

export function StickerPicker({ db, currentUser, messageId, senderUid, reactorCountry = null, reactorName = "", onClose, onPick }) {
  const [sending, setSending] = useState(false);

  const handlePick = async (sticker) => {
    if (sending || !db || !currentUser || !messageId) return;
    // You cannot react to your own message. Every heart path has checked this since it was
    // written; the sticker path never did, so your own stickers appeared in your own
    // "Who felt this" and, once the code below existed, would have notified you of yourself.
    if (senderUid && senderUid === currentUser.uid) { onClose?.(); return; }
    setSending(true);
    let added = false;
    try {
      const rRef = doc(db, "publicMessages", messageId, "reactions", sticker.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(rRef);
        const data = snap.exists() ? snap.data() : { count: 0, uids: [] };
        const uids = data.uids ?? [];
        // countries and reactedAt are carried forward and written back. The old code did a bare
        // tx.set of { count, uids } with no merge, which meant a sticker on a message that
        // already had hearts would have WIPED those two maps had the ids ever collided — and,
        // more immediately, it left sticker reactors with no country and no timestamp, so they
        // sorted to the bottom of the panel and lit no country on the globe.
        const countries = { ...(data.countries ?? {}) };
        const reactedAt = { ...(data.reactedAt ?? {}) };
        if (uids.includes(currentUser.uid)) {
          const next = uids.filter(u => u !== currentUser.uid);
          delete countries[currentUser.uid];
          delete reactedAt[currentUser.uid];
          tx.set(rRef, { count: Math.max(0, next.length), uids: next, countries, reactedAt });
        } else {
          countries[currentUser.uid] = reactorCountry ?? null;
          reactedAt[currentUser.uid] = Date.now();
          tx.set(rRef, { count: uids.length + 1, uids: [...uids, currentUser.uid], countries, reactedAt });
          added = true;
        }
      });

      // ── Tell the person. ──────────────────────────────────────────────────────────────────
      // None of this existed. A sticker wrote its reaction document and stopped there: no
      // reactionsReceived row, so it never appeared in the recipient's bell or their globe, and
      // no push, so their phone stayed silent. Someone sent warmth and the app quietly absorbed
      // it. In an app whose whole purpose is making a person feel noticed, that was the worst
      // thing on the card.
      //
      // Shape and ordering copied deliberately from the heart path: notify-like re-reads this
      // document to prove the reaction happened, so the POST is CHAINED onto the write rather
      // than fired beside it — run in parallel and the endpoint often finds nothing yet.
      if (senderUid && senderUid !== currentUser.uid) {
        const ownerRef = doc(db, "users", senderUid, "reactionsReceived", `${messageId}_${currentUser.uid}`);
        if (!added) {
          deleteDoc(ownerRef).catch(() => {});
        } else {
          const myName = (reactorName || "").trim().split(" ")[0] || "Someone";
          const reactedAt = Date.now();
          setDoc(ownerRef, {
            messageId, ownerUid: senderUid, reactorUid: currentUser.uid,
            emoji: sticker.emoji, stickerId: sticker.id, stickerLabel: sticker.label,
            country: reactorCountry ?? null, reactorName: myName, reactedAt,
          })
            .then(() => {
              if (shouldNotifySticker(messageId)) {
                authedPost(currentUser, "/api/notify-like", { ownerUid: senderUid, messageId })
                  .catch(() => {});
              }
            })
            .catch((err) => { console.error("[sticker reactionsReceived]", err?.code, err?.message); });
        }
      }

      onPick?.(sticker);
    } catch (err) {
      console.error("Sticker react error:", err);
    }
    setSending(false);
    onClose?.();
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
            <p className="text-[11px] text-slate-400">Tap one to send it as a reaction</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Sticker grid */}
        <div className="overflow-y-auto px-4 pt-1 pb-10 grid grid-cols-4 gap-2.5">
          {STICKERS.map(s => (
            <button
              key={s.id}
              onClick={() => handlePick(s)}
              disabled={sending}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all active:scale-90 hover:scale-105 ${s.bg}`}
            >
              <span className={`text-3xl leading-none select-none ${s.anim}`}>{s.emoji}</span>
              <span className="text-[9px] font-semibold text-slate-500 text-center leading-tight">{s.label}</span>
            </button>
          ))}
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
