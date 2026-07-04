// KindnessBoard.jsx — the Impact tab reborn as a living storybook of the user's kindness.
//
// A storyboard that keeps growing: the cover carries the headline stats (lives touched, the
// ripple line), then the story unfolds in monthly CHAPTERS, newest on top — the current month
// marked "still being written". Each chapter holds story cards merged chronologically from data
// the app already writes (own greetings, hearts received, ripples, feeling-replies, kindness
// echoes) plus milestone stickers pinned at the exact event that crossed them (first greeting,
// first heart, first chain, 10/50/100 sends, every new country reached — with distance flavour).
// An "Atlas" footer keeps the old Impact deep-dives (furthest reach, countries chart, milestones).
//
// Reads are one-shot on mount (limit-capped) — the board is a reflective surface, not a live feed.

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import {
  DARK, LIGHT, kmBetween, LivesTouchedHero, RippleLine,
  FurthestReachCard, ReachByCountryGraph, MilestoneCard,
  useReactionData, useRippleData, useOnwardReach,
} from "./MyImpact";
import { FLAG_MAP } from "./MicroAnimations";
import { COUNTRY_COORDS } from "./WorldMap";

function flag(country) {
  return country && FLAG_MAP[country] ? FLAG_MAP[country] : "";
}
function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: "long", year: "numeric" });
}
function dayLabel(ts) {
  return new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" });
}

// ── build the story: merge event streams → batched cards + milestone stickers ──────

function buildStory({ sends, hearts, ripples, uplifts, echoes, homeCountry }) {
  // Raw events, oldest first, so milestones pin at the event that crossed them.
  const events = [];
  // Batch sends per local day (a day of 4 greetings is one card, not four).
  const sendsByDay = new Map();
  sends.forEach((s) => {
    const d = new Date(s.timestamp); d.setHours(0, 0, 0, 0);
    const k = d.getTime();
    sendsByDay.set(k, (sendsByDay.get(k) ?? 0) + 1);
  });
  [...sendsByDay.entries()].forEach(([dayTs, count]) => {
    events.push({ type: "sent", ts: dayTs + 12 * 3600000, count });
  });
  hearts.forEach((h) => events.push({
    type: "felt", ts: h.reactedAt, name: (h.reactorName || "Someone").split(" ")[0], country: h.country ?? null, emoji: h.emoji || "❤️",
  }));
  ripples.forEach((r) => events.push({ type: "ripple", ts: r.createdAt ?? r.reactedAt ?? 0, country: r.responderCountry ?? null }));
  uplifts.forEach((u) => events.push({ type: "uplift", ts: u.ts, count: u.count, text: u.text }));
  echoes.forEach((e) => events.push({
    type: "echo", ts: e.createdAt, name: e.posterName ? e.posterName.split(" ")[0] : null,
  }));
  events.sort((a, b) => a.ts - b.ts);

  // Walk oldest→newest and interleave milestone stickers.
  const out = [];
  let sentTotal = 0, heartTotal = 0, rippleTotal = 0;
  const countriesSeen = new Set();
  const home = homeCountry && COUNTRY_COORDS[homeCountry] ? COUNTRY_COORDS[homeCountry] : null;
  let furthestKm = 0;
  events.forEach((ev) => {
    if (ev.ts <= 0) return;
    out.push(ev);
    if (ev.type === "sent") {
      const before = sentTotal;
      sentTotal += ev.count;
      if (before === 0) out.push({ type: "milestone", ts: ev.ts + 1, emoji: "✨", label: "Your story began — first greeting sent" });
      [10, 50, 100, 250].forEach((m) => {
        if (before < m && sentTotal >= m) out.push({ type: "milestone", ts: ev.ts + 1, emoji: "🎉", label: `${m} greetings sent` });
      });
    }
    if (ev.type === "felt") {
      heartTotal += 1;
      if (heartTotal === 1) out.push({ type: "milestone", ts: ev.ts + 1, emoji: "💛", label: "First heart received — someone felt your words" });
      if (ev.country && !countriesSeen.has(ev.country)) {
        countriesSeen.add(ev.country);
        let distance = null;
        if (home && COUNTRY_COORDS[ev.country] && ev.country !== homeCountry) {
          const km = Math.round(kmBetween(home, COUNTRY_COORDS[ev.country]));
          if (km > furthestKm) { furthestKm = km; distance = km; }
        }
        out.push({
          type: "milestone", ts: ev.ts + 2, emoji: "🌍",
          label: `Your kindness reached ${flag(ev.country)} ${ev.country}${distance ? ` — your furthest yet, ${distance.toLocaleString()} km` : ""}`,
        });
      }
    }
    if (ev.type === "ripple") {
      rippleTotal += 1;
      if (rippleTotal === 1) out.push({ type: "milestone", ts: ev.ts + 1, emoji: "🌱", label: "First kindness chain — your warmth multiplied" });
    }
  });

  return out.sort((a, b) => a.ts - b.ts);
}

function chapterTitle(evs) {
  const newCountries = evs.filter((e) => e.type === "milestone" && e.emoji === "🌍").length;
  const ripples = evs.filter((e) => e.type === "ripple").length;
  const hearts = evs.filter((e) => e.type === "felt").length;
  const sends = evs.filter((e) => e.type === "sent").reduce((n, e) => n + e.count, 0);
  const uplifted = evs.some((e) => e.type === "uplift" || e.type === "echo");
  if (newCountries > 1) return `The month your words crossed ${newCountries} borders`;
  if (newCountries === 1) return "The month your kindness crossed a border";
  if (ripples > 0) return "The month kindness multiplied";
  if (uplifted) return "The month of being there";
  if (hearts > 1) return `The month ${hearts} hearts found you`;
  if (sends > 0) return "The month you kept showing up";
  return "A quiet page";
}

function storyLine(ev) {
  switch (ev.type) {
    case "sent":
      return ev.count === 1
        ? "You sent kindness into the world 💌"
        : `You sent ${ev.count} greetings — ${ev.count} little lifts 💌`;
    case "felt":
      return `${ev.name}${ev.country ? ` in ${flag(ev.country)} ${ev.country}` : ""} felt your words ${ev.emoji}`;
    case "ripple":
      return `Your kindness spread onward — someone you reached${ev.country ? ` in ${flag(ev.country)} ${ev.country}` : ""} greeted someone else 🌱`;
    case "uplift":
      return `${ev.count} ${ev.count === 1 ? "person" : "people"} lifted you up when you shared “${ev.text}” 💛`;
    case "echo":
      return `You were there for ${ev.name ? `${ev.name}'s` : "someone's"} hard moment — and it helped 🌟`;
    default:
      return "";
  }
}

// ── the board ──────────────────────────────────────────────────────────────────────

export default function KindnessBoard({ db, currentUser, liveStats, streak, profile, darkMode }) {
  const T = darkMode ? DARK : LIGHT;
  const uid = currentUser?.uid;
  const [raw, setRaw] = useState(null); // { sends, hearts, ripples, uplifts, echoes }
  const [atlasOpen, setAtlasOpen] = useState(false);

  // Existing aggregate hooks power the cover + atlas exactly as they did on Impact.
  const { data: reactData, loading: reactLoading } = useReactionData(db, currentUser, "30d");
  const { rippleCount, ripples: liveRipples } = useRippleData(db, currentUser);
  const onwardReach = useOnwardReach(db, currentUser, liveRipples);

  useEffect(() => {
    if (!db || !uid) return;
    let alive = true;
    (async () => {
      const safe = async (p) => { try { return await p; } catch { return { docs: [] }; } };
      const [sendsSnap, heartsSnap, ripplesSnap, upliftSnap, echoSnap] = await Promise.all([
        safe(getDocs(query(collection(db, "publicMessages"), where("uid", "==", uid), orderBy("timestamp", "desc"), limit(150)))),
        safe(getDocs(query(collection(db, "users", uid, "reactionsReceived"), orderBy("reactedAt", "desc"), limit(150)))),
        safe(getDocs(query(collection(db, "users", uid, "ripples"), orderBy("createdAt", "desc"), limit(50)))),
        safe(getDocs(query(collection(db, "users", uid, "feelingReplies"), orderBy("createdAt", "desc"), limit(100)))),
        safe(getDocs(query(collection(db, "users", uid, "kindnessEchoes"), orderBy("createdAt", "desc"), limit(50)))),
      ]);
      if (!alive) return;
      // Group feeling-replies into one "uplift" per feeling session.
      const byFeeling = new Map();
      upliftSnap.docs.map((d) => d.data()).forEach((r) => {
        const k = r.feelingCreatedAt ?? 0;
        const cur = byFeeling.get(k) ?? { ts: k, count: 0, text: (r.feelingText || "").slice(0, 40) };
        cur.count += 1;
        byFeeling.set(k, cur);
      });
      setRaw({
        sends: sendsSnap.docs.map((d) => d.data()).filter((m) => typeof m.timestamp === "number"),
        hearts: heartsSnap.docs.map((d) => d.data()).filter((h) => typeof h.reactedAt === "number" && h.reactorUid !== uid),
        ripples: ripplesSnap.docs.map((d) => d.data()),
        uplifts: [...byFeeling.values()].filter((u) => u.ts > 0),
        echoes: echoSnap.docs.map((d) => d.data()).filter((e) => typeof e.createdAt === "number"),
      });
    })();
    return () => { alive = false; };
  }, [db, uid]);

  const chapters = useMemo(() => {
    if (!raw) return null;
    const story = buildStory({ ...raw, homeCountry: profile?.country ?? null });
    const byMonth = new Map();
    story.forEach((ev) => {
      const k = monthKey(ev.ts);
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k).push(ev);
    });
    // Newest chapter first; events inside newest-first too (a storyboard you scroll down through time).
    return [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([k, evs], i, arr) => ({
        key: k,
        number: arr.length - i,
        label: monthLabel(k),
        title: chapterTitle(evs),
        current: k === monthKey(Date.now()),
        events: [...evs].sort((a, b) => b.ts - a.ts),
      }));
  }, [raw, profile?.country]);

  const startedLabel = useMemo(() => {
    const t = profile?.onboardingCompletedAt?.toMillis?.() ?? null;
    return t ? new Date(t).toLocaleDateString([], { month: "long", year: "numeric" }) : null;
  }, [profile]);

  return (
    <main className="flex-1 overflow-y-auto px-4 py-5" style={{ background: T.pageBg }}>
      {/* ── Cover ── */}
      <div className="text-center mb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: T.textDim }}>Your Kindness Story</p>
        {startedLabel && <p className="text-[10px] mt-0.5" style={{ color: T.textDim }}>began {startedLabel}</p>}
      </div>
      <LivesTouchedHero sentCount={liveStats?.sent30d ?? 0} dark={darkMode} />
      <RippleLine
        reachedCount={reactData?.uniqueReactorCount ?? 0}
        rippleCount={rippleCount}
        onwardReach={onwardReach}
        dark={darkMode}
      />

      {/* ── Chapters ── */}
      {!chapters ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin" style={{ color: T.accent ?? "#14b8a6" }} size={26} /></div>
      ) : chapters.length === 0 ? (
        <div className="rounded-2xl px-4 py-8 text-center mt-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <p className="text-3xl mb-2">📖</p>
          <p className="text-sm font-bold" style={{ color: T.text }}>Your first page is waiting</p>
          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: T.textDim }}>
            Send a greeting and your kindness story starts writing itself — every heart, every
            country, every chain gets a card here.
          </p>
        </div>
      ) : (
        chapters.map((ch) => (
          <section key={ch.key} className="mt-6">
            {/* Chapter divider */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px" style={{ background: T.border }} />
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: T.textDim }}>
                  Chapter {ch.number} · {ch.label}
                </p>
                <p className="text-[13px] font-bold" style={{ color: T.text }}>
                  {ch.title}{ch.current ? " " : ""}
                  {ch.current && <span className="font-medium" style={{ color: T.textDim }}>— still being written ✍️</span>}
                </p>
              </div>
              <div className="flex-1 h-px" style={{ background: T.border }} />
            </div>

            {/* Story cards on a timeline spine */}
            <div className="relative pl-5">
              <div className="absolute left-[7px] top-1 bottom-1 w-px" style={{ background: T.border }} />
              <div className="space-y-2">
                {ch.events.map((ev, i) => (
                  ev.type === "milestone" ? (
                    <div key={`${ev.ts}_${i}`} className="relative">
                      <span className="absolute -left-[19px] top-2 h-2.5 w-2.5 rounded-full" style={{ background: "#f59e0b", boxShadow: "0 0 0 3px rgba(245,158,11,0.2)" }} />
                      <div className="rounded-2xl px-3 py-2.5"
                        style={{ background: darkMode ? "rgba(245,158,11,0.12)" : "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "1px solid rgba(245,158,11,0.35)" }}>
                        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "#d97706" }}>{dayLabel(ev.ts)} · Milestone</p>
                        <p className="text-[13px] font-bold leading-snug" style={{ color: darkMode ? "#fcd34d" : "#92400e" }}>{ev.emoji} {ev.label}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={`${ev.ts}_${i}`} className="relative">
                      <span className="absolute -left-[18px] top-2.5 h-2 w-2 rounded-full" style={{ background: T.border }} />
                      <div className="rounded-2xl px-3 py-2.5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                        <p className="text-[9px] font-semibold" style={{ color: T.textDim }}>{dayLabel(ev.ts)}</p>
                        <p className="text-[13px] leading-snug" style={{ color: T.text }}>{storyLine(ev)}</p>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </section>
        ))
      )}

      {/* ── Atlas (the old Impact deep-dives, nothing lost) ── */}
      <button onClick={() => setAtlasOpen((v) => !v)}
        className="mt-7 w-full flex items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-bold"
        style={{ background: T.card, border: `1px solid ${T.border}`, color: T.textDim }}>
        🗺️ The numbers behind the story {atlasOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {atlasOpen && (
        <div className="mt-3 space-y-3 pb-4">
          <MilestoneCard countriesCount={Object.keys(reactData?.usersByCountry ?? {}).length} dark={darkMode} />
          <FurthestReachCard reactionByCountry={reactData?.reactionByCountry ?? {}} homeCountry={profile?.country} dark={darkMode} />
          <ReachByCountryGraph usersByCountry={reactData?.usersByCountry ?? {}} loading={reactLoading} dark={darkMode} />
        </div>
      )}
      <div className="h-6" />
    </main>
  );
}
