// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// KindnessTree.jsx — the personal-growth centrepiece (v2). Kind actions "water" a tree
// that grows through many stages. Balance = real spark balance + local preview points. The
// growth is an animated inline SVG: soil → seed → stem → leaves → blossom, with a watering
// animation when points are earned.
//
// ── WHY THE SCALE CHANGED (and why it could only move one way) ───────────────────────────────
// The ladder used to top out at 10,000,000. Measured against what someone actually earns in a
// day, that is not a long climb — it is an unreachable one. A user doing something kind EVERY
// DAY without missing one needed 63 years to reach Tree of Life, and 3 years to reach Blooming.
// Seven of the seventeen stages could not be reached in a lifetime, and the stage list showed
// them all, with their prices on.
//
// A ladder whose top half is decoration does the opposite of what it is for. The middle sagged
// too: past the first fortnight, advancement slowed to once every few months, which is where
// people quietly stop caring.
//
// The scale below puts the summit at roughly 5 months of devoted use, a year of regular use, or
// three years of occasional use, with a step every two to four weeks through the first year.
//
// THE DIRECTION MATTERS. Every new threshold is at or BELOW its old value, so the change can
// only ever move somebody UP — a tester on 30,000 goes from Leafing to First blossom. That is
// deliberate: docs/v2-roadmap.md says "never devalue testers' balances", so the fix had to be
// lowering the bar rather than raising what actions pay. scripts/check-tree.cjs asserts it.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Droplets } from "lucide-react";
import { getPoints } from "./points";
import { playWatering } from "./sounds";

export const TREE_STAGES = [
  { min: 0,       name: "Seed",          blurb: "Every forest starts exactly here." },
  { min: 200,     name: "Sprouting",     blurb: "Something is stirring beneath the soil." },
  { min: 500,     name: "Sprout",        blurb: "First green — your kindness broke the surface." },
  { min: 1100,    name: "Seedling",      blurb: "Small, steady, and quietly growing." },
  { min: 2100,    name: "Sapling",       blurb: "Standing a little taller each day." },
  { min: 3700,    name: "Rooted",        blurb: "Roots deep enough to hold firm." },
  { min: 6000,    name: "Young tree",    blurb: "Strong enough to give a little shade." },
  { min: 9200,    name: "Leafing",       blurb: "Leaves unfurling, one by one." },
  { min: 13500,   name: "In leaf",       blurb: "Full and green — people notice." },
  { min: 19500,   name: "Budding",       blurb: "The first buds are forming." },
  { min: 27500,   name: "First blossom", blurb: "Your kindness is beginning to flower." },
  { min: 38000,   name: "Blooming",      blurb: "In full, glorious bloom." },
  { min: 52000,   name: "Full bloom",    blurb: "Fifty thousand drops of kindness." },
  { min: 71000,   name: "Flourishing",   blurb: "Thriving, and giving back to the world." },
  { min: 96000,   name: "Grand tree",    blurb: "A landmark of kindness." },
  { min: 150000,  name: "Ancient tree",  blurb: "Weathered, wise, and wonderful." },
  { min: 250000,  name: "Tree of Life",  blurb: "A tree others rest beneath. 🌍" },
];

export function treeStageFor(balance) {
  return TREE_STAGES.reduce((s, t) => (balance >= t.min ? t : s), TREE_STAGES[0]);
}

// How long one full pour runs, start to finish. Single source of truth: every place that
// flips `watering` on must clear it after exactly this, or the visual cuts off mid-pour.
export const WATERING_MS = 7000;

// Sky palette by time of day — the scene should feel like it belongs to the moment
// the user opened it. [top, bottom].
export function skyFor(hour = new Date().getHours(), darkMode = false) {
  // In dark mode the scene is always night, whatever the clock says — a daylight sky
  // inside an otherwise dark app is a bright rectangle, and it was what made the stage
  // name unreadable (near-white text remapped onto a pale gradient).
  if (darkMode) return { sky: ["#0b1120", "#111a2b"], sun: null, night: true, label: "night" };
  if (hour < 5)  return { sky: ["#1e293b", "#334155"], sun: null,      night: true,  label: "night" };
  if (hour < 8)  return { sky: ["#fed7aa", "#fef3c7"], sun: "#fbbf24", night: false, label: "dawn" };
  if (hour < 17) return { sky: ["#e0f2fe", "#FFF1F0"], sun: "#fde68a", night: false, label: "day" };
  if (hour < 20) return { sky: ["#fecaca", "#fed7aa"], sun: "#fb923c", night: false, label: "dusk" };
  return { sky: ["#312e81", "#1e293b"], sun: null, night: true, label: "night" };
}

// Owns one pour at a time. Awards can arrive back-to-back in a single tick — completing the
// last daily Practice fires `practice` and `practiceAll` together — so a second trigger
// mid-pour is coalesced rather than restarting: the tree still grows underneath, which reads
// as the water working. Without this the first timeout would also cut the second pour short.
export function useWatering(autoStart = false) {
  const [watering, setWatering] = useState(autoStart);
  const timer = useRef(0);

  const startPour = useCallback(() => {
    if (timer.current) return; // already pouring — let it finish
    setWatering(true);
    try { playWatering(WATERING_MS); } catch { /* ignore */ }
    timer.current = setTimeout(() => { timer.current = 0; setWatering(false); }, WATERING_MS);
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    timer.current = setTimeout(() => { timer.current = 0; setWatering(false); }, WATERING_MS);
    try { playWatering(WATERING_MS); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return { watering, startPour };
}

// ── the animated SVG growth scene ─────────────────────────────────────────────
// `growth` (0..1) overrides stageIdx for smooth continuous animation — used by the
// grow-from-seed replay. `ambient` adds drifting motes, a time-of-day sky and
// butterflies. `watering` plays the full pour → soak → push-up sequence.
// The can is drawn upright and rotated by the keyframe. The rose therefore MOVES during the
// tilt, so droplets must spawn where it ends up — not where it's drawn. Rotating the local
// rose centre (68, 42) by POUR_DEG about the pivot (30, 44) lands it here.
const CAN_PIVOT = { x: 30, y: 44 };
const ROSE_LOCAL = { x: 68, y: 42 };
const POUR_DEG = 34;
const ROSE = (() => {
  const r = (POUR_DEG * Math.PI) / 180;
  const dx = ROSE_LOCAL.x - CAN_PIVOT.x, dy = ROSE_LOCAL.y - CAN_PIVOT.y;
  return {
    x: +(CAN_PIVOT.x + dx * Math.cos(r) - dy * Math.sin(r)).toFixed(1),
    y: +(CAN_PIVOT.y + dx * Math.sin(r) + dy * Math.cos(r)).toFixed(1),
  };
})();

// Each droplet: horizontal drift, fall distance, duration and stagger. Durations never share
// a period, so the stream doesn't visibly loop across the ~4s pour.
const SPRAY = [
  { dx: -8, dy: 108, dur: 1.32, d: 0.00, r: 2.0 },
  { dx: -2, dy: 109, dur: 1.15, d: 0.62, r: 1.7 },
  { dx:  2, dy: 110, dur: 1.24, d: 0.18, r: 1.8 },
  { dx: 10, dy: 111, dur: 1.18, d: 0.34, r: 2.1 },
  { dx: 14, dy: 111, dur: 1.45, d: 0.72, r: 1.7 },
  { dx: 18, dy: 111, dur: 1.28, d: 0.10, r: 1.9 },
  { dx: 26, dy: 110, dur: 1.22, d: 0.46, r: 2.0 },
  { dx: 33, dy: 109, dur: 1.36, d: 0.26, r: 1.8 },
  { dx: 37, dy: 108, dur: 1.10, d: 0.54, r: 1.6 },
  { dx: 41, dy: 107, dur: 1.30, d: 0.58, r: 2.0 },
  { dx: 49, dy: 105, dur: 1.42, d: 0.38, r: 1.7 },
  { dx: 56, dy: 103, dur: 1.26, d: 0.66, r: 1.9 },
  { dx: 60, dy: 101, dur: 1.48, d: 0.14, r: 1.6 },
  { dx: 63, dy: 100, dur: 1.38, d: 0.50, r: 1.7 },
];

export function TreeScene({ stageIdx = 0, watering = false, size = 200, growth = null, ambient = false, hour, darkMode = false }) {
  const maxIdx = TREE_STAGES.length - 1;
  const eff = growth != null ? growth * maxIdx : stageIdx; // continuous stage position
  const t = Math.max(0, Math.min(1, eff / maxIdx));        // 0..1 growth
  const stemH = 8 + t * 96;
  const stemTopY = 178 - stemH;
  const canopyR = t < 0.28 ? 0 : 8 + (t - 0.28) * 78;
  const showLeaves = eff >= 2 && eff < 7;
  const showCanopy = eff >= 6;
  const showBlossom = eff >= 10;
  const showButterflies = ambient && eff >= 8;

  // ── One visible thing per late stage ────────────────────────────────────────────────────────
  // Measured before this existed: from First blossom (10) to Tree of Life (16) every stage drew
  // the SAME picture — canopy, butterflies, seven blossoms — differing only by +6px of stem and
  // +4.9px of canopy radius on a 200px canvas. About 3% per stage, across 27,500 to 250,000
  // drops, which is most of a year of use. A reward that stops varying stops being a reward, and
  // it stopped exactly where the climb gets long.
  //
  // "Budding" was the sharpest case: the stage is NAMED for buds and blurbed "The first buds are
  // forming", and blossoms started one stage later, so it drew none. It was "In leaf" plus 3%.
  //
  // ORDERED BY WHEN PEOPLE ARRIVE, NOT BY GRANDEUR. At regular use the back of the ladder lands
  // at 4.5 months (Flourishing), 6 (Grand tree), 9.6 (Ancient tree) and 16 (Tree of Life), and
  // few people are still here at six months. Saving the best drawing for stage 16 spends it on
  // almost nobody — so the bird and the fruit sit at 11 and 13, inside the first five months, and
  // the top of the ladder gets statelier rather than busier.
  //
  // The exception is the second sapling at Tree of Life. A tree that has made another tree is the
  // payoff of the whole ladder; it should be rare, and it should mean something to have got there.
  const showBuds = eff >= 9 && eff < 10;   // closed, and only at Budding — they OPEN at 10
  const blossomCount = eff >= 11 ? 16 : 7;
  const showBird = eff >= 11;
  const showPetalFall = eff >= 12;
  const showFruit = eff >= 13;
  const richCanopy = eff >= 14;
  const showSurfaceRoots = eff >= 15;
  const showSapling = eff >= 16;
  // Points around the canopy, used by buds, blossoms and fruit so they never sit on top of each
  // other. The 0.61 phase offset is what keeps fruit clear of the blossoms above it.
  const onCanopy = (i, n, radius = 0.7, phase = 0) => {
    const ang = ((i + phase) / n) * Math.PI * 2;
    return [100 + Math.cos(ang) * canopyR * radius, stemTopY + Math.sin(ang) * canopyR * radius];
  };
  const trunkW = 3 + t * 9;
  const sky = ambient ? skyFor(hour, darkMode) : null;
  // While the replay is running we drive geometry frame by frame, so CSS transitions
  // would fight it and smear the motion.
  const grow = growth != null ? "none" : "all 900ms cubic-bezier(0.34,1.2,0.64,1)";

  return (
    <svg viewBox="0 0 200 200" width={size} height={size}
      className={watering || growth != null ? "" : "seen-tree-sway"} aria-hidden="true">
      {ambient && (
        <>
          <defs>
            <linearGradient id="seenSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={sky.sky[0]} />
              <stop offset="100%" stopColor={sky.sky[1]} />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="200" height="200" fill="url(#seenSky)" rx="18" />
          {sky.sun && <circle cx="163" cy="38" r="13" fill={sky.sun} opacity="0.75" style={{ animation: "seenSunGlow 6s ease-in-out infinite" }} />}
          {sky.night && [0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={24 + i * 38} cy={22 + (i % 3) * 16} r="1.4" fill="#fff"
              style={{ animation: `seenStarTwinkle ${2.4 + i * 0.4}s ease-in-out ${i * 0.3}s infinite` }} />
          ))}
          {/* drifting motes / pollen */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={`m${i}`} cx={26 + i * 30} cy={150 - (i % 4) * 22} r={1.6} fill={sky.night ? "#e2e8f0" : "#fef9c3"} opacity="0.85"
              style={{ animation: `seenMoteDrift ${9 + i * 1.7}s linear ${i * 1.3}s infinite` }} />
          ))}
        </>
      )}

      {/* Soil mound — darkens only once the water actually lands, so it runs on the pour's
          own clock rather than flipping the instant `watering` goes true.

          The lower ellipse is deeper than the upper one (ry 16 vs 9). That difference is the
          earth the roots live in: the upper ellipse is the visible surface, the lower one the
          cross-section below it, and the root clip path uses exactly these lower-ellipse
          numbers — change one and you must change the other. Before roots existed both were
          shallow and the mound read as a flat disc, which is the "unfinished" edge the
          review picked up on. */}
      <ellipse cx="100" cy="183" rx="54" ry="16" fill="#8b5e34"
        style={watering ? { "--soil": "#8b5e34", "--wet": "#553019", animation: `seenSoilSoak ${WATERING_MS}ms ease both` } : undefined} />
      <ellipse cx="100" cy="180" rx="52" ry="9" fill="#a06a3c"
        style={watering ? { "--soil": "#a06a3c", "--wet": "#6b4423", animation: `seenSoilSoak ${WATERING_MS}ms ease both` } : undefined} />

      {/* ── Roots ──────────────────────────────────────────────────────────────
          "For strong growth you need a strong base" — so the root system is driven by the
          same `t` as the canopy and thickens in step with it, from the first stem onward.

          A root is a FILLED WEDGE, not a stroke. Strokes cannot taper, and the first attempt
          at this drew strokes: the result was a starburst of even-width spokes radiating from
          one point, which read as a scratch in the soil rather than as roots. Each root now
          runs from a wide base to a point, leaves the trunk from a slightly different spot
          along the base, and curves as it goes.

          Two other deliberate choices:
          · Drawn OUTSIDE the drink group below. The plant lifts as it takes water; roots are
            anchored in the earth, and lifting them too would look like the tree hopping out
            of the ground.
          · Clipped to the soil ellipse, so no matter how the numbers are tuned a root can
            never poke out of the mound. Depths are set to finish just inside that boundary
            anyway — a root cut flat by the clip looks like a mistake, so the clip is a
            backstop rather than the mechanism. */}
      {eff >= 1 && (() => {
        const depth = 8 + t * 13;    // vertical reach of the deepest root
        const spread = 5 + t * 19;   // horizontal reach of the widest lateral
        const w = 1.6 + t * 4.0;     // half-width where the taproot meets the trunk
        const Y = 176;               // just under the surface, so roots emerge from the soil
        // Wedge: down one side of a quadratic to the tip, back up the other. The control
        // point is pulled in on the way out and pushed out on the way back, which is what
        // gives the taper its slight belly rather than a straight cone.
        const wedge = (x0, y0, cx, cy, x1, y1, hw) =>
          `M ${x0 - hw} ${y0} Q ${cx - hw * 0.35} ${cy} ${x1} ${y1} Q ${cx + hw * 0.35} ${cy} ${x0 + hw} ${y0} Z`;
        return (
          <g clipPath="url(#seenSoilClip)" style={{ transition: grow }}>
            <defs>
              <clipPath id="seenSoilClip">
                <ellipse cx="100" cy="183" rx="54" ry="16" />
              </clipPath>
            </defs>
            {/* Taproot — a half-pixel off centre so it isn't hidden dead behind the trunk. */}
            <path d={wedge(100, Y, 101, Y + depth * 0.6, 100.5, Y + depth, w * 0.95)}
              fill="#C98A52" opacity="0.9" />
            {[-1, 1].map((dir) => (
              <g key={dir}>
                {/* Outer lateral: the long one, bowing down as it reaches out. */}
                <path d={wedge(100 + dir * w * 0.9, Y + 1,
                  100 + dir * spread * 0.5, Y + depth * 0.35,
                  100 + dir * spread, Y + depth * 0.9, w * 0.75)}
                  fill="#C98A52" opacity="0.85" />
                {/* Inner lateral: steeper and shorter, so the pair never runs parallel. */}
                <path d={wedge(100 + dir * w * 0.3, Y + 2,
                  100 + dir * spread * 0.15, Y + depth * 0.6,
                  100 + dir * spread * 0.45, Y + depth * 0.95, w * 0.5)}
                  fill="#B87A45" opacity="0.85" />
                {/* A branchlet off the outer lateral, once there's a tree worth supporting. */}
                {t > 0.45 && (
                  <path d={wedge(100 + dir * spread * 0.62, Y + depth * 0.55,
                    100 + dir * spread * 0.95, Y + depth * 0.5,
                    100 + dir * spread * 1.25, Y + depth * 0.45, w * 0.28)}
                    fill="#D9A066" opacity="0.75" />
                )}
              </g>
            ))}
          </g>
        );
      })()}

      {/* the whole plant lifts a touch as it drinks — two gentle gulps, same clock */}
      <g style={{
        transformOrigin: "100px 182px",
        ...(watering
          ? { animation: `seenPlantDrink ${WATERING_MS}ms ease both` }
          : { transform: "scale(1)", transition: "transform 900ms cubic-bezier(0.34,1.4,0.64,1)" }),
      }}>
        {/* seed (early) */}
        {eff <= 1 && <ellipse cx="100" cy="176" rx="7" ry="9" fill="#6b4423" style={{ transformOrigin: "100px 176px", animation: eff >= 0.5 ? "seenSeedCrack 1.6s ease-in-out infinite" : "none" }} />}

        {/* trunk / stem */}
        {eff >= 1 && (
          <rect x={100 - trunkW / 2} y={stemTopY} width={trunkW} height={stemH} rx={trunkW / 2}
            fill={eff >= 6 ? "#7a5230" : "#3f9d4f"} style={{ transition: grow }} />
        )}

        {/* young leaves along the stem */}
        {showLeaves && [0.4, 0.68].map((f, i) => (
          <g key={i} style={{ transformOrigin: `100px ${stemTopY + stemH * f}px`, animation: "seenLeafPop 700ms ease both", animationDelay: `${i * 120}ms` }}>
            <ellipse cx={100 - 10} cy={stemTopY + stemH * f} rx="11" ry="6" fill="#4caf50" transform={`rotate(-28 ${100 - 10} ${stemTopY + stemH * f})`} />
            <ellipse cx={100 + 10} cy={stemTopY + stemH * f - 6} rx="11" ry="6" fill="#43a047" transform={`rotate(28 ${100 + 10} ${stemTopY + stemH * f - 6})`} />
          </g>
        ))}

        {/* canopy for trees */}
        {showCanopy && (
          <g style={{ transformOrigin: `100px ${stemTopY}px`, transition: grow }}>
            {/* Grand tree — two more lobes rising above the crown. BEHIND the others, and only a
                shade deeper: drawn on top in a dark green they read as a second, darker tree
                overlapping this one, which looks like a rendering fault rather than a fuller
                canopy. Behind, they extend the silhouette upward, which is what a big old tree
                actually does. */}
            {richCanopy && (
              <>
                <circle cx={100 - canopyR * 0.34} cy={stemTopY - canopyR * 0.62} r={canopyR * 0.56} fill="#3c9349" />
                <circle cx={100 + canopyR * 0.42} cy={stemTopY - canopyR * 0.5} r={canopyR * 0.54} fill="#37883f" />
              </>
            )}
            <circle cx="100" cy={stemTopY} r={canopyR} fill="#3f9d4f" />
            <circle cx={100 - canopyR * 0.55} cy={stemTopY + canopyR * 0.15} r={canopyR * 0.7} fill="#4caf50" />
            <circle cx={100 + canopyR * 0.55} cy={stemTopY + canopyR * 0.1} r={canopyR * 0.72} fill="#43a047" />
            <circle cx="100" cy={stemTopY - canopyR * 0.4} r={canopyR * 0.7} fill="#4caf50" />
          </g>
        )}

        {/* Budding — closed buds, and nothing else. Tight, pale, unopened: the picture the
            stage's own name has been promising. They become the blossoms below at stage 10,
            which is what makes arriving there look like something happening. */}
        {showBuds && Array.from({ length: 7 }).map((_, i) => {
          const [bx, by] = onCanopy(i, 7);
          return (
            // Pink first and dominant, with only a small sepal at the foot. The first version
            // put a green base over the pink and at this scale the green won — the buds read as
            // smudges on the leaves rather than as anything about to open.
            <g key={i} style={{ transformOrigin: `${bx}px ${by}px`, animation: "seenLeafPop 600ms ease both", animationDelay: `${i * 80}ms` }}>
              <ellipse cx={bx} cy={by - 0.6} rx={2.6} ry={3.8} fill="#f4bcd0" />
              <ellipse cx={bx - 0.7} cy={by - 1.4} rx={1} ry={1.8} fill="#fbdce6" />
              <path d={`M ${bx - 2.4} ${by + 2.4} q 2.4 2 4.8 0 q -2.4 1 -4.8 0 z`} fill="#4d8c3f" />
            </g>
          );
        })}

        {/* blossoms — seven at First blossom, and the canopy fills with them at Blooming */}
        {showBlossom && Array.from({ length: blossomCount }).map((_, i) => {
          const [bx, by] = onCanopy(i, blossomCount, i % 2 ? 0.78 : 0.58);
          return <circle key={i} cx={bx} cy={by} r={3.4} fill={i % 2 ? "#f9a8d4" : "#fbcfe8"}
            style={{ animation: "seenLeafPop 600ms ease both", animationDelay: `${i * 60}ms` }} />;
        })}

        {/* Flourishing — fruit. Offset around the canopy so it hangs below the blossoms rather
            than sitting among them, and given a stem so it reads as fruit and not a berry. */}
        {showFruit && Array.from({ length: 5 }).map((_, i) => {
          const [fx, fy] = onCanopy(i, 5, 0.66, 0.61);
          return (
            <g key={i} style={{ transformOrigin: `${fx}px ${fy}px`, animation: "seenLeafPop 700ms ease both", animationDelay: `${300 + i * 90}ms` }}>
              <path d={`M ${fx} ${fy - 4.6} q 1.6 -1.4 3 -1.2`} stroke="#5b7c3a" strokeWidth="1" fill="none" strokeLinecap="round" />
              <circle cx={fx} cy={fy} r={3.1} fill="#e4572e" />
              <circle cx={fx - 0.9} cy={fy - 1} r={1} fill="#f6a192" opacity="0.8" />
            </g>
          );
        })}

        {/* butterflies visit a grown tree */}
        {showButterflies && [0, 1].map((i) => (
          <text key={i} x={i ? 44 : 148} y={i ? 96 : 74} fontSize="13"
            style={{ animation: `seenButterfly ${7 + i * 2}s ease-in-out ${i * 2.2}s infinite` }}>🦋</text>
        ))}

        {/* Blooming — a bird settles in. Placed on the canopy's upper right rather than floating,
            because a tree big enough to be nested in is the thing being said. Only animated in
            the ambient (hero) rendering; in the small stage-list swatches it simply sits. */}
        {showBird && (
          <g style={{ transformOrigin: `${100 + canopyR * 0.62}px ${stemTopY - canopyR * 0.5}px`,
            animation: ambient ? "seenButterfly 9s ease-in-out 1.4s infinite" : "none" }}>
            <ellipse cx={100 + canopyR * 0.62} cy={stemTopY - canopyR * 0.5} rx="5.4" ry="3.6" fill="#f59e0b" />
            <circle cx={100 + canopyR * 0.62 + 4.4} cy={stemTopY - canopyR * 0.5 - 2.4} r="2.6" fill="#fbbf24" />
            <path d={`M ${100 + canopyR * 0.62 + 6.6} ${stemTopY - canopyR * 0.5 - 2.6} l 3 1 l -3 1 z`} fill="#ea580c" />
            <ellipse cx={100 + canopyR * 0.62 - 1} cy={stemTopY - canopyR * 0.5} rx="3" ry="1.8" fill="#d97706" />
          </g>
        )}
      </g>

      {/* Full bloom — petals come loose and drift past. Outside the drink group so they keep
          falling while the tree lifts, and ambient-only: in a 56px stage swatch a falling petal
          is a speck crossing the frame, which reads as a rendering fault rather than as weather. */}
      {showPetalFall && ambient && [0, 1, 2, 3].map((i) => (
        <circle key={i} cx={78 + i * 15} cy={stemTopY + 6} r={2.4} fill={i % 2 ? "#f9a8d4" : "#fbcfe8"}
          style={{ "--spin": `${200 + i * 90}deg`,
            animation: `seenPetalFall ${5.5 + i * 1.3}s linear ${i * 1.7}s infinite` }} />
      ))}

      {/* Ancient tree — buttress roots break the surface. Deliberately NOT inside the clipped
          underground group above: the whole point is that these are the ones that have pushed out
          of the soil, which is what an old tree looks like and what no younger stage shows. */}
      {showSurfaceRoots && (
        <g style={{ transition: grow }}>
          {/* Drawn as TRUNK, not as root, and clearly ABOVE the soil line. Two earlier attempts
              failed the same way: a root-coloured wedge sitting inside the mound merged straight
              into the fan of underground roots already drawn there, and Grand tree and Ancient
              tree were indistinguishable side by side. A buttress is the trunk flaring out as it
              meets the ground — same bark, silhouetted against the mound's edge — which is both
              what an old tree looks like and the one shape no younger stage draws. */}
          {[-1, 1].map((dir) => (
            <g key={dir}>
              <path
                d={`M ${100 + dir * trunkW * 0.5} 156
                    Q ${100 + dir * trunkW * 0.8} 170 ${100 + dir * 21} 177
                    L ${100 + dir * trunkW * 0.5} 177 Z`}
                fill="#7a5230" />
              <path
                d={`M ${100 + dir * trunkW * 0.5} 156
                    Q ${100 + dir * trunkW * 0.8} 170 ${100 + dir * 21} 177`}
                fill="none" stroke="#5f3f24" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
            </g>
          ))}
        </g>
      )}

      {/* Tree of Life — a second sapling, at the foot of the first. The top of the ladder, and
          the only stage that adds another plant rather than another detail: a tree that has made
          a tree is the whole idea of the thing, and it is worth sixteen months to arrive at. */}
      {showSapling && (
        <g style={{ transformOrigin: "142px 178px", animation: "seenLeafPop 900ms ease both", animationDelay: "500ms" }}>
          <rect x="141" y="160" width="2.6" height="18" rx="1.3" fill="#4d8c3f" />
          <ellipse cx="136" cy="163" rx="7" ry="3.8" fill="#4caf50" transform="rotate(-26 136 163)" />
          <ellipse cx="149" cy="159" rx="7" ry="3.8" fill="#43a047" transform="rotate(26 149 159)" />
          <ellipse cx="137" cy="170" rx="5.6" ry="3.2" fill="#43a047" transform="rotate(-22 137 170)" />
        </g>
      )}

      {/* Watering — a can leans in from the top left, its rose sprays a fan of fine
          droplets over the soil, then it rights itself and leaves. One-shot over
          WATERING_MS; re-triggers mid-pour are coalesced by useWatering. */}
      {watering && (
        <g>
          {/* The can — drawn upright, tilted by the keyframe about CAN_PIVOT. */}
          <g style={{ transformBox: "view-box", transformOrigin: `${CAN_PIVOT.x}px ${CAN_PIVOT.y}px`,
            animation: `seenCanPour ${WATERING_MS}ms both` }}>
            <path d="M15 20 Q30 2 45 20" fill="none" stroke="#38bdf8" strokeWidth="3.2" strokeLinecap="round" />
            <rect x="9" y="18" width="42" height="27" rx="6" fill="#7dd3fc" />
            <path d="M30 18 h21 v27 h-21 z" fill="#38bdf8" opacity="0.45" />
            <rect x="7" y="15" width="46" height="6" rx="3" fill="#38bdf8" />
            {/* spout out to the rose */}
            <path d="M50 27 Q61 30 67 39" fill="none" stroke="#0ea5e9" strokeWidth="6" strokeLinecap="round" />
            <path d="M50 27 Q61 30 67 39" fill="none" stroke="#7dd3fc" strokeWidth="2.6" strokeLinecap="round" />
            {/* rose / shower head, angled across the spout */}
            <g transform={`rotate(-48 ${ROSE_LOCAL.x} ${ROSE_LOCAL.y})`}>
              <ellipse cx={ROSE_LOCAL.x} cy={ROSE_LOCAL.y + 1.4} rx="8.6" ry="5" fill="#0284c7" />
              <ellipse cx={ROSE_LOCAL.x} cy={ROSE_LOCAL.y} rx="8.6" ry="5" fill="#38bdf8" />
              {[-5, -2.5, 0, 2.5, 5].map((d) => (
                <circle key={d} cx={ROSE_LOCAL.x + d} cy={ROSE_LOCAL.y + 1.6} r="0.85" fill="#075985" opacity="0.8" />
              ))}
            </g>
            <path d="M14 24 Q15.5 33 17 42" fill="none" stroke="#e0f2fe" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
          </g>

          {/* The spray. Drawn OUTSIDE the can group so it isn't dragged by the tilt, at the
              point the rose actually reaches. The window group bounds the looping droplets
              to the pour phase, so individual drops never need to be in phase with anything. */}
          <g style={{ animation: `seenSprayWindow ${WATERING_MS}ms linear both` }}>
            {/* short jets right at the rose, so the shower head reads as pouring even
                before the individual droplets have travelled anywhere */}
            {[-9, 0, 9, 18].map((a, i) => (
              <path key={a} d={`M${ROSE.x} ${ROSE.y} q ${4 + a * 0.35} 9 ${8 + a * 0.7} 19`}
                fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" opacity="0.75"
                style={{ animation: `seenJet 0.75s ease-in-out ${i * 0.12}s infinite` }} />
            ))}
            {SPRAY.map((s, i) => (
              <g key={i} style={{ "--dx": `${s.dx}px`, animation: `seenSprayX ${s.dur}s linear ${s.d}s infinite` }}>
                <ellipse cx={ROSE.x} cy={ROSE.y} rx={s.r} ry={s.r * 1.8} fill="#0ea5e9"
                  style={{ "--dy": `${s.dy}px`, animation: `seenSprayY ${s.dur}s cubic-bezier(0.42,0,0.9,0.55) ${s.d}s infinite` }} />
              </g>
            ))}
            {/* little splashes where the fan lands */}
            {[70, 92, 112, 130].map((x, i) => (
              <path key={x} d={`M${x - 4} 174 Q${x} 168 ${x + 4} 174`} fill="none" stroke="#7dd3fc"
                strokeWidth="1.5" strokeLinecap="round"
                style={{ animation: `seenSplash 0.9s ease-out ${1.1 + i * 0.19}s infinite` }} />
            ))}
          </g>
        </g>
      )}
    </svg>
  );
}

export default function KindnessTreePanel({ sparkBalance = 0, darkMode = false, onClose, autoWater = false }) {
  const [localPts, setLocalPts] = useState(() => getPoints());
  const { watering, startPour } = useWatering(true); // always pour on open — this panel IS "tend your tree"
  useEffect(() => {
    const onPts = () => { setLocalPts(getPoints()); startPour(); };
    window.addEventListener("seen-points", onPts);
    return () => window.removeEventListener("seen-points", onPts);
  }, [startPour]);

  const balance = sparkBalance + localPts;
  const stage = treeStageFor(balance);
  const stageIdx = TREE_STAGES.indexOf(stage);
  const next = TREE_STAGES[stageIdx + 1] ?? null;
  const pct = next ? Math.max(0, Math.min(100, Math.round(((balance - stage.min) / (next.min - stage.min)) * 100))) : 100;

  return createPortal(
    <div data-portal {...(darkMode ? { "data-dark-shell": "" } : {})}
      className="fixed inset-0 z-[250] flex flex-col" style={{ background: darkMode ? "#0e1219" : "#fff" }}>
      <div className="seen-overlay-header flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0 bg-white">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-1">🌳 Your Kindness Tree</h2>
        <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="seen-grad-hero rounded-3xl border border-teal-100 bg-gradient-to-b from-sky-50 to-teal-50 px-4 pt-4 pb-5 text-center overflow-hidden">
          <div className="mx-auto" style={{ width: 200, height: 200 }}><TreeScene stageIdx={stageIdx} watering={watering} darkMode={darkMode} /></div>
          <p className="mt-1 text-lg font-bold text-slate-800">{stage.name}</p>
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
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-start gap-3">
          <span className="mt-0.5 text-teal-500"><Droplets size={18} /></span>
          <p className="text-[12px] text-slate-600 leading-relaxed">
            Every kind action — a message, a real-life kindness, a reflection, a heart —
            <strong className="text-slate-800"> waters your tree</strong>. Watch it grow.
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Growth stages</p>
          <div className="space-y-1">
            {TREE_STAGES.map((s) => {
              const achieved = balance >= s.min;
              const current = s === stage;
              return (
                <div key={s.name}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${current ? "border-teal-300 bg-teal-50" : achieved ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"}`}>
                  <span className="text-xs w-6 text-center" style={{ opacity: achieved ? 1 : 0.4 }}>{achieved ? "🌿" : "•"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${achieved ? "text-slate-800" : "text-slate-400"}`}>
                      {s.name}{current && <span className="ml-1.5 text-[10px] font-bold text-teal-700">· you are here</span>}
                    </p>
                    <p className="text-[10px] text-slate-400">{s.min.toLocaleString()}+ drops</p>
                  </div>
                  {achieved && !current && <span className="text-teal-500 text-xs">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
        <p className="pb-6 text-center text-[10px] text-slate-400">One day, a fully grown tree may plant a real one. 🌍</p>
      </div>
    </div>,
    document.body
  );
}
