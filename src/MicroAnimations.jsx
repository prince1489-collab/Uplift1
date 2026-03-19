/**
 * MicroAnimations.jsx — Seen app delight layer
 *
 * All 17 micro-animations in one file.
 *
 * EXPORTS
 *   AnimationLayer          — place once inside the outermost app div
 *   useAnimations           — hook returning every trigger function
 *   useSparkCounter         — hook for animated spark balance count-up
 *   useProgressBarFill      — hook for animated progress bar on load
 *   MessageSlideIn          — wrapper that slides new feed messages in
 *   SendingIndicator        — "..." bubble shown briefly before message lands
 *   ReactionButton          — drop-in replacement for reaction emoji buttons
 *   GreetingSheetWrapper    — slide-up wrapper for the greeting picker
 *   MapTransitionWrapper    — scale+fade wrapper for the world map overlay
 *   CountryReveal           — flag reveal beside sender name on new country
 *   LiveCountTick           — animated live greeter count pill
 *   StreakBadgeWithPulse    — streak badge that pulses once on session start
 */

import React, {
  useCallback, useEffect, useLayoutEffect,
  useRef, useState,
} from "react";

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

let _nextId = 0;
const uid = () => ++_nextId;
const rand = (a, b) => a + Math.random() * (b - a);

// Country code → flag emoji
const FLAG_MAP = {
  "India": "🇮🇳", "United States": "🇺🇸", "United Kingdom": "🇬🇧",
  "Canada": "🇨🇦", "Australia": "🇦🇺", "Germany": "🇩🇪", "France": "🇫🇷",
  "Brazil": "🇧🇷", "Japan": "🇯🇵", "China": "🇨🇳", "South Korea": "🇰🇷",
  "Nigeria": "🇳🇬", "South Africa": "🇿🇦", "Mexico": "🇲🇽", "Spain": "🇪🇸",
  "Italy": "🇮🇹", "Netherlands": "🇳🇱", "Sweden": "🇸🇪", "Norway": "🇳🇴",
  "Pakistan": "🇵🇰", "Bangladesh": "🇧🇩", "Indonesia": "🇮🇩", "Turkey": "🇹🇷",
  "Egypt": "🇪🇬", "Kenya": "🇰🇪", "Ghana": "🇬🇭", "Ethiopia": "🇪🇹",
  "Philippines": "🇵🇭", "Vietnam": "🇻🇳", "Thailand": "🇹🇭", "Malaysia": "🇲🇾",
  "Singapore": "🇸🇬", "New Zealand": "🇳🇿", "Argentina": "🇦🇷", "Chile": "🇨🇱",
  "Colombia": "🇨🇴", "Peru": "🇵🇪", "Venezuela": "🇻🇪", "Poland": "🇵🇱",
  "Ukraine": "🇺🇦", "Romania": "🇷🇴", "Portugal": "🇵🇹", "Greece": "🇬🇷",
  "Ireland": "🇮🇪", "Denmark": "🇩🇰", "Finland": "🇫🇮", "Switzerland": "🇨🇭",
  "Austria": "🇦🇹", "Belgium": "🇧🇪", "Saudi Arabia": "🇸🇦", "UAE": "🇦🇪",
  "United Arab Emirates": "🇦🇪", "Israel": "🇮🇱", "Iran": "🇮🇷",
  "Iraq": "🇮🇶", "Jordan": "🇯🇴", "Lebanon": "🇱🇧", "Morocco": "🇲🇦",
  "Tunisia": "🇹🇳", "Algeria": "🇩🇿", "Libya": "🇱🇾", "Sudan": "🇸🇩",
  "Russia": "🇷🇺", "Kazakhstan": "🇰🇿", "Uzbekistan": "🇺🇿",
  "Afghanistan": "🇦🇫", "Nepal": "🇳🇵", "Sri Lanka": "🇱🇰",
};

export function countryToFlag(country) {
  return FLAG_MAP[country] ?? "🌍";
}

// ─────────────────────────────────────────────────────────────────
// GLOBAL KEYFRAMES — injected once
// ─────────────────────────────────────────────────────────────────

const KEYFRAMES = `
  /* 1. Heart balloon */
  @keyframes seenBalloonFloat {
    0%   { transform: translateY(0) translateX(0); opacity: 1; }
    20%  { transform: translateY(-20vh) translateX(calc(var(--wobble) * 0.3)); opacity: 1; }
    50%  { transform: translateY(-50vh) translateX(var(--wobble)); opacity: 0.9; }
    80%  { transform: translateY(-80vh) translateX(calc(var(--wobble) * 0.5)); opacity: 0.6; }
    100% { transform: translateY(-105vh) translateX(0); opacity: 0; }
  }

  /* 2. Spark burst */
  @keyframes seenSparkFly {
    0%   { transform: translate(0,0) scale(1); opacity: 1; }
    60%  { opacity: 0.8; }
    100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
  }

  /* 3. Wave ripple rings */
  @keyframes seenRippleRing {
    0%   { transform: translate(-50%,-50%) scale(1); opacity: 0.8; }
    100% { transform: translate(-50%,-50%) scale(6); opacity: 0; }
  }

  /* 4. Streak confetti */
  @keyframes seenConfettiFall {
    0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
    80%  { opacity: 1; }
    100% { transform: translateY(110vh) rotate(var(--rot,360deg)) scale(0.8); opacity: 0; }
  }

  /* 5. Coin float */
  @keyframes seenCoinFloat {
    0%   { transform: translateY(0) scale(0.5); opacity: 0; }
    20%  { opacity: 1; transform: translateY(-10px) scale(1.1); }
    100% { transform: translateY(-80px) scale(0.8); opacity: 0; }
  }

  /* 6. Globe pulse ring */
  @keyframes seenGlobePulseRing {
    0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.7); }
    70%  { box-shadow: 0 0 0 10px rgba(16,185,129,0); }
    100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
  }
  .seen-globe-pulse {
    animation: seenGlobePulseRing 0.8s ease-out 3;
    border-radius: 999px;
  }

  /* 8. Message slide-in from left */
  @keyframes seenMsgSlideLeft {
    0%   { transform: translateX(-22px); opacity: 0; }
    60%  { transform: translateX(4px); opacity: 1; }
    100% { transform: translateX(0); opacity: 1; }
  }

  /* 8. Message slide-in from right */
  @keyframes seenMsgSlideRight {
    0%   { transform: translateX(22px); opacity: 0; }
    60%  { transform: translateX(-4px); opacity: 1; }
    100% { transform: translateX(0); opacity: 1; }
  }

  /* 9. Typing dots */
  @keyframes seenTypingDot {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30%            { transform: translateY(-5px); opacity: 1; }
  }

  /* 10. Spark counter count-up flash */
  @keyframes seenSparkFlash {
    0%   { color: #fbbf24; transform: scale(1.3); }
    100% { color: inherit; transform: scale(1); }
  }

  /* 11. Streak badge pulse on load */
  @keyframes seenStreakPulse {
    0%   { box-shadow: 0 0 0 0 rgba(249,115,22,0.6); }
    70%  { box-shadow: 0 0 0 10px rgba(249,115,22,0); }
    100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); }
  }

  /* 13. Wave trail hand */
  @keyframes seenWaveTrail {
    0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity: 1; }
    40%  { transform: translate(30px,-40px) rotate(20deg) scale(1.2); opacity: 0.9; }
    100% { transform: translate(80px,-110px) rotate(-10deg) scale(0.5); opacity: 0; }
  }

  /* 14. Reaction beat */
  @keyframes seenReactionBeat {
    0%   { transform: scale(1); }
    30%  { transform: scale(1.5); }
    60%  { transform: scale(1.2); }
    100% { transform: scale(1); }
  }

  /* 15. Live count tick */
  @keyframes seenLiveTick {
    0%   { transform: scale(1); color: inherit; }
    40%  { transform: scale(1.35); color: #10b981; }
    100% { transform: scale(1); color: inherit; }
  }

  /* 16. Map entrance */
  @keyframes seenMapIn {
    0%   { transform: scale(0.92); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes seenMapOut {
    0%   { transform: scale(1); opacity: 1; }
    100% { transform: scale(0.92); opacity: 0; }
  }

  /* 17. Greeting sheet slide-up */
  @keyframes seenSheetUp {
    0%   { transform: translateY(100%); opacity: 0.6; }
    100% { transform: translateY(0); opacity: 1; }
  }

  /* 7. Country flag fade-in */
  @keyframes seenFlagReveal {
    0%   { opacity: 0; transform: scale(0.5) translateY(4px); }
    60%  { opacity: 1; transform: scale(1.2) translateY(0); }
    100% { opacity: 1; transform: scale(1); }
  }
`;

let _keyframesInjected = false;
function ensureKeyframes() {
  if (_keyframesInjected) return;
  _keyframesInjected = true;
  const style = document.createElement("style");
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────
// useAnimations — the central controller hook
// ─────────────────────────────────────────────────────────────────

export function useAnimations() {
  const [particles, setParticles] = useState([]);
  const [globePulse, setGlobePulse] = useState(false);
  const globeTimerRef = useRef(null);

  useEffect(() => { ensureKeyframes(); }, []);

  const removeAfter = useCallback((id, ms) => {
    setTimeout(() => setParticles((p) => p.filter((x) => x.id !== id)), ms);
  }, []);

  // ── 1. Heart balloon ─────────────────────────────────────────
  const triggerHeartBalloon = useCallback((count = 1) => {
    const items = Array.from({ length: count }, (_, i) => {
      const p = { id: uid(), type: "heartBalloon", x: rand(20, 80), delay: i * 120, wobble: rand(-1, 1), size: rand(28, 42) };
      removeAfter(p.id, 2900 + p.delay);
      return p;
    });
    setParticles((prev) => [...prev, ...items]);
  }, [removeAfter]);

  // ── 2. Spark burst ───────────────────────────────────────────
  const triggerSparkBurst = useCallback((originX = 85, originY = 92) => {
    const COLORS = ["#fbbf24","#f59e0b","#34d399","#a78bfa","#fb7185","#60a5fa"];
    const sparks = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const dist = rand(50, 90);
      const p = { id: uid(), type: "spark", x: originX, y: originY, dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, size: rand(6, 11), color: COLORS[i % COLORS.length] };
      removeAfter(p.id, 750);
      return p;
    });
    setParticles((prev) => [...prev, ...sparks]);
  }, [removeAfter]);

  // ── 3. Wave ripple ───────────────────────────────────────────
  const triggerWaveRipple = useCallback((originX = 15, originY = 70) => {
    const rings = Array.from({ length: 3 }, (_, i) => {
      const p = { id: uid(), type: "waveRing", x: originX, y: originY, ringIndex: i, delay: i * 130 };
      removeAfter(p.id, 1000 + p.delay);
      return p;
    });
    setParticles((prev) => [...prev, ...rings]);
  }, [removeAfter]);

  // ── 4. Streak confetti ───────────────────────────────────────
  const triggerStreakConfetti = useCallback(() => {
    const COLORS = ["#f87171","#fb923c","#fbbf24","#34d399","#60a5fa","#a78bfa","#f472b6"];
    const pieces = Array.from({ length: 36 }, () => {
      const p = { id: uid(), type: "confetti", x: rand(5, 95), delay: rand(0, 500), color: COLORS[Math.floor(Math.random() * COLORS.length)], size: rand(6, 12), rot: rand(180, 540), shape: Math.random() > 0.5 ? "rect" : "circle", speed: rand(1.8, 3.5) };
      removeAfter(p.id, 3500 + p.delay);
      return p;
    });
    setParticles((prev) => [...prev, ...pieces]);
  }, [removeAfter]);

  // ── 5. Coin float ────────────────────────────────────────────
  const triggerCoinFloat = useCallback((originX = 20, originY = 70) => {
    const coins = Array.from({ length: 5 }, (_, i) => {
      const p = { id: uid(), type: "coin", x: originX + rand(-15, 15), y: originY, delay: i * 80, size: rand(14, 20) };
      removeAfter(p.id, 1500 + p.delay);
      return p;
    });
    setParticles((prev) => [...prev, ...coins]);
  }, [removeAfter]);

  // ── 6. Globe pulse ───────────────────────────────────────────
  const triggerGlobePulse = useCallback(() => {
    if (globeTimerRef.current) clearTimeout(globeTimerRef.current);
    setGlobePulse(true);
    globeTimerRef.current = setTimeout(() => setGlobePulse(false), 3000);
  }, []);

  // ── 13. Wave trail ───────────────────────────────────────────
  const triggerWaveTrail = useCallback((originX = 15, originY = 70) => {
    const p = { id: uid(), type: "waveTrail", x: originX, y: originY };
    removeAfter(p.id, 900);
    setParticles((prev) => [...prev, p]);
  }, [removeAfter]);

  useEffect(() => () => { if (globeTimerRef.current) clearTimeout(globeTimerRef.current); }, []);

  return {
    particles, globePulse,
    triggerHeartBalloon,
    triggerSparkBurst,
    triggerWaveRipple,
    triggerStreakConfetti,
    triggerCoinFloat,
    triggerGlobePulse,
    triggerWaveTrail,
  };
}

// ─────────────────────────────────────────────────────────────────
// PARTICLE RENDERERS
// ─────────────────────────────────────────────────────────────────

function HeartBalloon({ p }) {
  return (
    <div style={{ position:"fixed", left:`${p.x}%`, bottom:"-60px", fontSize:`${p.size}px`, lineHeight:1,
      animationName:"seenBalloonFloat", animationDuration:"2.6s", animationDelay:`${p.delay}ms`,
      animationTimingFunction:"cubic-bezier(0.25,0.46,0.45,0.94)", animationFillMode:"forwards",
      "--wobble":`${p.wobble * 30}px`, pointerEvents:"none", zIndex:9999,
      filter:"drop-shadow(0 2px 6px rgba(239,68,68,0.4))" }}>
      ❤️
    </div>
  );
}

function Spark({ p }) {
  return (
    <div style={{ position:"fixed", left:`${p.x}%`, top:`${p.y}%`,
      width:`${p.size}px`, height:`${p.size}px`, borderRadius:"50%", background:p.color,
      animationName:"seenSparkFly", animationDuration:"680ms", animationTimingFunction:"ease-out",
      animationFillMode:"forwards", "--dx":`${p.dx}px`, "--dy":`${p.dy}px`,
      pointerEvents:"none", zIndex:9999, boxShadow:`0 0 4px ${p.color}` }} />
  );
}

function WaveRing({ p }) {
  return (
    <div style={{ position:"fixed", left:`${p.x}%`, top:`${p.y}%`,
      transform:"translate(-50%,-50%)", width:"8px", height:"8px", borderRadius:"50%",
      border:"2px solid #14b8a6", animationName:"seenRippleRing", animationDuration:"800ms",
      animationDelay:`${p.delay}ms`, animationTimingFunction:"ease-out",
      animationFillMode:"forwards", opacity:0, pointerEvents:"none", zIndex:9999 }} />
  );
}

function ConfettiPiece({ p }) {
  return (
    <div style={{ position:"fixed", left:`${p.x}%`, top:"-16px",
      width:p.shape==="rect"?`${p.size}px`:`${p.size*.8}px`,
      height:p.shape==="rect"?`${p.size*.6}px`:`${p.size*.8}px`,
      borderRadius:p.shape==="rect"?"2px":"50%", background:p.color,
      animationName:"seenConfettiFall", animationDuration:`${p.speed}s`,
      animationDelay:`${p.delay}ms`, animationTimingFunction:"linear",
      animationFillMode:"forwards", "--rot":`${p.rot}deg`,
      pointerEvents:"none", zIndex:9999 }} />
  );
}

function CoinFloat({ p }) {
  return (
    <div style={{ position:"fixed", left:`${p.x}%`, top:`${p.y}%`,
      fontSize:`${p.size}px`, lineHeight:1, animationName:"seenCoinFloat",
      animationDuration:"1.2s", animationDelay:`${p.delay}ms`,
      animationTimingFunction:"ease-out", animationFillMode:"forwards",
      opacity:0, pointerEvents:"none", zIndex:9999, userSelect:"none" }}>
      ✨
    </div>
  );
}

function WaveTrail({ p }) {
  return (
    <div style={{ position:"fixed", left:`${p.x}%`, top:`${p.y}%`,
      fontSize:"22px", lineHeight:1, animationName:"seenWaveTrail",
      animationDuration:"800ms", animationTimingFunction:"ease-out",
      animationFillMode:"forwards", pointerEvents:"none", zIndex:9999, userSelect:"none" }}>
      👋
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AnimationLayer — render once at app root
// ─────────────────────────────────────────────────────────────────

export function AnimationLayer({ controller }) {
  const { particles } = controller;
  return (
    <>
      {particles.map((p) => {
        switch (p.type) {
          case "heartBalloon": return <HeartBalloon key={p.id} p={p} />;
          case "spark":        return <Spark key={p.id} p={p} />;
          case "waveRing":     return <WaveRing key={p.id} p={p} />;
          case "confetti":     return <ConfettiPiece key={p.id} p={p} />;
          case "coin":         return <CoinFloat key={p.id} p={p} />;
          case "waveTrail":    return <WaveTrail key={p.id} p={p} />;
          default:             return null;
        }
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// 8. MessageSlideIn — wraps each new message group
// ─────────────────────────────────────────────────────────────────

export function MessageSlideIn({ mine, isNew, children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);
  if (!isNew) return children;
  return (
    <div style={{
      animationName: mine ? "seenMsgSlideRight" : "seenMsgSlideLeft",
      animationDuration: "320ms",
      animationTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
      animationFillMode: "both",
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 9. SendingIndicator — "..." bubble shown before message lands
// ─────────────────────────────────────────────────────────────────

export function SendingIndicator({ visible }) {
  if (!visible) return null;
  return (
    <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"8px" }}>
      <div style={{ display:"inline-flex", alignItems:"center", gap:"4px",
        background:"#0d9488", borderRadius:"16px 16px 2px 16px",
        padding:"8px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.1)" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width:"6px", height:"6px", borderRadius:"50%", background:"rgba(255,255,255,0.8)",
            animationName:"seenTypingDot", animationDuration:"1.1s",
            animationDelay:`${i * 180}ms`, animationIterationCount:"infinite" }} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 10. useSparkCounter — animated count-up for spark balance
// ─────────────────────────────────────────────────────────────────

export function useSparkCounter(targetValue) {
  const [displayed, setDisplayed] = useState(targetValue);
  const [flashing, setFlashing] = useState(false);
  const prevRef = useRef(targetValue);

  useEffect(() => {
    const prev = prevRef.current;
    if (targetValue === prev) return;
    prevRef.current = targetValue;

    if (targetValue <= prev) { setDisplayed(targetValue); return; }

    // Count up from prev to target over ~600ms
    const diff = targetValue - prev;
    const steps = Math.min(diff, 20);
    const stepMs = 600 / steps;
    let current = prev;
    let step = 0;

    setFlashing(true);
    setTimeout(() => setFlashing(false), 700);

    const id = setInterval(() => {
      step++;
      current = Math.round(prev + (diff * step) / steps);
      setDisplayed(current);
      if (step >= steps) { clearInterval(id); setDisplayed(targetValue); }
    }, stepMs);
    return () => clearInterval(id);
  }, [targetValue]);

  return { displayed, flashing };
}

// ─────────────────────────────────────────────────────────────────
// 11. StreakBadgeWithPulse — pulses once per session on load
// ─────────────────────────────────────────────────────────────────

export function StreakBadgeWithPulse({ streak }) {
  const [pulsed, setPulsed] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!streak || streak < 1) return;
    // Delay slightly so it doesn't fire during app init
    timerRef.current = setTimeout(() => setPulsed(true), 800);
    return () => clearTimeout(timerRef.current);
  }, []); // only on mount

  if (!streak || streak < 1) return null;
  const hot = streak >= 7;

  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:"4px",
      borderRadius:"999px", padding:"4px 10px", fontSize:"12px", fontWeight:700,
      border:`1px solid ${hot ? "#fed7aa" : "#e2e8f0"}`,
      background: hot ? "#fff7ed" : "#f8fafc",
      color: hot ? "#c2410c" : "#475569",
      animation: pulsed ? "seenStreakPulse 0.9s ease-out" : "none",
    }}>
      🔥 {streak}d
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// 12. useProgressBarFill — animates from 0 to target % on mount
// ─────────────────────────────────────────────────────────────────

export function useProgressBarFill(targetPercent) {
  const [width, setWidth] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current || targetPercent === 0) return;
    hasAnimated.current = true;
    // Small delay so the DOM is rendered first
    const id = setTimeout(() => {
      setWidth(targetPercent);
    }, 200);
    return () => clearTimeout(id);
  }, [targetPercent]);

  return width;
}

// ─────────────────────────────────────────────────────────────────
// 14. ReactionButton — beats on tap, heart turns red and beats twice
// ─────────────────────────────────────────────────────────────────

export function ReactionButton({ emoji, count, mine, onClick }) {
  const [beating, setBeating] = useState(false);

  const handleClick = () => {
    setBeating(true);
    setTimeout(() => setBeating(false), 400);
    onClick?.();
  };

  const isHeart = emoji === "❤️";

  return (
    <button onClick={handleClick}
      style={{
        display:"inline-flex", alignItems:"center", gap:"2px",
        borderRadius:"999px", border:`1px solid ${mine ? "#99f6e4" : "#e2e8f0"}`,
        background: mine ? "#f0fdfa" : "#ffffff", padding:"2px 6px",
        fontSize:"11px", color: mine ? "#0f766e" : "#475569",
        cursor:"pointer", transition:"border-color 0.15s",
        transform: beating ? "scale(1)" : "scale(1)",
        animation: beating ? "seenReactionBeat 350ms cubic-bezier(0.34,1.56,0.64,1)" : "none",
        filter: beating && isHeart ? "drop-shadow(0 0 4px rgba(239,68,68,0.6))" : "none",
      }}>
      <span style={{ fontSize:"12px", transition:"filter 0.2s",
        filter: beating && isHeart ? "saturate(2) brightness(1.1)" : "none" }}>
        {emoji}
      </span>
      <span>{count}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// 15. LiveCountTick — animates the count when it increments
// ─────────────────────────────────────────────────────────────────

export function LiveCountTick({ count }) {
  const [ticking, setTicking] = useState(false);
  const prevRef = useRef(count);

  useEffect(() => {
    if (count !== prevRef.current && count > prevRef.current) {
      prevRef.current = count;
      setTicking(true);
      setTimeout(() => setTicking(false), 500);
    } else {
      prevRef.current = count;
    }
  }, [count]);

  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"5px",
      borderRadius:"999px", background:"#f0fdf4", padding:"4px 8px",
      fontSize:"11px", fontWeight:600, color:"#15803d" }}>
      <span style={{ width:"6px", height:"6px", borderRadius:"50%",
        background:"#10b981", flexShrink:0, animation:"seenTypingDot 2s ease-in-out infinite" }} />
      <span style={{ animation: ticking ? "seenLiveTick 450ms ease-out" : "none",
        display:"inline-block" }}>
        {count}
      </span>
      &nbsp;greeting{count !== 1 ? "s" : ""} now
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// 16. MapTransitionWrapper — scale+fade for world map overlay
// ─────────────────────────────────────────────────────────────────

export function MapTransitionWrapper({ visible, children }) {
  const [render, setRender] = useState(visible);
  const [animOut, setAnimOut] = useState(false);

  useEffect(() => {
    if (visible) { setRender(true); setAnimOut(false); }
    else {
      setAnimOut(true);
      const id = setTimeout(() => { setRender(false); setAnimOut(false); }, 220);
      return () => clearTimeout(id);
    }
  }, [visible]);

  if (!render) return null;

  return (
    <div style={{
      animationName: animOut ? "seenMapOut" : "seenMapIn",
      animationDuration: "220ms",
      animationTimingFunction: "cubic-bezier(0.34,1.2,0.64,1)",
      animationFillMode: "both",
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 17. GreetingSheetWrapper — slide-up for greeting picker
// ─────────────────────────────────────────────────────────────────

export function GreetingSheetWrapper({ visible, children }) {
  const [render, setRender] = useState(visible);

  useEffect(() => {
    if (visible) setRender(true);
    else {
      const id = setTimeout(() => setRender(false), 260);
      return () => clearTimeout(id);
    }
  }, [visible]);

  if (!render) return null;

  return (
    <div style={{
      animationName: visible ? "seenSheetUp" : "none",
      animationDuration: "300ms",
      animationTimingFunction: "cubic-bezier(0.34,1.2,0.64,1)",
      animationFillMode: "both",
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 7. CountryReveal — flag beside sender name on new country message
// ─────────────────────────────────────────────────────────────────

export function CountryReveal({ country, isNew }) {
  const [visible, setVisible] = useState(isNew);
  const flag = countryToFlag(country);

  useEffect(() => {
    if (!isNew) return;
    const id = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(id);
  }, [isNew]);

  if (!visible || !country) return null;

  return (
    <span style={{
      marginLeft:"4px", fontSize:"13px",
      animationName: visible ? "seenFlagReveal" : "none",
      animationDuration: "400ms",
      animationTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
      animationFillMode: "both",
      display:"inline-block",
      transition:"opacity 0.4s ease",
      opacity: visible ? 1 : 0,
    }}>
      {flag}
    </span>
  );
}
