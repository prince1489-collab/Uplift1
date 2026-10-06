// UserGlimpse.jsx — the "glimpse" card shown when you tap someone's name in the feed.
// Low-exposure by design: their location and two self-described lines
// (💛 Most days, I'm… / ✨ In another life, I'd be…). No photo or stats. The feed itself
// stays uncluttered — country lives HERE, not next to the name.
// Reads publicProfiles/{uid}, NOT users/{uid} — see src/publicProfile.js for why the
// readable fields were split out of the private profile document.

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { FLAG_MAP } from "./MicroAnimations";
import { readPublicProfile } from "./publicProfile";

export default function UserGlimpse({ db, uid, country, name, onClose, self = false }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!db || !uid) { setLoading(false); return; }
    readPublicProfile(db, uid)
      .then((pub) => { if (alive) { setData(pub ?? {}); setLoading(false); } })
      .catch(() => { if (alive) { setData({}); setLoading(false); } });
    return () => { alive = false; };
  }, [db, uid]);

  const land = country ?? data?.country ?? null;
  const flag = land ? FLAG_MAP[land] : null;
  const mostDays = (data?.mostDays || "").trim();
  const anotherLife = (data?.anotherLife || "").trim();
  // "Right now…" — the one line they chose to share from their conversation with Seen (3.15).
  const rightNow = (data?.rightNow || "").trim();
  const hasGlimpse = mostDays || anotherLife || rightNow;
  const firstName = String(name ?? data?.fullName ?? "").trim().split(/\s+/)[0] || "";
  // Your own glimpse (tap "You" in the feed, 3.18): the same card, so you can see what others see.
  const heading = self ? "✨ How others see you" : firstName ? `✨ A glimpse into ${firstName}'s life` : "✨ A glimpse";

  return createPortal(
    <div data-portal className="fixed inset-0 z-[260] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl"
        style={{ animation: "seenSheetRise 320ms cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-500 leading-relaxed">{heading}</span>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors flex-shrink-0">
            <X size={15} className="text-slate-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin text-teal-500" size={22} />
          </div>
        ) : (
          <>
            {land && (
              <p className="mb-3 text-sm font-semibold text-slate-700">
                {flag ? `${flag} ` : "🌍 "}{land}
              </p>
            )}
            {hasGlimpse ? (
              <div className="space-y-3">
                {rightNow && (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3.5 py-3">
                    <p className="mb-0.5 text-[11px] font-semibold text-orange-600">🌱 Right now…</p>
                    <p className="text-sm leading-relaxed text-slate-700">{rightNow}</p>
                  </div>
                )}
                {mostDays && (
                  <div className="rounded-2xl bg-amber-50 border border-amber-100 px-3.5 py-3">
                    <p className="text-[11px] font-semibold text-amber-600 mb-0.5">💛 Most days, I'm…</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{mostDays}</p>
                  </div>
                )}
                {anotherLife && (
                  <div className="rounded-2xl bg-violet-50 border border-violet-100 px-3.5 py-3">
                    <p className="text-[11px] font-semibold text-violet-500 mb-0.5">✨ In another life, I'd be…</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{anotherLife}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-xs text-slate-400 py-6 leading-relaxed">
                {self ? "You haven't shared a glimpse yet. 🌱" : "This person hasn't shared their glimpse yet. 🌱"}
              </p>
            )}
            {self ? (
              <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
                This is what people see when they tap your name.
                {!rightNow && <><br />Share a 🌱 Right now line from Messages → Seen → ⋯</>}
              </p>
            ) : (
              <p className="text-center text-[10px] text-slate-300 mt-4">A glimpse — not the whole story.</p>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
