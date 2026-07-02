// UserGlimpse.jsx — the "glimpse" card shown when you tap someone's name in the feed.
// Low-exposure by design: their location, current mood, and two self-described lines
// (💛 Most days, I'm… / ✨ In another life, I'd be…). No photo or stats. The feed itself
// stays uncluttered — mood and country live HERE, not next to the name.
// Fetches the author's profile on open (any authenticated user may read user docs).

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc } from "firebase/firestore";
import { X, Loader2 } from "lucide-react";
import { FLAG_MAP } from "./MicroAnimations";
import { MoodPill } from "./UpliftRetentionFeatures";

export default function UserGlimpse({ db, uid, country, name, moodTag, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!db || !uid) { setLoading(false); return; }
    getDoc(doc(db, "users", uid))
      .then((snap) => { if (alive) { setData(snap.exists() ? snap.data() : {}); setLoading(false); } })
      .catch(() => { if (alive) { setData({}); setLoading(false); } });
    return () => { alive = false; };
  }, [db, uid]);

  const land = country ?? data?.country ?? null;
  const flag = land ? FLAG_MAP[land] : null;
  // Prefer their live mood from the profile; fall back to the mood on the tapped message.
  const mood = data?.moodTag ?? moodTag ?? null;
  const mostDays = (data?.mostDays || "").trim();
  const anotherLife = (data?.anotherLife || "").trim();
  const hasGlimpse = mostDays || anotherLife;
  const firstName = String(name ?? data?.fullName ?? "").trim().split(/\s+/)[0] || "";
  const heading = firstName ? `✨ A glimpse into ${firstName}'s life` : "✨ A glimpse";

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
            {(land || mood) && (
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {land && (
                  <p className="text-sm font-semibold text-slate-700">
                    {flag ? `${flag} ` : "🌍 "}{land}
                  </p>
                )}
                {mood && <MoodPill mood={mood} />}
              </div>
            )}
            {hasGlimpse ? (
              <div className="space-y-3">
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
                This person hasn't shared their glimpse yet. 🌱
              </p>
            )}
            <p className="text-center text-[10px] text-slate-300 mt-4">A glimpse — not the whole story.</p>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
