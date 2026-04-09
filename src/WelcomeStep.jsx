import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  collection, onSnapshot, orderBy, query, limit, where,
} from "firebase/firestore";
import "./WelcomeStep.css";

const PRESENCE_TTL_MS = 5 * 60 * 1000;

// Real Firebase presence count
function useLiveCount(db) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!db) return;
    const cutoff = Date.now() - PRESENCE_TTL_MS;
    const q = query(
      collection(db, "presence"),
      where("lastSeen", ">=", cutoff)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setCount(snap.size),
      () => setCount(null) // rules may block unauthenticated reads
    );
    return unsub;
  }, [db]);

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
          .filter((m) => m.sender && m.country);
        setMessages(msgs);
      },
      () => setMessages([])
    );
    return unsub;
  }, [db]);

  return messages;
}

function buildTickerText(msg) {
  const name = msg.sender?.split(" ")?.[0] || "Someone";
  const country = msg.country || "the world";
  return `${name} just sent kindness to someone in ${country}`;
}

// Fallback items shown before real data loads
const FALLBACK_TICKER = [
  "Sofia just sent kindness to someone in Brazil 🇧🇷",
  "Liam brightened someone's day in Japan 🇯🇵",
  "Amara sent kindness to someone in Germany 🇩🇪",
  "Carlos spread joy to someone in India 🇮🇳",
  "Mei just sent kindness to someone in Canada 🇨🇦",
  "Yusuf sent warmth to someone in Nigeria 🇳🇬",
  "Elena just connected with a stranger in France 🇫🇷",
];

// Background: single slow radial gradient + grain texture
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

  useEffect(() => {
    idxRef.current = 0;
    setIdx(0);
    setVisible(true);
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

function WelcomeStep({ onStartJourney, db }) {
  const count = useLiveCount(db);
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

        {/* Live social proof counter — only shown when data is available */}
        {count !== null && count > 0 && (
          <div className="welcome-live">
            <span
              className={`welcome-live__dot${
                dotPulse ? " welcome-live__dot--pulse" : ""
              }`}
            />
            <span className="welcome-live__text">
              <strong>{count.toLocaleString()}</strong> people connected today
            </span>
          </div>
        )}

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
        <ActivityTicker db={db} />
        <p className="welcome-trust">No posts · No followers · Just kindness</p>
        <button className="welcome-step__cta" onClick={onStartJourney}>
          I want to feel seen <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}

export default WelcomeStep;
