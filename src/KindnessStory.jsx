// KindnessStory.jsx — the feed's "your kindness has a story" surfaces.
//
// (a) KindnessStoryCard — on feed open, a warm dismissible card summarising the impact that
//     accrued since the user's last visit: who was touched by their words (reactions, with
//     country flags) and any kindness chains (ripples). Includes an "echo" line when an older
//     greeting was only just felt. Reads users/{uid}/reactionsReceived + users/{uid}/ripples
//     since profile.lastStoryAckAt; dismissing writes lastStoryAckAt (owner profile field —
//     no rules change). This is the "what happened while I was gone?" curiosity loop.
//
// (b) PulseStrip — a thin rotating one-liner that makes the feed feel alive, built ONLY from
//     data already in memory (the 7-day feed) plus the presence count (publicly readable) and
//     the user's own newest reaction. Zero new writes.

import React, { useState, useEffect, useMemo, useRef } from "react";
import { collection, query, where, orderBy, limit, getDocs, setDoc, doc } from "firebase/firestore";
import { FLAG_MAP } from "./MicroAnimations";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ── (a) While you were away ──────────────────────────────────────────────────────

export function KindnessStoryCard({ db, currentUser, profile, messages, onOpenImpact }) {
  const uid = currentUser?.uid;
  const [story, setStory] = useState(null);
  const [hidden, setHidden] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!db || !uid || !profile || fetchedRef.current) return;
    fetchedRef.current = true; // one story per feed mount — live events get toasts instead
    const since = Math.max(Number(profile.lastStoryAckAt ?? 0), Date.now() - 7 * DAY_MS);
    (async () => {
      try {
        const [rSnap, pSnap] = await Promise.all([
          getDocs(query(collection(db, "users", uid, "reactionsReceived"),
            where("reactedAt", ">", since), orderBy("reactedAt", "desc"), limit(30))),
          getDocs(query(collection(db, "users", uid, "ripples"),
            where("createdAt", ">", since), orderBy("createdAt", "desc"), limit(10))),
        ]);
        const reactions = rSnap.docs.map((d) => d.data())
          .filter((r) => r.reactorUid && r.reactorUid !== uid);
        const rippleCount = pSnap.size;
        if (!reactions.length && !rippleCount) return;

        const people = new Set(reactions.map((r) => r.reactorUid)).size;
        const flags = [...new Set(reactions.map((r) => r.country).filter(Boolean))]
          .map((c) => FLAG_MAP[c]).filter(Boolean).slice(0, 4);

        // Echo: the newest reaction landed on a greeting sent >24h earlier (or one so old it
        // has already left the 7-day feed) — the "your words are still working" moment.
        let echo = null;
        const newest = reactions[0];
        if (newest && Array.isArray(messages) && messages.length > 0) {
          const msg = messages.find((m) => m.id === newest.messageId);
          const msgTs = msg && typeof msg.timestamp === "number" ? msg.timestamp : null;
          if (msgTs === null || newest.reactedAt - msgTs > DAY_MS) echo = { country: newest.country ?? null };
        }
        setStory({ people, flags, rippleCount, echo });
      } catch (_) { /* best-effort — no card is fine */ }
    })();
  }, [db, uid, profile, messages]);

  if (!story || hidden) return null;

  const ack = () => {
    setHidden(true);
    setDoc(doc(db, "users", uid), { lastStoryAckAt: Date.now() }, { merge: true }).catch(() => {});
  };

  const bits = [];
  if (story.people > 0) {
    bits.push(
      `${story.people} ${story.people === 1 ? "person was" : "people were"} touched by your words${story.flags.length ? ` ${story.flags.join(" ")}` : ""}`
    );
  }
  if (story.rippleCount > 0) {
    bits.push(
      story.people > 0
        ? `${story.rippleCount === 1 ? "one of them went" : `${story.rippleCount} went`} on to greet someone else 🌱`
        : `${story.rippleCount} kindness ${story.rippleCount === 1 ? "chain" : "chains"} grew from your greetings 🌱`
    );
  }
  const echoLine = story.echo
    ? `A greeting you sent a while back was just felt${story.echo.country ? ` in ${FLAG_MAP[story.echo.country] ? `${FLAG_MAP[story.echo.country]} ` : ""}${story.echo.country}` : ""}.`
    : null;

  return (
    <div className="mb-3" style={{ animation: "seenFadeUp 400ms ease both" }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); ack(); onOpenImpact?.(); }}
        className="w-full text-left rounded-2xl px-4 py-3.5 flex items-start gap-3 active:scale-[0.99] transition-all"
        style={{
          background: "linear-gradient(135deg, #fffbeb, #ecfdf5)",
          border: "1px solid #fde68a",
          boxShadow: "0 4px 16px rgba(245,158,11,0.10)",
        }}>
        <span className="text-2xl">💛</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">While you were away</p>
          <p className="text-[13px] text-slate-700 leading-snug mt-0.5">{bits.join(" · ")}.</p>
          {echoLine && <p className="text-[12px] text-violet-600 leading-snug mt-1">✨ {echoLine}</p>}
          <p className="text-[10px] text-slate-400 mt-1">Tap to see your full story →</p>
        </div>
        <span
          onClick={(e) => { e.stopPropagation(); ack(); }}
          className="p-1 text-slate-300 hover:text-slate-500 flex-shrink-0">✕</span>
      </button>
    </div>
  );
}

// ── (b) Live pulse strip ─────────────────────────────────────────────────────────

export function PulseStrip({ db, currentUser, messages }) {
  const uid = currentUser?.uid;
  const [presenceCount, setPresenceCount] = useState(null);
  const [lastHeartCountry, setLastHeartCountry] = useState(null);
  const [idx, setIdx] = useState(0);

  // Rolling-24h presence count (same query the welcome globe uses) — refresh each minute.
  useEffect(() => {
    if (!db) return;
    let alive = true;
    const load = () => {
      getDocs(query(collection(db, "presence"), where("lastSeen", ">=", Date.now() - DAY_MS)))
        .then((s) => { if (alive) setPresenceCount(s.size); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [db]);

  // The user's own most recent heart — a personal "kindness landed" line.
  useEffect(() => {
    if (!db || !uid) return;
    getDocs(query(collection(db, "users", uid, "reactionsReceived"), orderBy("reactedAt", "desc"), limit(1)))
      .then((s) => {
        const c = s.docs[0]?.data()?.country;
        if (c) setLastHeartCountry(c);
      })
      .catch(() => {});
  }, [db, uid]);

  const facts = useMemo(() => {
    const start = startOfTodayMs();
    const today = (messages || []).filter(
      (m) => m.uid !== "system" && typeof m.timestamp === "number" && m.timestamp >= start
    );
    const countries = new Set(today.map((m) => m.country).filter(Boolean)).size;
    const out = [];
    if (today.length > 0) {
      out.push(`💬 ${today.length} ${today.length === 1 ? "greeting" : "greetings"} today${countries > 1 ? ` · from ${countries} countries` : ""}`);
    }
    if (presenceCount >= 2) out.push(`🟢 ${presenceCount} people here today`);
    if (lastHeartCountry) {
      out.push(`💛 Your last heart came from ${FLAG_MAP[lastHeartCountry] ? `${FLAG_MAP[lastHeartCountry]} ` : ""}${lastHeartCountry}`);
    }
    return out;
  }, [messages, presenceCount, lastHeartCountry]);

  useEffect(() => {
    if (facts.length < 2) return;
    const t = setInterval(() => setIdx((i) => i + 1), 6000);
    return () => clearInterval(t);
  }, [facts.length]);

  if (!facts.length) return null;
  const fact = facts[idx % facts.length];

  return (
    <div className="border-b border-slate-100 bg-white px-4 py-1.5 text-center flex-shrink-0">
      <p key={fact} className="text-[11px] font-medium text-slate-400 truncate"
        style={{ animation: "seenFadeUp 450ms ease both" }}>
        {fact}
      </p>
    </div>
  );
}
