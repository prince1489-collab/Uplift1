// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// MySeenStory.jsx — the "My SEEN Story" tab (v2): a warm, narrative view of the user's
// kindness journey, assembled from data already in hand (no new Firestore reads beyond a
// single owner-only journal count). Journal = write today; My SEEN Story = read your journey.

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { treeStageFor } from "./KindnessTree";

const PERIODS = [
  { id: "week",  label: "This week" },
  { id: "month", label: "This month" },
  { id: "all",   label: "All time" },
];

// Count today's completed "Have you tried?" items across this device (localStorage).
function hytCompletedCount() {
  let n = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("seen_hyt_state_")) {
        const done = JSON.parse(localStorage.getItem(k) || "{}")?.done || {};
        n += Object.values(done).filter(Boolean).length;
      }
    }
  } catch { /* ignore */ }
  return n;
}

function Tile({ value, label, emoji }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
      <div className="text-xl mb-0.5">{emoji}</div>
      <div className="text-lg font-extrabold text-slate-800 tabular-nums leading-none">{value}</div>
      <div className="text-[10px] text-slate-500 mt-1 leading-tight">{label}</div>
    </div>
  );
}

export default function MySeenStory({ db, currentUser, liveStats, streak = 0, profile, sparkBalance = 0, onOpenTree }) {
  const [period, setPeriod] = useState("week");
  const [journalCount, setJournalCount] = useState(null);
  const hytTried = useMemo(() => hytCompletedCount(), []);

  useEffect(() => {
    if (!db || !currentUser?.uid) return;
    let alive = true;
    getDocs(collection(db, "users", currentUser.uid, "journal"))
      .then((snap) => { if (alive) setJournalCount(snap.size); })
      .catch(() => { if (alive) setJournalCount(0); });
    return () => { alive = false; };
  }, [db, currentUser?.uid]);

  const stage = treeStageFor(sparkBalance);
  const allTimeSent = Number(profile?.greetingsSentCount ?? 0);
  const sent = period === "week" ? Number(liveStats?.sent7d ?? 0)
    : period === "month" ? Number(liveStats?.sent30d ?? 0) : allTimeSent;
  const countries = period === "week" ? Number(liveStats?.countries7d ?? 0)
    : period === "month" ? Number(liveStats?.countries30d ?? 0) : Number(liveStats?.countries30d ?? 0);
  const periodLabel = PERIODS.find((p) => p.id === period)?.label.toLowerCase();

  // Warm, template-assembled narrative (no AI; wellbeing wording stays reflective, never scored)
  const narrative = useMemo(() => {
    const first = (profile?.fullName || "").trim().split(" ")[0] || "you";
    const parts = [];
    if (sent > 0) {
      parts.push(`${period === "all" ? "So far" : `Over ${periodLabel}`}, you sent **${sent}** kind message${sent === 1 ? "" : "s"}${countries > 0 ? `, reaching **${countries}** countr${countries === 1 ? "y" : "ies"}` : ""}.`);
    } else {
      parts.push(`${period === "all" ? "Your story is just beginning" : `A quiet ${periodLabel}`} — and that's completely okay.`);
    }
    if (streak > 0) parts.push(`You're on a **${streak}-day** kindness streak.`);
    if (hytTried > 0) parts.push(`You've tried **${hytTried}** real-life kindness${hytTried === 1 ? "" : "es"} on this device.`);
    if (journalCount) parts.push(`You've written **${journalCount}** reflection${journalCount === 1 ? "" : "s"} in your journal.`);
    parts.push(`Your Kindness Tree is a **${stage.name}** — every kind act waters it a little more.`);
    parts.push(`Small things, ${first}. They add up.`);
    return parts.join(" ");
  }, [sent, countries, streak, hytTried, journalCount, stage.name, period, periodLabel, profile?.fullName]);

  const renderRich = (t) =>
    t.split("**").map((chunk, i) => (i % 2 ? <strong key={i} className="text-slate-900">{chunk}</strong> : <span key={i}>{chunk}</span>));

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4">
      <div className="mx-auto w-full max-w-md space-y-4">
        {/* Period segments */}
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`flex-1 rounded-full py-1.5 text-[12px] font-semibold transition-colors ${
                period === p.id ? "bg-white text-teal-600 shadow-sm" : "text-slate-500"
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* The narrative */}
        <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white px-5 py-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600 mb-2">Your journey</p>
          <p className="text-[15px] leading-relaxed text-slate-700">{renderRich(narrative)}</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2">
          <Tile emoji="💌" value={sent} label={`Sent ${period === "all" ? "" : periodLabel}`.trim()} />
          <Tile emoji="🌍" value={countries} label="Countries" />
          <Tile emoji="🔥" value={streak} label="Day streak" />
          <Tile emoji="✅" value={hytTried} label="Tried in life" />
          <Tile emoji="📓" value={journalCount ?? "…"} label="Reflections" />
          <button onClick={onOpenTree} className="rounded-2xl border border-teal-200 bg-teal-50 px-3 py-3 text-center active:scale-[0.98] transition-transform">
            <div className="text-xl mb-0.5">{stage.scene}</div>
            <div className="text-[11px] font-bold text-teal-700 leading-none">{stage.name}</div>
            <div className="text-[10px] text-slate-500 mt-1">Your tree →</div>
          </button>
        </div>

        {/* Shareable summary */}
        <button
          onClick={() => {
            const text = narrative.replace(/\*\*/g, "");
            if (navigator.share) navigator.share({ text }).catch(() => {});
            else if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
          }}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-teal-600 hover:bg-teal-50 transition-colors">
          Share my SEEN story
        </button>

        <p className="text-center text-[10px] text-slate-400 leading-relaxed pb-4">
          Reflection only — a gentle mirror of your journey, never a score.
        </p>
      </div>
    </main>
  );
}
