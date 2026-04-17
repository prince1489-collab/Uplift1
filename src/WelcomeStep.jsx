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
