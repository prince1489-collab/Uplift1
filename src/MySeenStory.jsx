// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// MySeenStory.jsx — the "Grow" tab (tab id still `impact`). Since 3.30: the Kindness Tree and three
// numbers with levels — days in a row, hearts received, countries reached (growStats.js). The
// words that used to sit here are said in Seen instead (seenUpdates.js).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { treeStageFor, TREE_STAGES, TreeScene, useWatering, WATERING_MS } from "./KindnessTree";
import { getPoints } from "./points";
import { playLevelUp, playGrowthSwell } from "./sounds";
import { useReactionData } from "./MyImpact";
import { FLAG_MAP } from "./MicroAnimations";
import { claimStageUp } from "./treeMilestone";
import { useBackLayer } from "./backStack";
import { todayGrowth, GROWTH_EVENT } from "./todayGrowth";
import { liveStreak } from "./rhythm";
import { todayKey as localDayKey } from "./hytPrompts";
import { TIERS, WORLD_COUNTRIES, tierFor, bestStreakOf, weekDots, doneToday, restDayShown, firstLevelLabel, mergeCountries } from "./growStats";

const REPLAY_MS = 4200;      // grow-from-seed replay
// The spray window opens ~1s in and droplets take ~1.3s to fall, so the first water lands
// around here. Growth starts on that beat: water arrives, then the tree responds.
const GROWTH_DELAY_MS = 2000;
// Just after the final growth note — and after the watering can has finished, which the old
// arithmetic missed. useWatering(true) runs for WATERING_MS from mount, so at 6,500ms the pour was
// still going and the celebration landed on top of it. The sequence this file is otherwise careful
// about is water, then grow, then celebrate; taking the max of the two makes that true of what you
// actually see rather than only of the growth half.
const MILESTONE_DELAY_MS = Math.max(GROWTH_DELAY_MS + REPLAY_MS, WATERING_MS) + 300;
const prefersReducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};


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

// ── milestone celebration ────────────────────────────────────────────────────
// Effects only: the warm glow and the petals falling past the tree. The WORDS are not in here.
//
// THE BUG THIS SPLIT EXISTS FOR. This component used to carry the announcement too, in a
// `absolute inset-x-0 bottom-6` block with no backdrop. Because it is `inset-0` over the whole
// hero BUTTON rather than over the tree, "bottom-6" is not under the tree — it is 24px up from the
// card's bottom edge, which is exactly where the card already puts "N drops · M more until X" and
// the "See how it grows →" link. Measured in a browser: the block spanned 517-556px and the
// progress line 517-530px, so they printed straight through each other. The hero ALSO renders the
// stage name in flow, in the same size and weight, so during the celebration the name appeared
// twice at once, one copy sitting on other text.
//
// None of that is visible in the source — the two halves are 250 lines apart and neither says
// anything about the other. It is obvious in a picture, which is what scripts/render-milestone.mjs
// is for.
//
// The fix is not a z-index or a scrim. The words go back into the FLOW (see the hero below), where
// they take the place of the card's own name and blurb for a few seconds. Nothing is positioned,
// so nothing can collide, and the name is announced once.
function MilestoneEffects({ onDone }) {
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
    </div>
  );
}

// ── Levels, drawn ───────────────────────────────────────────────────────────────────────────
// A medal with the level on it. Colours climb bronze → silver → gold → teal-blue → violet. Inline,
// because the Tailwind palette is remapped (teal is coral here) and a medal must look like one.
const MEDALS = [
  ["#e2e8f0", "#cbd5e1", "#64748b"], // level 0: not yet
  ["#f3c9a1", "#cd7f32", "#7a4a1f"], ["#f3c9a1", "#b8692a", "#6b3f17"],
  ["#eef2f6", "#a8b2bd", "#475569"], ["#eef2f6", "#8e99a6", "#334155"],
  ["#fff1b8", "#f2b705", "#7a5a00"], ["#fff1b8", "#e09a00", "#6b4700"],
  ["#d6f4fb", "#38bdf8", "#075985"], ["#ede4ff", "#8b5cf6", "#4c1d95"],
];
// `locked`: the first level, not reached yet — a faint "1" to aim for rather than a "0" (3.31.1).
function Medal({ level, size = 44, locked = false }) {
  const [hi, mid, ink] = MEDALS[locked ? 0 : Math.min(level, MEDALS.length - 1)];
  return (
    <span aria-hidden className="grid flex-shrink-0 place-items-center rounded-full font-extrabold tabular-nums"
      style={{ width: size, height: size, fontSize: size * 0.4, color: ink,
        background: `radial-gradient(circle at 32% 28%, ${hi}, ${mid})`, boxShadow: `inset 0 -2px 0 rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.12)` }}>
      {locked ? 1 : level}
    </span>
  );
}

function Bar({ pct, color }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(3, pct)}%`, background: color }} />
    </div>
  );
}

const STAT_LOOK = {
  streak: { emoji: "🔥", title: "Days in a row", color: "linear-gradient(90deg,#fb923c,#ef4444)", unit: (n) => (n === 1 ? "day" : "days") },
  hearts: { emoji: "❤️", title: "Hearts received", color: "linear-gradient(90deg,#fb7185,#e11d48)", unit: (n) => (n === 1 ? "heart" : "hearts") },
  countries: { emoji: "🌍", title: "Countries reached", color: "linear-gradient(90deg,#34d399,#0ea5e9)", unit: (n) => (n === 1 ? "country" : "countries") },
};

// One of the three. `value` is the big number; `levelValue` is what the level is measured on (the
// best run for days in a row, the number itself for the others).
function StatCard({ stat, value, levelValue = value, sub = null, children, celebrate = false, onCelebrated, onOpen, delay = 0 }) {
  const look = STAT_LOOK[stat];
  const shown = useCountUp(value);
  const t = tierFor(levelValue, TIERS[stat]);
  // For days in a row the bar runs from today's run towards the next level above your best.
  const pct = stat === "streak" && t.next ? Math.min(100, Math.floor((value / t.next) * 100)) : t.pct;
  const toGo = t.next == null ? 0 : (stat === "streak" ? t.next - value : t.toNext);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white"
      style={{ animation: "seenFadeUp 500ms ease both", animationDelay: `${delay}ms` }}>
      {celebrate && <MilestoneEffects onDone={onCelebrated} />}
      <button onClick={onOpen} className="block w-full px-4 pb-3 pt-3.5 text-left active:scale-[0.99] transition-transform"
        aria-label={`${look.title}: ${value}. Level ${t.level}. Open levels`}>
        <div className="flex items-center gap-3">
          <span style={{ opacity: t.level ? 1 : 0.5 }}><Medal level={t.level} locked={!t.level} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{look.emoji} {look.title}</p>
            <p className="flex items-baseline gap-1.5">
              <span className="text-[30px] font-extrabold leading-none tabular-nums text-slate-800">{shown.toLocaleString()}</span>
              {sub && <span className="text-[12px] font-semibold text-slate-400">{sub}</span>}
            </p>
          </div>
          <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${celebrate ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}
            style={celebrate ? { animation: "seenStageReveal 900ms cubic-bezier(0.2,0.9,0.3,1) both" } : undefined}>
            {celebrate ? `Level ${t.level}!` : t.level ? `Level ${t.level}` : firstLevelLabel(stat)}
          </span>
        </div>
        <div className="mt-3"><Bar pct={pct} color={look.color} /></div>
        <p className="mt-1.5 text-[11.5px] font-semibold text-slate-500">
          {t.next == null ? "Top level reached" : `${toGo.toLocaleString()} more ${look.unit(toGo)} to Level ${t.level + 1}`}
        </p>
      </button>
      {children && <div className="px-4 pb-3.5">{children}</div>}
    </div>
  );
}

// The ladder for one stat, opened from its card: every level, the ones reached lit up.
function LevelSheet({ stat, value, levelValue = value, countries = [], best = 0, onClose }) {
  useBackLayer(true, onClose);
  const look = STAT_LOOK[stat];
  const tiers = TIERS[stat];
  const t = tierFor(levelValue, tiers);
  return createPortal(
    <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up flex max-h-[85dvh] flex-col rounded-t-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-shrink-0 justify-center pt-3 pb-2"><div className="h-1 w-10 rounded-full bg-slate-200" /></div>
        <div className="flex items-center justify-between px-5 pb-2">
          <h2 className="text-lg font-bold text-slate-800">{look.emoji} {look.title}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-8 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <Medal level={t.level} size={52} />
            <div>
              <p className="text-[26px] font-extrabold leading-none tabular-nums text-slate-800">{value.toLocaleString()}</p>
              <p className="mt-1 text-[12px] font-semibold text-slate-500">
                {stat === "streak" ? `Your best: ${best} ${look.unit(best)}` : stat === "countries" ? `of ${WORLD_COUNTRIES} countries` : `Level ${t.level}`}
              </p>
            </div>
          </div>
          {stat === "countries" && countries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {countries.map((c) => (
                <span key={c} title={c} className="rounded-xl border border-slate-100 bg-white px-2 py-1 text-[12px] text-slate-600">
                  <span className="mr-1 text-base leading-none" aria-hidden>{FLAG_MAP[c] || "🌍"}</span>{c}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            {tiers.map((n, i) => {
              const got = i < t.level;
              return (
                <div key={n} className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 ${got ? "border-amber-200 bg-amber-50/60" : i === t.level ? "border-dashed border-slate-300" : "border-slate-100 bg-slate-50"}`}>
                  <span style={{ opacity: got ? 1 : 0.45 }}><Medal level={i + 1} size={30} /></span>
                  <span className={`text-[12px] font-extrabold tabular-nums ${got ? "text-slate-800" : "text-slate-400"}`}>{n.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
          {stat === "streak" && (
            <p className="text-[12px] leading-relaxed text-slate-500">Levels count your best run. 🛡️ One rest day in any seven keeps a run going — you don't have to do anything.</p>
          )}
          <button onClick={onClose} className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-bold text-white">Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── The Grow tab, 3.30 ──────────────────────────────────────────────────────────────────────
// The tree and three numbers, each a ladder to climb. Everything Grow used to SAY — this week's
// moments, what Seen noticed, new certificates, the tree's pace — is now said in Seen, the
// conversation in Messages (seenUpdates.js), where words already live. The certificates and the
// real-tree promise moved into the tree's own panel. The numbers come from App: the hearts
// listener and the countries collection live there because they're needed on every tab.
export default function MySeenStory({ db, currentUser, profile, sparkBalance = 0, darkMode = false, onOpenTree, onMakeSeen,
  heartsTotal = 0, heartsWeek = 0, countries = [], onCountriesSeen, fresh = [], onCelebrated, onStageUp }) {
  const [localPts, setLocalPts] = useState(() => getPoints());
  const [today, setToday] = useState(() => todayGrowth());
  useEffect(() => {
    const on = (e) => setToday(e.detail?.items ?? todayGrowth());
    window.addEventListener(GROWTH_EVENT, on);
    return () => window.removeEventListener(GROWTH_EVENT, on);
  }, []);
  // Pour on open — this tab is where the tree is watched.
  const { watering, startPour } = useWatering(true);
  useEffect(() => {
    const onPts = () => { setLocalPts(getPoints()); startPour(); };
    window.addEventListener("seen-points", onPts);
    return () => window.removeEventListener("seen-points", onPts);
  }, [startPour]);
  const [openStat, setOpenStat] = useState(null);

  // Hearts and countries on your own messages over 30 days — read here as before, so nobody's
  // hearts number is smaller than 3.29 showed, and any country they add joins the collection.
  const { data: reactData } = useReactionData(db, currentUser, "30d");
  const reactCountries = useMemo(() => Object.keys(reactData?.reactionByCountry || {}), [reactData]);
  const merged = useMemo(() => mergeCountries({ stored: countries, incoming: reactCountries, flagMap: FLAG_MAP }), [countries, reactCountries]);
  useEffect(() => { if (merged.added.length) onCountriesSeen?.(merged.added); }, [merged.added, onCountriesSeen]);
  const hearts = Math.max(Number(heartsTotal) || 0, Number(reactData?.totalReactions ?? 0));

  const dayKey = localDayKey();
  const run = liveStreak(profile || {}, dayKey);
  const best = bestStreakOf(profile, dayKey);
  const dots = useMemo(() => weekDots(profile, dayKey), [profile, dayKey]);
  const didToday = doneToday(profile, dayKey);
  const restShown = restDayShown(profile, dayKey);

  const balance = sparkBalance + localPts;
  const stage = treeStageFor(balance);
  const stageIdx = TREE_STAGES.indexOf(stage);
  const next = TREE_STAGES[stageIdx + 1] ?? null;
  const pct = next ? Math.max(0, Math.min(100, Math.round(((balance - stage.min) / (next.min - stage.min)) * 100))) : 100;

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

  // ── A new stage, the first time you reach it ───────────────────────────────────────────────
  // The latch is shared with App (treeMilestone.js), which skips while Grow is open so this one
  // wins: the tree is on screen for the petals. Seen is told too (read, since it was seen here).
  const [milestone, setMilestone] = useState(null);
  useEffect(() => {
    if (!claimStageUp(stageIdx)) return;
    const t = setTimeout(() => {
      setMilestone(TREE_STAGES[stageIdx]);
      try { playLevelUp(); } catch { /* ignore */ }
      onStageUp?.(stageIdx);
    }, prefersReducedMotion() ? 200 : MILESTONE_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageIdx]);

  // A new level on one of the cards (App decides, growStats.planBadges): petals on that card.
  const freshStats = useMemo(() => new Set((fresh || []).map((f) => f.stat)), [fresh]);
  useEffect(() => {
    if (!freshStats.size) return undefined;
    const t = setTimeout(() => { try { playLevelUp(); } catch { /* ignore */ } }, 500);
    return () => clearTimeout(t);
  }, [freshStats]);

  const flags = merged.all.slice().reverse(); // newest first
  return (
    <main {...(darkMode ? { "data-dark-shell": "" } : {})} className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4"
      style={{ background: darkMode ? "#0e1219" : undefined }}>
      <div className="mx-auto w-full max-w-md space-y-3.5 pb-4">
        {/* Hero — the animated Kindness Tree (centrepiece) */}
        <button onClick={onOpenTree}
          className="relative block w-full seen-grad-hero rounded-3xl border border-teal-100 bg-gradient-to-b from-sky-50 to-teal-50 px-4 pt-5 pb-6 text-center overflow-hidden active:scale-[0.99] transition-transform"
          style={{ animation: "seenFadeUp 600ms ease both", animationDelay: "80ms" }}>
          <div className="mx-auto" style={{ width: 210, height: 210 }}>
            <TreeScene stageIdx={stageIdx} growth={replay} watering={watering} size={210} ambient darkMode={darkMode} today={today} />
          </div>
          {milestone && <MilestoneEffects onDone={() => setMilestone(null)} />}
          {/* The name, and for a few seconds the announcement of it — in the SAME place, one at a
              time. The celebration used to be painted over this region from an absolutely
              positioned overlay, which put two copies of the stage name on screen at once and
              printed the announcement through the progress line and the link below it. Swapping
              the content instead of covering it makes the collision impossible rather than
              tuned-around.

              min-h keeps the progress bar and the link still while the two states change over:
              name+blurb and eyebrow+name are within a few pixels of each other, so this is a
              guard, not a correction. */}
          <div className="min-h-[34px]">
            {milestone ? (
              <>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600"
                  style={{ animation: "seenFadeUp 600ms ease 200ms both" }}>New stage reached</p>
                <p className="text-xl font-extrabold text-slate-800"
                  style={{ animation: "seenStageReveal 1100ms cubic-bezier(0.2,0.9,0.3,1) 400ms both" }}>
                  {milestone.name}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-xl font-extrabold text-slate-800">{stage.name}</p>
              </>
            )}
          </div>
          <div className="mt-4 mx-auto max-w-xs">
            {next ? (
              <>
                <div className="h-2 rounded-full bg-white/70 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-[12px] font-semibold text-slate-600">
                  {Math.max(0, next.min - balance).toLocaleString()} drops to <strong>{next.name}</strong>
                </p>
                <p className="text-[10.5px] text-slate-400">💧 {balance.toLocaleString()} drops</p>
              </>
            ) : (
              <p className="text-[11px] font-semibold text-teal-700">Fully grown — {balance.toLocaleString()} drops of kindness 🌸</p>
            )}
          </div>
          {/* Says what the tap does. It read "Tap to tend your tree →", and tapping opens the
              stage list — tending is the watering animation, and that fires when you EARN
              something, not when you press this. A label naming an action the control does not
              perform is a small lie on the app's most earnest screen. The watering stays where it
              is: it lands at the moment kindness does, and moving it onto a button would turn a
              reward into a fidget. */}
          <span className="mt-3 inline-block text-[11px] font-semibold text-teal-600">See how it grows →</span>
        </button>

        <StatCard stat="streak" value={run} levelValue={best} delay={120}
          sub={best > run ? `best ${best}` : null}
          celebrate={freshStats.has("streak")} onCelebrated={() => onCelebrated?.("streak")} onOpen={() => setOpenStat("streak")}>
          <div className="flex items-center gap-1.5">
            {dots.map((d) => (
              <span key={d.key} title={d.key}
                className={`grid h-7 w-7 place-items-center rounded-full text-[10.5px] font-bold ${d.done ? "text-white" : "text-slate-300"} ${d.isToday && !d.done ? "ring-2 ring-orange-200" : ""}`}
                style={d.done ? { background: "linear-gradient(135deg,#fb923c,#ef4444)" } : undefined}>
                {d.done ? "🔥" : d.letter}
              </span>
            ))}
          </div>
          {didToday ? (
            <p className="mt-2 text-[12px] font-bold text-emerald-700">
              ✓ Today's done
              {restShown && <span className="font-semibold text-slate-500" title="One rest day in any seven keeps a run going"> · 🛡️ 1 rest day in hand</span>}
            </p>
          ) : (
            <button onClick={onMakeSeen} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[13px] font-extrabold text-white active:scale-[0.99] transition-transform"
              style={{ background: "linear-gradient(90deg,#fb923c,#ef4444)" }}>
              ✨ Today's still open — make someone feel seen
            </button>
          )}
        </StatCard>

        <StatCard stat="hearts" value={hearts} delay={180}
          celebrate={freshStats.has("hearts")} onCelebrated={() => onCelebrated?.("hearts")} onOpen={() => setOpenStat("hearts")}>
          {heartsWeek > 0 && (
            <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: darkMode ? "rgba(251,113,133,0.16)" : "#fff1f2", color: darkMode ? "#fda4af" : "#be123c" }}>+{heartsWeek} this week</span>
          )}
        </StatCard>

        <StatCard stat="countries" value={merged.all.length} sub={`of ${WORLD_COUNTRIES}`} delay={240}
          celebrate={freshStats.has("countries")} onCelebrated={() => onCelebrated?.("countries")} onOpen={() => setOpenStat("countries")}>
          {flags.length > 0 && (
            <div className="flex items-center gap-1">
              {flags.slice(0, 10).map((c, i) => (
                <span key={c} title={c} className={`text-[20px] leading-none ${i === 0 ? "rounded-md ring-2 ring-amber-300" : ""}`}>{FLAG_MAP[c] || "🌍"}</span>
              ))}
              {flags.length > 10 && <span className="ml-1 text-[11px] font-bold text-slate-400">+{flags.length - 10}</span>}
            </div>
          )}
        </StatCard>
      </div>

      {openStat && (
        <LevelSheet stat={openStat} best={best} countries={flags}
          value={openStat === "streak" ? run : openStat === "hearts" ? hearts : merged.all.length}
          levelValue={openStat === "streak" ? best : undefined}
          onClose={() => setOpenStat(null)} />
      )}
    </main>
  );
}
