// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// StickerReactions.jsx — Curated animated sticker reactions (GIF-style preview)

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, onSnapshot, runTransaction } from "firebase/firestore";
import { X } from "lucide-react";

export const STICKERS = [
  { id: "sticker_love",     emoji: "❤️",  label: "Sending love",   anim: "sticker-bounce", bg: "bg-rose-50   border-rose-100"   },
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

const STICKER_MAP = Object.fromEntries(STICKERS.map(s => [s.id, s]));

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStickerReactions(db, messageId) {
  const [reactions, setReactions] = useState({});
  useEffect(() => {
    if (!db || !messageId) return;
    return onSnapshot(
      collection(db, "publicMessages", messageId, "stickerReactions"),
      snap => {
        const r = {};
        snap.forEach(d => { r[d.id] = d.data(); });
        setReactions(r);
      },
      () => {}
    );
  }, [db, messageId]);
  return reactions;
}

// ── StickerPicker ─────────────────────────────────────────────────────────────

export function StickerPicker({ db, currentUser, messageId, onClose, onPick }) {
  const [sending, setSending] = useState(false);

  const handlePick = async (sticker) => {
    if (sending || !db || !currentUser || !messageId) return;
    setSending(true);
    try {
      const rRef = doc(db, "publicMessages", messageId, "stickerReactions", sticker.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(rRef);
        const data = snap.exists() ? snap.data() : { count: 0, uids: [] };
        const uids = data.uids ?? [];
        if (uids.includes(currentUser.uid)) {
          const next = uids.filter(u => u !== currentUser.uid);
          tx.set(rRef, { count: Math.max(0, next.length), uids: next });
        } else {
          tx.set(rRef, { count: uids.length + 1, uids: [...uids, currentUser.uid] });
        }
      });
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
            <p className="text-sm font-bold text-slate-800">React with a GIF</p>
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

// ── StickerDisplay — shown below message bubble ───────────────────────────────

export function StickerDisplay({ db, messageId, currentUser }) {
  const reactions = useStickerReactions(db, messageId);
  const active = Object.entries(reactions).filter(([, v]) => (v.count ?? 0) > 0);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {active.map(([stickerId, data]) => {
        const s = STICKER_MAP[stickerId];
        if (!s) return null;
        const isMe = (data.uids ?? []).includes(currentUser?.uid);
        return (
          <div
            key={stickerId}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-sm ${
              isMe
                ? "border-teal-300 bg-teal-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <span className={`text-base leading-none select-none ${s.anim}`}>{s.emoji}</span>
            {data.count > 1 && (
              <span className="text-[11px] font-bold text-slate-500">{data.count}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
