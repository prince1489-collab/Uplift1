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
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import {
  DARK, LIGHT, kmBetween,
  useRippleData, useOnwardReach,
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
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: "long" });
}
function dayLabel(ts) {
  return new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" });
}
// ISO-ish week number, and a "16–22 Jun" range label for the week that ts falls in (Mon–Sun).
function weekOfYear(ts) {
  const d = new Date(ts);
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (u.getUTCDay() + 6) % 7;
  u.setUTCDate(u.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(u.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((u - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}
function weekRangeLabel(ts) {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Mon = 0
  const mon = new Date(d); mon.setDate(d.getDate() - day);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (x) => x.toLocaleDateString([], { day: "numeric", month: "short" });
  return `${fmt(mon)} – ${fmt(sun)}`;
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

// ── headline metric circle ──────────────────────────────────────────────────────────
// A ringed number with a label under it; four of these sit in one row as the board's cover.

function StatCircle({ value, label, color, dark }) {
  const T = dark ? DARK : LIGHT;
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <div className="flex items-center justify-center rounded-full"
        style={{
          width: 62, height: 62,
          background: dark ? `${color}1f` : `${color}14`,
          border: `2px solid ${color}`,
          boxShadow: dark ? "none" : `0 3px 10px ${color}22`,
        }}>
        <span className="font-extrabold leading-none" style={{ color, fontSize: 20 }}>{value}</span>
      </div>
      <span className="text-[8.5px] font-bold uppercase tracking-wide text-center leading-tight" style={{ color: T.textDim }}>{label}</span>
    </div>
  );
}

// ── the board ──────────────────────────────────────────────────────────────────────

export default function KindnessBoard({ db, currentUser, liveStats, streak, profile, darkMode }) {
  const T = darkMode ? DARK : LIGHT;
  const uid = currentUser?.uid;
  const [raw, setRaw] = useState(null); // { sends, hearts, ripples, uplifts, echoes }
  const [openYears, setOpenYears] = useState({});
  const [openMonths, setOpenMonths] = useState({});

  // Ripple metric: live uncapped ripple-doc count + second-order onward reach.
  const { rippleCount, ripples: liveRipples } = useRippleData(db, currentUser);
  const onwardReach = useOnwardReach(db, currentUser, liveRipples);

  useEffect(() => {
    if (!db || !uid) return;
    let alive = true;
    (async () => {
      const safe = async (p) => { try { return await p; } catch { return { docs: [] }; } };
      const [sendsSnap, heartsSnap, ripplesSnap, upliftSnap, echoSnap] = await Promise.all([
        // Equality-only (no orderBy) so it needs NO composite index — buildStory sorts in JS.
        safe(getDocs(query(collection(db, "publicMessages"), where("uid", "==", uid), limit(500)))),
        safe(getDocs(query(collection(db, "users", uid, "reactionsReceived"), orderBy("reactedAt", "desc"), limit(300)))),
        safe(getDocs(query(collection(db, "users", uid, "ripples"), orderBy("createdAt", "desc"), limit(200)))),
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

  // Nest the story into Year → Month (chapter) → Week, newest first at every level.
  const tree = useMemo(() => {
    if (!raw) return null;
    const story = buildStory({ ...raw, homeCountry: profile?.country ?? null });
    if (!story.length) return [];
    const years = new Map(); // year → Map(monthKey → Map(weekNum → { weekNum, label, events }))
    story.forEach((ev) => {
      const y = new Date(ev.ts).getFullYear();
      const mk = monthKey(ev.ts);
      const wk = weekOfYear(ev.ts);
      if (!years.has(y)) years.set(y, new Map());
      const months = years.get(y);
      if (!months.has(mk)) months.set(mk, new Map());
      const weeks = months.get(mk);
      if (!weeks.has(wk)) weeks.set(wk, { weekNum: wk, label: weekRangeLabel(ev.ts), events: [] });
      weeks.get(wk).events.push(ev);
    });
    const nowY = new Date().getFullYear();
    const nowM = monthKey(Date.now());
    // Number chapters (months) oldest = 1 so the newest carries the highest chapter number.
    const totalMonths = [...years.values()].reduce((n, m) => n + m.size, 0);
    let seen = 0;
    return [...years.entries()].sort((a, b) => b[0] - a[0]).map(([year, months]) => ({
      year,
      current: year === nowY,
      months: [...months.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([mk, weeks]) => {
        const allEvents = [...weeks.values()].flatMap((w) => w.events);
        seen += 1;
        return {
          key: mk,
          number: totalMonths - seen + 1,
          label: monthLabel(mk),
          title: chapterTitle(allEvents),
          current: mk === nowM,
          weeks: [...weeks.values()].sort((a, b) => b.weekNum - a.weekNum)
            .map((w) => ({ ...w, events: [...w.events].sort((a, b) => b.ts - a.ts) })),
        };
      }),
    }));
  }, [raw, profile?.country]);

  const isYearOpen = (yr) => openYears[yr.year] ?? yr.current;
  const isMonthOpen = (m) => openMonths[m.key] ?? m.current;

  const startedLabel = useMemo(() => {
    const t = profile?.onboardingCompletedAt?.toMillis?.() ?? null;
    return t ? new Date(t).toLocaleDateString([], { month: "long", year: "numeric" }) : null;
  }, [profile]);

  // Lifetime metrics from the already-fetched subcollection reads (no 30-day window, no composite index).
  const messagesSent = Math.max(raw?.sends?.length ?? 0, Number(profile?.greetingsSentCount ?? 0));
  const usersReached = raw ? new Set(raw.hearts.map((h) => h.reactorUid).filter(Boolean)).size : 0;
  const countriesCount = raw ? new Set(raw.hearts.map((h) => h.country).filter(Boolean)).size : 0;
  const rippleEffect = (rippleCount ?? 0) + (onwardReach ?? 0);

  return (
    <main className="flex-1 overflow-y-auto px-4 py-5" style={{ background: T.pageBg }}>
      {/* ── Cover: heading + 4 headline metrics ── */}
      <div className="text-center mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: T.textDim }}>Your Kindness Story</p>
        {startedLabel && <p className="text-[10px] mt-0.5" style={{ color: T.textDim }}>began {startedLabel}</p>}
      </div>
      <div className="flex items-start justify-between gap-1.5">
        <StatCircle value={messagesSent} label="Messages sent" color="#14b8a6" dark={darkMode} />
        <StatCircle value={usersReached} label="Users reached" color="#f59e0b" dark={darkMode} />
        <StatCircle value={countriesCount} label="Countries reached" color="#6366f1" dark={darkMode} />
        <StatCircle value={rippleEffect} label="Ripple effect" color="#10b981" dark={darkMode} />
      </div>

      {/* ── Chapters: collapsible Year → Month → Week ── */}
      {!tree ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin" style={{ color: T.accent ?? "#14b8a6" }} size={26} /></div>
      ) : tree.length === 0 ? (
        <div className="rounded-2xl px-4 py-8 text-center mt-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <p className="text-3xl mb-2">📖</p>
          <p className="text-sm font-bold" style={{ color: T.text }}>Your first page is waiting</p>
          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: T.textDim }}>
            Send a greeting and your kindness story starts writing itself — every heart, every
            country, every chain gets a card here.
          </p>
        </div>
      ) : (
        tree.map((yr) => (
          <section key={yr.year} className="mt-5">
            {/* Year header (collapsible) */}
            <button onClick={() => setOpenYears((s) => ({ ...s, [yr.year]: !isYearOpen(yr) }))}
              className="w-full flex items-center gap-2 mb-1">
              {isYearOpen(yr) ? <ChevronDown size={16} style={{ color: T.textDim }} /> : <ChevronRight size={16} style={{ color: T.textDim }} />}
              <span className="text-[15px] font-extrabold tracking-tight" style={{ color: T.text }}>{yr.year}</span>
              <div className="flex-1 h-px" style={{ background: T.border }} />
              {yr.current && <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: T.accentLabel }}>this year</span>}
            </button>

            {isYearOpen(yr) && yr.months.map((m) => (
              <div key={m.key} className="mt-2.5">
                {/* Month = chapter (collapsible) */}
                <button onClick={() => setOpenMonths((s) => ({ ...s, [m.key]: !isMonthOpen(m) }))}
                  className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left"
                  style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  {isMonthOpen(m) ? <ChevronDown size={14} style={{ color: T.textDim }} /> : <ChevronRight size={14} style={{ color: T.textDim }} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[8.5px] font-bold uppercase tracking-[0.16em]" style={{ color: T.textDim }}>
                      Chapter {m.number} · {m.label}
                    </p>
                    <p className="text-[12.5px] font-bold leading-tight" style={{ color: T.text }}>
                      {m.title}
                      {m.current && <span className="font-medium" style={{ color: T.textDim }}> — still being written ✍️</span>}
                    </p>
                  </div>
                </button>

                {isMonthOpen(m) && (
                  <div className="mt-2 pl-1">
                    {m.weeks.map((w) => (
                      <div key={w.weekNum} className="mb-2">
                        {/* Week subheader */}
                        <p className="text-[9px] font-bold uppercase tracking-wide mb-1.5 pl-4" style={{ color: T.textDim }}>
                          Week {w.weekNum} · {w.label}
                        </p>
                        {/* Story cards on a timeline spine */}
                        <div className="relative pl-5">
                          <div className="absolute left-[7px] top-1 bottom-1 w-px" style={{ background: T.border }} />
                          <div className="space-y-2">
                            {w.events.map((ev, i) => (
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        ))
      )}
      <div className="h-6" />
    </main>
  );
}
