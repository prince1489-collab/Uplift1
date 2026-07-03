// DailyMission.jsx — "Today's Mission" card at the top of the feed.
//
// One mission per day, picked deterministically per user (local day number + uid seed — the
// same rotation clock as Life Hacks and Journal prompts, so it changes exactly once a day at
// local midnight). Every mission is VERIFIABLE client-side from data the app already has:
// the in-memory 7-day feed, the user's outgoingReactions, and profile.lastGreetingAt — no new
// collections and no rules change. Completing the day's mission awards a small spark bonus
// once (guarded by a localStorage key) with a short confetti burst; the card then collapses
// to a slim ✓ line for the rest of the day.

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, runTransaction, doc } from "firebase/firestore";

export const MISSION_REWARD = 15;

function localDayNumber() {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}
function seedFromUid(uid) {
  let h = 0;
  const s = String(uid || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function localDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ctx: { myToday (own messages today, newest-first), todayMessageCount, todayReactions, messages }
const MISSIONS = [
  { id: "send", emoji: "💌", title: "Send a kind greeting today",
    check: (c) => c.todayMessageCount > 0 || c.myToday.length > 0 },
  { id: "morning", emoji: "🌅", title: "Brighten someone's morning — send before noon",
    check: (c) => c.myToday.some((m) => new Date(m.timestamp).getHours() < 12) },
  { id: "evening", emoji: "🌙", title: "Send an evening glow — greet after 6pm",
    check: (c) => c.myToday.some((m) => new Date(m.timestamp).getHours() >= 18) },
  { id: "hearts3", emoji: "💛", title: "Send three hearts — react to 3 greetings",
    check: (c) => c.todayReactions >= 3 },
  { id: "givegive", emoji: "🔄", title: "Give twice — send a greeting and react to one",
    check: (c) => (c.todayMessageCount > 0 || c.myToday.length > 0) && c.todayReactions >= 1 },
  { id: "mystery", emoji: "🎁", title: "Send a mystery gift greeting",
    check: (c) => c.myToday.some((m) => m.isMystery) },
  { id: "triple", emoji: "✨", title: "Triple kindness — send 3 greetings today",
    check: (c) => c.todayMessageCount >= 3 || c.myToday.length >= 3 },
  { id: "silence", emoji: "🕊️", title: "Break the silence — be first to greet in 3+ hours",
    check: (c) => c.myToday.some((m) => {
      const i = c.messages.findIndex((x) => x.id === m.id); // feed is newest-first
      const older = i >= 0 ? c.messages[i + 1] : null;
      return !older || (typeof older.timestamp === "number" && m.timestamp - older.timestamp >= 3 * 3600000);
    }) },
];

export function pickDailyMission(uid) {
  const raw = (localDayNumber() + seedFromUid(uid)) % MISSIONS.length;
  return MISSIONS[((raw % MISSIONS.length) + MISSIONS.length) % MISSIONS.length];
}

// Short confetti burst (reuses the global seenConfettiFall keyframe, like the Journal's).
function Confetti() {
  const colors = ["#f59e0b", "#10b981", "#14b8a6", "#fb7185", "#a78bfa", "#fbbf24"];
  return (
    <div className="pointer-events-none fixed inset-0 z-[320] overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.3;
        const dur = 1.2 + Math.random() * 0.8;
        const rot = Math.random() * 720 - 360;
        const size = 6 + Math.random() * 6;
        return (
          <span key={i} style={{
            position: "absolute", top: "-6%", left: `${left}%`,
            width: size, height: size * 0.6, background: colors[i % colors.length],
            borderRadius: 2, "--rot": `${rot}deg`,
            animation: `seenConfettiFall ${dur}s cubic-bezier(0.3,0.7,0.5,1) ${delay}s forwards`,
          }} />
        );
      })}
    </div>
  );
}

export default function DailyMissionCard({ db, currentUser, messages, todayMessageCount }) {
  const uid = currentUser?.uid;
  const dateKey = localDateString();
  const claimKey = `seen_mission_${uid}_${dateKey}`;
  const [claimed, setClaimed] = useState(() => {
    try { return localStorage.getItem(claimKey) === "1"; } catch { return false; }
  });
  const [celebrate, setCelebrate] = useState(false);
  const [todayReactions, setTodayReactions] = useState(0);

  // How many greetings the user reacted to today (single-field inequality — no index needed).
  useEffect(() => {
    if (!db || !uid) return;
    const q = query(
      collection(db, "users", uid, "outgoingReactions"),
      where("reactedAt", ">", startOfTodayMs())
    );
    return onSnapshot(q, (snap) => setTodayReactions(snap.size), () => {});
  }, [db, uid]);

  const mission = useMemo(() => (uid ? pickDailyMission(uid) : null), [uid, dateKey]);

  const done = useMemo(() => {
    if (!mission || !uid) return false;
    const start = startOfTodayMs();
    const myToday = (messages || []).filter(
      (m) => m.uid === uid && typeof m.timestamp === "number" && m.timestamp >= start
    );
    try {
      return mission.check({ myToday, todayMessageCount: todayMessageCount ?? 0, todayReactions, messages: messages || [] });
    } catch { return false; }
  }, [mission, uid, messages, todayMessageCount, todayReactions]);

  // Award the spark bonus once per day, the moment the mission completes.
  useEffect(() => {
    if (!done || claimed || !db || !uid) return;
    setClaimed(true);
    try { localStorage.setItem(claimKey, "1"); } catch { /* still award */ }
    runTransaction(db, async (tx) => {
      const refDoc = doc(db, "users", uid);
      const snap = await tx.get(refDoc);
      const data = snap.exists() ? snap.data() : {};
      tx.set(refDoc, { sparkBalance: Number(data.sparkBalance ?? 0) + MISSION_REWARD }, { merge: true });
    }).catch(() => {});
    setCelebrate(true);
    const t = setTimeout(() => setCelebrate(false), 1700);
    return () => clearTimeout(t);
  }, [done, claimed, db, uid, claimKey]);

  if (!mission || !uid) return null;

  if (claimed || done) {
    return (
      <>
        {celebrate && <Confetti />}
        <div className="mb-3 flex items-center justify-center gap-1.5" style={{ animation: "seenFadeUp 400ms ease both" }}>
          <span className="text-[11px] font-semibold text-emerald-600">
            ✓ Today's mission complete · +{MISSION_REWARD} sparks
          </span>
        </div>
      </>
    );
  }

  return (
    <div className="mb-3" style={{ animation: "seenFadeUp 400ms ease both" }} onClick={(e) => e.stopPropagation()}>
      <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/70 to-white px-4 py-3 flex items-center gap-3">
        <span className="text-xl">{mission.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-500">
            🎯 Today's mission · +{MISSION_REWARD} sparks
          </p>
          <p className="text-[13px] font-semibold text-slate-700 leading-snug">{mission.title}</p>
        </div>
      </div>
    </div>
  );
}
