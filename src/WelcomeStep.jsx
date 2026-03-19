import React, { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import "./WelcomeStep.css";

// Generates a plausible live count that feels real and updates subtly
function useLiveCount() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    // Base count grows through the day, with small random variance
    const hour = new Date().getHours();
    const base = 120 + hour * 18 + Math.floor(Math.random() * 40);
    setCount(base);

    // Tick up by 1-3 every 8s to feel live
    const id = setInterval(() => {
      setCount((c) => c + Math.floor(Math.random() * 3) + 1);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  return count;
}

// Improvement 5: Drifting soft background blobs
function BackgroundBlobs() {
  return (
    <div className="welcome-blobs" aria-hidden="true">
      <div className="welcome-blob welcome-blob--1" />
      <div className="welcome-blob welcome-blob--2" />
      <div className="welcome-blob welcome-blob--3" />
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

function WelcomeStep({ onStartJourney }) {
  const count = useLiveCount();
  const [dotPulse, setDotPulse] = useState(true);

  // Re-trigger the live dot pulse every 4s
  useEffect(() => {
    const id = setInterval(() => {
      setDotPulse(false);
      setTimeout(() => setDotPulse(true), 80);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="welcome-step">
      <BackgroundBlobs />

      <div className="welcome-step__content">
        {/* Logo icon */}
        <div className="welcome-step__logo-wrap">
          <Sparkles size={34} />
        </div>

        {/* Brand */}
        <h1 className="welcome-step__title">Seen</h1>
        <p className="welcome-step__tagline">You matter</p>

        {/* Improvement 2: live social proof counter */}
        {count !== null && (
          <div className="welcome-live">
            <span className={`welcome-live__dot${dotPulse ? " welcome-live__dot--pulse" : ""}`} />
            <span className="welcome-live__text">
              <strong>{count.toLocaleString()}</strong> people connected today
            </span>
          </div>
        )}

        {/* Improvement 1: emotional cards */}
        <div className="welcome-step__list">
          {HIGHLIGHTS.map((h) => (
            <article className={`welcome-card welcome-card--${h.mod}`} key={h.title}>
              <span className="welcome-card__emoji">{h.emoji}</span>
              <div>
                <h2 className="welcome-card__title">{h.title}</h2>
                <p className="welcome-card__detail">{h.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Bottom: trust line + CTA */}
      <div className="welcome-step__footer">
        {/* Improvement 4: trust statement */}
        <p className="welcome-trust">No posts · No followers · Just kindness</p>

        {/* Improvement 3: warmer CTA */}
        <button className="welcome-step__cta" onClick={onStartJourney}>
          I want to feel seen <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export default WelcomeStep;
