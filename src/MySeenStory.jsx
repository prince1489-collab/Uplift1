// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// MySeenStory.jsx — the "Grow" tab (v2, tab id still `impact`). The centrepiece is the animated
// Kindness Tree; the whole page has gentle motion (staggered fade-in, idle tree sway,
// count-up metrics). Only four metrics are shown: Countries reached, Ripple effect,
// Tried in real life, Reflections. Tree balance = real sparkBalance + device-local
// preview points, so demo actions visibly grow the hero tree.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { collection, getDocs } from "firebase/firestore";
import { X } from "lucide-react";
import { treeStageFor, TREE_STAGES, TreeScene, useWatering } from "./KindnessTree";
import { getPoints } from "./points";
import { playLevelUp, playGrowthSwell } from "./sounds";
import { useReactionData, useRippleData, useOnwardReach } from "./MyImpact";
import { FLAG_MAP } from "./MicroAnimations";

const STAGE_SEEN_KEY = "seen_v2_tree_stage_seen"; // highest stage already celebrated
const REPLAY_MS = 4200;      // grow-from-seed replay
// The spray window opens ~1s in and droplets take ~1.3s to fall, so the first water lands
// around here. Growth starts on that beat: water arrives, then the tree responds.
const GROWTH_DELAY_MS = 2000;
const MILESTONE_DELAY_MS = GROWTH_DELAY_MS + REPLAY_MS + 300; // just after the final growth note
const prefersReducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};


// Completed "Have you tried?" items on this device — the total, plus how many separate
// days they were spread across, which is what makes the number mean something.
function hytCompletedCount() {
  let total = 0, days = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("seen_hyt_state_")) {
        const done = JSON.parse(localStorage.getItem(k) || "{}")?.done || {};
        const n = Object.values(done).filter(Boolean).length;
        if (n > 0) { total += n; days += 1; }
      }
    }
  } catch { /* ignore */ }
  return { total, days };
}

// Small count-up hook — rolls a number from 0 → target on mount / change.
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const to = Math.max(0, Math.round(Number(target) || 0));
    if (to === 0) { setVal(0); return; }
    let start = 0;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(Math.round(to * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

// One metric, opened up: a human line, then the actual data behind the figure.
function MetricCard({ card, onClose }) {
  if (!card) return null;
  return createPortal(
    <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up flex max-h-[85dvh] flex-col rounded-t-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-shrink-0 justify-center pt-3 pb-2"><div className="h-1 w-10 rounded-full bg-slate-200" /></div>
        <div className="flex items-center justify-between px-5 pb-1">
          <h2 className="text-lg font-bold text-slate-800">{card.emoji} {card.label}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <p className="px-5 pb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{card.basis}</p>

        <div className="overflow-y-auto overscroll-contain px-5 pb-8 space-y-4">
          <div className="seen-grad-cool rounded-2xl bg-gradient-to-br from-teal-50 to-sky-50 px-4 py-4 text-center">
            <p className="text-4xl font-extrabold tabular-nums text-slate-800">{card.value.toLocaleString()}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{card.line}</p>
          </div>

          {card.rows?.length > 0 && (
            <div className="space-y-1">
              <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{card.rowsTitle}</p>
              {card.rows.map((r, i) => (
                <div key={i} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-2.5">
                  <span className="flex-shrink-0 text-base leading-snug">{r.icon}</span>
                  <span className="min-w-0 flex-1 text-sm leading-snug text-slate-700">{r.label}</span>
                  {r.value != null && <span className="flex-shrink-0 text-sm font-bold tabular-nums leading-snug text-slate-500">{r.value}</span>}
                </div>
              ))}
            </div>
          )}

          {card.empty && <p className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-400">{card.empty}</p>}

          <p className="text-[12px] leading-relaxed text-slate-500">{card.how}</p>
          <button onClick={onClose}
            className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-bold text-white transition-colors hover:bg-teal-700">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── milestone celebration — petals + the new stage name drawing in ───────────
function MilestoneOverlay({ stage, onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 4200);
    return () => clearTimeout(t);
  }, [onDone]);
  const petals = ["🌸", "🌼", "🍃", "🌺", "🍂", "🌸", "🍃", "🌼"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl" aria-hidden="true">
      {/* warm glow pulses twice around the whole card */}
      <div className="absolute inset-0 rounded-3xl" style={{ animation: "seenMilestoneGlow 2.4s ease-in-out 2" }} />
      {petals.map((p, i) => (
        <span key={i} style={{
          position: "absolute", top: -14, left: `${6 + i * 12}%`, fontSize: 15 + (i % 3) * 4,
          "--spin": `${(i % 2 ? 1 : -1) * (240 + i * 40)}deg`,
          animation: `seenPetalFall ${2.6 + (i % 4) * 0.5}s cubic-bezier(0.35,0.6,0.5,1) ${i * 0.16}s both`,
        }}>{p}</span>
      ))}
      <div className="absolute inset-x-0 bottom-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600"
          style={{ animation: "seenFadeUp 600ms ease 500ms both" }}>New stage reached</p>
        <p className="mt-1 text-xl font-extrabold text-slate-800"
          style={{ animation: "seenStageReveal 1100ms cubic-bezier(0.2,0.9,0.3,1) 700ms both" }}>
          {stage.name}
        </p>
      </div>
    </div>
  );
}

function MetricTile({ emoji, value, label, delay = 0, onOpen }) {
  const shown = useCountUp(value);
  return (
    <button onClick={onOpen}
      className="rounded-2xl border border-slate-200 bg-white px-3 py-4 text-center transition-transform active:scale-[0.97]"
      style={{ animation: "seenFadeUp 500ms ease both", animationDelay: `${delay}ms` }}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-2xl font-extrabold text-slate-800 tabular-nums leading-none">{shown.toLocaleString()}</div>
      <div className="text-[11px] text-slate-500 mt-1.5 leading-tight">{label}</div>
    </button>
  );
}

export default function MySeenStory({ db, currentUser, liveStats, profile, sparkBalance = 0, darkMode = false, onOpenTree }) {
  const [journalCount, setJournalCount] = useState(null);
  const [localPts, setLocalPts] = useState(() => getPoints());
  // Pour on open. Points are only ever awarded on Connect / Practice / Reflect, and this
  // component isn't mounted then — so waiting for a "seen-points" event meant the watering
  // animation could never actually play here. Opening the tab is the moment to show it.
  const { watering, startPour } = useWatering(true);
  const [openCard, setOpenCard] = useState(null); // which metric card is open
  const hytTried = useMemo(() => hytCompletedCount(), []);

  // Live points → grow + water the hero tree (useWatering owns the pour timing + sound).
  useEffect(() => {
    const onPts = () => { setLocalPts(getPoints()); startPour(); };
    window.addEventListener("seen-points", onPts);
    return () => window.removeEventListener("seen-points", onPts);
  }, [startPour]);

  // Keep enough of the journal docs to back the number up — when you started, and roughly
  // how much you've written — rather than just the count.
  const [journalFacts, setJournalFacts] = useState({ words: 0, firstDate: null });
  useEffect(() => {
    if (!db || !currentUser?.uid) return;
    let alive = true;
    getDocs(collection(db, "users", currentUser.uid, "journal"))
      .then((snap) => {
        if (!alive) return;
        setJournalCount(snap.size);
        let words = 0, first = null;
        snap.forEach((d) => {
          const e = d.data() || {};
          words += String(e.text || "").trim().split(/\s+/).filter(Boolean).length;
          const when = e.date || null;
          if (when && (!first || when < first)) first = when;
        });
        setJournalFacts({ words, firstDate: first });
      })
      .catch(() => { if (alive) setJournalCount(0); });
    return () => { alive = false; };
  }, [db, currentUser?.uid]);

  // Real impact hooks (same as MyImpact): countries reached + ripple effect.
  // The Week/Month/All-time selector is gone. It drove exactly one of the four numbers,
  // and its "All time" was really 30 days — a control that changes one number in four,
  // mislabelled, is worse than no control. Each metric now states its own true basis.
  const reactPeriod = "30d"; // the widest window useReactionData supports
  const { data: reactData } = useReactionData(db, currentUser, reactPeriod);
  const { rippleCount, ripples } = useRippleData(db, currentUser);
  const onwardReach = useOnwardReach(db, currentUser, ripples);

  // Countries reached = countries the people who hearted your messages were in.
  // This used to take Math.max() with a figure from liveStats, but that counts every country
  // appearing anywhere in the feed — including people with no connection to your messages —
  // so the headline could exceed the real list and contradict the breakdown card below it.
  const countryCounts = reactData?.reactionByCountry || {};
  const countryRows = useMemo(
    () => Object.entries(countryCounts).sort((a, b) => b[1] - a[1]),
    [countryCounts]
  );
  const countries = countryRows.length;
  const ripple = rippleCount + onwardReach;

  // Each metric opened up. Bases genuinely differ, so each card says which it is.
  const periodWord = "Last 30 days";
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const METRIC_CARDS = {
    countries: {
      emoji: "🌍", label: "Countries reached", value: countries, basis: periodWord,
      line: countries === 0
        ? "No hearts from abroad yet — they often arrive a little after you've forgotten you sent anything."
        : `${plural(countries, "place", "places")} where someone opened their phone and found a stranger had thought of them.`,
      rowsTitle: "Where they were",
      rows: countryRows.map(([c, n]) => ({ icon: FLAG_MAP[c] || "🌍", label: c, value: n })),
      empty: countries === 0 ? "Countries appear here once someone hearts a message you sent." : null,
      how: "Counted from the reactions on messages you sent, one entry per country, over the last 30 days.",
    },
    ripple: {
      emoji: "💫", label: "Ripple effect", value: ripple, basis: "All time",
      line: ripple === 0
        ? "Nothing has rippled onward yet. It tends to start the moment someone reacts to you."
        : "Kindness that carried on without you.",
      rowsTitle: "How it breaks down",
      rows: ripple === 0 ? [] : [
        { icon: "🌱", label: "People you reached who went on to send their own kindness", value: rippleCount },
        { icon: "❤️", label: "Hearts those onward messages went on to receive", value: onwardReach },
      ],
      empty: ripple === 0 ? "This fills in when someone you reached goes on to be kind to somebody else." : null,
      how: "The two figures added together, counted over your whole time in Seen.",
    },
    tried: {
      emoji: "🤝", label: "Tried in real life", value: hytTried.total, basis: "All time · this device",
      line: hytTried.total === 0
        ? "Nothing ticked off yet. One small thing counts."
        : "Things that happened off this screen, because you decided to.",
      rowsTitle: "The shape of it",
      rows: hytTried.total === 0 ? [] : [
        { icon: "✅", label: "Practice suggestions marked done", value: hytTried.total },
        { icon: "📆", label: "Separate days you did one", value: hytTried.days },
      ],
      empty: hytTried.total === 0 ? "Tick something off in Practice and it lands here." : null,
      how: "Every prompt you've marked done in Practice. Stored on this device, so it starts fresh on a new phone.",
    },
    reflections: {
      emoji: "🪞", label: "Reflections", value: journalCount ?? 0, basis: "All time · private",
      line: (journalCount ?? 0) === 0
        ? "Nothing written yet. A line or two is plenty."
        : "Your own thinking, kept where only you can read it.",
      rowsTitle: "What's in there",
      rows: (journalCount ?? 0) === 0 ? [] : [
        { icon: "✍️", label: "Reflections written", value: journalCount },
        ...(journalFacts.words ? [{ icon: "📖", label: "Words, roughly", value: journalFacts.words.toLocaleString() }] : []),
        ...(journalFacts.firstDate ? [{ icon: "🌱", label: "You started on", value: journalFacts.firstDate }] : []),
      ],
      empty: (journalCount ?? 0) === 0 ? "Write one in Reflect and it appears here." : null,
      how: "Entries in your private journal. Nobody else can ever read them, including us.",
    },
  };

  const balance = sparkBalance + localPts;
  const stage = treeStageFor(balance);
  const stageIdx = TREE_STAGES.indexOf(stage);
  const next = TREE_STAGES[stageIdx + 1] ?? null;
  const pct = next ? Math.max(0, Math.min(100, Math.round(((balance - stage.min) / (next.min - stage.min)) * 100))) : 100;
  const first = (profile?.fullName || "").trim().split(" ")[0] || "you";

  // ── Grow-from-seed replay ──────────────────────────────────────────────────
  // On open, walk the tree from bare soil up to where it actually is, so the whole
  // journey is something you watch rather than a state you arrive at. `replay` is a
  // continuous 0..1 growth value; null hands control back to the stage-driven view.
  const [replay, setReplay] = useState(() => (prefersReducedMotion() ? null : 0));
  const replayRaf = useRef(0);
  const targetGrowth = stageIdx / (TREE_STAGES.length - 1);
  const replayDoneRef = useRef(false);
  useEffect(() => {
    if (replayDoneRef.current || prefersReducedMotion()) { setReplay(null); return; }
    replayDoneRef.current = true;
    const DURATION = REPLAY_MS;
    // Hold on bare soil until the first droplets actually land, so the sequence reads
    // causally — water arrives, THEN the tree grows — rather than the two running at once.
    const begin = setTimeout(() => {
      // One call schedules every growth note. Pre-scheduling beats watching the rAF loop:
      // easeOutCubic crosses several stages inside a single frame near the start, and rAF
      // stalls entirely if the tab is backgrounded part-way through.
      playGrowthSwell(stageIdx, DURATION);
      let start = 0;
      const step = (ts) => {
        if (!start) start = ts;
        const p = Math.min(1, (ts - start) / DURATION);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        setReplay(eased * targetGrowth);
        if (p < 1) replayRaf.current = requestAnimationFrame(step);
        else setReplay(null); // hand back to the live stage view
      };
      replayRaf.current = requestAnimationFrame(step);
    }, GROWTH_DELAY_MS);
    return () => { clearTimeout(begin); cancelAnimationFrame(replayRaf.current); };
  }, [targetGrowth]);

  // ── Milestone moment ───────────────────────────────────────────────────────
  // Fires once per stage, the first time you reach it — never on every visit.
  const [milestone, setMilestone] = useState(null);
  useEffect(() => {
    let seen = -1;
    try { seen = Number(localStorage.getItem(STAGE_SEEN_KEY) ?? -1); } catch { /* ignore */ }
    if (stageIdx <= seen) return;
    try { localStorage.setItem(STAGE_SEEN_KEY, String(stageIdx)); } catch { /* ignore */ }
    if (seen < 0) return; // first ever visit — record where they are, don't celebrate
    // Let the growth replay finish before celebrating on top of it.
    const t = setTimeout(() => {
      setMilestone(TREE_STAGES[stageIdx]);
      try { playLevelUp(); } catch { /* ignore */ }
    }, prefersReducedMotion() ? 200 : MILESTONE_DELAY_MS);
    return () => clearTimeout(t);
  }, [stageIdx]);

  return (
    <main {...(darkMode ? { "data-dark-shell": "" } : {})} className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4"
      style={{ background: darkMode ? "#0e1219" : undefined }}>
      <div className="mx-auto w-full max-w-md space-y-4">
        {/* Hero — the animated Kindness Tree (centrepiece) */}
        <button onClick={onOpenTree}
          className="relative block w-full seen-grad-hero rounded-3xl border border-teal-100 bg-gradient-to-b from-sky-50 to-teal-50 px-4 pt-5 pb-6 text-center overflow-hidden active:scale-[0.99] transition-transform"
          style={{ animation: "seenFadeUp 600ms ease both", animationDelay: "80ms" }}>
          <div className="mx-auto" style={{ width: 210, height: 210 }}>
            <TreeScene stageIdx={stageIdx} growth={replay} watering={watering} size={210} ambient darkMode={darkMode} />
          </div>
          {milestone && <MilestoneOverlay stage={milestone} onDone={() => setMilestone(null)} />}
          <p className="mt-1 text-xl font-extrabold text-slate-800">{stage.name}</p>
          <p className="text-[12px] text-slate-500 mt-0.5">{stage.blurb}</p>
          <div className="mt-4 mx-auto max-w-xs">
            {next ? (
              <>
                <div className="h-2 rounded-full bg-white/70 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {balance.toLocaleString()} drops · {Math.max(0, next.min - balance).toLocaleString()} more until <strong>{next.name}</strong>
                </p>
              </>
            ) : (
              <p className="text-[11px] font-semibold text-teal-700">Fully grown — {balance.toLocaleString()} drops of kindness 🌸</p>
            )}
          </div>
          <span className="mt-3 inline-block text-[11px] font-semibold text-teal-600">Tap to tend your tree →</span>
        </button>

        {/* Reflective one-liner */}
        <p className="text-center text-[13px] text-slate-500 leading-relaxed px-2"
          style={{ animation: "seenFadeUp 500ms ease both", animationDelay: "160ms" }}>
          Every kind act you make waters this tree, {first}. Here's the reach of your kindness.
        </p>

        {/* The four metrics */}
        <div className="flex items-center gap-2 px-1" style={{ animation: "seenFadeUp 500ms ease both", animationDelay: "180ms" }}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex-1">The reach of your kindness</p>
          <span className="text-[10px] font-semibold text-slate-300">tap any number</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <MetricTile emoji="🌍" value={countries} label="Countries reached" delay={200} onOpen={() => setOpenCard("countries")} />
          <MetricTile emoji="💫" value={ripple} label="Ripple effect" delay={280} onOpen={() => setOpenCard("ripple")} />
          <MetricTile emoji="🤝" value={hytTried.total} label="Tried in real life" delay={360} onOpen={() => setOpenCard("tried")} />
          <MetricTile emoji="🪞" value={journalCount ?? 0} label="Reflections" delay={440} onOpen={() => setOpenCard("reflections")} />
        </div>

        <p className="text-center text-[10px] text-slate-400 leading-relaxed pb-4"
          style={{ animation: "seenFadeUp 500ms ease both", animationDelay: "520ms" }}>
          A gentle mirror of your journey — never a score.
        </p>
      </div>

      {openCard && <MetricCard card={METRIC_CARDS[openCard]} onClose={() => setOpenCard(null)} />}
    </main>
  );
}
