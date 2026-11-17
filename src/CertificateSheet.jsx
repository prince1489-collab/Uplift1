// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// CertificateSheet.jsx — the seven certificates, earned on days somebody made someone feel seen.
//
// They lived on the Grow tab until 3.30, which is now only the tree and three numbers. They moved
// into the tree's own panel (tap the tree), and a new one is announced in Seen with a button that
// opens it. The sheet sits above the tree panel (z-260 over its z-250).

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { CERTIFICATES, earnedCount } from "./certificates";
import { drawCertificate } from "./certificateImage";
import { useBackLayer } from "./backStack";
import { shareImage } from "./shareImage";

// ── Certificates ─────────────────────────────────────────────────────────────
// Seven of them, earned on days somebody showed up. The row is a ledger, not a scoreboard: the
// ones behind you are in colour, the next one names its number so the target is a fact rather
// than a mystery, and the rest stay quiet. Nothing here says how far BEHIND anyone is.
export function CertificatesRow({ activeDays, onOpen }) {
  const earned = earnedCount(activeDays);
  const next = CERTIFICATES[earned];
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <p className="flex-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {/* activeDays is exactly this count — every way a day is counted is a kind act. */}
          {activeDays > 0 ? `${activeDays} ${activeDays === 1 ? "day" : "days"} you made someone feel seen` : "Your certificates"}
        </p>
        {next && (
          <span className="text-[10px] font-semibold text-slate-300">
            {next.days - activeDays} more {next.days - activeDays === 1 ? "day" : "days"}
          </span>
        )}
      </div>
      {/* Horizontal, because seven of anything in a column would own the screen. overflow-x with
          the scrollbar hidden is the same treatment the app gives every other side-scrolling row. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none" }}>
        {CERTIFICATES.map((c, i) => {
          const got = i < earned;
          const isNext = i === earned;
          return (
            <button
              key={c.days}
              onClick={got ? () => onOpen(c) : undefined}
              disabled={!got}
              aria-label={got ? `Open your ${c.name} certificate` : `${c.name} — ${c.days} days, not yet earned`}
              className={`flex w-[92px] flex-shrink-0 flex-col items-center gap-1 rounded-2xl border px-2 py-2.5 transition-all ${
                got
                  ? "border-emerald-200 bg-white active:scale-[0.97]"
                  : isNext
                    ? "border-dashed border-slate-300 bg-white/60"
                    : "border-slate-100 bg-slate-50"
              }`}>
              <span className="text-xl leading-none" style={{ opacity: got ? 1 : 0.35 }} aria-hidden>{c.emoji}</span>
              <span className={`text-[11px] font-bold leading-tight ${got ? "text-slate-700" : "text-slate-400"}`}>{c.name}</span>
              <span className="text-[9px] font-semibold text-slate-400">{got ? "earned" : `${c.days} days`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The sheet. Draws the real PNG on open and shares that exact file — what you look at is what
// gets sent, rather than a second rendering nobody checked.
export function CertificateSheet({ cert, name, since, onClose }) {
  useBackLayer(true, onClose);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const blobRef = useRef(null);

  useEffect(() => {
    let alive = true;
    let made = "";
    drawCertificate({ name, days: cert.days, emoji: cert.emoji, since })
      .then((blob) => {
        if (!alive) return;
        blobRef.current = blob;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => { if (alive) setNote("Couldn't draw your certificate just now."); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [cert, name, since]);

  const share = async () => {
    const blob = blobRef.current;
    if (!blob || busy) return;
    setBusy(true);
    setNote("");
    try {
      // Handed to shareImage, which knows the difference between a browser and a WebView. This
      // used to call navigator.share directly, which does not exist in either of the WebViews
      // this app actually ships in — so on a phone it fell through to an <a download> that a
      // WebView discards, and then said "Saved to your downloads." See src/shareImage.js.
      const result = await shareImage({
        blob,
        fileName: `seen-${cert.days}-days.png`,
        title: "My Seen certificate",
      });
      // Only the browser path can honestly claim a download, and a dismissal says nothing at all.
      if (result === "downloaded") setNote("Saved to your downloads.");
    } catch (err) {
      console.error("[certificate] share failed:", err?.message);
      setNote("Couldn't share that just now — please try again.");
    }
    setBusy(false);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[260] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up flex max-h-[92dvh] flex-col rounded-t-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-shrink-0 justify-center pt-3 pb-2"><div className="h-1 w-10 rounded-full bg-slate-200" /></div>
        <div className="flex flex-shrink-0 items-center justify-between px-5 pb-3">
          <h2 className="text-lg font-bold text-slate-800">{cert.emoji} {cert.name}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {url ? (
            <img src={url} alt={`Certificate for ${cert.days} days of kindness`}
              className="mx-auto w-full max-w-[320px] rounded-2xl border border-slate-200 shadow-sm" />
          ) : (
            <div className="mx-auto aspect-[4/5] w-full max-w-[320px] rounded-2xl bg-slate-100" />
          )}
          <p className="mt-3 text-center text-[12px] leading-relaxed text-slate-500">{cert.blurb}</p>
        </div>

        <div className="flex-shrink-0 border-t border-slate-100 px-5 pb-6 pt-3">
          {note && <p className="mb-2 text-center text-[12px] font-semibold text-slate-500">{note}</p>}
          <button onClick={share} disabled={!url || busy}
            className="w-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40">
            {busy ? "Sharing…" : "Share"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
