// TourGuide.jsx — one-time interactive spotlight tour for first-time users.
//
// Dims the screen and cuts a "hole" over a real UI element (the box-shadow cutout
// technique: a transparent box with a huge surrounding shadow), then shows a tooltip
// card. Each step can run a `before()` callback to reveal hidden elements by flipping
// the app's own state (open the header, open the send sheet, show the long-press bar).
//
// If a target can't be found/measured, the step falls back to a centred card with no
// cutout — so the tour can never get stuck on a missing element.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const SETTLE_MS = 360; // wait for header/sheet open + scroll animations before measuring
const PAD = 8;         // breathing room around the spotlighted element

export default function TourGuide({ steps, onDone }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null); // null → centred-card fallback
  const [ready, setReady] = useState(false);
  const settleTimer = useRef(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Measure the current step's target (after running its before() + a settle delay).
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setRect(null);

    try { step.before?.(); } catch { /* ignore reveal errors */ }

    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (cancelled) return;
      measure();
      setReady(true);
    }, SETTLE_MS);

    return () => { cancelled = true; clearTimeout(settleTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function measure() {
    if (!step.target) { setRect(null); return; }
    const el = document.querySelector(step.target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { setRect(null); return; }
    const extraTop = step.extraPadTop ?? 0;
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height, extraTop });
  }

  // Keep the spotlight aligned if the layout shifts under it.
  useLayoutEffect(() => {
    if (!ready) return;
    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, index]);

  const next = () => { if (isLast) onDone?.(); else setIndex((i) => i + 1); };
  const skip = () => onDone?.();

  // Tooltip placement: below the target if there's room, otherwise above; centred when no rect.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  let cardStyle;
  if (rect) {
    const extraTop = rect.extraTop ?? 0;
    const spotTop = rect.top - PAD - extraTop;
    const spotBottom = rect.top + rect.height + PAD;
    const placeBelow = spotBottom < vh - 200;
    cardStyle = placeBelow
      ? { top: spotBottom + 10, left: 12, right: 12 }
      : { bottom: vh - spotTop + 10, left: 12, right: 12 };
  } else {
    cardStyle = { top: "50%", left: 12, right: 12, transform: "translateY(-50%)" };
  }

  return createPortal(
    <div className="fixed inset-0 z-[400]" style={{ touchAction: "none" }}>
      {/* Click-catcher: swallows taps on the real UI so the user follows the guided path. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Spotlight cutout, or a full dim layer when there's no target. */}
      {rect ? (
        <div
          className="absolute rounded-2xl"
          style={{
            top: rect.top - PAD - (rect.extraTop ?? 0),
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD + PAD + (rect.extraTop ?? 0),
            boxShadow: "0 0 0 9999px rgba(2,6,23,0.72)",
            transition: "all 220ms cubic-bezier(0.34,1.2,0.64,1)",
            pointerEvents: "none",
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "rgba(2,6,23,0.72)" }} />
      )}

      {/* Tooltip card */}
      <div
        className="absolute rounded-2xl bg-white p-4 shadow-2xl"
        style={{ ...cardStyle, maxWidth: 420, margin: "0 auto" }}>
        <button
          onClick={skip}
          aria-label="Skip tour"
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
          <X size={16} />
        </button>

        <h3 className="pr-8 text-base font-bold text-slate-900">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>

        <div className="mt-4 flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
              <span
                key={s.key}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 18 : 6,
                  background: i === index ? "#14b8a6" : "#cbd5e1",
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isLast && (
              <button onClick={skip} className="px-2 py-2 text-sm font-semibold text-slate-400 hover:text-slate-600">
                Skip
              </button>
            )}
            <button
              onClick={next}
              className="rounded-xl px-4 py-2 text-sm font-bold text-white active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg, #14b8a6, #10b981)", boxShadow: "0 4px 14px rgba(20,184,166,0.35)" }}>
              {isLast ? "Start sending" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
