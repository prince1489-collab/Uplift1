// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { signInAnonymously } from "firebase/auth";
import { geoOrthographic, geoPath, geoGraticule, geoInterpolate } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import "./WelcomeStep.css";


function useAnonymousAuth(auth) {
  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(() => {});
  }, [auth]);
}

const AFFIRMATIONS = [
  "You are not invisible.",
  "Someone out there is rooting for you.",
  "It's okay to not be okay.",
  "You showed up today. That's enough.",
  "One message can change someone's whole day.",
  "You matter more than you know.",
  "Kindness finds its way back to you.",
];

function AffirmationRotator() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const rotate = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % AFFIRMATIONS.length);
        setVisible(true);
      }, 400);
    }, 4500);
    return () => clearInterval(rotate);
  }, []);

  return (
    <div className="welcome-affirmation">
      <span className="welcome-affirmation__icon">🤍</span>
      <span className={`welcome-affirmation__text${visible ? " welcome-affirmation__text--in" : " welcome-affirmation__text--out"}`}>
        {AFFIRMATIONS[idx]}
      </span>
    </div>
  );
}
function BackgroundAmbient() {
  return (
    <div className="welcome-ambient" aria-hidden="true">
      <div className="welcome-ambient__radial" />
      <div className="welcome-ambient__grain" />
    </div>
  );
}


// Improvement 1: Emotional feature cards
const HIGHLIGHTS = [
  {
    emoji: "🌍",
    title: "You're not alone",
    detail: "Someone in the world is thinking of you right now.",
    mod: "world",
  },
  {
    emoji: "💬",
    title: "Be seen, feel better",
    detail: "A single kind message can shift someone's whole day.",
    mod: "seen",
  },
  {
    emoji: "✨",
    title: "No pressure, just kindness",
    detail: "Choose a greeting and send it. That's all it takes.",
    mod: "kind",
  },
];

// ── Canvas Globe — d3-geo orthographic projection ──────────────────────

const _LAND      = feature(worldAtlas, worldAtlas.objects.land);
const _COUNTRIES = feature(worldAtlas, worldAtlas.objects.countries);
const _GRATICULE = geoGraticule().step([20, 20])();

const GLOBE_CONNECTIONS = [
  { from: [-0.1, 51.5], to: [-74,  40.7], delay: 0   }, // London → NYC
  { from: [79,   21  ], to: [139,  35.7], delay: 0.9 }, // Mumbai → Tokyo
  { from: [7,    5.5 ], to: [-46, -13.6], delay: 1.8 }, // Lagos → Brasília
  { from: [-0.1, 51.5], to: [133, -25  ], delay: 2.7 }, // London → Australia
];

const ARC_STEPS = 64;
const ARC_COORDS = GLOBE_CONNECTIONS.map(({ from, to }) => {
  const interp = geoInterpolate(from, to);
  return Array.from({ length: ARC_STEPS + 1 }, (_, i) => interp(i / ARC_STEPS));
});

function GlobePreview() {
  const canvasRef = useRef(null);
  const wrapRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;

    const DPR  = Math.min(window.devicePixelRatio || 1, 2);
    const CSS  = wrap.clientWidth || 150; // reads size from CSS so @media queries control it
    canvas.width  = CSS * DPR;
    canvas.height = CSS * DPR;
    canvas.style.width  = CSS + "px";
    canvas.style.height = CSS + "px";

    const ctx = canvas.getContext("2d");
    ctx.scale(DPR, DPR);

    const CX = CSS / 2;
    const CY = CSS / 2;
    const R  = CSS * 0.44;

    const proj = geoOrthographic()
      .scale(R)
      .translate([CX, CY])
      .clipAngle(90);

    const pathGen = geoPath().projection(proj).context(ctx);

    let lon = -20;
    let rafId;
    const t0 = performance.now();
    let prevNow = t0;

    function frame(now) {
      const t = (now - t0) / 1000;
      // Time-based rotation (2.4°/s ≈ the old 0.04°/frame at 60 fps) so the speed is the
      // same on every device regardless of refresh rate; clamp gaps from throttled tabs.
      const dt = Math.min(100, now - prevNow);
      prevNow = now;
      lon -= 2.4 * (dt / 1000);
      proj.rotate([lon, -25, 0]);

      ctx.clearRect(0, 0, CSS, CSS);

      // Ocean
      ctx.beginPath();
      pathGen({ type: "Sphere" });
      const ocean = ctx.createRadialGradient(CX - R * 0.3, CY - R * 0.3, 0, CX, CY, R);
      ocean.addColorStop(0, "#1e4a7a");
      ocean.addColorStop(1, "#050d1c");
      ctx.fillStyle = ocean;
      ctx.fill();

      // Graticule
      ctx.beginPath();
      pathGen(_GRATICULE);
      ctx.strokeStyle = "rgba(77,255,176,0.1)";
      ctx.lineWidth = 0.4;
      ctx.stroke();

      // Land fill
      ctx.beginPath();
      pathGen(_LAND);
      ctx.fillStyle = "rgba(77,255,176,0.22)";
      ctx.fill();

      // Country borders — all batched into one stroke call
      ctx.beginPath();
      _COUNTRIES.features.forEach(f => pathGen(f));
      ctx.strokeStyle = "rgba(77,255,176,0.38)";
      ctx.lineWidth = 0.35;
      ctx.stroke();

      // Animated arcs
      GLOBE_CONNECTIONS.forEach(({ to, delay }, i) => {
        const PERIOD = 3.6;
        const el = ((t - delay) % PERIOD + PERIOD) % PERIOD;
        const drawProg = Math.min(el / (PERIOD * 0.52), 1);
        const alpha = el > PERIOD * 0.7
          ? Math.max(0, 1 - (el - PERIOD * 0.7) / (PERIOD * 0.3))
          : 1;

        if (drawProg < 0.02 || alpha < 0.01) return;

        const steps = Math.max(2, Math.floor(drawProg * ARC_STEPS));
        const arcFeat = { type: "LineString", coordinates: ARC_COORDS[i].slice(0, steps + 1) };

        // Soft glow
        ctx.beginPath();
        pathGen(arcFeat);
        ctx.strokeStyle = `rgba(77,255,176,${0.22 * alpha})`;
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.stroke();

        // Bright core
        ctx.beginPath();
        pathGen(arcFeat);
        ctx.strokeStyle = `rgba(77,255,176,${alpha})`;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();

        // Destination pulse dot
        if (drawProg >= 0.98) {
          const pt = proj(to);
          if (pt) {
            const pulse = Math.min((el - PERIOD * 0.52) / 0.5, 1);
            const dotR  = 3 + pulse * 5;
            const dotA  = alpha * Math.max(0, 1 - pulse * 0.6);
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], dotR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(77,255,176,${dotA})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(77,255,176,${alpha})`;
            ctx.fill();
          }
        }
      });

      // Atmosphere halo
      const atm = ctx.createRadialGradient(CX, CY, R * 0.88, CX, CY, R * 1.1);
      atm.addColorStop(0, "rgba(77,255,176,0)");
      atm.addColorStop(1, "rgba(77,255,176,0.15)");
      ctx.beginPath();
      ctx.arc(CX, CY, R * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = atm;
      ctx.fill();

      // Sphere outline
      ctx.beginPath();
      pathGen({ type: "Sphere" });
      ctx.strokeStyle = "rgba(77,255,176,0.28)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Specular shine
      const shine = ctx.createRadialGradient(
        CX - R * 0.38, CY - R * 0.38, 0,
        CX - R * 0.1,  CY - R * 0.1,  R * 0.85
      );
      shine.addColorStop(0, "rgba(255,255,255,0.16)");
      shine.addColorStop(0.6, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.fillStyle = shine;
      ctx.fill();

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="welcome-globe" ref={wrapRef} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

function WelcomeStep({ onStartJourney, db, auth }) {
  useAnonymousAuth(auth);

  return (
    <div className="welcome-step">
      <BackgroundAmbient />

      <div className="welcome-step__content">
        {/* Logo icon */}
        <div className="welcome-step__logo-wrap">
          <Sparkles size={28} />
        </div>

        {/* Brand */}
        <h1 className="welcome-step__title">Seen</h1>
        <p className="welcome-step__tagline">Kindness is Addictive</p>

        {/* Animated globe — the hook before sign-up */}
        <GlobePreview />

        {/* Emotional cards */}
        <div className="welcome-step__list">
          {HIGHLIGHTS.map((h) => (
            <article
              className={`welcome-card welcome-card--${h.mod}`}
              key={h.title}
            >
              <span className="welcome-card__emoji">{h.emoji}</span>
              <div>
                <h2 className="welcome-card__title">{h.title}</h2>
                <p className="welcome-card__detail">{h.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Bottom: ticker + trust line + CTA — always visible */}
      <div className="welcome-step__footer">
        <AffirmationRotator />
        <p className="welcome-trust">No posts · No followers · Just kindness</p>
        <button className="welcome-step__cta" onClick={onStartJourney}>
          I want to feel seen <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}

export default WelcomeStep;
