// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  collection, onSnapshot, orderBy, query, limit, where,
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import "./WelcomeStep.css";

const PRESENCE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — matches "today" label

function useAnonymousAuth(auth) {
  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(() => {});
  }, [auth]);
}

// Real Firebase presence count — rolling 24h window, refreshes every minute.
function useLiveCount(db) {
  const [count, setCount] = useState(null);
  const [cutoff, setCutoff] = useState(() => Date.now() - PRESENCE_TTL_MS);

  // Slide the window forward every minute so old entries fall off naturally
  useEffect(() => {
    const id = setInterval(() => setCutoff(Date.now() - PRESENCE_TTL_MS), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "presence"), where("lastSeen", ">=", cutoff));
    const unsub = onSnapshot(q, (snap) => setCount(snap.size), () => setCount(0));
    return unsub;
  }, [db, cutoff]);

  return count;
}

// Real messages from publicMessages collection
function useRecentMessages(db) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "publicMessages"),
      orderBy("timestamp", "desc"),
      limit(12)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const msgs = snap.docs
          .map((d) => d.data())
          .filter((m) => m.sender || m.country);
        setMessages(msgs);
      },
      () => setMessages([])
    );
    return unsub;
  }, [db]);

  return messages;
}

function buildTickerText(msg) {
  const name = (msg.sender || "Someone").split(" ")[0];
  const country = msg.country || "the world";
  return `${name} just sent kindness to someone in ${country}`;
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

// Activity ticker — uses real messages when available
function ActivityTicker({ db }) {
  const realMessages = useRecentMessages(db);
  const items =
    realMessages.length > 0
      ? realMessages.map(buildTickerText)
      : FALLBACK_TICKER;

  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const idxRef = useRef(0);
  const lenRef = useRef(items.length);

  // When items switches from fallback→real, restart from 0
  useEffect(() => {
    if (lenRef.current !== items.length) {
      lenRef.current = items.length;
      idxRef.current = 0;
      setIdx(0);
      setVisible(true);
    }
  }, [items.length]);

  useEffect(() => {
    const rotate = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        idxRef.current = (idxRef.current + 1) % items.length;
        setIdx(idxRef.current);
        setVisible(true);
      }, 300);
    }, 3800);
    return () => clearInterval(rotate);
  }, [items.length]);

  return (
    <div className="welcome-ticker">
      <span className="welcome-ticker__label">Live</span>
      <span
        className={`welcome-ticker__text${
          visible ? " welcome-ticker__text--in" : " welcome-ticker__text--out"
        }`}
      >
        {items[idx]}
      </span>
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

// ── Animated globe preview ─────────────────────────────────────────────

// Equirectangular → SVG200: x = 100 + 80*(lon/180), y = 100 - 80*(lat/90)
// ALL vertices verified to be inside the sphere (dist < 79 from centre 100,100).
// Outside-sphere vertices cause SVG clipPath to create huge arc-shaped fills.
const CONTINENTS = [
  // North America — stays within visible hemisphere (no far-west Alaska)
  "52,38 67,38 76,58 64,78 60,86 51,79 45,56 44,47",
  // South America
  "63,90 73,90 84,104 78,149 70,149 66,143 64,96",
  // Europe
  "96,68 116,67 118,51 112,38 104,48 98,51 96,57",
  // Africa — NE corner is Egypt (lon≈25°E), NOT Iran (lon=52°E)
  "97,68 111,72 119,90 116,122 108,130 100,95 92,81",
  // Asia — capped at lon≈105°E for 70°N so no point leaves the sphere
  "112,36 147,38 160,59 162,69 148,78 136,93 130,80 116,67 113,63",
  // Australia
  "150,111 168,111 168,139 158,139 150,120",
  // Greenland
  "73,27 90,27 90,37 75,37",
];

// Arc paths — control points pushed outside the sphere so arcs fly above the surface.
const GLOBE_ARCS = [
  // UK → USA East Coast
  { id: "a", d: "M 100,55 Q 65,16 58,66", cx: 58, cy: 66, delay: "0s" },
  // India → Japan
  { id: "b", d: "M 135,81 Q 158,36 162,68", cx: 162, cy: 68, delay: "0.9s" },
  // West Africa → India
  { id: "c", d: "M 104,92 Q 112,16 135,81", cx: 135, cy: 81, delay: "1.8s" },
  // Nigeria → Australia
  { id: "d", d: "M 104,92 Q 165,50 159,122", cx: 159, cy: 122, delay: "2.7s" },
];

function GlobePreview() {
  return (
    <div className="welcome-globe" aria-hidden="true">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" overflow="visible">
        <defs>
          <radialGradient id="wg-fill" cx="38%" cy="32%">
            <stop offset="0%" stopColor="#1a3a6e" />
            <stop offset="100%" stopColor="#050d1c" />
          </radialGradient>
          <radialGradient id="wg-atm" cx="50%" cy="50%">
            <stop offset="74%" stopColor="rgba(77,255,176,0)" />
            <stop offset="100%" stopColor="rgba(77,255,176,0.16)" />
          </radialGradient>
          <radialGradient id="wg-shine" cx="32%" cy="24%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <clipPath id="wg-clip">
            <circle cx="100" cy="100" r="79" />
          </clipPath>
        </defs>

        {/* Atmosphere halo */}
        <circle cx="100" cy="100" r="86" fill="url(#wg-atm)" />

        {/* Sphere base */}
        <circle cx="100" cy="100" r="80" fill="url(#wg-fill)" stroke="rgba(77,255,176,0.28)" strokeWidth="0.8" />

        {/* Grid lines — clipped to sphere */}
        <g clipPath="url(#wg-clip)" fill="none" strokeLinecap="round">
          <ellipse cx="100" cy="100" rx="79" ry="10" stroke="rgba(77,255,176,0.18)" strokeWidth="0.8" />
          <ellipse cx="100" cy="73"  rx="68" ry="8"  stroke="rgba(77,255,176,0.12)" strokeWidth="0.6" />
          <ellipse cx="100" cy="127" rx="68" ry="8"  stroke="rgba(77,255,176,0.12)" strokeWidth="0.6" />
          <ellipse cx="100" cy="50"  rx="43" ry="5"  stroke="rgba(77,255,176,0.08)" strokeWidth="0.5" />
          <path d="M 100,21 Q 170,100 100,179" stroke="rgba(77,255,176,0.12)" strokeWidth="0.6" />
          <path d="M 100,21 Q  30,100 100,179" stroke="rgba(77,255,176,0.12)" strokeWidth="0.6" />
          <path d="M 100,21 Q 186,58 179,100 Q 186,142 100,179" stroke="rgba(77,255,176,0.08)" strokeWidth="0.5" />
          <path d="M 100,21 Q  14,58  21,100 Q  14,142 100,179" stroke="rgba(77,255,176,0.08)" strokeWidth="0.5" />
        </g>

        {/* Continent fills — clipped to sphere */}
        <g
          clipPath="url(#wg-clip)"
          fill="rgba(77,255,176,0.14)"
          stroke="rgba(77,255,176,0.45)"
          strokeWidth="0.8"
          strokeLinejoin="round"
        >
          {CONTINENTS.map((pts, i) => (
            <polygon key={i} points={pts} />
          ))}
        </g>

        {/* Animated arcs + destination pulses */}
        {GLOBE_ARCS.map(({ id, d, cx, cy, delay }) => (
          <g key={id}>
            {/* Wide soft glow under the arc */}
            <path
              d={d} pathLength="1" fill="none"
              stroke="rgba(77,255,176,0.28)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray="1" strokeDashoffset="1"
              style={{ animation: `wgArc 3.6s ease-out ${delay} infinite` }}
            />
            {/* Crisp bright arc */}
            <path
              d={d} pathLength="1" fill="none"
              stroke="#4DFFB0" strokeWidth="2.2" strokeLinecap="round"
              strokeDasharray="1" strokeDashoffset="1"
              style={{ animation: `wgArc 3.6s ease-out ${delay} infinite` }}
            />
            {/* Destination pulse */}
            <circle cx={cx} cy={cy} r="5" fill="#4DFFB0"
              style={{
                animation: `wgDot 3.6s ease-out ${delay} infinite`,
                transformOrigin: `${cx}px ${cy}px`,
                filter: "drop-shadow(0 0 8px rgba(77,255,176,1))",
              }}
            />
          </g>
        ))}

        {/* Shine overlay */}
        <circle cx="100" cy="100" r="80" fill="url(#wg-shine)" />
      </svg>
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
          <Sparkles size={34} />
        </div>

        {/* Brand */}
        <h1 className="welcome-step__title">Seen</h1>
        <p className="welcome-step__tagline">You matter</p>

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
