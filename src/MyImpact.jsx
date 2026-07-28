// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

import React, { useEffect, useMemo, useState } from "react";
import {
  collection, limit, onSnapshot, query, where,
} from "firebase/firestore";
import { countryToFlag } from "./MicroAnimations";
import { COUNTRY_COORDS } from "./WorldMap";
import { readPublicProfile } from "./publicProfile";

// ── Theme tokens ──────────────────────────────────────────────────
export const DARK = {
  pageBg:       "#060e18",
  card:         "rgba(255,255,255,0.04)",
  cardInner:    "rgba(255,255,255,0.04)",
  border:       "rgba(255,255,255,0.07)",
  divider:      "rgba(255,255,255,0.08)",
  toggleBg:     "rgba(255,255,255,0.06)",
  toggleBorder: "rgba(255,255,255,0.1)",
  text:         "#ffffff",
  textMid:      "rgba(255,255,255,0.82)",
  textDim:      "rgba(255,255,255,0.4)",
  textFaint:    "rgba(255,255,255,0.25)",
  textFaintest: "rgba(255,255,255,0.2)",
  accent:       "#FF8580",
  accentDim:    "rgba(255,133,128,0.85)",
  accentBg:     "rgba(255,133,128,0.05)",
  accentBorder: "rgba(255,133,128,0.14)",
  accentLabel:  "rgba(255,133,128,0.7)",
  accentMuted:  "rgba(255,133,128,0.4)",
  accentBar:    "rgba(255,133,128,0.4)",
  accentBarSel: "rgba(255,133,128,0.85)",
  rowSelBg:     "rgba(255,133,128,0.07)",
  rowSelBorder: "rgba(255,133,128,0.2)",
  rowSelGlow:   "rgba(255,133,128,0.15)",
  rowBg:        "rgba(255,255,255,0.03)",
  rowBorder:    "rgba(255,255,255,0.05)",
  barTrack:     "rgba(255,255,255,0.06)",
  skeleton:     "rgba(255,255,255,0.07)",
};
export const LIGHT = {
  pageBg:       "#f1f5f9",
  card:         "rgba(255,255,255,0.9)",
  cardInner:    "rgba(0,0,0,0.03)",
  border:       "rgba(0,0,0,0.08)",
  divider:      "rgba(0,0,0,0.08)",
  toggleBg:     "rgba(0,0,0,0.06)",
  toggleBorder: "rgba(0,0,0,0.1)",
  text:         "#0f172a",
  textMid:      "rgba(15,23,42,0.75)",
  textDim:      "rgba(15,23,42,0.5)",
  textFaint:    "rgba(15,23,42,0.35)",
  textFaintest: "rgba(15,23,42,0.25)",
  accent:       "#D24341",
  accentDim:    "#D24341",
  accentBg:     "rgba(210,67,65,0.08)",
  accentBorder: "rgba(210,67,65,0.2)",
  accentLabel:  "#D24341",
  accentMuted:  "rgba(210,67,65,0.5)",
  accentBar:    "rgba(210,67,65,0.4)",
  accentBarSel: "rgba(210,67,65,0.85)",
  rowSelBg:     "rgba(210,67,65,0.07)",
  rowSelBorder: "rgba(210,67,65,0.2)",
  rowSelGlow:   "rgba(210,67,65,0.1)",
  rowBg:        "rgba(0,0,0,0.02)",
  rowBorder:    "rgba(0,0,0,0.05)",
  barTrack:     "rgba(0,0,0,0.07)",
  skeleton:     "rgba(0,0,0,0.07)",
};

// ── Haversine distance ────────────────────────────────────────────

export function kmBetween([lon1, lat1], [lon2, lat2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Data hook ─────────────────────────────────────────────────────

const CACHE_TTL = 60 * 60 * 1000;

export function useReactionData(db, currentUser, period) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !currentUser) return;
    const cacheKey = `seen_react_v1_${period}_${currentUser.uid}`;

    // Serve the cache instantly for first paint — but stay subscribed below so
    // live updates (new reactions) overwrite it within seconds.
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.at < CACHE_TTL) {
        setData(cached.data);
        setLoading(false);
      }
    } catch (_) {}

    const cutoff = Date.now() - (period === "30d" ? 30 : 7) * 86400000;
    const q = query(
      collection(db, "publicMessages"),
      where("uid", "==", currentUser.uid),
      where("timestamp", ">=", cutoff),
      limit(500)
    );

    let reactionUnsubs = [];
    const perMsg = new Map(); // msgId -> [{ uid, country }] reactions by others
    let dayMap = {};

    const recompute = () => {
      let totalReactions = 0;
      const reactionByCountry = {};
      const uidsByCountry = {};
      const allReactorUids = new Set();
      // The single most recent reaction from another country — powers the weekly story.
      let notableReaction = null;
      for (const entries of perMsg.values()) {
        for (const { uid, country, reactedAt } of entries) {
          totalReactions++;
          allReactorUids.add(uid);
          if (country) {
            reactionByCountry[country] = (reactionByCountry[country] || 0) + 1;
            if (!uidsByCountry[country]) uidsByCountry[country] = new Set();
            uidsByCountry[country].add(uid);
            if (reactedAt && (!notableReaction || reactedAt > notableReaction.reactedAt)) {
              notableReaction = { country, reactedAt };
            }
          }
        }
      }
      const usersByCountry = Object.fromEntries(
        Object.entries(uidsByCountry).map(([c, s]) => [c, s.size])
      );
      const result = { totalReactions, reactionByCountry, usersByCountry,
                       uniqueReactorCount: allReactorUids.size, dayMap, notableReaction };
      setData(result);
      setLoading(false);
      try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data: result })); } catch (_) {}
    };

    const outer = onSnapshot(q, (snap) => {
      dayMap = {};
      snap.forEach(d => {
        const key = new Date(d.data().timestamp).toISOString().split("T")[0];
        dayMap[key] = (dayMap[key] || 0) + 1;
      });

      reactionUnsubs.forEach(u => u());
      reactionUnsubs = [];
      perMsg.clear();

      if (snap.empty) { recompute(); return; }

      snap.docs.forEach(d => {
        const msgId = d.id;
        const unsub = onSnapshot(collection(db, "publicMessages", msgId, "reactions"), (rSnap) => {
          const entries = [];
          rSnap.forEach(rDoc => {
            const { uids = [], countries = {}, reactedAt = {} } = rDoc.data();
            uids.forEach(uid => {
              if (uid !== currentUser.uid) entries.push({ uid, country: countries[uid], reactedAt: reactedAt[uid] });
            });
          });
          perMsg.set(msgId, entries);
          recompute();
        }, () => {});
        reactionUnsubs.push(unsub);
      });
    }, () => { setLoading(false); });

    return () => { outer(); reactionUnsubs.forEach(u => u()); };
  }, [db, currentUser, period]);

  return { data, loading };
}

// ── Ripple data — people my kindness sparked into greeting others ──
// Each doc under users/{me}/ripples represents one person who reacted to my
// greeting and then went on to send their own. Counted once per person.
export function useRippleData(db, currentUser) {
  const [ripples, setRipples] = useState(null);

  useEffect(() => {
    if (!db || !currentUser) return;
    const cacheKey = `seen_ripples_v1_${currentUser.uid}`;

    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.at < CACHE_TTL) setRipples(cached.data);
    } catch (_) {}

    const unsub = onSnapshot(
      collection(db, "users", currentUser.uid, "ripples"),
      (snap) => {
        const list = snap.docs.map(d => d.data());
        setRipples(list);
        try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data: list })); } catch (_) {}
      },
      () => {}
    );
    return () => unsub();
  }, [db, currentUser]);

  return { rippleCount: ripples?.length ?? 0, ripples: ripples ?? [] };
}

// ── Onward Reach — second-order impact ────────────────────────────
// Of the people I reached who then sent their own greetings (ripple responders),
// how many likes did THEIR greetings go on to receive? Each responder denormalizes
// their own total likes received onto their profile (reactionsReceivedCount), which
// any user can read. We sum across my ripple responders. Best-effort: a responder's
// count only populates once they've been online running the latest build.
export function useOnwardReach(db, currentUser, ripples) {
  const [onwardReach, setOnwardReach] = useState(() => {
    if (!currentUser) return 0;
    try {
      const cached = JSON.parse(localStorage.getItem(`seen_onward_v1_${currentUser.uid}`) || "null");
      if (cached && Date.now() - cached.at < CACHE_TTL) return cached.v;
    } catch (_) {}
    return 0;
  });

  useEffect(() => {
    if (!db || !currentUser || !ripples?.length) { setOnwardReach(0); return; }
    let cancelled = false;
    const uids = [...new Set(ripples.map(r => r.responderUid).filter(Boolean))];
    Promise.all(uids.map(uid =>
      readPublicProfile(db, uid).then(p => p?.reactionsReceivedCount ?? 0).catch(() => 0)
    )).then(counts => {
      if (cancelled) return;
      const total = counts.reduce((a, b) => a + b, 0);
      setOnwardReach(total);
      try { localStorage.setItem(`seen_onward_v1_${currentUser.uid}`, JSON.stringify({ at: Date.now(), v: total })); } catch (_) {}
    });
    return () => { cancelled = true; };
  }, [db, currentUser, ripples]);

  return onwardReach;
}

// ── Weekly story — a short, human narrative assembled from this week's data.
// Pure function: same inputs → same output, so it changes naturally week to week.
function buildWeeklyStory({ countriesCount, notableReaction, rippleCount, onwardReach = 0, dayMap }) {
  const sentences = [];

  if (countriesCount > 0) {
    sentences.push(
      `This week your warmth reached ${countriesCount} ${countriesCount === 1 ? "country" : "countries"}.`
    );
  }

  if (notableReaction?.reactedAt) {
    const d = new Date(notableReaction.reactedAt);
    const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
    let hr = d.getHours();
    const ampm = hr >= 12 ? "pm" : "am";
    hr = hr % 12 || 12;
    const timeLabel = `${hr}${ampm}`;
    sentences.push(
      `Someone in ${notableReaction.country} reacted to your greeting at ${timeLabel} on a ${weekday} — probably right when they needed it.`
    );
  }

  if (rippleCount > 0) {
    sentences.push(
      `And your kindness travelled: ${rippleCount} ${rippleCount === 1 ? "person" : "people"} you reached went on to greet someone else.`
    );
  }

  if (onwardReach > 0) {
    sentences.push(
      `Those greetings went on to touch ${onwardReach} more ${onwardReach === 1 ? "person" : "people"} — your kindness, multiplied.`
    );
  }

  if (sentences.length === 0) {
    // Gentle fallback before any data exists.
    const active = Object.keys(dayMap || {}).length;
    sentences.push(
      active > 0
        ? "Your story is just getting started — every greeting is a small light for someone, somewhere."
        : "Send your first greeting this week and watch your story begin to unfold here."
    );
  }

  return sentences.join(" ");
}

// ── Odometer number — rolling digit reels ─────────────────────────

export function OdometerNumber({ value = 0, fontSize = 26, duration = 1100, color = "#fff" }) {
  const target = Math.max(0, Math.round(Number(value) || 0));
  const digits = String(target).split("").map(Number); // most-significant first
  const n = digits.length;
  const [rolled, setRolled] = useState(false);

  // Roll up from 0 → target whenever the value changes (and on mount).
  useEffect(() => {
    setRolled(false);
    let raf2;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setRolled(true)); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [target]);

  const cell = fontSize;

  return (
    <span style={{ display: "inline-flex", height: cell, fontSize, fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1 }}>
      {digits.map((d, idx) => {
        // Rightmost (ones) reel spins the most for that classic odometer whir.
        const extra = idx + 1;
        const colLen = 10 * (extra + 1);
        const offset = rolled ? d + 10 * extra : 0;
        return (
          <span key={idx} style={{ height: cell, overflow: "hidden", display: "inline-block", width: "0.62em" }}>
            <span style={{
              display: "flex", flexDirection: "column",
              transform: `translateY(-${offset * cell}px)`,
              transition: rolled ? `transform ${duration}ms cubic-bezier(0.22,1,0.36,1)` : "none",
            }}>
              {Array.from({ length: colLen + 1 }).map((_, k) => (
                <span key={k} style={{ height: cell, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {k % 10}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────

function StatTile({ value, label, sub, loading, dark = false }) {
  const C = dark ? DARK : LIGHT;
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "2px 4px" }}>
      {loading ? (
        <div style={{ height: "30px", borderRadius: "6px", background: C.skeleton, margin: "0 auto 6px", width: "52%" }} />
      ) : (
        <div style={{ display: "flex", justifyContent: "center", margin: "0 0 4px" }}>
          <OdometerNumber value={value ?? 0} fontSize={26} color={C.text} />
        </div>
      )}
      <p style={{ fontSize: "10px", fontWeight: 700, color: C.textDim, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
      {sub && <p style={{ fontSize: "9px", color: C.accent, margin: "2px 0 0", fontWeight: 600 }}>{sub}</p>}
    </div>
  );
}

// ── Milestone card ────────────────────────────────────────────────

const MILESTONES = [1, 5, 10, 20, 35, 50, 75, 100];

export function MilestoneCard({ countriesCount, dark = false }) {
  const C = dark ? DARK : LIGHT;
  const reached = MILESTONES.filter(m => countriesCount >= m);
  const next = MILESTONES.find(m => countriesCount < m) || null;
  const prev = reached.length > 0 ? reached[reached.length - 1] : 0;
  const progress = next ? Math.round(((countriesCount - prev) / (next - prev)) * 100) : 100;

  return (
    <div style={{ margin: "0 18px 22px", borderRadius: "16px", background: C.card, border: `1px solid ${C.border}`, padding: "16px" }}>
      <p style={{ fontSize: "10px", fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 12px" }}>
        Milestone Progress
      </p>
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
        {MILESTONES.map(m => (
          <div key={m} style={{
            padding: "3px 8px", borderRadius: "8px", fontSize: "10px", fontWeight: 700,
            background: countriesCount >= m ? C.accentBg : C.cardInner,
            color: countriesCount >= m ? C.accent : C.textFaintest,
            border: `1px solid ${countriesCount >= m ? C.accentBorder : C.border}`,
          }}>
            {m}
          </div>
        ))}
      </div>
      {next ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: C.textDim, fontWeight: 600 }}>{countriesCount} / {next} countries</span>
            <span style={{ fontSize: "11px", color: C.accent, fontWeight: 700 }}>{progress}%</span>
          </div>
          <div style={{ height: "5px", borderRadius: "3px", background: C.barTrack, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, borderRadius: "3px", background: `linear-gradient(90deg, ${C.accent}, ${dark ? "#FF8580" : "#A82E2C"})`, transition: "width 0.8s cubic-bezier(0.34,1.2,0.64,1)" }} />
          </div>
          <p style={{ fontSize: "10px", color: C.textFaint, margin: "8px 0 0", fontWeight: 500 }}>
            {next - countriesCount} more {next - countriesCount === 1 ? "country" : "countries"} to next milestone
          </p>
        </>
      ) : (
        <p style={{ fontSize: "12px", color: C.accent, fontWeight: 700, margin: 0, textAlign: "center" }}>
          🏆 All milestones reached!
        </p>
      )}
    </div>
  );
}

// ── Furthest Reach card ───────────────────────────────────────────

export function FurthestReachCard({ reactionByCountry, homeCountry, dark = false }) {
  const C = dark ? DARK : LIGHT;
  const result = useMemo(() => {
    const homeCoords = COUNTRY_COORDS[homeCountry];
    if (!homeCoords || !reactionByCountry || Object.keys(reactionByCountry).length === 0) return null;
    let best = null, bestKm = 0;
    for (const country of Object.keys(reactionByCountry)) {
      const coords = COUNTRY_COORDS[country];
      if (!coords) continue;
      const km = kmBetween(homeCoords, coords);
      if (km > bestKm) { bestKm = km; best = country; }
    }
    if (!best) return null;
    return { country: best, km: Math.round(bestKm) };
  }, [reactionByCountry, homeCountry]);

  if (!result) return null;

  return (
    <div style={{ margin: "0 18px 22px", borderRadius: "16px", background: C.card, border: `1px solid ${C.border}`, padding: "16px" }}>
      <p style={{ fontSize: "10px", fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 12px" }}>
        Furthest Reaction
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "32px", lineHeight: 1 }}>{countryToFlag(result.country)}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: C.text, margin: "0 0 2px" }}>{result.country}</p>
          <p style={{ fontSize: "12px", color: C.accent, fontWeight: 600, margin: 0 }}>{result.km.toLocaleString()} km from home</p>
        </div>
        <span style={{ fontSize: "24px" }}>✈️</span>
      </div>
    </div>
  );
}

// ── Rhythm card ───────────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function RhythmCard({ streak, dayMap, dark = false }) {
  const C = dark ? DARK : LIGHT;
  const bestDay = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    Object.entries(dayMap || {}).forEach(([dateStr, count]) => {
      const dow = new Date(dateStr + "T12:00:00").getDay();
      totals[dow] += count;
    });
    const max = Math.max(...totals);
    if (max === 0) return null;
    return DAY_NAMES[totals.indexOf(max)];
  }, [dayMap]);

  return (
    <div style={{ margin: "0 18px 22px", borderRadius: "16px", background: C.card, border: `1px solid ${C.border}`, padding: "16px" }}>
      <p style={{ fontSize: "10px", fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 14px" }}>
        Your Rhythm
      </p>
      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ flex: 1, background: C.cardInner, borderRadius: "12px", padding: "12px", textAlign: "center" }}>
          <p style={{ fontSize: "28px", margin: "0 0 4px", lineHeight: 1 }}>{streak >= 7 ? "🔥" : streak >= 3 ? "✨" : "💫"}</p>
          <p style={{ fontSize: "22px", fontWeight: 800, color: streak > 0 ? C.text : C.textFaint, margin: "0 0 2px", lineHeight: 1 }}>{streak}</p>
          <p style={{ fontSize: "9px", fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Day streak</p>
        </div>
        {bestDay ? (
          <div style={{ flex: 1, background: C.cardInner, borderRadius: "12px", padding: "12px", textAlign: "center" }}>
            <p style={{ fontSize: "28px", margin: "0 0 4px", lineHeight: 1 }}>📅</p>
            <p style={{ fontSize: "14px", fontWeight: 800, color: C.text, margin: "0 0 2px", lineHeight: 1.2 }}>{bestDay}</p>
            <p style={{ fontSize: "9px", fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Best day</p>
          </div>
        ) : (
          <div style={{ flex: 1, background: C.cardInner, borderRadius: "12px", padding: "12px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <p style={{ fontSize: "11px", color: C.textFaint, margin: 0, fontWeight: 500, lineHeight: 1.4 }}>Send more to discover your best day</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Hero: Lives Touched ───────────────────────────────────────────
// Reframes the cold "greetings sent" count as felt human impact.
export function LivesTouchedHero({ sentCount, dark = false }) {
  const C = dark ? DARK : LIGHT;
  const n = sentCount ?? 0;
  return (
    <div style={{ textAlign: "center", padding: "26px 18px 6px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
        <span style={{ fontSize: "22px", opacity: 0.9 }}>✨</span>
        <OdometerNumber value={n} fontSize={56} color={C.accent} duration={1300} />
        <span style={{ fontSize: "22px", opacity: 0.9 }}>✨</span>
      </div>
      <p style={{ fontSize: "13px", fontWeight: 700, color: C.textMid, margin: "8px 0 0", letterSpacing: "0.01em" }}>
        {n === 1 ? "day you may have brightened" : "days you may have brightened"}
      </p>
      <p style={{ fontSize: "11px", color: C.textDim, margin: "6px auto 0", maxWidth: "270px", lineHeight: 1.5 }}>
        A single unexpected kind message can lift someone's mood for hours.
      </p>
    </div>
  );
}

// ── Hero: Ripple line ─────────────────────────────────────────────
// You → people you reached → those who passed the kindness on.
export function RippleLine({ reachedCount, rippleCount, onwardReach = 0, dark = false }) {
  const C = dark ? DARK : LIGHT;
  const reached = reachedCount ?? 0;
  const showOnward = rippleCount > 0;
  const node = (label, value, accent) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", minWidth: "50px", flex: 1 }}>
      <span style={{ fontSize: "17px", fontWeight: 800, color: accent ? C.accent : C.text, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: "8.5px", fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.25 }}>{label}</span>
    </div>
  );
  const arrow = (
    <span style={{ fontSize: "14px", color: C.accentMuted, margin: "0 1px", marginBottom: "12px", flexShrink: 0 }}>→</span>
  );
  let caption;
  if (rippleCount > 0 && onwardReach > 0) caption = `Your kindness rippled onward to ${onwardReach} more ${onwardReach === 1 ? "person" : "people"}.`;
  else if (rippleCount > 0) caption = "Your kindness didn't stop with you.";
  else caption = "Keep going — soon your kindness will spark theirs.";
  return (
    <div style={{ margin: "14px 18px 8px", borderRadius: "16px", background: C.accentBg, border: `1px solid ${C.accentBorder}`, padding: "16px 12px 14px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: "2px" }}>
        {node("You", "🫶", false)}
        {arrow}
        {node(reached === 1 ? "person reached" : "people reached", reached, false)}
        {arrow}
        {node("greeted others", rippleCount, true)}
        {showOnward && arrow}
        {showOnward && node("🌊 reached onward", onwardReach, true)}
      </div>
      <p style={{ fontSize: "11.5px", fontWeight: 600, color: rippleCount > 0 ? C.accentDim : C.textDim, textAlign: "center", margin: "12px 0 0" }}>
        {caption}
      </p>
    </div>
  );
}

// ── Hero: Weekly story card ───────────────────────────────────────
function WeeklyStoryCard({ story, dark = false }) {
  const C = dark ? DARK : LIGHT;
  return (
    <div style={{ margin: "8px 18px 22px", borderRadius: "16px", background: C.card, border: `1px solid ${C.border}`, padding: "16px 16px 14px" }}>
      <p style={{ fontSize: "10px", fontWeight: 700, color: C.accentLabel, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
        Your Week
      </p>
      <p style={{ fontSize: "14px", lineHeight: 1.6, color: C.textMid, margin: 0, fontWeight: 500 }}>
        {story}
      </p>
      <p style={{ fontSize: "10px", color: C.textFaint, margin: "12px 0 0", textAlign: "right", fontStyle: "italic" }}>
        — your week in kindness
      </p>
    </div>
  );
}

// ── Countries Reached — interactive horizontal bar chart ──────────

export function ReachByCountryGraph({ usersByCountry, loading, dark = false }) {
  const C = dark ? DARK : LIGHT;
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [sortAlpha, setSortAlpha] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const rows = Object.entries(usersByCountry || {}).sort(
    sortAlpha ? ([a], [b]) => a.localeCompare(b) : ([, a], [, b]) => b - a
  );
  const maxUsers = Math.max(1, ...rows.map(([, n]) => n));

  return (
    <div style={{ margin: "0 18px 26px", borderRadius: "16px", background: C.card, border: `1px solid ${C.border}`, padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <p style={{ fontSize: "10px", fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
          Countries Reached
        </p>
        {rows.length > 1 && (
          <button
            onClick={() => setSortAlpha(v => !v)}
            style={{
              fontSize: "10px", fontWeight: 700, color: sortAlpha ? C.accent : C.textDim,
              background: C.toggleBg, border: `1px solid ${C.toggleBorder}`,
              borderRadius: "6px", padding: "3px 9px", cursor: "pointer",
            }}
          >
            {sortAlpha ? "A–Z" : "By reach ↓"}
          </button>
        )}
      </div>

      {loading ? (
        [1, 2, 3].map(i => (
          <div key={i} style={{ height: "52px", borderRadius: "12px", background: C.cardInner, marginBottom: "10px" }} />
        ))
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 0" }}>
          <p style={{ fontSize: "36px", margin: "0 0 10px" }}>🌍</p>
          <p style={{ fontSize: "13px", color: C.textFaint, margin: 0, fontWeight: 500 }}>No countries reached yet</p>
          <p style={{ fontSize: "11px", color: C.textFaintest, margin: "5px 0 0" }}>Keep spreading kindness — they're coming</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {rows.map(([country, count], idx) => {
            const isSelected = selectedCountry === country;
            const pct = mounted ? (count / maxUsers) * 100 : 0;
            return (
              <div
                key={country}
                onClick={() => setSelectedCountry(isSelected ? null : country)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  background: isSelected ? C.rowSelBg : C.rowBg,
                  border: `1px solid ${isSelected ? C.rowSelBorder : C.rowBorder}`,
                  cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                  boxShadow: isSelected ? `0 0 10px ${C.rowSelGlow}` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "22px", lineHeight: 1, flexShrink: 0 }}>{countryToFlag(country)}</span>
                  <span style={{ flex: 1, fontSize: "13px", fontWeight: 600, color: C.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {country}
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: C.accent, flexShrink: 0 }}>
                    {count} {count === 1 ? "person" : "people"}
                  </span>
                </div>
                <div style={{ height: "5px", borderRadius: "3px", background: C.barTrack, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    borderRadius: "3px",
                    width: `${pct}%`,
                    background: isSelected ? C.accentBarSel : C.accentBar,
                    transition: `width 0.55s cubic-bezier(0.34,1.2,0.64,1) ${idx * 40}ms, background 0.15s`,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function MyImpact({ db, currentUser, liveStats, streak = 0, profile, darkMode = false }) {
  const C = darkMode ? DARK : LIGHT;
  const [period, setPeriod] = useState("7d");
  const { data, loading } = useReactionData(db, currentUser, period);
  const { rippleCount, ripples } = useRippleData(db, currentUser);
  const onwardReach = useOnwardReach(db, currentUser, ripples);

  const sentCount = period === "7d" ? (liveStats?.sent7d ?? null) : (liveStats?.sent30d ?? null);
  const countriesCount = period === "7d" ? (liveStats?.countries7d ?? null) : (liveStats?.countries30d ?? null);

  // Weekly story always reflects the 7-day window, regardless of the toggle.
  const weeklyStory = useMemo(() => buildWeeklyStory({
    countriesCount: Object.keys(data?.reactionByCountry ?? {}).length,
    notableReaction: data?.notableReaction,
    rippleCount,
    onwardReach,
    dayMap: data?.dayMap,
  }), [data, rippleCount, onwardReach]);

  const reactingCountriesCount = Object.keys(data?.reactionByCountry || {}).length;

  return (
    <div style={{ flex: 1, background: C.pageBg, overflowY: "auto", display: "flex", flexDirection: "column", paddingBottom: "32px" }}>

      {/* ── Living Impact hero ── */}
      <LivesTouchedHero sentCount={sentCount} dark={darkMode} />
      <RippleLine reachedCount={data?.uniqueReactorCount ?? 0} rippleCount={rippleCount} onwardReach={onwardReach} dark={darkMode} />
      <WeeklyStoryCard story={weeklyStory} dark={darkMode} />

      {/* ── Header ── */}
      <div style={{ padding: "22px 18px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: "20px", fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
            Your Kindness
          </p>
          <p style={{ fontSize: "20px", fontWeight: 800, color: C.accent, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
            Footprint
          </p>
        </div>
        <div style={{ display: "flex", background: C.toggleBg, borderRadius: "10px", padding: "3px", marginTop: "2px" }}>
          {["7d", "30d"].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: "5px 13px", borderRadius: "7px", fontSize: "11px", fontWeight: 700,
              border: "none", cursor: "pointer", transition: "all 0.15s",
              background: period === p ? C.accentBg : "transparent",
              color: period === p ? C.accent : C.textDim,
            }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat tiles ── */}
      <div style={{ margin: "0 18px 22px", borderRadius: "16px", background: C.card, border: `1px solid ${C.border}`, padding: "18px 8px 16px", display: "flex" }}>
        <StatTile loading={false} value={sentCount} label="Sent" dark={darkMode} />
        <div style={{ width: "1px", background: C.divider, margin: "4px 0" }} />
        <StatTile loading={false} value={countriesCount} label="Countries" sub="reached" dark={darkMode} />
        <div style={{ width: "1px", background: C.divider, margin: "4px 0" }} />
        <StatTile
          loading={loading}
          value={data?.totalReactions}
          label="Reactions"
          sub={reactingCountriesCount > 0 ? `${reactingCountriesCount} ${reactingCountriesCount === 1 ? "country" : "countries"}` : undefined}
          dark={darkMode}
        />
      </div>

      {/* ── Milestone Progress ── */}
      <MilestoneCard countriesCount={countriesCount ?? 0} dark={darkMode} />

      {/* ── Furthest Reaction ── */}
      {!loading && <FurthestReachCard reactionByCountry={data?.reactionByCountry} homeCountry={profile?.country} dark={darkMode} />}

      {/* ── Your Rhythm ── */}
      <RhythmCard streak={streak} dayMap={data?.dayMap} dark={darkMode} />

      {/* ── Countries Reached ── */}
      <ReachByCountryGraph usersByCountry={data?.usersByCountry} loading={loading} dark={darkMode} />
    </div>
  );
}
