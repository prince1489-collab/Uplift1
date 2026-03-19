/**
 * MicroAnimations.jsx
 *
 * All six delight animations for Seen, managed through a single
 * AnimationLayer that sits at the root of the app.
 *
 * EXPORTS:
 *   - AnimationLayer     — renders floating particles (place once at app root)
 *   - useAnimations      — hook that returns trigger functions
 *
 * TRIGGERS:
 *   triggerHeartBalloon()  — ❤️ heart floats from bottom to top
 *   triggerSparkBurst(x,y) — ✨ sparks explode from send button position
 *   triggerWaveRipple(x,y) — 🌊 ripple rings expand from wave button
 *   triggerStreakConfetti() — 🎉 confetti shower on streak milestone
 *   triggerCoinFloat(x,y)  — 💛 coins float up from a message card
 *   triggerGlobePulse()    — 🌍 globe button glows on new country wave
 *
 * INTEGRATION in App.jsx:
 *
 *   import { AnimationLayer, useAnimations } from "./MicroAnimations";
 *
 *   // Inside App():
 *   const anim = useAnimations();
 *
 *   // Place once, just inside the outermost app container div:
 *   <AnimationLayer controller={anim} />
 *
 *   // Wire triggers:
 *   // — In handleSendMessage, after the message is sent:
 *   anim.triggerSparkBurst();
 *
 *   // — Pass anim down to MessageReactions so it can trigger heart + coin:
 *   //   Already done via onHeartReact / onGiftSent props below.
 *
 *   // — In WaveBackButton after a wave is sent:
 *   anim.triggerWaveRipple();
 *
 *   // — After recordGreetingDay() when streak crosses milestone:
 *   if ([3,7,14,30].includes(newStreak)) anim.triggerStreakConfetti();
 *
 *   // — After a wave is received from a new country:
 *   anim.triggerGlobePulse();
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

let _nextId = 0;
const uid = () => ++_nextId;

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

// ─────────────────────────────────────────────────────────────────
// useAnimations hook — returns a controller object with all triggers
// ─────────────────────────────────────────────────────────────────

export function useAnimations() {
  const [particles, setParticles] = useState([]);
  const [globePulse, setGlobePulse] = useState(false);
  const globeTimerRef = useRef(null);

  const removeParticle = useCallback((id) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── 1. Heart balloon ─────────────────────────────────────────
  const triggerHeartBalloon = useCallback((count = 1) => {
    const newBalloons = Array.from({ length: count }, (_, i) => ({
      id: uid(),
      type: "heartBalloon",
      x: randomBetween(20, 80), // % from left
      delay: i * 120,           // stagger multi-balloon
      wobble: randomBetween(-1, 1), // wobble direction
      size: randomBetween(28, 42),
    }));
    setParticles((prev) => [...prev, ...newBalloons]);
    newBalloons.forEach((p) => {
      setTimeout(() => removeParticle(p.id), 2800 + p.delay);
    });
  }, [removeParticle]);

  // ── 2. Spark burst ───────────────────────────────────────────
  const triggerSparkBurst = useCallback((originX, originY) => {
    const sparks = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const dist = randomBetween(50, 90);
      return {
        id: uid(),
        type: "spark",
        x: originX ?? 50,
        y: originY ?? 90,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        size: randomBetween(6, 10),
        color: ["#fbbf24", "#f59e0b", "#34d399", "#a78bfa", "#fb7185"][Math.floor(Math.random() * 5)],
      };
    });
    setParticles((prev) => [...prev, ...sparks]);
    sparks.forEach((p) => setTimeout(() => removeParticle(p.id), 700));
  }, [removeParticle]);

  // ── 3. Wave ripple ───────────────────────────────────────────
  const triggerWaveRipple = useCallback((originX, originY) => {
    const rings = Array.from({ length: 3 }, (_, i) => ({
      id: uid(),
      type: "waveRing",
      x: originX ?? 50,
      y: originY ?? 60,
      ringIndex: i,
      delay: i * 120,
    }));
    setParticles((prev) => [...prev, ...rings]);
    rings.forEach((p) => setTimeout(() => removeParticle(p.id), 900 + p.delay));
  }, [removeParticle]);

  // ── 4. Streak confetti ───────────────────────────────────────
  const triggerStreakConfetti = useCallback(() => {
    const COLORS = ["#f87171","#fb923c","#fbbf24","#34d399","#60a5fa","#a78bfa","#f472b6"];
    const pieces = Array.from({ length: 32 }, () => ({
      id: uid(),
      type: "confetti",
      x: randomBetween(5, 95),
      delay: randomBetween(0, 400),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: randomBetween(6, 11),
      rotation: randomBetween(-45, 45),
      shape: Math.random() > 0.5 ? "rect" : "circle",
      speed: randomBetween(1.8, 3.2),
    }));
    setParticles((prev) => [...prev, ...pieces]);
    pieces.forEach((p) => setTimeout(() => removeParticle(p.id), 3000 + p.delay));
  }, [removeParticle]);

  // ── 5. Coin float ────────────────────────────────────────────
  const triggerCoinFloat = useCallback((originX, originY) => {
    const coins = Array.from({ length: 5 }, (_, i) => ({
      id: uid(),
      type: "coin",
      x: (originX ?? 50) + randomBetween(-15, 15),
      y: originY ?? 70,
      delay: i * 80,
      size: randomBetween(14, 20),
    }));
    setParticles((prev) => [...prev, ...coins]);
    coins.forEach((p) => setTimeout(() => removeParticle(p.id), 1400 + p.delay));
  }, [removeParticle]);

  // ── 6. Globe pulse ───────────────────────────────────────────
  const triggerGlobePulse = useCallback(() => {
    if (globeTimerRef.current) clearTimeout(globeTimerRef.current);
    setGlobePulse(true);
    globeTimerRef.current = setTimeout(() => setGlobePulse(false), 3000);
  }, []);

  useEffect(() => () => { if (globeTimerRef.current) clearTimeout(globeTimerRef.current); }, []);

  return {
    particles,
    globePulse,
    triggerHeartBalloon,
    triggerSparkBurst,
    triggerWaveRipple,
    triggerStreakConfetti,
    triggerCoinFloat,
    triggerGlobePulse,
  };
}

// ─────────────────────────────────────────────────────────────────
// PARTICLE RENDERERS
// ─────────────────────────────────────────────────────────────────

function HeartBalloon({ p, onDone }) {
  return (
    <div
      onAnimationEnd={onDone}
      style={{
        position: "fixed",
        left: `${p.x}%`,
        bottom: "-60px",
        fontSize: `${p.size}px`,
        lineHeight: 1,
        animationName: "seenBalloonFloat",
        animationDuration: "2.6s",
        animationDelay: `${p.delay}ms`,
        animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        animationFillMode: "forwards",
        "--wobble": `${p.wobble * 30}px`,
        pointerEvents: "none",
        zIndex: 9999,
        userSelect: "none",
        filter: "drop-shadow(0 2px 6px rgba(239,68,68,0.4))",
      }}
    >
      ❤️
    </div>
  );
}

function Spark({ p, onDone }) {
  return (
    <div
      onAnimationEnd={onDone}
      style={{
        position: "fixed",
        left: `${p.x}%`,
        top: `${p.y}%`,
        width: `${p.size}px`,
        height: `${p.size}px`,
        borderRadius: "50%",
        background: p.color,
        animationName: "seenSparkFly",
        animationDuration: "650ms",
        animationTimingFunction: "ease-out",
        animationFillMode: "forwards",
        "--dx": `${p.dx}px`,
        "--dy": `${p.dy}px`,
        pointerEvents: "none",
        zIndex: 9999,
        boxShadow: `0 0 4px ${p.color}`,
      }}
    />
  );
}

function WaveRing({ p, onDone }) {
  return (
    <div
      onAnimationEnd={p.ringIndex === 2 ? onDone : undefined}
      style={{
        position: "fixed",
        left: `${p.x}%`,
        top: `${p.y}%`,
        transform: "translate(-50%, -50%)",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        border: "2px solid #14b8a6",
        animationName: "seenRippleRing",
        animationDuration: "800ms",
        animationDelay: `${p.delay}ms`,
        animationTimingFunction: "ease-out",
        animationFillMode: "forwards",
        opacity: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}

function ConfettiPiece({ p, onDone }) {
  const isRect = p.shape === "rect";
  return (
    <div
      onAnimationEnd={onDone}
      style={{
        position: "fixed",
        left: `${p.x}%`,
        top: "-16px",
        width: isRect ? `${p.size}px` : `${p.size * 0.8}px`,
        height: isRect ? `${p.size * 0.6}px` : `${p.size * 0.8}px`,
        borderRadius: isRect ? "2px" : "50%",
        background: p.color,
        transform: `rotate(${p.rotation}deg)`,
        animationName: "seenConfettiFall",
        animationDuration: `${p.speed}s`,
        animationDelay: `${p.delay}ms`,
        animationTimingFunction: "linear",
        animationFillMode: "forwards",
        "--rot-end": `${p.rotation + randomBetween(180, 540)}deg`,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}

function CoinFloat({ p, onDone }) {
  return (
    <div
      onAnimationEnd={onDone}
      style={{
        position: "fixed",
        left: `${p.x}%`,
        top: `${p.y}%`,
        fontSize: `${p.size}px`,
        lineHeight: 1,
        animationName: "seenCoinFloat",
        animationDuration: "1.2s",
        animationDelay: `${p.delay}ms`,
        animationTimingFunction: "ease-out",
        animationFillMode: "forwards",
        opacity: 0,
        pointerEvents: "none",
        zIndex: 9999,
        userSelect: "none",
      }}
    >
      ✨
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AnimationLayer — render this once at the app root
// ─────────────────────────────────────────────────────────────────

export function AnimationLayer({ controller }) {
  const { particles } = controller;

  const remove = useCallback((id) => {
    // particles auto-remove via timeouts in useAnimations,
    // onAnimationEnd is a safety net for stragglers
  }, []);

  return (
    <>
      {/* Global keyframes injected once */}
      <style>{`
        @keyframes seenBalloonFloat {
          0%   { transform: translateY(0) translateX(0); opacity: 1; }
          20%  { transform: translateY(-20vh) translateX(calc(var(--wobble) * 0.3)); opacity: 1; }
          50%  { transform: translateY(-50vh) translateX(var(--wobble)); opacity: 0.9; }
          80%  { transform: translateY(-80vh) translateX(calc(var(--wobble) * 0.5)); opacity: 0.6; }
          100% { transform: translateY(-105vh) translateX(0); opacity: 0; }
        }

        @keyframes seenSparkFly {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          60%  { opacity: 0.8; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
        }

        @keyframes seenRippleRing {
          0%   { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(6); opacity: 0; }
        }

        @keyframes seenConfettiFall {
          0%   { transform: translateY(0) rotate(var(--rot-end, 0deg)) scale(1); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(var(--rot-end, 360deg)) scale(0.8); opacity: 0; }
        }

        @keyframes seenCoinFloat {
          0%   { transform: translateY(0) scale(0.5); opacity: 0; }
          20%  { opacity: 1; transform: translateY(-10px) scale(1.1); }
          100% { transform: translateY(-80px) scale(0.8); opacity: 0; }
        }

        @keyframes seenGlobePulseRing {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.7); }
          70%  { box-shadow: 0 0 0 10px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }

        .seen-globe-pulse {
          animation: seenGlobePulseRing 0.8s ease-out 3;
          border-radius: 999px;
        }
      `}</style>

      {/* Render all active particles */}
      {particles.map((p) => {
        const onDone = () => {};
        switch (p.type) {
          case "heartBalloon": return <HeartBalloon key={p.id} p={p} onDone={onDone} />;
          case "spark":        return <Spark key={p.id} p={p} onDone={onDone} />;
          case "waveRing":     return <WaveRing key={p.id} p={p} onDone={onDone} />;
          case "confetti":     return <ConfettiPiece key={p.id} p={p} onDone={onDone} />;
          case "coin":         return <CoinFloat key={p.id} p={p} onDone={onDone} />;
          default:             return null;
        }
      })}
    </>
  );
}
