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

// Background: single slow radial gradient + grain texture
function BackgroundAmbient() {
  return (
    <div className="welcome-ambient" aria-hidden="true">
      <div className="welcome-ambient__radial" />
      <div className="welcome-ambient__grain" />
    </div>
  );
}

// Live activity ticker — cycles through plausible activity items
const TICKER_ITEMS = [
  "Sofia just sent a greeting to someone in Brazil 🇧🇷",
  "Liam brightened someone's day in Japan 🇯🇵",
  "Amara sent kindness to a stranger in Germany 🇩🇪",
  "Carlos spread joy to someone in India 🇮🇳",
  "Mei lifted someone's spirits in Canada 🇨🇦",
  "Yusuf sent warmth to someone in Nigeria 🇳🇬",
  "Elena just connected with a stranger in France 🇫🇷",
];

function ActivityTicker() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const rotate = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % TICKER_ITEMS.length);
        setVisible(true);
      }, 300);
    }, 3800);
    return () => clearInterval(rotate);
  }, []);

  return (
    <div className="welcome-ticker">
      <span className="welcome-ticker__label">Live</span>
      <span className={`welcome-ticker__text${visible ? " welcome-ticker__text--in" : " welcome-ticker__text--out"}`}>
        {TICKER_ITEMS[idx]}
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
      <BackgroundAmbient />

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

      {/* Bottom: ticker + trust line + CTA */}
      <div className="welcome-step__footer">
        <ActivityTicker />
        <p className="welcome-trust">No posts · No followers · Just kindness</p>
        <button className="welcome-step__cta" onClick={onStartJourney}>
          I want to feel seen <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}

export default WelcomeStep;
