// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// IntroStep.jsx — Cinematic word-by-word intro, auto-advances to WelcomeStep

import React, { useCallback, useEffect, useRef, useState } from "react";

const PHRASES = [
  "Someone out there…",
  "…needs to hear from you.",
];

export default function IntroStep({ onDone }) {
  const [phraseIdx, setPhraseIdx]   = useState(0);
  const [textVisible, setTextVisible] = useState(false);
  const [showFinal, setShowFinal]   = useState(false);
  const [showCTA, setShowCTA]       = useState(false);
  const timers = useRef([]);

  const schedule = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };

  const finish = useCallback(() => {
    timers.current.forEach(clearTimeout);
    localStorage.setItem("seen_intro_v1", "1");
    onDone();
  }, [onDone]);

  useEffect(() => {
    // Returning users skip the intro entirely
    if (localStorage.getItem("seen_intro_v1")) { onDone(); return; }

    // ── Sequence ──────────────────────────────────────────────────
    schedule(() => setTextVisible(true),  400);   // phrase 1 fades in
    schedule(() => setTextVisible(false), 2300);  // phrase 1 fades out
    schedule(() => { setPhraseIdx(1); setTextVisible(true); }, 2900);  // phrase 2
    schedule(() => setTextVisible(false), 4700);  // phrase 2 fades out
    schedule(() => setShowFinal(true),    5300);  // "Welcome to Seen"
    schedule(() => setShowCTA(true),      6400);  // Enter button appears

    return () => timers.current.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fadeStyle = (visible) => ({
    opacity:   visible ? 1 : 0,
    transform: visible ? "translateY(0px)" : "translateY(14px)",
    transition: "opacity 0.65s ease, transform 0.65s ease",
  });

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ background: "linear-gradient(135deg, #020617 0%, #0f172a 55%, #042f2e 100%)" }}
      onClick={finish}>

      {/* Ambient teal glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(20,184,166,0.07) 0%, transparent 70%)" }}
      />

      {/* Subtle floating particles */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-teal-400/20"
            style={{
              width:  `${4 + i * 2}px`,
              height: `${4 + i * 2}px`,
              left:   `${15 + i * 14}%`,
              top:    `${20 + (i % 3) * 25}%`,
              animation: `introDrift ${6 + i * 1.5}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.8}s`,
            }}
          />
        ))}
      </div>

      {/* Skip label */}
      <p
        className="absolute top-14 right-6 text-[11px] font-medium text-white/25 hover:text-white/50 transition-colors cursor-pointer"
        onClick={e => { e.stopPropagation(); finish(); }}>
        skip
      </p>

      {/* ── Phrase area ── */}
      <div className="relative flex flex-col items-center justify-center px-10 text-center"
           style={{ minHeight: 120 }}>

        {/* Rolling phrases */}
        {!showFinal && (
          <p
            className="text-[1.75rem] font-light leading-snug tracking-wide text-white"
            style={{ fontStyle: "italic", ...fadeStyle(textVisible) }}>
            {PHRASES[phraseIdx]}
          </p>
        )}

        {/* Final title */}
        {showFinal && (
          <div
            className="flex flex-col items-center gap-3"
            style={fadeStyle(showFinal)}>
            <div className="flex items-baseline gap-2">
              <span
                className="text-5xl font-extrabold tracking-tight text-white"
                style={{ letterSpacing: "-0.03em" }}>
                Seen
              </span>
              <span className="text-3xl leading-none">✨</span>
            </div>
            <p className="text-sm font-light tracking-widest text-white/40 uppercase">
              The kindness app
            </p>
          </div>
        )}
      </div>

      {/* ── Enter button ── */}
      <div
        className="absolute bottom-16 flex flex-col items-center gap-3"
        style={fadeStyle(showCTA)}>
        <button
          onClick={e => { e.stopPropagation(); finish(); }}
          className="flex items-center gap-2 rounded-full px-9 py-3.5 text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #14b8a6, #10b981)",
            boxShadow: "0 0 32px rgba(20,184,166,0.35), 0 4px 16px rgba(0,0,0,0.3)",
          }}>
          Enter &rarr;
        </button>
        <p className="text-[10px] text-white/20 tracking-wide">
          tap anywhere to continue
        </p>
      </div>

      {/* Hint before CTA appears */}
      {!showCTA && !showFinal && (
        <p className="absolute bottom-16 text-[10px] text-white/15 tracking-widest uppercase animate-pulse">
          tap to skip
        </p>
      )}

      {/* Drift animation keyframes */}
      <style>{`
        @keyframes introDrift {
          from { transform: translateY(0px) scale(1); opacity: 0.15; }
          to   { transform: translateY(-18px) scale(1.2); opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
